import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const PRO_MODEL = "gemini-2.5-flash";
export const FLASH_MODEL = "gemini-2.5-flash";

export const DISCLAIMER = (
    "LexGuard is an AI-powered awareness tool and does not constitute legal advice. " +
    "Consult a licensed attorney in your jurisdiction for legally binding guidance."
);

async function callModel(model, systemPrompt, prompt, maxTokens = 8192) {
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.2,
                maxOutputTokens: maxTokens
            }
        });
        return response.text;
    } catch (e) {
        console.error(`Gemini API Error (${model}):`, e);
        throw e;
    }
}

function extractJson(text) {
    let raw = text.trim();
    if (raw.startsWith("```json")) {
        raw = raw.replace(/^```json/, "");
    }
    if (raw.startsWith("```")) {
        raw = raw.replace(/^```/, "");
    }
    if (raw.endsWith("```")) {
        raw = raw.replace(/```$/, "");
    }
    return JSON.parse(raw.trim());
}

export async function detectDocumentType(text) {
    const systemPrompt = "You are a legal document analyzer. Output only JSON.";
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
        const raw = await callModel(FLASH_MODEL, systemPrompt, prompt);
        return extractJson(raw);
    } catch (e) {
        return { document_type: "General Legal Document", confidence: 0.5, secondary_type: "Unknown" };
    }
}

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
        const raw = await callModel(FLASH_MODEL, systemPrompt, prompt, 8192);
        const clauses = extractJson(raw);
        if (Array.isArray(clauses)) {
            return { clauses, total_clauses: clauses.length, status: "success" };
        }
        throw new Error("Non-list response");
    } catch (e) {
        // Fallback: return entire text as single clause
        return {
            clauses: [{
                clause_id: "C001",
                raw_text: documentText.slice(0, 5000),
                section_title: "Full Document",
                clause_type_hint: "General",
                detected_parties: [],
                detected_dates: [],
                obligations: [],
                permissions: [],
                restrictions: [],
                has_ambiguous_language: false,
                non_english_detected: false,
                page_reference: "Page 1"
            }],
            total_clauses: 1,
            status: "fallback",
            error: e.message
        };
    }
}

export async function agent2Classifier(clauses, documentType) {
    const systemPrompt = `You are a legal risk classifier AI (Agent 2 — Classifier).
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

Output ONLY a JSON array of classified clauses, no extra text.`;

    const clauseTexts = clauses.map(c => ({
        clause_id: c.clause_id,
        text: (c.raw_text || "").slice(0, 2000),
        type_hint: c.clause_type_hint || ""
    }));

    const prompt = `Document Type: ${documentType}

Clauses to classify:
${JSON.stringify(clauseTexts, null, 2).slice(0, 35000)}

Classify each clause. Return JSON array matching clause_ids from input.`;

    try {
        const raw = await callModel(FLASH_MODEL, systemPrompt, prompt, 8192);
        const classified = extractJson(raw);
        if (Array.isArray(classified)) {
            return { classified_clauses: classified, status: "success" };
        }
        return { classified_clauses: [], status: "error" };
    } catch (e) {
        return { classified_clauses: [], status: "error", error: e.message };
    }
}

export async function agent3Reasoner(clausesWithClassification, documentType) {
    const targetClauses = clausesWithClassification.filter(c => 
        ["CRITICAL", "HIGH", "MEDIUM"].includes(c.severity)
    );

    if (targetClauses.length === 0) {
        return { reasoned_clauses: [], status: "success", message: "No high-risk clauses found" };
    }

    const systemPrompt = `You are an expert legal reasoning AI (Agent 3 — Legal Reasoner).
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

Output ONLY a JSON array. No extra text.`;

    const prompt = `Document Type: ${documentType}

Clauses requiring deep reasoning:
${JSON.stringify(targetClauses.slice(0, 20), null, 2).slice(0, 35000)}

Apply the 7-step legal reasoning framework to each clause.
Return a JSON array of reasoning objects.`;

    try {
        const raw = await callModel(PRO_MODEL, systemPrompt, prompt, 8192);
        const reasoned = extractJson(raw);
        if (Array.isArray(reasoned)) {
            return { reasoned_clauses: reasoned, status: "success" };
        }
        return { reasoned_clauses: [], status: "error" };
    } catch (e) {
        return { reasoned_clauses: [], status: "error", error: e.message };
    }
}

export async function agent4Explainer(mergedClauses, documentType) {
    const systemPrompt = `You are a legal simplification AI (Agent 4 — Explainer).
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

Output ONLY a JSON array. No extra text.`;

    const prompt = `Document Type: ${documentType}

All clauses with extracted text, classification, and reasoning:
${JSON.stringify(mergedClauses.slice(0, 30), null, 2).slice(0, 35000)}

Generate an explanation card for EVERY clause listed above.
Return a JSON array with one card per clause.`;

    try {
        const raw = await callModel(PRO_MODEL, systemPrompt, prompt, 8192);
        const explanations = extractJson(raw);
        if (Array.isArray(explanations)) {
            return { explanation_cards: explanations, status: "success" };
        }
        return { explanation_cards: [], status: "error" };
    } catch (e) {
        return { explanation_cards: [], status: "error", error: e.message };
    }
}

export async function agent5Negotiator(mergedClauses, documentType, overallRiskScore) {
    const systemPrompt = `You are a contract negotiation strategy AI (Agent 5 — Negotiation Advisor).
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

Output ONLY the JSON object above. No extra text.`;

    const summaryClauses = mergedClauses.map(c => ({
        clause_id: c.clause_id,
        clause_type: c.clause_type || "General",
        severity: c.severity,
        raw_text: (c.raw_text || "").slice(0, 500),
        plain_english: c.plain_english || "",
        practical_impact: c.practical_impact || ""
    }));

    const prompt = `Document Type: ${documentType}
Overall Risk Score: ${overallRiskScore}/100

All clauses summary:
${JSON.stringify(summaryClauses.slice(0, 30), null, 2).slice(0, 30000)}

Generate the comprehensive negotiation strategy.
End the negotiation_email_template with this disclaimer:
"${DISCLAIMER}"`;

    try {
        const raw = await callModel(PRO_MODEL, systemPrompt, prompt, 8192);
        const strategy = extractJson(raw);
        if (typeof strategy === "object" && strategy !== null) {
            return { negotiation_output: strategy, status: "success" };
        }
        return { negotiation_output: {}, status: "error" };
    } catch (e) {
        return { negotiation_output: {}, status: "error", error: e.message };
    }
}
