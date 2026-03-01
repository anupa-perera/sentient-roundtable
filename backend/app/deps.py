import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request

from app.config import Settings
from app.core.orchestrator import RoundtableOrchestrator
from app.services.key_store import EphemeralKeyStore
from app.services.openrouter import OpenRouterClient
from app.services.redis_store import RedisStore

TaskMap = dict[str, asyncio.Task[Any]]
TaskEmitterFactory = Callable[[str], Callable[[str, dict], Awaitable[None]]]


def get_settings(request: Request) -> Settings:
    """Resolve global settings object from app state."""
    return request.app.state.settings


def get_store(request: Request) -> RedisStore:
    """Resolve Redis-backed store service from app state."""
    return request.app.state.store


def get_key_store(request: Request) -> EphemeralKeyStore:
    """Resolve process-local key store from app state."""
    return request.app.state.key_store


def get_openrouter(request: Request) -> OpenRouterClient:
    """Resolve OpenRouter API client from app state."""
    return request.app.state.openrouter


def get_orchestrator(request: Request) -> RoundtableOrchestrator:
    """Resolve orchestrator service from app state."""
    return request.app.state.orchestrator


def get_task_map(request: Request) -> TaskMap:
    """Resolve session task map used to track in-flight orchestrations."""
    return request.app.state.session_tasks


def get_task_lock(request: Request) -> asyncio.Lock:
    """Resolve global lock protecting task-map mutations."""
    return request.app.state.task_lock
