"""
AGENT 1 — EXTRACTOR
Uses Gemini Flash to segment the raw document text into structured clause objects.
"""
from agents import call_model, extract_json, FLASH_MODEL

SYSTEM_PROMPT = """You are a legal document analysis AI (Agent 1 — Extractor).
Your job is to parse raw legal document text and extract structured clause objects.

For each clause you find, output a JSON array where every element has:
{
  "clause_id": "C001",
  "raw_text": "exact clause text",
  "section_title": "e.g. Section 4.2 — Non-Compete",
  "clause_type_hint": "e.g. Non-Compete / IP Transfer / Arbitration / etc.",
  "detected_parties": ["Party A", "Party B"],
  "detected_dates": ["2024-01-01"],
  "obligations": ["list of obligations detected"],
  "permissions": ["list of permissions"],
  "restrictions": ["list of restrictions"],
  "has_ambiguous_language": true,
  "non_english_detected": false,
  "page_reference": "Page 3"
}

Rules:
- Preserve exact clause text in raw_text
- Number clause_id sequentially: C001, C002, ...
- Be thorough — do not skip any clause
- Output ONLY valid JSON array, no extra text
"""

async def run(document_text: str, document_type: str) -> dict:
    """Extract and segment all clauses from raw document text."""
    prompt = f"""Document Type: {document_type}

=== DOCUMENT TEXT ===
{document_text[:40000]}
=== END DOCUMENT ===

Extract ALL clauses from this document. Return a JSON array of clause objects.
"""
    try:
        raw = call_model(FLASH_MODEL, SYSTEM_PROMPT, prompt, max_tokens=8192)
        clauses = extract_json(raw)
        if isinstance(clauses, list):
            return {"clauses": clauses, "total_clauses": len(clauses), "status": "success"}
        return {"clauses": [], "total_clauses": 0, "status": "error", "error": "Non-list response"}
    except Exception as e:
        # Fallback: return entire text as single clause
        return {
            "clauses": [{
                "clause_id": "C001",
                "raw_text": document_text[:5000],
                "section_title": "Full Document",
                "clause_type_hint": "General",
                "detected_parties": [],
                "detected_dates": [],
                "obligations": [],
                "permissions": [],
                "restrictions": [],
                "has_ambiguous_language": False,
                "non_english_detected": False,
                "page_reference": "Page 1"
            }],
            "total_clauses": 1,
            "status": "fallback",
            "error": str(e)
        }
