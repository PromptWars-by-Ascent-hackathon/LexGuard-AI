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

import { callGemini, parseGeminiJson, FLASH_MODEL, PRO_MODEL } from './services/googleGemini.js';

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
export async function agent1Extractor(documentText, documentType, userPhone) {
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
        const raw = await callGemini(FLASH_MODEL, systemPrompt, prompt, 8192, false, userPhone);
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
export async function agent2Classifier(rawClauses, documentType, userPhone) {
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

    const clauseTexts = rawClauses.map((c) => ({
        clause_id: c.clause_id,
        text: (c.raw_text || '').slice(0, 2000),
        type_hint: c.clause_type_hint || '',
    }));

    const prompt = `Document Type: ${documentType}

Clauses to classify:
${JSON.stringify(clauseTexts, null, 2).slice(0, 35000)}

Classify each clause. Return JSON array matching clause_ids from input.`;

    try {
        const raw = await callGemini(FLASH_MODEL, systemPrompt, prompt, 8192, false, userPhone);
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

// ─── Agent 3: Deep Analyzer (Combined Reasoner, Explainer, Negotiator) ────────
export async function agent3DeepAnalyzer(clausesWithClassification, documentType, userPhone) {
    const targetClauses = clausesWithClassification.filter((c) =>
        ['CRITICAL', 'HIGH', 'MEDIUM'].includes(c.severity)
    );

    if (targetClauses.length === 0) {
        return { analyzed_clauses: [], negotiation_output: {}, status: 'success' };
    }

    const systemPrompt = `You are a combined Legal Reasoner, Explainer, and Negotiation Advisor AI (Agent 3).
For each clause provided, perform a deep legal analysis, explain it simply, and recommend negotiation strategies.

Output a JSON object with exactly these two keys:
1. "analyzed_clauses": an array of objects for each input clause.
2. "negotiation_output": an overall negotiation strategy for the entire document.

{
  "analyzed_clauses": [
    {
      "clause_id": "C001",
      "reasoning_trace": {
        "intent_analysis": "Legal/business purpose",
        "scope_detection": "Geographic scope, duration",
        "implication_inference": "All practical consequences",
        "adversarial_simulation": "Worst-case exploitation",
        "contradiction_scan": ["clause IDs this contradicts"],
        "undefined_terms": ["vague/exploitable undefined terms"],
        "standard_comparison_summary": "How this compares to standard"
      },
      "overall_risk_assessment": "3-4 sentence risk summary",
      "plain_english": "Simple 2-3 sentence explanation",
      "practical_impact": "How it affects the person RIGHT NOW",
      "worst_case_scenario": "If exploited maximally",
      "standard_comparison": "Is this typical?",
      "negotiation_recommendation": "Accept, reject, or negotiate?",
      "redline_language": "Suggested replacement text if any",
      "confidence": 0.92,
      "low_confidence_flag": false
    }
  ],
  "negotiation_output": {
    "negotiation_strategy": {
      "reject_outright": ["C001"],
      "redline_and_counter": ["C002"],
      "accept_with_clarification": [],
      "accept_as_is": []
    },
    "top_priority_negotiation_item": "The single most important thing to negotiate",
    "redline_suggestions": [
      {
        "clause_id": "C002",
        "original_excerpt": "...",
        "suggested_replacement": "...",
        "reason": "Why this change protects the user"
      }
    ],
    "negotiation_email_template": "Professional email text",
    "power_dynamics": "Brief assessment",
    "walk_away_triggers": ["Conditions to refuse signing"]
  }
}

Output ONLY valid JSON. No extra text.`;

    const prompt = `Document Type: ${documentType}

Clauses to analyze:
${JSON.stringify(targetClauses.slice(0, 30), null, 2).slice(0, 35000)}

Return the single combined JSON object.`;

    try {
        const raw = await callGemini(PRO_MODEL, systemPrompt, prompt, 8192, false, userPhone);
        const data = parseGeminiJson(raw);
        if (data && Array.isArray(data.analyzed_clauses)) {
            return {
                analyzed_clauses: data.analyzed_clauses,
                negotiation_output: data.negotiation_output || {},
                status: 'success'
            };
        }
        return { analyzed_clauses: [], negotiation_output: {}, status: 'error' };
    } catch (err) {
        console.warn('[Agent3] Deep Analysis failed:', err?.message);
        return { analyzed_clauses: [], negotiation_output: {}, status: 'error', error: err.message };
    }
}
