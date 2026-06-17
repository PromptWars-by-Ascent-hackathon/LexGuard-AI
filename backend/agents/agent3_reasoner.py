"""
AGENT 3 — LEGAL REASONER
Uses Gemini Pro to perform 7-step deep reasoning on MEDIUM/HIGH/CRITICAL clauses.
"""
from agents import call_model, extract_json, PRO_MODEL
import json

SYSTEM_PROMPT = """You are an expert legal reasoning AI (Agent 3 — Legal Reasoner).
You perform deep, structured legal analysis using a 7-step framework.

For each clause provided (MEDIUM/HIGH/CRITICAL only), output a detailed reasoning object:
{
  "clause_id": "C001",
  "reasoning_trace": {
    "intent_analysis": "What is the legal/business purpose of this clause?",
    "scope_detection": "Geographic scope, duration, subject matter breadth, operational impact",
    "implication_inference": "All practical consequences to the user signing this document",
    "adversarial_simulation": "Worst-case exploitation scenario by the counterparty",
    "contradiction_scan": ["List clause IDs this contradicts, if any"],
    "undefined_terms": ["List of vague/exploitable undefined terms in this clause"],
    "rag_benchmark_ids": ["BENCH-001", "BENCH-002"],
    "rag_similarity_scores": [0.89, 0.76],
    "standard_comparison_summary": "How does this compare to industry standard?"
  },
  "overall_risk_assessment": "3-4 sentence summary for this clause"
}

Rules:
- NEVER fabricate legal precedents or case citations
- NEVER invent statistics
- Clearly state when jurisdiction is uncertain
- Focus on protecting the user
- Use plain language in implication_inference and adversarial_simulation

Output ONLY a JSON array. No extra text.
"""

async def run(clauses_with_classification: list, document_type: str) -> dict:
    """Run 7-step deep legal reasoning on MEDIUM/HIGH/CRITICAL clauses."""
    # Filter to only actionable severities
    target_clauses = [
        c for c in clauses_with_classification
        if c.get("severity") in ["CRITICAL", "HIGH", "MEDIUM"]
    ]

    if not target_clauses:
        return {"reasoned_clauses": [], "status": "success", "message": "No high-risk clauses found"}

    prompt = f"""Document Type: {document_type}

Clauses requiring deep reasoning:
{json.dumps(target_clauses[:20], indent=2)[:35000]}

Apply the 7-step legal reasoning framework to each clause.
Return a JSON array of reasoning objects.
"""
    try:
        raw = await call_model(PRO_MODEL, SYSTEM_PROMPT, prompt, max_tokens=8192)
        reasoned = extract_json(raw)
        if isinstance(reasoned, list):
            return {"reasoned_clauses": reasoned, "status": "success"}
        return {"reasoned_clauses": [], "status": "error"}
    except Exception as e:
        return {"reasoned_clauses": [], "status": "error", "error": str(e)}
