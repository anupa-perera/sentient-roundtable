"""Roundtable session start and streaming endpoints."""

import asyncio
import json
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from app.config import Settings
from app.core.orchestrator import RoundtableOrchestrator
from app.deps import (
    get_key_store,
    get_openrouter,
    get_orchestrator,
    get_settings,
    get_store,
    get_task_lock,
    get_task_map,
)
from app.models.session import SessionConfig, SessionStartRequest, SessionStartResponse
from app.models.types import AuthMode, Phase
from app.services.key_store import EphemeralKeyStore
from app.services.model_catalog import normalize_models
from app.services.openrouter import OpenRouterClient
from app.services.redis_store import RedisStore

router = APIRouter(prefix="/roundtable", tags=["roundtable"])


@router.post("/start", response_model=SessionStartResponse)
async def start_roundtable(
    payload: SessionStartRequest,
    store: RedisStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
    openrouter: OpenRouterClient = Depends(get_openrouter),
    key_store: EphemeralKeyStore = Depends(get_key_store),
) -> SessionStartResponse:
    """Create a new session, validate models for selected auth mode, and persist setup state."""
    selected_models = set(payload.models + [payload.host_model])
    if payload.auth_mode == AuthMode.SYSTEM:
        if not settings.openrouter_api_key:
            raise HTTPException(status_code=500, detail="System OpenRouter key is not configured.")
        model_catalog = await _load_system_catalog(store, openrouter, settings)
        model_map = {model.id: model for model in model_catalog}
        unknown = [model_id for model_id in selected_models if model_id not in model_map]
        if unknown:
            raise HTTPException(status_code=422, detail=f"Unknown model(s): {', '.join(unknown)}")
        paid = [model_id for model_id in selected_models if not model_map[model_id].is_free]
        if paid:
            raise HTTPException(
                status_code=422,
                detail=f"System mode only allows free models. Paid selection: {', '.join(paid)}",
            )
    else:
        try:
            byok_catalog = normalize_models(
                await openrouter.list_models(payload.user_openrouter_api_key or "")
            )
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"BYOK key validation failed: {exc}") from exc
        model_map = {model.id: model for model in byok_catalog}
        unknown = [model_id for model_id in selected_models if model_id not in model_map]
        if unknown:
            raise HTTPException(status_code=422, detail=f"Unknown model(s): {', '.join(unknown)}")

    session_id = uuid4().hex
    session_config = SessionConfig(
        question=payload.question,
        models=payload.models,
        host_model=payload.host_model,
        rounds=payload.rounds,
        email=payload.email,
        auth_mode=payload.auth_mode,
    )
    await store.create_session(session_id, session_config)
    if payload.auth_mode == AuthMode.BYOK:
        await key_store.set_key(session_id, payload.user_openrouter_api_key or "")
    return SessionStartResponse(session_id=session_id)


@router.get("/stream/{session_id}")
async def stream_roundtable(
    session_id: str,
    request: Request,
    store: RedisStore = Depends(get_store),
    orchestrator: RoundtableOrchestrator = Depends(get_orchestrator),
    task_map: dict[str, asyncio.Task] = Depends(get_task_map),
    task_lock: asyncio.Lock = Depends(get_task_lock),
) -> EventSourceResponse:
    """Replay and tail session events while ensuring only one orchestrator run per session."""
    if not await store.session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found.")

    async with task_lock:
        lock_acquired = await store.acquire_run_lock(session_id)
        if lock_acquired and session_id not in task_map:
            task_map[session_id] = asyncio.create_task(
                _run_session(session_id=session_id, store=store, orchestrator=orchestrator, task_map=task_map)
            )

    after_event_id = request.headers.get("last-event-id") or "0-0"

    async def event_generator():
        """Yield replayed and live SSE events until stream completion/disconnect."""
        cursor = after_event_id
        complete_seen = False
        complete_idle_cycles = 0
        last_ping_at = time.monotonic()
        while True:
            if await request.is_disconnected():
                break
            events = await store.read_events(session_id, cursor, count=100, block_ms=1000)
            if events:
                complete_idle_cycles = 0
                for event_id, event_name, data_json in events:
                    cursor = event_id
                    if event_name == "complete":
                        complete_seen = True
                    yield {"id": event_id, "event": event_name, "data": data_json}
                continue

            if time.monotonic() - last_ping_at > 15:
                last_ping_at = time.monotonic()
                yield {"event": "ping", "data": json.dumps({"timestamp": int(time.time())})}

            if complete_seen:
                complete_idle_cycles += 1
                if complete_idle_cycles >= 2:
                    break

            state = await store.get_session_state(session_id)
            if state.phase == Phase.COMPLETE and complete_idle_cycles >= 1:
                break

    return EventSourceResponse(event_generator())


async def _run_session(
    *,
    session_id: str,
    store: RedisStore,
    orchestrator: RoundtableOrchestrator,
    task_map: dict[str, asyncio.Task],
) -> None:
    """Execute orchestration and persist emitted events to Redis stream."""

    async def emit_event(event_name: str, data: dict) -> None:
        """Persist one emitted event for replay/resume support."""
        await store.append_event(session_id, event_name, data)

    try:
        await orchestrator.run(session_id, emit_event)
    except Exception as exc:
        await emit_event(
            "error",
            {
                "message": f"Session failed: {exc}",
                "recoverable": False,
            },
        )
        try:
            await store.transition_phase(session_id, Phase.COMPLETE)
        except Exception:
            pass
        await emit_event("complete", {"session_id": session_id, "email_sent": False})
    finally:
        task_map.pop(session_id, None)


async def _load_system_catalog(
    store: RedisStore,
    openrouter: OpenRouterClient,
    settings: Settings,
):
    """Load model catalog using cache-first strategy for the system key."""
    cached = await store.get_cached_system_models()
    if cached is not None:
        return normalize_models(cached)
    try:
        raw_models = await openrouter.list_models(settings.openrouter_api_key)
        await store.set_cached_system_models(raw_models)
        return normalize_models(raw_models)
    except Exception:
        cached_fallback = await store.get_cached_system_models()
        if cached_fallback is not None:
            return normalize_models(cached_fallback)
        raise
