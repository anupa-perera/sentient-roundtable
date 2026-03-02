def build_synthesis_prompt(question: str) -> str:
    """Prompt template for final findings generation."""
    return f"""Produce the FINAL FINDINGS DOCUMENT for a roundtable discussion.

BURNING QUESTION: "{question}"

Structure:
1. **Executive Summary** - 2-3 sentence answer
2. **Key Findings** - Strongest, most agreed-upon conclusions
3. **Points of Contention** - Where panelists disagreed and why
4. **Credibility Assessment** - Who was rated most accurate and why
5. **Final Verdict** - Synthesized answer to the burning question

Use plain, simple language with short sentences.
Avoid jargon and overly complex wording.
Keep the tone human and natural while staying structured.
Be authoritative and clear."""
