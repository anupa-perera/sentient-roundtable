"""Unit tests for roundtable orchestration edge cases."""

from types import SimpleNamespace

import pytest

pytest.importorskip("pydantic_settings")

from app.core.orchestrator import RoundtableOrchestrator
from app.models.session import SessionConfig
from app.models.types import AuthMode, Phase


class _FakeStore:
    """Minimal store stub covering methods used during _run_rounds tests."""

    def __init__(self) -> None:
        self.saved_rounds: list[dict] = []
        self.transitions: list[Phase] = []

    async def transition_phase(self, session_id: str, phase: Phase) -> None:
        self.transitions.append(phase)

    async def update_state(self, session_id: str, **kwargs) -> None:
        return None

    async def save_round(
        self,
        *,
        session_id: str,
        round_number: int,
        responses,
        summary: str,
    ) -> None:
        self.saved_rounds.append(
            {
                "session_id": session_id,
                "round_number": round_number,
                "responses": responses,
                "summary": summary,
            }
        )


class _FakeOpenRouter:
    """OpenRouter stub returning empty stream output for one model."""

    async def chat_completion_stream(
        self,
        *,
        api_key: str,
        model: str,
        system_prompt: str,
        user_message: str,
        on_token,
        max_tokens: int,
        temperature: float,
    ) -> str:
        if model == "m-empty":
            return "   "
        await on_token("ok")
        return "ok"

    async def chat_completion(
        self,
        *,
        api_key: str,
        model: str,
        system_prompt: str,
        user_message: str,
        max_tokens: int,
        temperature: float,
    ) -> str:
        return "host summary"


class _FakeKeyStore:
    """No-op key store stub."""

    async def get_key(self, session_id: str) -> str:
        return ""

    async def delete_key(self, session_id: str) -> None:
        return None


@pytest.mark.asyncio
async def test_empty_stream_response_uses_refusal_fallback() -> None:
    """Empty stream outputs should emit recoverable error and refusal text."""
    store = _FakeStore()
    orchestrator = RoundtableOrchestrator(
        store=store,
        openrouter=_FakeOpenRouter(),
        key_store=_FakeKeyStore(),
        settings=SimpleNamespace(openrouter_api_key="sys-key"),
    )
    config = SessionConfig(
        question="What tradeoffs matter most for production readiness?",
        models=["m-empty", "m-ok"],
        host_model="host",
        rounds=1,
        auth_mode=AuthMode.SYSTEM,
    )
    emitted_events: list[tuple[str, dict]] = []

    async def emit_event(name: str, data: dict) -> None:
        emitted_events.append((name, data))

    await orchestrator._run_rounds("session-1", config, emit_event)

    turn_events = [data for name, data in emitted_events if name == "turn_complete"]
    assert turn_events[0]["model"] == "m-empty"
    assert turn_events[0]["response"] == "i refused to take part this round"

    error_events = [data for name, data in emitted_events if name == "error"]
    assert any(
        "returned an empty response" in data.get("message", "")
        and data.get("model") == "m-empty"
        and data.get("recoverable") is True
        for data in error_events
    )
