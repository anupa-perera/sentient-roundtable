import json
import re

from app.models.vote import ModelVotes, Vote


def parse_votes_response(raw_response: str, voter: str, panel_models: list[str]) -> ModelVotes:
    """Parse and sanitize voter JSON response into typed vote objects."""
    cleaned = _extract_json(raw_response)
    payload = json.loads(cleaned)
    votes_payload = payload.get("votes", [])
    valid_votes: list[Vote] = []
    for vote_payload in votes_payload:
        model = vote_payload.get("model")
        if not model or model == voter or model not in panel_models:
            continue
        try:
            valid_votes.append(
                Vote(
                    model=model,
                    score=int(vote_payload.get("score")),
                    reason=str(vote_payload.get("reason", "")).strip() or "No reason provided.",
                )
            )
        except Exception:
            continue
    return ModelVotes(voter=voter, votes=valid_votes)


def _extract_json(raw_response: str) -> str:
    """Extract JSON object even when wrapped with markdown fences."""
    stripped = raw_response.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or start >= end:
        raise ValueError("Voter response does not contain JSON payload.")
    return stripped[start : end + 1]
