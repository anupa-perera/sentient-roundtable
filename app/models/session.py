from datetime import datetime, timezone

from pydantic import BaseModel, Field, model_validator

from app.models.types import AuthMode, Phase


class SessionConfig(BaseModel):
    """Persisted setup configuration for a session."""

    question: str = Field(..., min_length=10, max_length=2000)
    models: list[str] = Field(..., min_length=2, max_length=8)
    host_model: str
    rounds: int = Field(default=3, ge=1, le=10)
    email: str | None = None
    auth_mode: AuthMode = AuthMode.SYSTEM


class SessionStartRequest(SessionConfig):
    """Incoming payload for session start endpoint."""

    user_openrouter_api_key: str | None = Field(default=None, min_length=8)

    @model_validator(mode="after")
    def validate_auth_mode(self) -> "SessionStartRequest":
        """Require BYOK key only when BYOK mode is selected."""
        if self.auth_mode == AuthMode.BYOK and not self.user_openrouter_api_key:
            raise ValueError("user_openrouter_api_key is required when auth_mode='byok'")
        return self


class SessionStartResponse(BaseModel):
    """Session start response containing generated session id."""

    session_id: str


class SessionState(BaseModel):
    """Mutable runtime state for orchestration progress tracking."""

    session_id: str
    phase: Phase = Phase.SETUP
    current_round: int = 0
    active_speaker: str | None = None
    speaking_order: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None
