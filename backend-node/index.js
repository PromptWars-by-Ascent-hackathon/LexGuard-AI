import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
import mammoth from 'mammoth';

import {
    DISCLAIMER,
    detectDocumentType,
    agent1Extractor,
    agent2Classifier,
    agent3Reasoner,
    agent4Explainer,
    agent5Negotiator
} from './agents.js';

dotenv.config();

const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());

const sessions = new Map();
const SEVERITY_ORDER = { "CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFORMATIONAL": 0 };

function calculateRiskScore(classifiedClauses) {
    if (!classifiedClauses || classifiedClauses.length === 0) {
        const defaultBreakdown = {};
        ["financial", "privacy", "employment", "ip", "compliance", "legal_rights", "operational"].forEach(d => {
            defaultBreakdown[d] = 0;
        });
        return { overall: 0, breakdown: defaultBreakdown };
    }

    const severityWeights = { "CRITICAL": 100, "HIGH": 75, "MEDIUM": 45, "LOW": 15, "INFORMATIONAL": 0 };
    const dimensionMap = {
        "Financial": "financial", "Privacy": "privacy", "Employment": "employment",
        "IP": "ip", "Compliance": "compliance", "Legal Rights": "legal_rights", "Operational": "operational"
    };

    const dimScores = {};
    Object.values(dimensionMap).forEach(d => {
        dimScores[d] = [];
    });
    const allScores = [];

    classifiedClauses.forEach(clause => {
        const severity = (clause.severity || "LOW").toUpperCase();
        const score = severityWeights[severity] !== undefined ? severityWeights[severity] : 0;
        allScores.push(score);

        const dim = dimensionMap[clause.risk_dimension] || "operational";
        if (dimScores[dim]) {
            dimScores[dim].push(score);
        }
    });

    // Prevent dilution: Base score is the maximum risk found. Add 10% of remaining risks.
    const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0;
    const sumOthers = allScores.reduce((a, b) => a + b, 0) - maxScore;
    let overall = maxScore + (sumOthers * 0.1);
    overall = Math.min(Math.round(overall), 100);
    
    const breakdown = {};
    Object.keys(dimScores).forEach(d => {
        const v = dimScores[d];
        if (v.length > 0) {
            const dimMax = Math.max(...v);
            const dimOthers = v.reduce((a, b) => a + b, 0) - dimMax;
            let dimScore = dimMax + (dimOthers * 0.15); // slightly higher weight for dimension accumulation
            breakdown[d] = Math.min(Math.round(dimScore), 100);
        } else {
            breakdown[d] = 0;
        }
    });

    return {
        overall: overall,
        breakdown: breakdown
    };
}

function countBySeverity(clauses) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0, total: clauses.length };
    clauses.forEach(c => {
        const s = (c.severity || "LOW").toLowerCase();
        if (counts[s] !== undefined) {
            counts[s]++;
        }
    });
    return counts;
}

async function runPipeline(documentText, sessionId, filename) {
    const startMs = Date.now();
    const pipelineId = uuidv4();

    const updateProgress = (agent, message) => {
        const s = sessions.get(sessionId);
        if (s) {
            s.progress = { agent, message };
            sessions.set(sessionId, s);
        }
    };

    try {
        // 0. Detect Document Type
        updateProgress(0, "Detecting document type...");
        const docTypeResult = await detectDocumentType(documentText);
        const documentType = docTypeResult.document_type || "General Legal Document";
        const docConfidence = docTypeResult.confidence || 0.5;

        // 1. Extractor
        updateProgress(1, "Agent 1: Extracting clauses...");
        const extraction = await agent1Extractor(documentText, documentType);
        const rawClauses = extraction.clauses || [];

        // 2. Classifier
        updateProgress(2, "Agent 2: Classifying risk levels...");
        const classification = await agent2Classifier(rawClauses, documentType);
        const classified = classification.classified_clauses || [];

        const classMap = new Map(classified.map(c => [c.clause_id, c]));
        const merged1 = rawClauses.map(rc => {
            const cls = classMap.get(rc.clause_id) || {};
            return { ...rc, ...cls };
        });

        // 3. Legal Reasoner
        updateProgress(3, "Agent 3: Reasoning through legal implications...");
        const reasoning = await agent3Reasoner(merged1, documentType);
        const reasoned = reasoning.reasoned_clauses || [];

        const reasonMap = new Map(reasoned.map(r => [r.clause_id, r]));
        const merged2 = merged1.map(m => {
            const r = reasonMap.get(m.clause_id) || {};
            return {
                ...m,
                reasoning_trace: r.reasoning_trace || {},
                overall_risk_assessment: r.overall_risk_assessment || ""
            };
        });

        // 4. Explainer
        updateProgress(4, "Agent 4: Generating plain-English explanations...");
        const explanation = await agent4Explainer(merged2, documentType);
        const explanations = explanation.explanation_cards || [];

        const explainMap = new Map(explanations.map(e => [e.clause_id, e]));
        const merged3 = merged2.map(m => {
            const e = explainMap.get(m.clause_id) || {};
            return {
                ...m,
                plain_english: e.plain_english || "",
                practical_impact: e.practical_impact || "",
                worst_case_scenario: e.worst_case_scenario || "",
                standard_comparison: e.standard_comparison || "",
                negotiation_recommendation: e.negotiation_recommendation || "",
                confidence: e.confidence || 0.85,
                low_confidence_flag: e.low_confidence_flag || false
            };
        });

        // Calculate risk scores
        const risk = calculateRiskScore(merged3);
        const overallScore = risk.overall;

        // 5. Negotiation Advisor
        updateProgress(5, "Agent 5: Building negotiation strategy...");
        const negotiation = await agent5Negotiator(merged3, documentType, overallScore);
        const negOutput = negotiation.negotiation_output || {};

        // Sort by severity
        merged3.sort((a, b) => {
            const orderA = SEVERITY_ORDER[a.severity || "LOW"] || 0;
            const orderB = SEVERITY_ORDER[b.severity || "LOW"] || 0;
            return orderB - orderA;
        });

        merged3.forEach((c, idx) => {
            c.priority_rank = idx + 1;
        });

        // Contradictions
        const contradictions = [];
        merged3.forEach(c => {
            const rt = c.reasoning_trace || {};
            if (Array.isArray(rt.contradiction_scan)) {
                rt.contradiction_scan.forEach(x => contradictions.push(x));
            }
        });

        const duration = Math.round(((Date.now() - startMs) / 1000) * 100) / 100;

        const result = {
            session_id: sessionId,
            filename: filename,
            document_type: documentType,
            document_type_confidence: docConfidence,
            low_document_confidence: docConfidence < 0.80,
            overall_risk_score: overallScore,
            risk_breakdown: risk.breakdown,
            clause_counts: countBySeverity(merged3),
            clauses: merged3,
            contradictions_detected: Array.from(new Set(contradictions)),
            top_priority_negotiation_item: negOutput.top_priority_negotiation_item || "",
            negotiation_strategy: negOutput.negotiation_strategy || {},
            redline_suggestions: negOutput.redline_suggestions || [],
            negotiation_email_template: negOutput.negotiation_email_template || "",
            power_dynamics: negOutput.power_dynamics || "",
            walk_away_triggers: negOutput.walk_away_triggers || [],
            processing_metadata: {
                pipeline_run_id: pipelineId,
                session_id: sessionId,
                analysis_duration_seconds: duration,
                timestamp: new Date().toISOString(),
                gcp_project_id: "promptwars-community-x-ascen"
            },
            disclaimer: DISCLAIMER
        };

        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'completed';
            session.result = result;
            session.progress = { agent: 5, message: "Analysis complete!" };
            sessions.set(sessionId, session);
        }
    } catch (err) {
        console.error("Pipeline Error:", err);
        const session = sessions.get(sessionId);
        if (session) {
            session.status = 'error';
            session.error = err.message;
            session.progress = { agent: -1, message: "Error: " + err.message };
            sessions.set(sessionId, session);
        }
    }
}

app.get('/api/health', (req, res) => {
    res.json({
        status: "healthy",
        service: "LexGuard AI Node Backend",
        version: "1.0.0",
        gcp_project: "promptwars-community-x-ascen",
        timestamp: new Date().toISOString()
    });
});

app.post('/api/v1/documents/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ detail: "No file uploaded" });

        let documentText = "";
        const originalName = req.file.originalname.toLowerCase();
        if (originalName.endsWith('.pdf')) {
            const parser = new PDFParse({ data: req.file.buffer });
            const pdfData = await parser.getText();
            documentText = pdfData.text;
            await parser.destroy();
        } else if (originalName.endsWith('.docx') || originalName.endsWith('.doc')) {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            documentText = result.value;
        } else {
            documentText = req.file.buffer.toString('utf-8');
        }

        const sizeMb = req.file.buffer.length / (1024 * 1024);
        if (sizeMb > 10) { // e.g. 10MB limit
            return res.status(413).json({ detail: `File too large (${sizeMb.toFixed(1)}MB). Maximum allowed: 10MB` });
        }

        const sessionId = uuidv4();
        sessions.set(sessionId, {
            session_id: sessionId,
            filename: req.file.originalname,
            status: 'processing',
            progress: { agent: 0, message: "Document received, starting analysis..." },
            created_at: new Date().toISOString()
        });

        // Run pipeline async
        runPipeline(documentText, sessionId, req.file.originalname);

        res.json({
            session_id: sessionId,
            filename: req.file.originalname,
            file_size_mb: Math.round(sizeMb * 100) / 100,
            status: "processing",
            message: "Document received. Analysis pipeline started.",
            disclaimer: DISCLAIMER
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ detail: e.message });
    }
});

app.get('/api/v1/analysis/:session_id/status', (req, res) => {
    const session = sessions.get(req.params.session_id);
    if (!session) return res.status(404).json({ detail: "Session not found" });
    res.json({
        session_id: session.session_id,
        status: session.status,
        progress: session.progress,
        filename: session.filename,
        created_at: session.created_at
    });
});

app.get('/api/v1/analysis/:session_id', (req, res) => {
    const session = sessions.get(req.params.session_id);
    if (!session) return res.status(404).json({ detail: "Session not found" });
    if (session.status === 'processing') {
        return res.status(202).json({
            session_id: session.session_id,
            status: "processing",
            progress: session.progress,
            message: "Analysis in progress. Please poll again."
        });
    }
    if (session.status === 'error') return res.status(500).json({ detail: session.error });
    res.json(session.result);
});

app.get('/api/v1/sessions', (req, res) => {
    const list = Array.from(sessions.values()).map(s => ({
        session_id: s.session_id,
        filename: s.filename,
        status: s.status,
        created_at: s.created_at,
        document_type: s.result ? s.result.document_type : undefined,
        overall_risk_score: s.result ? s.result.overall_risk_score : undefined
    }));
    // Sort reverse chronological
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ sessions: list, total: list.length });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
