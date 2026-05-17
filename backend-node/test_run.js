import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
    detectDocumentType,
    agent1Extractor,
    agent2Classifier,
    agent3Reasoner,
    agent4Explainer,
    agent5Negotiator
} from './agents.js';

const SEVERITY_ORDER = { "CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFORMATIONAL": 0 };

function calculateRiskScore(classifiedClauses) {
    if (!classifiedClauses || classifiedClauses.length === 0) {
        const defaultBreakdown = {};
        ["financial", "privacy", "employment", "ip", "compliance", "legal_rights", "operational"].forEach(d => {
            defaultBreakdown[d] = 0;
        });
        return { overall: 0, breakdown: defaultBreakdown };
    }

    const severityWeights = { "CRITICAL": 100, "HIGH": 70, "MEDIUM": 40, "LOW": 15, "INFORMATIONAL": 0 };
    const dimensionMap = {
        "Financial": "financial", "Privacy": "privacy", "Employment": "employment",
        "IP": "ip", "Compliance": "compliance", "Legal Rights": "legal_rights", "Operational": "operational"
    }

    const dimScores = {};
    Object.values(dimensionMap).forEach(d => {
        dimScores[d] = [];
    });
    const allScores = [];

    classifiedClauses.forEach(clause => {
        const severity = clause.severity || "LOW";
        const score = severityWeights[severity] !== undefined ? severityWeights[severity] : 0;
        allScores.push(score);

        const dim = dimensionMap[clause.risk_dimension] || "operational";
        if (dimScores[dim]) {
            dimScores[dim].push(score);
        }
    });

    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const overall = Math.round(sum(allScores) / Math.max(allScores.length, 1));
    
    const breakdown = {};
    Object.keys(dimScores).forEach(d => {
        const v = dimScores[d];
        breakdown[d] = v.length > 0 ? Math.round(sum(v) / v.length) : 0;
    });

    return {
        overall: Math.min(overall, 100),
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

async function main() {
    const filePath = path.join(__dirname, '../dummy_contract.txt');
    const documentText = fs.readFileSync(filePath, 'utf-8');

    console.log("Starting analysis pipeline test...");

    // 0. Detect Document Type
    console.log("0: Detecting document type...");
    const docTypeResult = await detectDocumentType(documentText);
    const documentType = docTypeResult.document_type || "General Legal Document";
    console.log(`Detected Document Type: ${documentType} (Confidence: ${docTypeResult.confidence})`);

    // 1. Extractor
    console.log("1: Extracting clauses...");
    const extraction = await agent1Extractor(documentText, documentType);
    const rawClauses = extraction.clauses || [];
    console.log(`Extracted ${rawClauses.length} clauses.`);

    // 2. Classifier
    console.log("2: Classifying risk levels...");
    const classification = await agent2Classifier(rawClauses, documentType);
    const classified = classification.classified_clauses || [];
    console.log(`Classified ${classified.length} clauses.`);

    const classMap = new Map(classified.map(c => [c.clause_id, c]));
    const merged1 = rawClauses.map(rc => {
        const cls = classMap.get(rc.clause_id) || {};
        return { ...rc, ...cls };
    });

    // 3. Legal Reasoner
    console.log("3: Reasoning through legal implications...");
    const reasoning = await agent3Reasoner(merged1, documentType);
    const reasoned = reasoning.reasoned_clauses || [];
    console.log(`Reasoned ${reasoned.length} clauses.`);

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
    console.log("4: Generating plain-English explanations...");
    const explanation = await agent4Explainer(merged2, documentType);
    const explanations = explanation.explanation_cards || [];
    console.log(`Explained ${explanations.length} clauses.`);

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
    console.log(`Overall Risk Score: ${overallScore}/100`);

    // 5. Negotiation Advisor
    console.log("5: Building negotiation strategy...");
    const negotiation = await agent5Negotiator(merged3, documentType, overallScore);
    const negOutput = negotiation.negotiation_output || {};
    console.log("Negotiation strategy formulated successfully.");

    // Sort by severity
    merged3.sort((a, b) => {
        const orderA = SEVERITY_ORDER[a.severity || "LOW"] || 0;
        const orderB = SEVERITY_ORDER[b.severity || "LOW"] || 0;
        return orderB - orderA;
    });

    merged3.forEach((c, idx) => {
        c.priority_rank = idx + 1;
    });

    const contradictions = [];
    merged3.forEach(c => {
        const rt = c.reasoning_trace || {};
        if (Array.isArray(rt.contradiction_scan)) {
            rt.contradiction_scan.forEach(x => contradictions.push(x));
        }
    });

    const result = {
        filename: "dummy_contract.txt",
        document_type: documentType,
        document_type_confidence: docTypeResult.confidence,
        low_document_confidence: docTypeResult.confidence < 0.80,
        overall_risk_score: overallScore,
        risk_breakdown: risk.breakdown,
        clause_counts: countBySeverity(merged3),
        clauses: merged3.slice(0, 2), // print top 2 for sanity check
        contradictions_detected: Array.from(new Set(contradictions)),
        top_priority_negotiation_item: negOutput.top_priority_negotiation_item || "",
        negotiation_strategy: negOutput.negotiation_strategy || {},
        redline_suggestions: negOutput.redline_suggestions || [],
        negotiation_email_template: negOutput.negotiation_email_template || "",
        power_dynamics: negOutput.power_dynamics || "",
        walk_away_triggers: negOutput.walk_away_triggers || []
    };

    console.log("=== PIPELINE OUTPUT SAMPLE ===");
    console.log(JSON.stringify(result, null, 2));
    console.log("Pipeline analysis completed successfully!");
}

main().catch(err => {
    console.error("Test execution failed:", err);
});
