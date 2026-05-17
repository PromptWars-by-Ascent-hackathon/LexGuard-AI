/**
 * @module agents
 * @description Five-agent legal analysis pipeline using Google Gemini AI.
 *
 * Pipeline:
 * 1. Agent 1 — Extractor: Identifies and structures individual clauses
 * 2. Agent 2 — Classifier: Assigns risk severity and legal dimension
 * 3. Agent 3 — Reasoner: Deep legal reasoning on high-risk clauses
 * 4. Agent 4 — Explainer: Plain-English summaries for each clause
 * 5. Agent 5 — Negotiation Advisor: Redlines, strategy, email template
 */

import dotenv from 'dotenv';
import { callGemini, parseGeminiJson, FLASH_MODEL, PRO_MODEL } from './services/googleGemini.js';

/** Legal disclaimer appended to all results and email templates. */
export const DISCLAIMER =
    'LexGuard is an AI-powered awareness tool and does not constitute legal advice. ' +
    'Consult a licensed attorney in your jurisdiction for legally binding guidance.';

// ─── Document Type Detection ──────────────────────────────────────────────────

/**
 * Detects the type of legal document (e.g. Employment Contract, NDA, SaaS Terms).
 * Uses a cache to avoid re-calling Gemini for identical document beginnings.
 *
 * @param {string} text - Raw document text (first 3000 chars used).
 * @returns {Promise<{document_type: string, confidence: number, secondary_type: string}>}
 */
export async function detectDocumentType(text) {
    const systemPrompt = 'You are a legal document analyzer. Output only JSON.';
    const prompt = `Analyze the following document text and identify its type.

Document categories:
Employment Contract, Freelance Agreement, Vendor Agreement, SaaS Terms, Privacy Policy, NDA,
Rental Agreement, Insurance Policy, Service Agreement, Government Notice, Financial Agreement,
Loan Agreement, Licensing Agreement, Academic Certificate, Corporate Certificate, Compliance Certificate,
Terms of Service, Partnership Agreement, Consulting Agreement, Procurement Contract,
Subscription Agreement, Declaration/Consent Forms, Regulatory Documents, Legal Notices, General Certificate

Document text (first 3000 chars):
${text.slice(0, 3000)}

Return JSON only:
{"document_type": "...", "confidence": 0.95, "secondary_type": "..."}`;

    try {
        const raw = await callGemini(FLASH_MODEL, systemPrompt, prompt, 512, true); // use cache
        return parseGeminiJson(raw);
    } catch {
        return { document_type: 'General Legal Document', confidence: 0.5, secondary_type: 'Unknown' };
    }
}

// ─── Agent 1: Extractor ───────────────────────────────────────────────────────

/**
 * Agent 1 — Extractor: Segments a legal document into structured clause objects.
 *
 * @param {string} documentText - Full document text (up to 40,000 chars).
 * @param {string} documentType - The identified document category.
 * @returns {Promise<{clauses: Object[], total_clauses: number, status: string}>}
 */
export async function agent1Extractor(documentText, documentType) {
    const systemPrompt = `You are a legal document analysis AI (Agent 1 — Extractor).
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
- Output ONLY valid JSON array, no extra text`;

    const prompt = `Document Type: ${documentType}

=== DOCUMENT TEXT ===
${documentText.slice(0, 40000)}
=== END DOCUMENT ===

Extract ALL clauses from this document. Return a JSON array of clause objects.`;

    try {
        const raw = await callGemini(FLASH_MODEL, systemPrompt, prompt, 8192);
        const clauses = parseGeminiJson(raw);
        if (Array.isArray(clauses)) {
            return { clauses, total_clauses: clauses.length, status: 'success' };
        }
        throw new Error('Non-array response from extractor');
    } catch (err) {
        console.warn('[Agent1] Fallback triggered:', err?.message);
        return {
            clauses: [{
                clause_id: 'C001', raw_text: documentText.slice(0, 5000),
                section_title: 'Full Document', clause_type_hint: 'General',
                detected_parties: [], detected_dates: [], obligations: [],
                permissions: [], restrictions: [], has_ambiguous_language: false,
                non_english_detected: false, page_reference: 'Page 1',
            }],
            total_clauses: 1,
            status: 'fallback',
            error: err.message,
        };
    }
}

// ─── Agent 2: Classifier ──────────────────────────────────────────────────────

/**
 * Agent 2 — Classifier: Assigns risk severity and dimension to each clause.
 *
 * @param {Object[]} clauses - Extracted clause objects from Agent 1.
 * @param {string} documentType - Document category for contextual classification.
 * @returns {Promise<{classified_clauses: Object[], status: string}>}
 */
export async function agent2Classifier(clauses, documentType) {
    const systemPrompt = `You are a legal risk classifier AI (Agent 2 — Classifier).
Given a list of extracted legal clauses, classify each one by risk severity and dimension.

For each clause, output a JSON object with:
{
  "clause_id": "C001",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW | INFORMATIONAL",
  "risk_dimension": "Financial | Privacy | Employment | IP | Compliance | Legal Rights | Operational",
  "clause_type": "Non-Compete | IP Transfer | Arbitration | Auto-Renewal | Liability Caps | Data Collection | Termination | Indemnification | Governing Law | NDA/Confidentiality | Force Majeure | Payment Terms | Subscription Terms | Data Sharing | Monitoring/Surveillance | AI/Data Usage Rights | Ownership Transfer | Warranty Disclaimers | Limitation of Remedies | Consent Clauses | Tracking/Analytics | Third-Party Sharing | Exclusivity | Licensing Restrictions | Penalty Clauses | General",
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

Output ONLY a JSON array of classified clauses, no extra text.`;

    const clauseTexts = clauses.map((c) => ({
        clause_id: c.clause_id,
        text: (c.raw_text || '').slice(0, 2000),
        type_hint: c.clause_type_hint || '',
    }));

    const prompt = `Document Type: ${documentType}

Clauses to classify:
${JSON.stringify(clauseTexts, null, 2).slice(0, 35000)}

Classify each clause. Return JSON array matching clause_ids from input.`;

    try {
        const raw = await callGemini(FLASH_MODEL, systemPrompt, prompt, 8192);
        const classified = parseGeminiJson(raw);
        if (Array.isArray(classified)) {
            return { classified_clauses: classified, status: 'success' };
        }
        return { classified_clauses: [], status: 'error' };
    } catch (err) {
        console.warn('[Agent2] Classification failed:', err?.message);
        return { classified_clauses: [], status: 'error', error: err.message };
    }
}

// ─── Agent 3: Legal Reasoner ──────────────────────────────────────────────────

/**
 * Agent 3 — Legal Reasoner: Deep 7-step legal analysis of high-risk clauses.
 * Only processes CRITICAL, HIGH, and MEDIUM severity clauses to save tokens.
 *
 * @param {Object[]} clausesWithClassification - Merged clauses with severity data.
 * @param {string} documentType - Document category context.
 * @returns {Promise<{reasoned_clauses: Object[], status: string}>}
 */
export async function agent3Reasoner(clausesWithClassification, documentType) {
    const targetClauses = clausesWithClassification.filter((c) =>
        ['CRITICAL', 'HIGH', 'MEDIUM'].includes(c.severity)
    );

    if (targetClauses.length === 0) {
        return { reasoned_clauses: [], status: 'success', message: 'No high-risk clauses found' };
    }

    const systemPrompt = `You are an expert legal reasoning AI (Agent 3 — Legal Reasoner).
You perform deep, structured legal analysis using a 7-step framework.

For each clause (MEDIUM/HIGH/CRITICAL only), output:
{
  "clause_id": "C001",
  "reasoning_trace": {
    "intent_analysis": "Legal/business purpose of this clause",
    "scope_detection": "Geographic scope, duration, subject matter breadth",
    "implication_inference": "All practical consequences to the signing party",
    "adversarial_simulation": "Worst-case exploitation by counterparty",
    "contradiction_scan": ["clause IDs this contradicts"],
    "undefined_terms": ["vague/exploitable undefined terms"],
    "standard_comparison_summary": "How this compares to industry standard"
  },
  "overall_risk_assessment": "3-4 sentence risk summary"
}

Rules:
- NEVER fabricate legal precedents or case citations
- Clearly state when jurisdiction is uncertain
- Focus on protecting the user
- Output ONLY a JSON array. No extra text.`;

    const prompt = `Document Type: ${documentType}

Clauses requiring deep reasoning:
${JSON.stringify(targetClauses.slice(0, 20), null, 2).slice(0, 35000)}

Apply the 7-step legal reasoning framework to each clause.
Return a JSON array of reasoning objects.`;

    try {
        const raw = await callGemini(PRO_MODEL, systemPrompt, prompt, 8192);
        const reasoned = parseGeminiJson(raw);
        if (Array.isArray(reasoned)) {
            return { reasoned_clauses: reasoned, status: 'success' };
        }
        return { reasoned_clauses: [], status: 'error' };
    } catch (err) {
        console.warn('[Agent3] Reasoning failed:', err?.message);
        return { reasoned_clauses: [], status: 'error', error: err.message };
    }
}

// ─── Agent 4: Explainer ───────────────────────────────────────────────────────

/**
 * Agent 4 — Explainer: Generates plain-English explanation cards for every clause.
 *
 * @param {Object[]} mergedClauses - Clauses merged with extraction + classification + reasoning.
 * @param {string} documentType - Document category context.
 * @returns {Promise<{explanation_cards: Object[], status: string}>}
 */
export async function agent4Explainer(mergedClauses, documentType) {
    const systemPrompt = `You are a legal simplification AI (Agent 4 — Explainer).
Transform legal clause analysis into clear, Grade 8-10 reading level explanation cards.

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
- Use "may", "typically", "generally" when uncertain
- Focus on practical impact over legal theory
- Output ONLY a JSON array. No extra text.`;

    const prompt = `Document Type: ${documentType}

All clauses with classification and reasoning:
${JSON.stringify(mergedClauses.slice(0, 30), null, 2).slice(0, 35000)}

Generate an explanation card for EVERY clause. Return a JSON array.`;

    try {
        const raw = await callGemini(PRO_MODEL, systemPrompt, prompt, 8192);
        const explanations = parseGeminiJson(raw);
        if (Array.isArray(explanations)) {
            return { explanation_cards: explanations, status: 'success' };
        }
        return { explanation_cards: [], status: 'error' };
    } catch (err) {
        console.warn('[Agent4] Explanation failed:', err?.message);
        return { explanation_cards: [], status: 'error', error: err.message };
    }
}

// ─── Agent 5: Negotiation Advisor ────────────────────────────────────────────

/**
 * Agent 5 — Negotiation Advisor: Produces a comprehensive negotiation strategy.
 * Generates redlines, power dynamics assessment, and a professional email template.
 *
 * @param {Object[]} mergedClauses - Fully enriched clause objects.
 * @param {string} documentType - Document category context.
 * @param {number} overallRiskScore - Computed overall risk score (0-100).
 * @returns {Promise<{negotiation_output: Object, status: string}>}
 */
export async function agent5Negotiator(mergedClauses, documentType, overallRiskScore) {
    const systemPrompt = `You are a contract negotiation strategy AI (Agent 5 — Negotiation Advisor).

Given the full clause analysis, output ONE comprehensive negotiation strategy object:
{
  "negotiation_strategy": {
    "reject_outright": ["clause_id list"],
    "redline_and_counter": ["clause_id list"],
    "accept_with_clarification": ["clause_id list"],
    "accept_as_is": ["clause_id list"]
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
  "negotiation_email_template": "Full professional email text",
  "power_dynamics": "Brief assessment of negotiating position",
  "walk_away_triggers": ["Conditions under which user should refuse to sign"]
}

Rules:
- Be realistic about negotiating power
- Prioritize by severity (CRITICAL first)
- Email template should be professional, not aggressive
- Output ONLY the JSON object above. No extra text.`;

    const summaryClauses = mergedClauses.map((c) => ({
        clause_id: c.clause_id,
        clause_type: c.clause_type || 'General',
        severity: c.severity,
        raw_text: (c.raw_text || '').slice(0, 500),
        plain_english: c.plain_english || '',
        practical_impact: c.practical_impact || '',
    }));

    const prompt = `Document Type: ${documentType}
Overall Risk Score: ${overallRiskScore}/100

All clauses summary:
${JSON.stringify(summaryClauses.slice(0, 30), null, 2).slice(0, 30000)}

Generate the comprehensive negotiation strategy.
End the negotiation_email_template with this disclaimer:
"${DISCLAIMER}"`;

    try {
        const raw = await callGemini(PRO_MODEL, systemPrompt, prompt, 8192);
        const strategy = parseGeminiJson(raw);
        if (typeof strategy === 'object' && strategy !== null) {
            return { negotiation_output: strategy, status: 'success' };
        }
        return { negotiation_output: {}, status: 'error' };
    } catch (err) {
        console.warn('[Agent5] Negotiation strategy failed:', err?.message);
        return { negotiation_output: {}, status: 'error', error: err.message };
    }
}
