from collections.abc import Sequence

from app.models.round import ModelResponse


def get_speaking_order(models: Sequence[str], round_num: int) -> list[str]:
    """Rotate speaking order by one index per round."""
    if not models:
        return []
    shift = (round_num - 1) % len(models)
    return list(models[shift:]) + list(models[:shift])


def build_turn_context(
    question: str,
    prior_summary: str,
    earlier_responses: list[ModelResponse],
    round_num: int,
    total_rounds: int,
) -> str:
    """Build panelist user-message context for a single turn."""
    lines = [
        f"Question: {question}",
        f"Round: {round_num}/{total_rounds}",
    ]
    if prior_summary:
        lines.extend(
            [
                "",
                "Prior rounds summary (host-compressed):",
                prior_summary.strip(),
            ]
        )
    if earlier_responses:
        lines.extend(["", "Earlier responses from this round:"])
        for response in earlier_responses:
            lines.append(f"- {response.model_name}: {response.response.strip()}")
    lines.extend(
        [
            "",
            "Provide your response now. Keep it concise and opinionated.",
        ]
    )
    return "\n".join(lines)


def format_round_for_host(round_responses: list[ModelResponse]) -> str:
    """Format round responses for host summarization prompt input."""
    blocks = ["Round transcript:"]
    for response in round_responses:
        blocks.extend(["", f"{response.model_name}:", response.response.strip()])
    return "\n".join(blocks)


def fallback_round_summary(round_responses: list[ModelResponse]) -> str:
    """Fallback summary when host summarization call fails."""
    excerpts: list[str] = []
    for response in round_responses:
        excerpt = response.response.strip()
        if len(excerpt) > 500:
            excerpt = excerpt[-500:]
        excerpts.append(f"{response.model_name}: {excerpt}")
    return "Fallback summary generated after host failure.\n\n" + "\n".join(excerpts)
