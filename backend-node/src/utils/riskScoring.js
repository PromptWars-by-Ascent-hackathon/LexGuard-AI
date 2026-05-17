/**
 * @module riskScoring
 * @description Utility functions for computing LexGuard risk scores from classified clauses.
 *
 * The scoring algorithm prevents dilution: a single CRITICAL clause drives the overall
 * score high even if surrounded by many informational/low clauses. This avoids the
 * "averaging trap" where a dangerous clause is mathematically neutralized by boilerplate.
 *
 * Formula:
 *   overall = max(severityScores) + 0.10 * sum(remaining scores)
 *   dimension = max(dimScores) + 0.15 * sum(remaining dim scores)
 *   All scores capped at 100.
 */

/** Maps severity strings to numeric weights for scoring. */
const SEVERITY_WEIGHTS = {
    CRITICAL: 100,
    HIGH: 75,
    MEDIUM: 45,
    LOW: 15,
    INFORMATIONAL: 0,
};

/** Normalizes risk dimension labels from the Gemini classifier to internal keys. */
const DIMENSION_MAP = {
    Financial: 'financial',
    Privacy: 'privacy',
    Employment: 'employment',
    IP: 'ip',
    Compliance: 'compliance',
    'Legal Rights': 'legal_rights',
    Operational: 'operational',
};

/** All internal dimension keys — used to initialize score arrays. */
export const ALL_DIMENSIONS = Object.values(DIMENSION_MAP);

/**
 * Computes the overall risk score and per-dimension breakdown from classified clauses.
 *
 * @param {Object[]} classifiedClauses - Clauses with a `severity` and `risk_dimension` field.
 * @returns {{ overall: number, breakdown: Object.<string, number> }}
 *   Overall score (0–100) and per-dimension scores.
 */
export function calculateRiskScore(classifiedClauses) {
    if (!classifiedClauses || classifiedClauses.length === 0) {
        const breakdown = {};
        ALL_DIMENSIONS.forEach((d) => { breakdown[d] = 0; });
        return { overall: 0, breakdown };
    }

    /** @type {Object.<string, number[]>} */
    const dimScores = {};
    ALL_DIMENSIONS.forEach((d) => { dimScores[d] = []; });
    const allScores = [];

    for (const clause of classifiedClauses) {
        const severity = (clause.severity || 'LOW').toUpperCase();
        const score = SEVERITY_WEIGHTS[severity] ?? 0;
        allScores.push(score);

        const dim = DIMENSION_MAP[clause.risk_dimension] || 'operational';
        dimScores[dim].push(score);
    }

    const computeAccumulatingScore = (scores) => {
        if (scores.length === 0) return 0;
        const max = Math.max(...scores);
        const rest = scores.reduce((a, b) => a + b, 0) - max;
        return Math.min(Math.round(max + rest * 0.1), 100);
    };

    const computeDimScore = (scores) => {
        if (scores.length === 0) return 0;
        const max = Math.max(...scores);
        const rest = scores.reduce((a, b) => a + b, 0) - max;
        return Math.min(Math.round(max + rest * 0.15), 100);
    };

    const overall = computeAccumulatingScore(allScores);
    const breakdown = {};
    for (const [dim, scores] of Object.entries(dimScores)) {
        breakdown[dim] = computeDimScore(scores);
    }

    return { overall, breakdown };
}

/**
 * Counts clauses by severity level.
 *
 * @param {Object[]} clauses - Array of clause objects with a `severity` field.
 * @returns {{ critical: number, high: number, medium: number, low: number, informational: number, total: number }}
 */
export function countBySeverity(clauses) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0, total: clauses.length };
    for (const c of clauses) {
        const s = (c.severity || 'LOW').toLowerCase();
        if (s in counts) counts[s]++;
    }
    return counts;
}

/**
 * Lookup order for sorting clauses highest risk first.
 * @type {Object.<string, number>}
 */
export const SEVERITY_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFORMATIONAL: 0 };
