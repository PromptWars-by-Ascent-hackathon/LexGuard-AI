/**
 * @module server
 * @description LexGuard AI — Express HTTP server.
 *
 * Security features:
 * - helmet: sets secure HTTP headers
 * - express-rate-limit: prevents API abuse (10 uploads/min per IP, 60 status polls/min)
 * - Input sanitization via documentParser utility
 * - .env for all secrets — no hardcoded credentials
 *
 * Routes:
 *   GET  /api/health                        — Health check
 *   POST /api/v1/documents/upload           — Upload & start analysis
 *   GET  /api/v1/analysis/:id/status        — Poll pipeline status
 *   GET  /api/v1/analysis/:id              — Get full results
 *   GET  /api/v1/sessions                  — List all sessions
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import { prepareDocument } from './utils/documentParser.js';
import { createSession, runPipeline, getSession, getAllSessions } from './pipeline.js';
import { DISCLAIMER } from './agents.js';

const app = express();

// ── Security Middleware ────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
    origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
        : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
}));

app.use(express.json({ limit: '1mb' })); // Prevent JSON body abuse

// ── Rate Limiting ─────────────────────────────────────────────────────────────

/** Upload rate limit: max 10 document uploads per IP per minute */
const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { detail: 'Too many upload requests. Please wait a moment and try again.' },
});

/** General API rate limit: max 60 requests per IP per minute */
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { detail: 'Too many requests. Please slow down.' },
});

app.use('/api/', generalLimiter);

// ── File Upload (multer — memory storage, no disk writes) ─────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB hard limit at transport layer
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
        ];
        if (allowed.includes(file.mimetype) ||
            file.originalname.match(/\.(pdf|txt|docx|doc)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type. Use PDF, DOCX, or TXT.'));
        }
    },
});

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Returns service health status. Used by Cloud Run health checks.
 */
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'healthy',
        service: 'LexGuard AI — Node.js Backend',
        version: '2.0.0',
        gcp_project: process.env.GCP_PROJECT_ID || 'lexguard-ai',
        timestamp: new Date().toISOString(),
    });
});

/**
 * POST /api/v1/documents/upload
 * Accepts a legal document (PDF/DOCX/TXT), extracts text, detects language,
 * translates if necessary, creates a session, and kicks off the async pipeline.
 */
app.post('/api/v1/documents/upload', uploadLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ detail: 'No file uploaded.' });
        }

        // Validate, extract text, and translate (if non-English)
        const { text, originalLanguage, wasTranslated, sizeMb } = await prepareDocument(
            req.file.buffer,
            req.file.originalname
        );

        const sessionId = createSession(req.file.originalname);

        // Fire-and-forget pipeline — does not block HTTP response
        runPipeline(text, sessionId, req.file.originalname, { originalLanguage, wasTranslated });

        res.json({
            session_id: sessionId,
            filename: req.file.originalname,
            file_size_mb: sizeMb,
            original_language: originalLanguage,
            was_translated: wasTranslated,
            status: 'processing',
            message: 'Document received. Analysis pipeline started.',
            disclaimer: DISCLAIMER,
        });
    } catch (err) {
        console.error('[Upload] Error:', err?.message);
        const status = err.message.includes('too large') ? 413 : 400;
        res.status(status).json({ detail: err.message });
    }
});

/**
 * GET /api/v1/analysis/:session_id/status
 * Returns the current progress of a pipeline session (which agent is running).
 * Lightweight polling endpoint — does not return full results.
 */
app.get('/api/v1/analysis/:session_id/status', (req, res) => {
    // Sanitize: only allow UUID-like session IDs
    const { session_id } = req.params;
    if (!/^[a-f0-9-]{36}$/.test(session_id)) {
        return res.status(400).json({ detail: 'Invalid session ID format.' });
    }

    const session = getSession(session_id);
    if (!session) return res.status(404).json({ detail: 'Session not found.' });

    res.json({
        session_id: session.session_id,
        status: session.status,
        progress: session.progress,
        filename: session.filename,
        created_at: session.created_at,
    });
});

/**
 * GET /api/v1/analysis/:session_id
 * Returns the full analysis result for a completed session.
 * Returns 202 if still processing, 500 if errored.
 */
app.get('/api/v1/analysis/:session_id', (req, res) => {
    const { session_id } = req.params;
    if (!/^[a-f0-9-]{36}$/.test(session_id)) {
        return res.status(400).json({ detail: 'Invalid session ID format.' });
    }

    const session = getSession(session_id);
    if (!session) return res.status(404).json({ detail: 'Session not found.' });

    if (session.status === 'processing') {
        return res.status(202).json({
            session_id: session.session_id,
            status: 'processing',
            progress: session.progress,
            message: 'Analysis in progress. Please poll again.',
        });
    }

    if (session.status === 'error') {
        return res.status(500).json({ detail: session.error });
    }

    res.json(session.result);
});

/**
 * GET /api/v1/sessions
 * Returns a reverse-chronological list of all analysis sessions.
 */
app.get('/api/v1/sessions', (_req, res) => {
    const list = getAllSessions();
    res.json({ sessions: list, total: list.length });
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[Server] Unhandled error:', err?.message);
    res.status(500).json({ detail: 'Internal server error.' });
});

// ── Start Server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`✅ LexGuard AI backend running on port ${PORT}`);
});

export default app; // For testing
