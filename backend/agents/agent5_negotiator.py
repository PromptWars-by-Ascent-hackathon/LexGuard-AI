"""
AGENT 5 — NEGOTIATION ADVISOR
Uses Gemini Pro to generate redlines, alternative wording, and a negotiation email template.
"""
import json
from agents import call_model, extract_json, PRO_MODEL

SYSTEM_PROMPT = """You are a contract negotiation strategy AI (Agent 5 — Negotiation Advisor).
Your job is to help the user negotiate better terms based on clause analysis.

Given the full clause analysis, output ONE comprehensive negotiation strategy object:
{
  "negotiation_strategy": {
    "reject_outright": ["clause_id list — unacceptable, non-negotiable rejection recommended"],
    "redline_and_counter": ["clause_id list — negotiate with proposed changes"],
    "accept_with_clarification": ["clause_id list — acceptable but needs definition/clarification"],
    "accept_as_is": ["clause_id list — fair, standard, accept without changes"]
  },
  "top_priority_negotiation_item": "The single most important thing to negotiate first",
  "redline_suggestions": [
    {
      "clause_id": "C001",
      "original_excerpt": "...",
      "suggested_replacement": "...",
      "reason": "Why this change protects the user"
    }
  ],
  "negotiation_email_template": "Full email text the user can send to the other party. Professional, assertive, reasonable tone.",
  "power_dynamics": "Brief assessment of negotiating position (strong/neutral/weak) and why",
  "walk_away_triggers": ["Conditions under which user should refuse to sign entirely"]
}

Rules:
- Be realistic about negotiating power
- Prioritize by severity (CRITICAL first)
- Redline language should be legally neutral and fair
- Email template should be professional, not aggressive
- Include the disclaimer at the end of the email template

Output ONLY the JSON object above. No extra text.
"""

DISCLAIMER = (
    "LexGuard is an AI-powered awareness tool and does not constitute legal advice. "
    "Consult a licensed attorney in your jurisdiction for legally binding guidance."
)

async def run(merged_clauses: list, document_type: str, overall_risk_score: int) -> dict:
    """Generate comprehensive negotiation strategy and redline suggestions."""
    # Pass only key fields to keep prompt manageable
    summary_clauses = []
    for c in merged_clauses:
        summary_clauses.append({
            "clause_id": c.get("clause_id"),
            "clause_type": c.get("clause_type", "General"),
            "severity": c.get("severity"),
            "raw_text": c.get("raw_text", "")[:500],
            "plain_english": c.get("plain_english", ""),
            "practical_impact": c.get("practical_impact", "")
        })

    prompt = f"""Document Type: {document_type}
Overall Risk Score: {overall_risk_score}/100

All clauses summary:
{json.dumps(summary_clauses[:30], indent=2)[:30000]}

Generate the comprehensive negotiation strategy.
End the negotiation_email_template with this disclaimer:
"{DISCLAIMER}"
"""
    try:
        raw = await call_model(PRO_MODEL, SYSTEM_PROMPT, prompt, max_tokens=8192)
        strategy = extract_json(raw)
        if isinstance(strategy, dict):
            return {"negotiation_output": strategy, "status": "success"}
        return {"negotiation_output": {}, "status": "error"}
    except Exception as e:
        return {"negotiation_output": {}, "status": "error", "error": str(e)}
