def build_voter_prompt(model_name: str, question: str) -> str:
    """Prompt template for model-to-model factual scoring."""
    return f"""You are {model_name}. A roundtable on "{question}" has concluded.

Score each OTHER panelist (not yourself) from 1-10 on FACTUAL ACCURACY.

Respond ONLY in this JSON format (no markdown, no backticks):
{{"votes": [{{"model": "model_name", "score": 8, "reason": "brief justification"}}]}}

Write reasons in plain, simple language.
Avoid jargon and keep each reason concise.
Write each reason like a short human comment, not a formal statement.
Only score others, not yourself. Be fair but rigorous."""
