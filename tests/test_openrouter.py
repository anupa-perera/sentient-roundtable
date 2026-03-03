"""Unit tests for OpenRouter client payload parsing helpers."""

import pytest

pytest.importorskip("redis")

from app.services.openrouter import OpenRouterClient


def test_extract_stream_token_handles_empty_choices() -> None:
    """Stream parser should not crash on provider chunks with empty choices."""
    token = OpenRouterClient._extract_stream_token({"choices": []})  # type: ignore[arg-type]
    assert token == ""


def test_extract_stream_token_reads_content() -> None:
    """Stream parser should return delta content when available."""
    token = OpenRouterClient._extract_stream_token(
        {"choices": [{"delta": {"content": "hello"}}]}  # type: ignore[arg-type]
    )
    assert token == "hello"


def test_extract_completion_text_supports_content_blocks() -> None:
    """Non-stream parser should support provider content block format."""
    text = OpenRouterClient._extract_completion_text(
        {
            "choices": [
                {
                    "message": {
                        "content": [
                            {"type": "text", "text": "part 1"},
                            {"type": "text", "text": " part 2"},
                        ]
                    }
                }
            ]
        }
    )
    assert text == "part 1 part 2"


def test_extract_error_detail_reads_nested_error_message() -> None:
    """Error parser should extract useful provider detail when present."""
    detail = OpenRouterClient._extract_error_detail(
        '{"error":{"code":429,"message":"Rate limit exceeded"}}'
    )
    assert detail == "Rate limit exceeded"
