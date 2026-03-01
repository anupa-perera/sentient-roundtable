"""Unit tests for voter JSON parsing behavior."""

import pytest

from app.core.voter import parse_votes_response


def test_parse_votes_response_filters_self_and_unknown_models() -> None:
    """Vote parser excludes self-votes and models outside the panel."""
    raw = """{"votes":[{"model":"model-a","score":8,"reason":"Good"},
    {"model":"model-b","score":7,"reason":"Solid"},
    {"model":"model-c","score":9,"reason":"Unknown"}]}"""
    parsed = parse_votes_response(raw, voter="model-a", panel_models=["model-a", "model-b"])
    assert len(parsed.votes) == 1
    assert parsed.votes[0].model == "model-b"


def test_parse_votes_response_accepts_json_in_code_fence() -> None:
    """Parser can extract JSON payload wrapped by markdown fences."""
    raw = """```json
{"votes":[{"model":"model-b","score":6,"reason":"ok"}]}
```"""
    parsed = parse_votes_response(raw, voter="model-a", panel_models=["model-a", "model-b"])
    assert parsed.votes[0].score == 6


def test_parse_votes_response_raises_without_json_payload() -> None:
    """Parser raises when no JSON object is present."""
    with pytest.raises(ValueError):
        parse_votes_response("no json", voter="model-a", panel_models=["model-a", "model-b"])

