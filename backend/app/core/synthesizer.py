from app.models.round import RoundData
from app.models.vote import ModelVotes


def build_synthesis_input(question: str, rounds: list[RoundData], votes: list[ModelVotes]) -> str:
    """Compose synthesis context from round summaries, full responses, and votes."""
    lines = [f"Question: {question}", "", "Round summaries:"]
    for round_data in rounds:
        lines.extend(
            [
                "",
                f"Round {round_data.round_number}:",
                round_data.summary.strip(),
            ]
        )

    lines.extend(["", "Model responses by round:"])
    for round_data in rounds:
        lines.append(f"\nRound {round_data.round_number}:")
        for response in round_data.responses:
            lines.append(f"- {response.model_name}: {response.response.strip()}")

    lines.extend(["", "Voting results:"])
    if not votes:
        lines.append("No valid votes were collected.")
    for model_votes in votes:
        lines.append(f"\nVoter {model_votes.voter}:")
        for vote in model_votes.votes:
            lines.append(
                f"- {vote.model}: score {vote.score}/10, reason: {vote.reason.strip()}"
            )
    return "\n".join(lines)


def fallback_findings(question: str, rounds: list[RoundData], votes: list[ModelVotes]) -> str:
    """Fallback findings text when synthesis call fails."""
    latest_summary = rounds[-1].summary if rounds else "No summary generated."
    lines = [
        "# Final Findings Document",
        "",
        "## Executive Summary",
        f"The session on '{question}' completed with fallback synthesis.",
        "",
        "## Key Findings",
        latest_summary.strip(),
        "",
        "## Credibility Assessment",
    ]
    if votes:
        lines.append("Votes were partially collected and are included below.")
    else:
        lines.append("Votes were unavailable due to synthesis fallback.")
    lines.append("")
    lines.append("## Final Verdict")
    lines.append(
        "The discussion completed, but synthesis generation failed. Review round summaries for final interpretation."
    )
    return "\n".join(lines)
