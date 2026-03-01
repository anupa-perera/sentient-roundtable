from pydantic import BaseModel, Field


class Vote(BaseModel):
    """Factual accuracy score assigned to one peer model."""

    model: str
    score: int = Field(..., ge=1, le=10)
    reason: str


class ModelVotes(BaseModel):
    """Set of peer votes emitted by a single voter model."""

    voter: str
    votes: list[Vote]
