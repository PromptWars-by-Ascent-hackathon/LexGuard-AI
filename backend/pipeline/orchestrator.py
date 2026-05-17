"""
Pipeline Orchestrator — runs all 5 agents sequentially and merges output.
"""
import time, uuid
from datetime import datetime
from agents import FLASH_MODEL, call_model, extract_json, DISCLAIMER
from agents import agent1_extractor, agent2_classifier, agent3_reasoner, agent4_explainer, agent5_negotiator

SEVERITY_ORDER = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFORMATIONAL": 0}

async def detect_document_type(text: str) -> dict:
    """Use Gemini Flash to auto-detect document type."""
    prompt = f"""Analyze the following document text and identify its type.

Document categories:
Employment Contract, Freelance Agreement, Vendor Agreement, SaaS Terms, Privacy Policy, NDA,
Rental Agreement, Insurance Policy, Service Agreement, Government Notice, Financial Agreement,
Loan Agreement, Licensing Agreement, Academic Certificate, Corporate Certificate, Compliance Certificate,
Terms of Service, Partnership Agreement, Consulting Agreement, Procurement Contract,
Subscription Agreement, Declaration/Consent Forms, Regulatory Documents, Legal Notices, General Certificate

Document text (first 3000 chars):
{text[:3000]}

Return JSON only:
{{"document_type": "...", "confidence": 0.95, "secondary_type": "..."}}
"""
    response_text = call_model(FLASH_MODEL, "You are a legal document analyzer. Output only JSON.", prompt)
    try:
        result = extract_json(response_text)
        return result
    except Exception:
        return {"document_type": "General Legal Document", "confidence": 0.5, "secondary_type": "Unknown"}

def calculate_risk_score(classified_clauses: list) -> dict:
    """Calculate overall and dimensional risk scores."""
    if not classified_clauses:
        return {"overall": 0, "breakdown": {d: 0 for d in ["financial","privacy","employment","ip","compliance","legal_rights","operational"]}}

    severity_weights = {"CRITICAL": 100, "HIGH": 70, "MEDIUM": 40, "LOW": 15, "INFORMATIONAL": 0}
    dimension_map = {
        "Financial": "financial", "Privacy": "privacy", "Employment": "employment",
        "IP": "ip", "Compliance": "compliance", "Legal Rights": "legal_rights", "Operational": "operational"
    }

    dim_scores = {d: [] for d in dimension_map.values()}
    all_scores = []

    for clause in classified_clauses:
        severity = clause.get("severity", "LOW")
        score = severity_weights.get(severity, 0)
        all_scores.append(score)
        dim = dimension_map.get(clause.get("risk_dimension", ""), "operational")
        dim_scores[dim].append(score)

    overall = int(sum(all_scores) / max(len(all_scores), 1))
    breakdown = {d: int(sum(v) / max(len(v), 1)) if v else 0 for d, v in dim_scores.items()}

    return {"overall": min(overall, 100), "breakdown": breakdown}

def count_by_severity(clauses: list) -> dict:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "informational": 0, "total": len(clauses)}
    for c in clauses:
        s = c.get("severity", "LOW").lower()
        if s in counts:
            counts[s] += 1
    return counts

async def run_pipeline(document_text: str, session_id: str, filename: str, progress_callback=None) -> dict:
    """
    Run the full 5-agent LexGuard pipeline sequentially.
    progress_callback(agent_num, status_msg) — called after each agent completes.
    """
    start_time = time.time()
    pipeline_id = str(uuid.uuid4())

    async def progress(agent_num: int, msg: str):
        if progress_callback:
            await progress_callback(agent_num, msg)

    # ─── Document Type Detection ──────────────────────────────────────────────
    await progress(0, "Detecting document type...")
    doc_type_result = await detect_document_type(document_text)
    document_type = doc_type_result.get("document_type", "General Legal Document")
    doc_confidence = doc_type_result.get("confidence", 0.5)

    # ─── AGENT 1: EXTRACTOR ──────────────────────────────────────────────────
    await progress(1, "Extracting clauses...")
    extraction = await agent1_extractor.run(document_text, document_type)
    raw_clauses = extraction.get("clauses", [])

    # ─── AGENT 2: CLASSIFIER ─────────────────────────────────────────────────
    await progress(2, "Classifying risk levels...")
    classification = await agent2_classifier.run(raw_clauses, document_type)
    classified = classification.get("classified_clauses", [])

    # Merge extraction + classification
    class_map = {c["clause_id"]: c for c in classified}
    merged_1 = []
    for rc in raw_clauses:
        cid = rc["clause_id"]
        merged = {**rc, **class_map.get(cid, {})}
        merged_1.append(merged)

    # ─── AGENT 3: LEGAL REASONER ─────────────────────────────────────────────
    await progress(3, "Reasoning through legal implications...")
    reasoning = await agent3_reasoner.run(merged_1, document_type)
    reasoned = reasoning.get("reasoned_clauses", [])
    reason_map = {r["clause_id"]: r for r in reasoned}

    merged_2 = []
    for m in merged_1:
        cid = m["clause_id"]
        r = reason_map.get(cid, {})
        merged_2.append({**m, "reasoning_trace": r.get("reasoning_trace", {}), "overall_risk_assessment": r.get("overall_risk_assessment", "")})

    # ─── AGENT 4: EXPLAINER ──────────────────────────────────────────────────
    await progress(4, "Generating plain-English explanations...")
    explanation = await agent4_explainer.run(merged_2, document_type)
    explanations = explanation.get("explanation_cards", [])
    explain_map = {e["clause_id"]: e for e in explanations}

    merged_3 = []
    for m in merged_2:
        cid = m["clause_id"]
        e = explain_map.get(cid, {})
        merged_3.append({
            **m,
            "plain_english": e.get("plain_english", ""),
            "practical_impact": e.get("practical_impact", ""),
            "worst_case_scenario": e.get("worst_case_scenario", ""),
            "standard_comparison": e.get("standard_comparison", ""),
            "negotiation_recommendation": e.get("negotiation_recommendation", ""),
            "confidence": e.get("confidence", 0.85),
            "low_confidence_flag": e.get("low_confidence_flag", False),
        })

    # ─── Risk Scores ─────────────────────────────────────────────────────────
    risk = calculate_risk_score(merged_3)
    overall_score = risk["overall"]

    # ─── AGENT 5: NEGOTIATION ADVISOR ────────────────────────────────────────
    await progress(5, "Building negotiation strategy...")
    negotiation = await agent5_negotiator.run(merged_3, document_type, overall_score)
    neg_output = negotiation.get("negotiation_output", {})

    # ─── Sort by severity ────────────────────────────────────────────────────
    merged_3.sort(key=lambda c: SEVERITY_ORDER.get(c.get("severity","LOW"), 0), reverse=True)
    for i, c in enumerate(merged_3, 1):
        c["priority_rank"] = i

    # ─── Contradictions ──────────────────────────────────────────────────────
    contradictions = []
    for c in merged_3:
        rt = c.get("reasoning_trace", {})
        if rt.get("contradiction_scan"):
            contradictions.extend(rt["contradiction_scan"])

    duration = round(time.time() - start_time, 2)

    # ─── Final Output ────────────────────────────────────────────────────────
    return {
        "session_id": session_id,
        "filename": filename,
        "document_type": document_type,
        "document_type_confidence": doc_confidence,
        "low_document_confidence": doc_confidence < 0.80,
        "overall_risk_score": overall_score,
        "risk_breakdown": risk["breakdown"],
        "clause_counts": count_by_severity(merged_3),
        "clauses": merged_3,
        "contradictions_detected": list(set(contradictions)),
        "top_priority_negotiation_item": neg_output.get("top_priority_negotiation_item", ""),
        "negotiation_strategy": neg_output.get("negotiation_strategy", {}),
        "redline_suggestions": neg_output.get("redline_suggestions", []),
        "negotiation_email_template": neg_output.get("negotiation_email_template", ""),
        "power_dynamics": neg_output.get("power_dynamics", ""),
        "walk_away_triggers": neg_output.get("walk_away_triggers", []),
        "processing_metadata": {
            "pipeline_run_id": pipeline_id,
            "session_id": session_id,
            "analysis_duration_seconds": duration,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "gcp_project_id": "promptwars-community-x-ascen"
        },
        "disclaimer": DISCLAIMER
    }
