def build_host_prompt(question: str, round_num: int, total_rounds: int) -> str:
    """Prompt template for host round summarization."""
    is_final = round_num == total_rounds
    final_instruction = (
        "Provide a comprehensive synthesis of all positions."
        if is_final
        else "Pose a refined follow-up angle for the next round."
    )
    return f"""You are the HOST/MODERATOR of a roundtable discussion.

BURNING QUESTION: "{question}"

You just completed round {round_num} of {total_rounds}. Your job:
1. Summarize the key arguments and positions from this round
2. Identify points of agreement and disagreement
3. Highlight the strongest arguments made
4. {final_instruction}

Use plain, simple language with short sentences.
Avoid jargon and overly complex wording.
Write like a human moderator speaking naturally to the group.
Be concise but capture all essential reasoning. This summary becomes the ONLY context the panelists receive for the next round."""
