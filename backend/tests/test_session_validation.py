"""Unit tests for session request validation rules."""

import pytest
from pydantic import ValidationError

from app.models.session import SessionStartRequest
from app.models.types import AuthMode


def test_byok_mode_requires_api_key() -> None:
    """BYOK mode rejects requests that omit user_openrouter_api_key."""
    with pytest.raises(ValidationError):
        SessionStartRequest(
            question="What should we build first in our roadmap?",
            models=["m1", "m2"],
            host_model="m1",
            rounds=3,
            auth_mode=AuthMode.BYOK,
        )


def test_system_mode_allows_missing_user_key() -> None:
    """System mode accepts requests without BYOK key."""
    payload = SessionStartRequest(
        question="What should we build first in our roadmap?",
        models=["m1", "m2"],
        host_model="m1",
        rounds=3,
        auth_mode=AuthMode.SYSTEM,
    )
    assert payload.user_openrouter_api_key is None

