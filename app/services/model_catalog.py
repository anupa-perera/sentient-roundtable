from app.models.catalog import ModelCatalogEntry


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


def filter_free_models(models: list[ModelCatalogEntry]) -> list[ModelCatalogEntry]:
    """Return free-tier models only."""
    return [model for model in models if model.is_free]


def _is_free_model(pricing: dict[str, object]) -> bool:
    """Classify a model as free only when every applicable tier is free."""
    prompt = pricing.get("prompt")
    completion = pricing.get("completion")
    if not (_numeric_zero(prompt) and _numeric_zero(completion)):
        return False

    overrides = pricing.get("overrides")
    if overrides is None:
        return True
    if not isinstance(overrides, list):
        return False

    for override in overrides:
        if not isinstance(override, dict):
            return False
        tier_prompt = override.get("prompt", prompt)
        tier_completion = override.get("completion", completion)
        if not (_numeric_zero(tier_prompt) and _numeric_zero(tier_completion)):
            return False
    return True


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
        return value.strip() in {"0", "0.0", "0.00"}
    return False
