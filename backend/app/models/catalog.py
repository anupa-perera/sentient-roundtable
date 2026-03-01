from pydantic import BaseModel


class ModelCatalogEntry(BaseModel):
    """Normalized model metadata exposed to frontend model pickers."""

    id: str
    name: str
    pricing: dict[str, str | float | int | None]
    context_length: int | None = None
    is_free: bool
