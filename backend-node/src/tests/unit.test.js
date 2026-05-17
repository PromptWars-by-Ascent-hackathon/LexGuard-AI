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
import { createSession, getSession, getAllSessions } from '../pipeline.js';
import { validateFileSize, extractTextFromBuffer } from '../utils/documentParser.js';


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
        const clauses = Array.from({ length: 20 }, (_) => ({
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

// ─── Session Management tests ──────────────────────────────────────────────────

describe('Session Management', () => {
    it('creates and retrieves a new session', () => {
        const filename = 'contract.pdf';
        const sessionId = createSession(filename);
        assert.ok(sessionId, 'Should generate a valid session ID');

        const session = getSession(sessionId);
        assert.ok(session, 'Should retrieve the created session');
        assert.equal(session.filename, filename);
        assert.equal(session.status, 'processing');
        assert.equal(session.progress.agent, 0);
    });

    it('returns undefined for non-existent session ID', () => {
        const session = getSession('non-existent-id');
        assert.equal(session, undefined);
    });

    it('returns all sessions sorted by created_at desc', async () => {
        const id1 = createSession('contract1.pdf');
        // Wait 10ms to ensure distinct timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
        const id2 = createSession('contract2.pdf');

        const all = getAllSessions();
        assert.ok(all.length >= 2, 'Should contain at least 2 sessions');

        // The first element in list should be the most recently created session (id2)
        assert.equal(all[0].session_id, id2);
        assert.equal(all[0].filename, 'contract2.pdf');
        assert.equal(all[1].session_id, id1);
        assert.equal(all[1].filename, 'contract1.pdf');
    });
});

// ─── Document Parser tests ─────────────────────────────────────────────────────

describe('validateFileSize', () => {
    it('does not throw when file size is under maximum', () => {
        const buffer = Buffer.alloc(1024 * 1024 * 5); // 5 MB
        assert.doesNotThrow(() => validateFileSize(buffer));
    });

    it('throws when file size is over maximum', () => {
        const buffer = Buffer.alloc(1024 * 1024 * 11); // 11 MB (max is 10 MB)
        assert.throws(() => validateFileSize(buffer), /File too large/);
    });
});

describe('extractTextFromBuffer', () => {
    it('extracts plain text from txt files directly', async () => {
        const content = 'Hello World';
        const buffer = Buffer.from(content, 'utf-8');
        const text = await extractTextFromBuffer(buffer, 'test.txt');
        assert.equal(text, content);
    });
});

