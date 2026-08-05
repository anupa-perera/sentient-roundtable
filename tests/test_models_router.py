"""Tests for model catalog fetching and cache behavior."""

from types import SimpleNamespace

from app.routers.models import list_system_models
from app.routers.roundtable import _load_system_catalog


class FakeStore:
    def __init__(self, cached: list[dict] | None = None) -> None:
        self.cached = cached

    async def get_cached_system_models(self) -> list[dict] | None:
        return self.cached

    async def set_cached_system_models(self, catalog: list[dict]) -> None:
        self.cached = catalog


class FakeOpenRouter:
    def __init__(self, models: list[dict]) -> None:
        self.models = models
        self.calls = 0

    async def list_models(self, api_key: str) -> list[dict]:
        self.calls += 1
        return self.models


def _tiered_free_model() -> dict:
    return {
        "id": "provider/free",
        "name": "Free",
        "pricing": {
            "prompt": "0",
            "completion": "0",
            "overrides": [
                {
                    "min_prompt_tokens": 32_000,
                    "prompt": "0",
                    "completion": "0",
                }
            ],
        },
    }


async def test_list_system_models_caches_only_normalized_entries() -> None:
    """Structured upstream fields must not be persisted in the internal cache."""
    store = FakeStore()
    openrouter = FakeOpenRouter([_tiered_free_model()])
    settings = SimpleNamespace(openrouter_api_key="system-key")

    response = await list_system_models(  # type: ignore[arg-type]
        store=store,
        settings=settings,
        openrouter=openrouter,
    )

    assert len(response) == 1
    assert store.cached is not None
    assert store.cached[0]["pricing"] == {"prompt": "0", "completion": "0"}
    assert "overrides" not in store.cached[0]["pricing"]


async def test_cached_structured_pricing_remains_backward_compatible() -> None:
    """Raw cache entries written by the previous release should still load safely."""
    store = FakeStore(cached=[_tiered_free_model()])
    openrouter = FakeOpenRouter([])
    settings = SimpleNamespace(openrouter_api_key="system-key")

    response = await list_system_models(  # type: ignore[arg-type]
        store=store,
        settings=settings,
        openrouter=openrouter,
    )

    assert len(response) == 1
    assert openrouter.calls == 0


async def test_roundtable_loader_caches_only_normalized_entries() -> None:
    """Session validation must use the same safe cache representation."""
    store = FakeStore()
    openrouter = FakeOpenRouter([_tiered_free_model()])
    settings = SimpleNamespace(openrouter_api_key="system-key")

    models = await _load_system_catalog(  # type: ignore[arg-type]
        store=store,
        openrouter=openrouter,
        settings=settings,
    )

    assert models[0].is_free is True
    assert store.cached is not None
    assert store.cached[0]["pricing"] == {"prompt": "0", "completion": "0"}
