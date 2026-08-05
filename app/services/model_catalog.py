from decimal import Decimal, InvalidOperation

from app.models.catalog import ModelCatalogEntry


CATALOG_CACHE_VERSION = 1
CACHE_VERSION_KEY = "_catalog_cache_version"
CACHE_ENTRY_KEY = "entry"
TIER_CONDITION_KEYS = {"min_prompt_tokens"}


def normalize_models(raw_models: list[dict]) -> list[ModelCatalogEntry]:
    """Normalize raw OpenRouter model payload into typed frontend-safe entries."""
    normalized: list[ModelCatalogEntry] = []
    for raw_model in raw_models:
        if not isinstance(raw_model, dict):
            continue
        model_id = str(raw_model.get("id", "")).strip()
        if not model_id:
            continue
        name = str(raw_model.get("name") or model_id)
        raw_pricing = raw_model.get("pricing")
        pricing = raw_pricing if isinstance(raw_pricing, dict) else {}
        context_length = raw_model.get("context_length")
        is_free = _is_free_model(pricing)
        normalized.append(
            ModelCatalogEntry(
                id=model_id,
                name=name,
                pricing=_normalize_pricing(pricing),
                context_length=(
                    context_length
                    if isinstance(context_length, int) and not isinstance(context_length, bool)
                    else None
                ),
                is_free=is_free,
            )
        )
    return sorted(normalized, key=lambda model: model.name.lower())


def serialize_models_for_cache(models: list[ModelCatalogEntry]) -> list[dict]:
    """Serialize validated entries with an explicit cache schema version."""
    return [
        {
            CACHE_VERSION_KEY: CATALOG_CACHE_VERSION,
            CACHE_ENTRY_KEY: model.model_dump(mode="json"),
        }
        for model in models
    ]


def deserialize_cached_models(cached_models: list[dict]) -> list[ModelCatalogEntry]:
    """Read current cache entries while remaining compatible with legacy raw payloads."""
    models: list[ModelCatalogEntry] = []
    legacy_entries: list[dict] = []
    for cached_model in cached_models:
        if isinstance(cached_model, dict) and CACHE_VERSION_KEY in cached_model:
            if cached_model.get(CACHE_VERSION_KEY) != CATALOG_CACHE_VERSION:
                raise ValueError("Unsupported model catalog cache version.")
            models.append(ModelCatalogEntry.model_validate(cached_model.get(CACHE_ENTRY_KEY)))
            continue
        if isinstance(cached_model, dict) and "is_free" in cached_model:
            if cached_model.get("is_free") is not False:
                raise ValueError("Unversioned free-model decisions must be refreshed.")
            models.append(ModelCatalogEntry.model_validate(cached_model))
            continue
        legacy_entries.append(cached_model)
    models.extend(normalize_models(legacy_entries))
    return sorted(models, key=lambda model: model.name.lower())


def filter_free_models(models: list[ModelCatalogEntry]) -> list[ModelCatalogEntry]:
    """Return free-tier models only."""
    return [model for model in models if model.is_free]


def _is_free_model(pricing: dict[str, object]) -> bool:
    """Classify a model as free only when every applicable tier is free."""
    if not (
        _numeric_zero(pricing.get("prompt"))
        and _numeric_zero(pricing.get("completion"))
    ):
        return False
    if not _all_pricing_dimensions_are_zero(pricing, ignored_keys={"overrides"}):
        return False

    overrides = pricing.get("overrides")
    if overrides is None:
        return True
    if not isinstance(overrides, list):
        return False

    for override in overrides:
        if not isinstance(override, dict):
            return False
        if not _all_pricing_dimensions_are_zero(
            override,
            ignored_keys=TIER_CONDITION_KEYS,
        ):
            return False
    return True


def _all_pricing_dimensions_are_zero(
    pricing: dict[str, object],
    *,
    ignored_keys: set[str],
) -> bool:
    """Require all present charge fields to be numeric zero."""
    charge_values = [
        value for key, value in pricing.items() if str(key) not in ignored_keys
    ]
    return bool(charge_values) and all(_numeric_zero(value) for value in charge_values)


def _normalize_pricing(
    pricing: dict[str, object],
) -> dict[str, str | float | int | None]:
    """Keep scalar pricing fields and drop provider-specific structured metadata."""
    normalized: dict[str, str | float | int | None] = {}
    for key, value in pricing.items():
        if value is None or isinstance(value, str):
            normalized[str(key)] = value
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            normalized[str(key)] = value
    return normalized


def _numeric_zero(value: object) -> bool:
    """Handle both numeric and string price formats."""
    if value is None:
        return False
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value) == 0.0
    if isinstance(value, str):
        try:
            return Decimal(value.strip()).is_zero()
        except InvalidOperation:
            return False
    return False
