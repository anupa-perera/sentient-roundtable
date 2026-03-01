"""FastAPI application entrypoint for Sentient Roundtable backend."""

import asyncio
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis

from app.config import get_settings
from app.core.orchestrator import RoundtableOrchestrator
from app.routers.export import router as export_router
from app.routers.models import router as models_router
from app.routers.roundtable import router as roundtable_router
from app.services.key_store import EphemeralKeyStore
from app.services.openrouter import OpenRouterClient
from app.services.redis_store import RedisStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize shared service objects and close them during shutdown."""
    settings = get_settings()
    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    await redis_client.ping()

    app.state.settings = settings
    app.state.redis = redis_client
    app.state.store = RedisStore(
        redis=redis_client,
        session_ttl_seconds=settings.session_ttl_seconds,
        model_cache_ttl_seconds=settings.model_cache_ttl_seconds,
    )
    app.state.key_store = EphemeralKeyStore(ttl_seconds=settings.session_ttl_seconds)
    app.state.openrouter = OpenRouterClient(
        base_url=settings.openrouter_base_url,
        http_referer=settings.openrouter_http_referer,
    )
    app.state.orchestrator = RoundtableOrchestrator(
        store=app.state.store,
        openrouter=app.state.openrouter,
        key_store=app.state.key_store,
        settings=settings,
    )
    app.state.session_tasks: dict[str, asyncio.Task[Any]] = {}
    app.state.task_lock = asyncio.Lock()
    try:
        yield
    finally:
        for task in app.state.session_tasks.values():
            task.cancel()
        if app.state.session_tasks:
            await asyncio.gather(*app.state.session_tasks.values(), return_exceptions=True)
        await redis_client.aclose()


app = FastAPI(title="Sentient Roundtable API", version="1.0.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(roundtable_router, prefix="/api")
app.include_router(models_router, prefix="/api")
app.include_router(export_router, prefix="/api")


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """Simple health check endpoint."""
    return {"status": "ok"}

