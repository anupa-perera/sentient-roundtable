import json
from datetime import datetime, timezone

from redis.asyncio import Redis

from app.models.round import ModelResponse, RoundData
from app.models.session import SessionConfig, SessionState
from app.models.types import Phase
from app.models.vote import ModelVotes


ALLOWED_PHASE_TRANSITIONS: dict[Phase, set[Phase]] = {
    Phase.SETUP: {Phase.RUNNING},
    Phase.RUNNING: {Phase.VOTING},
    Phase.VOTING: {Phase.SYNTHESIS},
    Phase.SYNTHESIS: {Phase.COMPLETE},
    Phase.COMPLETE: set(),
}


class RedisStore:
    """Redis data-access layer for session state, rounds, votes, and SSE events."""

    MODEL_CACHE_KEY = "models:openrouter:system:catalog"

    def __init__(self, redis: Redis, session_ttl_seconds: int, model_cache_ttl_seconds: int) -> None:
        self.redis = redis
        self.session_ttl_seconds = session_ttl_seconds
        self.model_cache_ttl_seconds = model_cache_ttl_seconds

    def _session_prefix(self, session_id: str) -> str:
        return f"session:{session_id}"

    def _config_key(self, session_id: str) -> str:
        return f"{self._session_prefix(session_id)}:config"

    def _state_key(self, session_id: str) -> str:
        return f"{self._session_prefix(session_id)}:state"

    def _round_key(self, session_id: str, round_num: int) -> str:
        return f"{self._session_prefix(session_id)}:round:{round_num}"

    def _votes_key(self, session_id: str) -> str:
        return f"{self._session_prefix(session_id)}:votes"

    def _findings_key(self, session_id: str) -> str:
        return f"{self._session_prefix(session_id)}:findings"

    def _events_key(self, session_id: str) -> str:
        return f"{self._session_prefix(session_id)}:events"

    def _run_lock_key(self, session_id: str) -> str:
        return f"{self._session_prefix(session_id)}:run_lock"

    async def create_session(self, session_id: str, config: SessionConfig) -> None:
        """Create initial session config/state records with TTL."""
        state = SessionState(session_id=session_id)
        pipeline = self.redis.pipeline()
        pipeline.set(self._config_key(session_id), config.model_dump_json())
        pipeline.expire(self._config_key(session_id), self.session_ttl_seconds)
        pipeline.set(self._state_key(session_id), state.model_dump_json())
        pipeline.expire(self._state_key(session_id), self.session_ttl_seconds)
        pipeline.set(self._votes_key(session_id), json.dumps([]))
        pipeline.expire(self._votes_key(session_id), self.session_ttl_seconds)
        pipeline.delete(self._findings_key(session_id))
        pipeline.delete(self._events_key(session_id))
        await pipeline.execute()

    async def session_exists(self, session_id: str) -> bool:
        """Check whether a session config key exists."""
        return bool(await self.redis.exists(self._config_key(session_id)))

    async def get_session_config(self, session_id: str) -> SessionConfig:
        """Load stored session config."""
        raw = await self.redis.get(self._config_key(session_id))
        if not raw:
            raise KeyError(f"Session {session_id} config not found.")
        return SessionConfig.model_validate_json(raw)

    async def get_session_state(self, session_id: str) -> SessionState:
        """Load mutable state snapshot for a session."""
        raw = await self.redis.get(self._state_key(session_id))
        if not raw:
            raise KeyError(f"Session {session_id} state not found.")
        return SessionState.model_validate_json(raw)

    async def save_session_state(self, session_id: str, state: SessionState) -> None:
        """Persist state snapshot and refresh TTL."""
        await self.redis.set(self._state_key(session_id), state.model_dump_json(), ex=self.session_ttl_seconds)

    async def update_state(self, session_id: str, **updates: object) -> SessionState:
        """Patch and persist selected state fields."""
        state = await self.get_session_state(session_id)
        payload = state.model_dump()
        payload.update(updates)
        next_state = SessionState.model_validate(payload)
        await self.save_session_state(session_id, next_state)
        return next_state

    async def transition_phase(self, session_id: str, target_phase: Phase) -> SessionState:
        """Transition phase with forward-only validation."""
        state = await self.get_session_state(session_id)
        if target_phase != state.phase and target_phase not in ALLOWED_PHASE_TRANSITIONS[state.phase]:
            raise ValueError(f"Invalid phase transition from {state.phase} to {target_phase}")
        payload = state.model_dump()
        payload["phase"] = target_phase
        if target_phase == Phase.COMPLETE:
            payload["completed_at"] = datetime.now(timezone.utc)
            payload["active_speaker"] = None
        next_state = SessionState.model_validate(payload)
        await self.save_session_state(session_id, next_state)
        return next_state

    async def save_round(
        self,
        session_id: str,
        round_number: int,
        responses: list[ModelResponse],
        summary: str,
    ) -> None:
        """Persist one completed round payload."""
        round_data = RoundData(round_number=round_number, responses=responses, summary=summary)
        await self.redis.set(
            self._round_key(session_id, round_number),
            round_data.model_dump_json(),
            ex=self.session_ttl_seconds,
        )

    async def list_rounds(self, session_id: str) -> list[RoundData]:
        """Load all round records sorted by round number."""
        keys: list[str] = []
        async for key in self.redis.scan_iter(match=f"{self._session_prefix(session_id)}:round:*"):
            keys.append(key)
        ordered: list[RoundData] = []
        for key in sorted(keys, key=lambda value: int(value.rsplit(":", 1)[1])):
            raw = await self.redis.get(key)
            if raw:
                ordered.append(RoundData.model_validate_json(raw))
        return ordered

    async def append_votes(self, session_id: str, model_votes: ModelVotes) -> None:
        """Append one voter's score set."""
        existing = await self.get_votes(session_id)
        existing.append(model_votes)
        payload = json.dumps([entry.model_dump() for entry in existing])
        await self.redis.set(self._votes_key(session_id), payload, ex=self.session_ttl_seconds)

    async def get_votes(self, session_id: str) -> list[ModelVotes]:
        """Load all stored vote sets for a session."""
        raw = await self.redis.get(self._votes_key(session_id))
        if not raw:
            return []
        data = json.loads(raw)
        return [ModelVotes.model_validate(entry) for entry in data]

    async def set_findings(self, session_id: str, findings: str) -> None:
        """Store synthesized findings document."""
        await self.redis.set(self._findings_key(session_id), findings, ex=self.session_ttl_seconds)

    async def get_findings(self, session_id: str) -> str | None:
        """Fetch findings document, if synthesis is complete."""
        findings = await self.redis.get(self._findings_key(session_id))
        if findings is None:
            return None
        return str(findings)

    async def acquire_run_lock(self, session_id: str) -> bool:
        """Acquire a per-session run lock to prevent duplicate orchestrations."""
        return bool(
            await self.redis.set(
                self._run_lock_key(session_id),
                "1",
                ex=self.session_ttl_seconds,
                nx=True,
            )
        )

    async def append_event(self, session_id: str, event_name: str, data: dict) -> str:
        """Write an SSE event into Redis stream and return generated stream ID."""
        event_id = await self.redis.xadd(
            self._events_key(session_id),
            fields={"event": event_name, "data": json.dumps(data)},
            maxlen=5000,
            approximate=True,
        )
        await self.redis.expire(self._events_key(session_id), self.session_ttl_seconds)
        return str(event_id)

    async def read_events(
        self,
        session_id: str,
        after_event_id: str,
        *,
        count: int = 100,
        block_ms: int = 1000,
    ) -> list[tuple[str, str, str]]:
        """Read stream entries after a given event ID for replay/tailing."""
        streams = await self.redis.xread(
            streams={self._events_key(session_id): after_event_id},
            count=count,
            block=block_ms,
        )
        output: list[tuple[str, str, str]] = []
        for _, entries in streams:
            for event_id, fields in entries:
                event_name = str(fields.get("event", "message"))
                data_json = str(fields.get("data", "{}"))
                output.append((str(event_id), event_name, data_json))
        return output

    async def get_cached_system_models(self) -> list[dict] | None:
        """Read cached system catalog from Redis."""
        raw = await self.redis.get(self.MODEL_CACHE_KEY)
        if not raw:
            return None
        data = json.loads(raw)
        if not isinstance(data, list):
            return None
        return data

    async def set_cached_system_models(self, catalog: list[dict]) -> None:
        """Store system model catalog with independent cache TTL."""
        await self.redis.set(
            self.MODEL_CACHE_KEY,
            json.dumps(catalog),
            ex=self.model_cache_ttl_seconds,
        )
