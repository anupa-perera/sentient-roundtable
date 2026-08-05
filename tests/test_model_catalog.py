"""Tests for the OpenRouter-to-application model catalog boundary."""

from app.services.model_catalog import (
    deserialize_cached_models,
    normalize_models,
    serialize_models_for_cache,
)


def test_normalize_models_drops_structured_pricing_metadata() -> None:
    """Tier overrides must not violate the frontend-safe scalar pricing contract."""
    models = normalize_models(
        [
            {
                "id": "qwen/tiered",
                "name": "Tiered model",
                "context_length": 1_000_000,
                "pricing": {
                    "prompt": "0.00000003",
                    "completion": "0.00000013",
                    "overrides": [
                        {
                            "min_prompt_tokens": 32_000,
                            "prompt": "0.0000001",
                            "completion": "0.0000004",
                        }
                    ],
                },
            }
        ]
    )

    assert len(models) == 1
    assert models[0].pricing == {
        "prompt": "0.00000003",
        "completion": "0.00000013",
    }
    assert models[0].is_free is False


def test_tier_override_with_a_cost_is_not_classified_as_free() -> None:
    """A zero base tier must not hide a paid long-context tier."""
    models = normalize_models(
        [
            {
                "id": "provider/conditional-free",
                "pricing": {
                    "prompt": "0",
                    "completion": "0",
                    "overrides": [
                        {
                            "min_prompt_tokens": 32_000,
                            "prompt": "0.000001",
                            "completion": "0.000002",
                        }
                    ],
                },
            }
        ]
    )

    assert models[0].is_free is False


def test_non_token_charge_is_not_classified_as_free() -> None:
    """A fixed or auxiliary charge must prevent system-key use."""
    models = normalize_models(
        [
            {
                "id": "provider/request-charge",
                "pricing": {
                    "prompt": "0",
                    "completion": "0",
                    "request": "0.01",
                },
            },
            {
                "id": "provider/tier-request-charge",
                "pricing": {
                    "prompt": "0",
                    "completion": "0",
                    "overrides": [
                        {"min_prompt_tokens": 32_000, "request": "0.01"}
                    ],
                },
            },
        ]
    )

    assert all(model.is_free is False for model in models)


def test_all_zero_pricing_tiers_are_classified_as_free() -> None:
    """Tier metadata is allowed when every tier remains free."""
    models = normalize_models(
        [
            {
                "id": "provider/always-free",
                "pricing": {
                    "prompt": "0",
                    "completion": "0",
                    "overrides": [
                        {
                            "min_prompt_tokens": 32_000,
                            "prompt": "0.0",
                            "completion": 0,
                        }
                    ],
                },
            }
        ]
    )

    assert models[0].is_free is True


def test_cache_round_trip_preserves_validated_free_classification() -> None:
    """Dropping tier metadata must not change the validated free decision."""
    models = normalize_models(
        [
            {
                "id": "provider/conditional-free",
                "pricing": {
                    "prompt": "0",
                    "completion": "0",
                    "overrides": [
                        {
                            "min_prompt_tokens": 32_000,
                            "prompt": "0.000001",
                            "completion": "0.000002",
                        }
                    ],
                },
            }
        ]
    )

    restored = deserialize_cached_models(serialize_models_for_cache(models))

    assert restored[0].is_free is False


def test_unknown_pricing_shape_is_conservatively_not_free() -> None:
    """Malformed external pricing must not enable a potentially paid model."""
    models = normalize_models(
        [
            {"id": "provider/unknown-pricing", "pricing": ["unexpected"]},
            {"pricing": {"prompt": "0", "completion": "0"}},
            "unexpected entry",
        ]  # type: ignore[list-item]
    )

    assert len(models) == 1
    assert models[0].pricing == {}
    assert models[0].is_free is False
