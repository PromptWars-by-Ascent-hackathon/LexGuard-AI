/**
 * @file Unit tests for LexGuard core logic.
 * Tests risk scoring, document parsing utilities, and agent fallback behavior.
 *
 * Run with: node --test src/tests/unit.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import modules under test (ESM)
import { calculateRiskScore, countBySeverity } from '../utils/riskScoring.js';

// ─── calculateRiskScore tests ─────────────────────────────────────────────────

describe('calculateRiskScore', () => {
    it('returns zero scores for empty input', () => {
        const result = calculateRiskScore([]);
        assert.equal(result.overall, 0);
        assert.equal(result.breakdown.financial, 0);
        assert.equal(result.breakdown.privacy, 0);
    });

    it('returns 100 for a single CRITICAL clause', () => {
        const clauses = [{ severity: 'CRITICAL', risk_dimension: 'Financial' }];
        const result = calculateRiskScore(clauses);
        assert.equal(result.overall, 100);
        assert.equal(result.breakdown.financial, 100);
    });

    it('does not dilute a CRITICAL score when surrounded by LOW clauses', () => {
        const clauses = [
            { severity: 'CRITICAL', risk_dimension: 'IP' },
            { severity: 'LOW', risk_dimension: 'Operational' },
            { severity: 'LOW', risk_dimension: 'Operational' },
            { severity: 'LOW', risk_dimension: 'Operational' },
            { severity: 'INFORMATIONAL', risk_dimension: 'Compliance' },
        ];
        const result = calculateRiskScore(clauses);
        // Score should be well above 50 despite many LOW clauses
        assert.ok(result.overall > 50, `Expected score > 50, got ${result.overall}`);
    });

    it('scores HIGH severity between 70 and 90', () => {
        const clauses = [{ severity: 'HIGH', risk_dimension: 'Privacy' }];
        const result = calculateRiskScore(clauses);
        assert.ok(result.overall >= 70 && result.overall <= 90,
            `Expected 70-90, got ${result.overall}`);
    });

    it('scores MEDIUM severity between 35 and 55', () => {
        const clauses = [{ severity: 'MEDIUM', risk_dimension: 'Employment' }];
        const result = calculateRiskScore(clauses);
        assert.ok(result.overall >= 35 && result.overall <= 55,
            `Expected 35-55, got ${result.overall}`);
    });

    it('caps overall score at 100', () => {
        const clauses = Array.from({ length: 20 }, (_, i) => ({
            severity: 'CRITICAL',
            risk_dimension: 'Financial',
        }));
        const result = calculateRiskScore(clauses);
        assert.equal(result.overall, 100);
    });

    it('handles unknown severity gracefully (treats as LOW)', () => {
        const clauses = [{ severity: 'UNKNOWN', risk_dimension: 'Operational' }];
        const result = calculateRiskScore(clauses);
        assert.equal(result.overall, 0); // UNKNOWN maps to 0 weight
    });

    it('handles unknown risk_dimension gracefully (maps to operational)', () => {
        const clauses = [{ severity: 'HIGH', risk_dimension: 'UnknownDimension' }];
        const result = calculateRiskScore(clauses);
        assert.ok(result.breakdown.operational > 0, 'Unknown dimension should map to operational');
    });
});

// ─── countBySeverity tests ────────────────────────────────────────────────────

describe('countBySeverity', () => {
    it('correctly counts mixed severity clauses', () => {
        const clauses = [
            { severity: 'CRITICAL' },
            { severity: 'HIGH' },
            { severity: 'HIGH' },
            { severity: 'MEDIUM' },
            { severity: 'LOW' },
            { severity: 'INFORMATIONAL' },
        ];
        const counts = countBySeverity(clauses);
        assert.equal(counts.critical, 1);
        assert.equal(counts.high, 2);
        assert.equal(counts.medium, 1);
        assert.equal(counts.low, 1);
        assert.equal(counts.informational, 1);
        assert.equal(counts.total, 6);
    });

    it('returns all zeros for empty array', () => {
        const counts = countBySeverity([]);
        assert.equal(counts.total, 0);
        assert.equal(counts.critical, 0);
    });

    it('handles missing severity field (defaults to LOW)', () => {
        const clauses = [{ risk_dimension: 'Financial' }]; // no severity field
        const counts = countBySeverity(clauses);
        assert.equal(counts.low, 1);
        assert.equal(counts.total, 1);
    });

    it('is case-insensitive for severity values', () => {
        const clauses = [{ severity: 'critical' }, { severity: 'High' }];
        const counts = countBySeverity(clauses);
        assert.equal(counts.critical, 1);
        assert.equal(counts.high, 1);
    });
});
