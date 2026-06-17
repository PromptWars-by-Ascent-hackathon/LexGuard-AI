"""
AGENT 2 — CLASSIFIER
Uses Gemini Flash to classify each clause by severity and risk dimension.
"""
import json
from agents import call_model, extract_json, FLASH_MODEL

SYSTEM_PROMPT = """You are a legal risk classifier AI (Agent 2 — Classifier).
Given a list of extracted legal clauses, classify each one by risk severity and dimension.

For each clause, output a JSON object with:
{
  "clause_id": "C001",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW | INFORMATIONAL",
  "risk_dimension": "Financial | Privacy | Employment | IP | Compliance | Legal Rights | Operational",
  "clause_type": "Non-Compete | IP Transfer | Arbitration | Auto-Renewal | Liability Caps | Data Collection | Termination | Indemnification | Governing Law | NDA/Confidentiality | Force Majeure | Payment Terms | Subscription Terms | Data Sharing | Monitoring/Surveillance | AI/Data Usage Rights | Ownership Transfer | Warranty Disclaimers | Limitation of Remedies | Consent Clauses | Tracking/Analytics | Third-Party Sharing | Exclusivity | Licensing Restrictions | Penalty Clauses | Background IP | Moral Rights Waiver | Biometric Collection | Compliance Obligations | Audit Rights | Vendor Lock-In | Usage Restrictions | Confidentiality Survival | Non-Solicitation | Hidden Fees | Jurisdiction Manipulation | One-Sided Amendments | Price Escalation | Certification Misrepresentation | Regulatory Liability | Misleading Terms | Undefined Legal Terms | General Exploitative Language | General",
  "sub_scores": {
    "scope_breadth": 0,
    "duration_unfairness": 0,
    "asymmetry": 0,
    "ambiguity": 0,
    "deviation_from_standard": 0
  },
  "flags": {
    "asymmetry": false,
    "undefined_terms": false,
    "hidden_obligations": false,
    "overbroad_restrictions": false,
    "auto_renewal": false,
    "data_exploitation": false,
    "unlimited_liability": false,
    "perpetual_obligations": false,
    "unfair_jurisdiction": false
  },
  "confidence": 0.90
}

Sub-scores are 0-100. Severity rules:
- CRITICAL: Unlimited liability, IP transfer without compensation, perpetual non-compete, surveillance
- HIGH: One-sided arbitration, broad data sharing, severe auto-renewal, major asymmetry
- MEDIUM: Moderately unfair terms, some ambiguity, restricted remedies
- LOW: Minor imbalances, standard terms with slight issues
- INFORMATIONAL: Standard industry clauses, definitions, boilerplate

Output ONLY a JSON array of classified clauses, no extra text.
"""

async def run(clauses: list, document_type: str) -> dict:
    """Classify each extracted clause by severity and risk dimension."""
    clause_texts = []
    for c in clauses:
        clause_texts.append({
            "clause_id": c.get("clause_id"),
            "text": c.get("raw_text", "")[:2000],
            "type_hint": c.get("clause_type_hint", "")
        })

    prompt = f"""Document Type: {document_type}

Clauses to classify:
{json.dumps(clause_texts, indent=2)[:35000]}

Classify each clause. Return JSON array matching clause_ids from input.
"""
    try:
        raw = await call_model(FLASH_MODEL, SYSTEM_PROMPT, prompt, max_tokens=8192)
        classified = extract_json(raw)
        if isinstance(classified, list):
            return {"classified_clauses": classified, "status": "success"}
        return {"classified_clauses": [], "status": "error"}
    except Exception as e:
        return {"classified_clauses": [], "status": "error", "error": str(e)}
