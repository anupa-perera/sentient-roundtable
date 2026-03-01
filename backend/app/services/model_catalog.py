from app.models.catalog import ModelCatalogEntry


def normalize_models(raw_models: list[dict]) -> list[ModelCatalogEntry]:
    """Normalize raw OpenRouter model payload into typed frontend-safe entries."""
    normalized: list[ModelCatalogEntry] = []
    for raw_model in raw_models:
        model_id = str(raw_model.get("id", "")).strip()
        if not model_id:
            continue
        name = str(raw_model.get("name") or model_id)
        pricing = raw_model.get("pricing") or {}
        context_length = raw_model.get("context_length")
        is_free = _is_free_model(pricing)
        normalized.append(
            ModelCatalogEntry(
                id=model_id,
                name=name,
                pricing=pricing,
                context_length=context_length if isinstance(context_length, int) else None,
                is_free=is_free,
            )
        )
    return sorted(normalized, key=lambda model: model.name.lower())


def filter_free_models(models: list[ModelCatalogEntry]) -> list[ModelCatalogEntry]:
    """Return free-tier models only."""
    return [model for model in models if model.is_free]


def _is_free_model(pricing: dict[str, object]) -> bool:
    """Classify model as free when both prompt and completion prices are zero."""
    prompt = pricing.get("prompt")
    completion = pricing.get("completion")
    return _numeric_zero(prompt) and _numeric_zero(completion)


def _numeric_zero(value: object) -> bool:
    """Handle both numeric and string price formats."""
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return float(value) == 0.0
    if isinstance(value, str):
        return value.strip() in {"0", "0.0", "0.00"}
    return False
