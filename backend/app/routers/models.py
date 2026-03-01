"""Model catalog endpoints for system and BYOK flows."""

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_openrouter, get_settings, get_store
from app.services.model_catalog import filter_free_models, normalize_models
from app.services.openrouter import OpenRouterClient
from app.services.redis_store import RedisStore
from app.config import Settings

router = APIRouter(prefix="/models", tags=["models"])


class ByokModelsRequest(BaseModel):
    """Request body used to fetch a model list with a user-provided key."""

    user_openrouter_api_key: str = Field(..., min_length=8)


@router.get("")
async def list_system_models(
    store: RedisStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
    openrouter: OpenRouterClient = Depends(get_openrouter),
) -> list[dict]:
    """Return free-only model catalog for the default system-key flow."""
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="System OpenRouter key is not configured.")

    cached = await store.get_cached_system_models()
    if cached is not None:
        models = [entry for entry in normalize_models(cached)]
    else:
        try:
            raw_models = await openrouter.list_models(settings.openrouter_api_key)
            await store.set_cached_system_models(raw_models)
            models = normalize_models(raw_models)
        except Exception as exc:
            cached_fallback = await store.get_cached_system_models()
            if cached_fallback is None:
                raise HTTPException(
                    status_code=503,
                    detail=f"Unable to load model catalog from OpenRouter: {exc}",
                ) from exc
            models = normalize_models(cached_fallback)

    return [entry.model_dump() for entry in filter_free_models(models)]


@router.post("/byok")
async def list_byok_models(
    request: ByokModelsRequest,
    openrouter: OpenRouterClient = Depends(get_openrouter),
) -> list[dict]:
    """Return full model catalog for BYOK testing without persisting user key."""
    try:
        raw_models = await openrouter.list_models(request.user_openrouter_api_key)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Unable to load BYOK models: {exc}") from exc
    return [entry.model_dump() for entry in normalize_models(raw_models)]

