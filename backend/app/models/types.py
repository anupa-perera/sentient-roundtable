from enum import Enum


class Phase(str, Enum):
    """Allowed session lifecycle phases."""

    SETUP = "setup"
    RUNNING = "running"
    VOTING = "voting"
    SYNTHESIS = "synthesis"
    COMPLETE = "complete"


class AuthMode(str, Enum):
    """Model access mode for OpenRouter calls."""

    SYSTEM = "system"
    BYOK = "byok"
