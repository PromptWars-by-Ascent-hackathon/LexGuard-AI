/**
 * @module pipeline
 * @description Orchestrates the 5-agent LexGuard analysis pipeline.
 * Manages session state, progress reporting, and result assembly.
 * Integrates Google Natural Language API for entity extraction.
 */

import { v4 as uuidv4 } from 'uuid';
import {
    detectDocumentType,
    agent1Extractor,
    agent2Classifier,
    agent3Reasoner,
    agent4Explainer,
    agent5Negotiator,
    DISCLAIMER,
} from './agents.js';
import { calculateRiskScore, countBySeverity, SEVERITY_ORDER } from './utils/riskScoring.js';
import { extractLegalEntities } from './services/googleNaturalLanguage.js';

/** In-memory session store. Replace with Redis/Firestore in production. */
const sessions = new Map();

/**
 * Retrieves a session by ID.
 * @param {string} sessionId
 * @returns {Object|undefined}
 */
export function getSession(sessionId) {
    return sessions.get(sessionId);
}

/**
 * Returns a summary list of all sessions (for the sessions list endpoint).
 * @returns {Object[]}
 */
export function getAllSessions() {
    return Array.from(sessions.values())
        .map((s) => ({
            session_id: s.session_id,
            filename: s.filename,
            status: s.status,
            created_at: s.created_at,
            document_type: s.result?.document_type,
            overall_risk_score: s.result?.overall_risk_score,
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Creates a new processing session and returns its ID.
 * @param {string} filename
 * @returns {string} sessionId
 */
export function createSession(filename) {
    const sessionId = uuidv4();
    sessions.set(sessionId, {
        session_id: sessionId,
        filename,
        status: 'processing',
        progress: { agent: 0, message: 'Document received, starting analysis...' },
        created_at: new Date().toISOString(),
    });
    return sessionId;
}

/**
 * Updates the progress of a session (which agent is currently running).
 * @param {string} sessionId
 * @param {number} agent - Agent number (0–5).
 * @param {string} message - Human-readable progress message.
 */
function updateProgress(sessionId, agent, message) {
    const s = sessions.get(sessionId);
    if (s) {
        s.progress = { agent, message };
        sessions.set(sessionId, s);
    }
}

/**
 * Runs the full 5-agent analysis pipeline asynchronously.
 * Called after document upload — does not block the HTTP response.
 *
 * @param {string} documentText - Extracted, sanitized document text.
 * @param {string} sessionId - Session ID to update with progress and results.
 * @param {string} filename - Original filename for metadata.
 * @param {{ originalLanguage: string, wasTranslated: boolean }} translationMeta
 * @returns {Promise<void>}
 */
export async function runPipeline(documentText, sessionId, filename, translationMeta = {}) {
    const startMs = Date.now();
    const pipelineId = uuidv4();

    try {
        // ── Stage 0: Document Type Detection ──────────────────────────────────
        updateProgress(sessionId, 0, 'Detecting document type...');
        const docTypeResult = await detectDocumentType(documentText);
        const documentType = docTypeResult.document_type || 'General Legal Document';
        const docConfidence = docTypeResult.confidence || 0.5;

        // ── Stage 0b: Google NL Entity Extraction (parallel) ──────────────────
        const entityPromise = extractLegalEntities(documentText);

        // ── Stage 1: Agent 1 — Extractor ──────────────────────────────────────
        updateProgress(sessionId, 1, 'Agent 1: Extracting clauses...');
        const extraction = await agent1Extractor(documentText, documentType);
        const rawClauses = extraction.clauses || [];

        // ── Stage 2: Agent 2 — Classifier ─────────────────────────────────────
        updateProgress(sessionId, 2, 'Agent 2: Classifying risk levels...');
        const classification = await agent2Classifier(rawClauses, documentType);
        const classified = classification.classified_clauses || [];

        const classMap = new Map(classified.map((c) => [c.clause_id, c]));
        const merged1 = rawClauses.map((rc) => ({ ...rc, ...(classMap.get(rc.clause_id) || {}) }));

        // ── Stage 3: Agent 3 — Legal Reasoner ─────────────────────────────────
        updateProgress(sessionId, 3, 'Agent 3: Reasoning through legal implications...');
        const reasoning = await agent3Reasoner(merged1, documentType);
        const reasoned = reasoning.reasoned_clauses || [];

        const reasonMap = new Map(reasoned.map((r) => [r.clause_id, r]));
        const merged2 = merged1.map((m) => ({
            ...m,
            reasoning_trace: reasonMap.get(m.clause_id)?.reasoning_trace || {},
            overall_risk_assessment: reasonMap.get(m.clause_id)?.overall_risk_assessment || '',
        }));

        // ── Stage 4: Agent 4 — Explainer ──────────────────────────────────────
        updateProgress(sessionId, 4, 'Agent 4: Generating plain-English explanations...');
        const explanation = await agent4Explainer(merged2, documentType);
        const explanations = explanation.explanation_cards || [];

        const explainMap = new Map(explanations.map((e) => [e.clause_id, e]));
        const merged3 = merged2.map((m) => {
            const e = explainMap.get(m.clause_id) || {};
            return {
                ...m,
                plain_english: e.plain_english || '',
                practical_impact: e.practical_impact || '',
                worst_case_scenario: e.worst_case_scenario || '',
                standard_comparison: e.standard_comparison || '',
                negotiation_recommendation: e.negotiation_recommendation || '',
                confidence: e.confidence || 0.85,
                low_confidence_flag: e.low_confidence_flag || false,
            };
        });

        // ── Risk Score Computation ─────────────────────────────────────────────
        const risk = calculateRiskScore(merged3);
        const overallScore = risk.overall;

        // ── Stage 5: Agent 5 — Negotiation Advisor ────────────────────────────
        updateProgress(sessionId, 5, 'Agent 5: Building negotiation strategy...');
        const negotiation = await agent5Negotiator(merged3, documentType, overallScore);
        const negOutput = negotiation.negotiation_output || {};

        // ── Await NL Entity Extraction ─────────────────────────────────────────
        const entities = await entityPromise;

        // ── Sort & Rank by Severity ────────────────────────────────────────────
        merged3.sort((a, b) =>
            (SEVERITY_ORDER[b.severity || 'LOW'] || 0) - (SEVERITY_ORDER[a.severity || 'LOW'] || 0)
        );
        merged3.forEach((c, idx) => { c.priority_rank = idx + 1; });

        // ── Contradiction Detection ────────────────────────────────────────────
        const contradictions = [];
        for (const c of merged3) {
            const cs = c.reasoning_trace?.contradiction_scan || [];
            if (Array.isArray(cs)) contradictions.push(...cs);
        }

        const duration = Math.round(((Date.now() - startMs) / 1000) * 100) / 100;

        const result = {
            session_id: sessionId,
            filename,
            document_type: documentType,
            document_type_confidence: docConfidence,
            low_document_confidence: docConfidence < 0.80,
            original_language: translationMeta.originalLanguage || 'en',
            was_translated: translationMeta.wasTranslated || false,
            overall_risk_score: overallScore,
            risk_breakdown: risk.breakdown,
            clause_counts: countBySeverity(merged3),
            clauses: merged3,
            entities,                          // ← Google NL API result
            contradictions_detected: [...new Set(contradictions)],
            top_priority_negotiation_item: negOutput.top_priority_negotiation_item || '',
            negotiation_strategy: negOutput.negotiation_strategy || {},
            redline_suggestions: negOutput.redline_suggestions || [],
            negotiation_email_template: negOutput.negotiation_email_template || '',
            power_dynamics: negOutput.power_dynamics || '',
            walk_away_triggers: negOutput.walk_away_triggers || [],
            processing_metadata: {
                pipeline_run_id: pipelineId,
                session_id: sessionId,
                analysis_duration_seconds: duration,
                timestamp: new Date().toISOString(),
                gcp_project_id: process.env.GCP_PROJECT_ID || 'lexguard-ai',
            },
            disclaimer: DISCLAIMER,
        };

        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'completed';
            session.result = result;
            session.progress = { agent: 5, message: 'Analysis complete!' };
            sessions.set(sessionId, session);
        }
    } catch (err) {
        console.error('[Pipeline] Fatal error:', err?.message);
        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'error';
            session.error = err.message;
            session.progress = { agent: -1, message: `Error: ${err.message}` };
            sessions.set(sessionId, session);
        }
    }
}
