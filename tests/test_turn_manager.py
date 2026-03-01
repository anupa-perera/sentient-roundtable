"""Unit tests for round ordering and turn context helpers."""

from app.core.turn_manager import build_turn_context, get_speaking_order
from app.models.round import ModelResponse


def test_get_speaking_order_rotates_each_round() -> None:
    """Round order rotates by one position per round."""
    models = ["a", "b", "c", "d"]
    assert get_speaking_order(models, 1) == ["a", "b", "c", "d"]
    assert get_speaking_order(models, 2) == ["b", "c", "d", "a"]
    assert get_speaking_order(models, 3) == ["c", "d", "a", "b"]


def test_build_turn_context_contains_summary_and_prior_turns() -> None:
    """Turn context includes compressed summary and earlier same-round responses."""
    context = build_turn_context(
        question="Should we adopt policy X?",
        prior_summary="Summary text.",
        earlier_responses=[
            ModelResponse(model_id="a", model_name="a", response="first"),
            ModelResponse(model_id="b", model_name="b", response="second"),
        ],
        round_num=2,
        total_rounds=3,
    )
    assert "Summary text." in context
    assert "a: first" in context
    assert "b: second" in context
    assert "Round: 2/3" in context

