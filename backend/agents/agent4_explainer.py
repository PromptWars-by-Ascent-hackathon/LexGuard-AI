"""
AGENT 4 — EXPLAINER
Uses Gemini Pro to generate user-friendly explanation cards for every clause.
"""
from agents import call_model, extract_json, PRO_MODEL

SYSTEM_PROMPT = """You are a legal simplification AI (Agent 4 — Explainer).
Your job is to transform legal clause analysis into clear, friendly explanation cards.

Grade 8-10 reading level. Imagine explaining to a smart non-lawyer.

For each clause, produce:
{
  "clause_id": "C001",
  "plain_english": "Simple 2-3 sentence explanation of what this clause actually means",
  "practical_impact": "How does this affect the person signing RIGHT NOW and in the future?",
  "worst_case_scenario": "If the other party exploits this clause maximally, what happens?",
  "standard_comparison": "Is this clause normal/typical? How does it differ from standard?",
  "negotiation_recommendation": "Should they accept, reject, or negotiate? What specifically to ask for?",
  "confidence": 0.92,
  "low_confidence_flag": false,
  "low_confidence_reason": ""
}

Rules:
- Set low_confidence_flag = true if confidence < 0.75
- NEVER state specific laws you are not 100% sure of
- Use "may", "typically", "generally" when uncertain
- Focus on practical impact over legal theory
- Be direct and honest about risks
- Plain English only — no jargon without explanation

Output ONLY a JSON array. No extra text.
"""

async def run(merged_clauses: list, document_type: str) -> dict:
    """Generate plain-English explanation cards for all clauses."""
    prompt = f"""Document Type: {document_type}

All clauses with extracted text, classification, and reasoning:
{json.dumps(merged_clauses[:30], indent=2)[:35000]}

Generate an explanation card for EVERY clause listed above.
Return a JSON array with one card per clause.
"""
    try:
        raw = call_model(PRO_MODEL, SYSTEM_PROMPT, prompt, max_tokens=8192)
        explanations = extract_json(raw)
        if isinstance(explanations, list):
            return {"explanation_cards": explanations, "status": "success"}
        return {"explanation_cards": [], "status": "error"}
    except Exception as e:
        return {"explanation_cards": [], "status": "error", "error": str(e)}
