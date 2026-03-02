from collections.abc import Awaitable, Callable

from app.config import Settings
from app.core.synthesizer import build_synthesis_input, fallback_findings
from app.core.turn_manager import (
    build_turn_context,
    fallback_round_summary,
    format_round_for_host,
    get_speaking_order,
)
from app.core.voter import parse_votes_response
from app.models.round import ModelResponse
from app.models.session import SessionConfig
from app.models.types import AuthMode, Phase
from app.prompts import (
    build_host_prompt,
    build_panelist_prompt,
    build_synthesis_prompt,
    build_voter_prompt,
)
from app.services.key_store import EphemeralKeyStore
from app.services.openrouter import OpenRouterClient
from app.services.redis_store import RedisStore


EventEmitter = Callable[[str, dict], Awaitable[None]]


class RoundtableOrchestrator:
    """Coordinate full fixed-round session lifecycle and emit SSE events."""

    def __init__(
        self,
        *,
        store: RedisStore,
        openrouter: OpenRouterClient,
        key_store: EphemeralKeyStore,
        settings: Settings,
    ) -> None:
        self.store = store
        self.openrouter = openrouter
        self.key_store = key_store
        self.settings = settings

    async def run(self, session_id: str, emit_event: EventEmitter) -> None:
        """Run all phases for a session and always clear any BYOK key afterward."""
        config = await self.store.get_session_config(session_id)
        try:
            await self._run_rounds(session_id, config, emit_event)
            await self._run_voting(session_id, config, emit_event)
            await self._run_synthesis(session_id, config, emit_event)
            await self.store.transition_phase(session_id, Phase.COMPLETE)
            await self.store.update_state(session_id, active_speaker=None, speaking_order=[])
            await emit_event("complete", {"session_id": session_id, "email_sent": False})
        finally:
            await self.key_store.delete_key(session_id)

    async def _run_rounds(
        self,
        session_id: str,
        config: SessionConfig,
        emit_event: EventEmitter,
    ) -> None:
        """Execute exact user-configured rounds with rotating sequential speaker order."""
        await self.store.transition_phase(session_id, Phase.RUNNING)
        prior_summary = ""
        for round_num in range(1, config.rounds + 1):
            order = get_speaking_order(config.models, round_num)
            round_responses: list[ModelResponse] = []
            for idx, model_id in enumerate(order):
                await self.store.update_state(
                    session_id,
                    current_round=round_num,
                    active_speaker=model_id,
                    speaking_order=order,
                )
                await emit_event(
                    "status",
                    {
                        "phase": Phase.RUNNING.value,
                        "round": round_num,
                        "speaker": model_id,
                        "speaking_order_position": idx + 1,
                    },
                )
                context = build_turn_context(
                    question=config.question,
                    prior_summary=prior_summary,
                    earlier_responses=round_responses,
                    round_num=round_num,
                    total_rounds=config.rounds,
                )
                panelist_prompt = build_panelist_prompt(
                    model_name=model_id,
                    question=config.question,
                    round_num=round_num,
                    total_rounds=config.rounds,
                )
                api_key = await self._resolve_api_key(config, session_id)
                try:
                    response_text = await self.openrouter.chat_completion_stream(
                        api_key=api_key,
                        model=model_id,
                        system_prompt=panelist_prompt,
                        user_message=context,
                        max_tokens=1000,
                        temperature=0.8,
                        on_token=lambda token, active_model=model_id: emit_event(
                            "token", {"model": active_model, "text": token}
                        ),
                    )
                except Exception as exc:
                    response_text = f"[Model {model_id} refused to participate in this round.]"
                    await emit_event(
                        "error",
                        {
                            "message": f"Model call failed for {model_id}: {exc}",
                            "recoverable": True,
                            "model": model_id,
                        },
                    )
                response = ModelResponse(model_id=model_id, model_name=model_id, response=response_text)
                round_responses.append(response)
                await emit_event(
                    "turn_complete",
                    {
                        "round": round_num,
                        "model": model_id,
                        "response": response_text,
                    },
                )
            await self.store.update_state(session_id, active_speaker=config.host_model)
            try:
                api_key = await self._resolve_api_key(config, session_id)
                summary = await self.openrouter.chat_completion(
                    api_key=api_key,
                    model=config.host_model,
                    system_prompt=build_host_prompt(config.question, round_num, config.rounds),
                    user_message=format_round_for_host(round_responses),
                    max_tokens=800,
                    temperature=0.3,
                )
            except Exception as exc:
                summary = fallback_round_summary(round_responses)
                await emit_event(
                    "error",
                    {
                        "message": f"Host summary failed in round {round_num}: {exc}",
                        "recoverable": True,
                        "model": config.host_model,
                    },
                )
            await self.store.save_round(
                session_id=session_id,
                round_number=round_num,
                responses=round_responses,
                summary=summary,
            )
            await emit_event("summary", {"round": round_num, "summary": summary})
            prior_summary = summary

    async def _run_voting(
        self,
        session_id: str,
        config: SessionConfig,
        emit_event: EventEmitter,
    ) -> None:
        """Collect factual-accuracy votes from each panel model against peers."""
        await self.store.transition_phase(session_id, Phase.VOTING)
        await self.store.update_state(session_id, active_speaker=None, speaking_order=[])
        await emit_event(
            "status",
            {
                "phase": Phase.VOTING.value,
                "round": config.rounds,
                "speaker": None,
                "speaking_order_position": None,
            },
        )
        rounds = await self.store.list_rounds(session_id)
        voting_context = "\n\n".join(
            [
                f"Round {round_data.round_number} summary:\n{round_data.summary}"
                for round_data in rounds
            ]
        )
        for voter in config.models:
            try:
                api_key = await self._resolve_api_key(config, session_id)
                raw_votes = await self.openrouter.chat_completion(
                    api_key=api_key,
                    model=voter,
                    system_prompt=build_voter_prompt(voter, config.question),
                    user_message=voting_context,
                    max_tokens=300,
                    temperature=0.3,
                )
                parsed_votes = parse_votes_response(raw_votes, voter, config.models)
                if parsed_votes.votes:
                    await self.store.append_votes(session_id, parsed_votes)
                    await emit_event("vote", parsed_votes.model_dump())
            except Exception as exc:
                await emit_event(
                    "error",
                    {
                        "message": f"Voting failed for {voter}: {exc}",
                        "recoverable": True,
                        "model": voter,
                    },
                )

    async def _run_synthesis(
        self,
        session_id: str,
        config: SessionConfig,
        emit_event: EventEmitter,
    ) -> None:
        """Generate final findings document from rounds and votes."""
        await self.store.transition_phase(session_id, Phase.SYNTHESIS)
        await self.store.update_state(session_id, active_speaker=config.host_model, speaking_order=[])
        await emit_event(
            "status",
            {
                "phase": Phase.SYNTHESIS.value,
                "round": config.rounds,
                "speaker": config.host_model,
                "speaking_order_position": 1,
            },
        )
        rounds = await self.store.list_rounds(session_id)
        votes = await self.store.get_votes(session_id)
        synthesis_input = build_synthesis_input(config.question, rounds, votes)
        try:
            api_key = await self._resolve_api_key(config, session_id)
            findings = await self.openrouter.chat_completion(
                api_key=api_key,
                model=config.host_model,
                system_prompt=build_synthesis_prompt(config.question),
                user_message=synthesis_input,
                max_tokens=2_000,
                temperature=0.3,
            )
        except Exception as exc:
            findings = fallback_findings(config.question, rounds, votes)
            await emit_event(
                "error",
                {
                    "message": f"Synthesis failed and fallback was used: {exc}",
                    "recoverable": True,
                    "model": config.host_model,
                },
            )
        await self.store.set_findings(session_id, findings)
        await emit_event("synthesis", {"document": findings})

    async def _resolve_api_key(self, config: SessionConfig, session_id: str) -> str:
        """Resolve OpenRouter key based on session auth mode."""
        if config.auth_mode == AuthMode.SYSTEM:
            if not self.settings.openrouter_api_key:
                raise RuntimeError("System OpenRouter key is not configured.")
            return self.settings.openrouter_api_key
        key = await self.key_store.get_key(session_id)
        if not key:
            raise RuntimeError("BYOK session key unavailable. Session may have expired or backend restarted.")
        return key
