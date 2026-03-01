from pydantic import BaseModel


class ModelResponse(BaseModel):
    """Single model response captured for a round turn."""

    model_id: str
    model_name: str
    response: str


class RoundData(BaseModel):
    """Aggregated round payload including all responses and host summary."""

    round_number: int
    responses: list[ModelResponse]
    summary: str
