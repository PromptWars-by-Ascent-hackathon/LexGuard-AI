/**
 * @module documentParser
 * @description Utility for extracting plain text from uploaded legal documents.
 * Supports PDF, DOCX/DOC, and plain-text formats.
 * Integrates with the Google Translate service to handle non-English documents.
 */

import { createRequire } from 'module';
import mammoth from 'mammoth';
import { prepareDocumentText } from '../services/googleTranslate.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

/** Maximum document size in megabytes allowed through the pipeline. */
export const MAX_FILE_SIZE_MB = 10;

/**
 * Validates file size against the maximum allowed limit.
 *
 * @param {Buffer} buffer - The file buffer to check.
 * @throws {Error} If the file exceeds MAX_FILE_SIZE_MB.
 */
export function validateFileSize(buffer) {
    const sizeMb = buffer.length / (1024 * 1024);
    if (sizeMb > MAX_FILE_SIZE_MB) {
        throw new Error(`File too large (${sizeMb.toFixed(1)}MB). Maximum allowed: ${MAX_FILE_SIZE_MB}MB.`);
    }
}

/**
 * Extracts plain text from an uploaded file buffer.
 * Dispatches to the appropriate parser based on file extension.
 *
 * @param {Buffer} buffer - Raw file buffer from multer.
 * @param {string} originalName - Original filename (used to determine file type).
 * @returns {Promise<string>} Extracted plain text content.
 * @throws {Error} If PDF parsing fails or file type is unsupported.
 */
export async function extractTextFromBuffer(buffer, originalName) {
    const name = originalName.toLowerCase();

    if (name.endsWith('.pdf')) {
        const parser = new PDFParse({ data: buffer });
        const pdfData = await parser.getText();
        await parser.destroy();
        return pdfData.text || '';
    }

    if (name.endsWith('.docx') || name.endsWith('.doc')) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
    }

    // Plain text / markdown / other text formats
    return buffer.toString('utf-8');
}

/**
 * Full document preparation pipeline:
 * 1. Validates file size
 * 2. Extracts text from buffer
 * 3. Detects language and translates to English if needed
 *
 * @param {Buffer} buffer - Raw file buffer.
 * @param {string} originalName - Original filename.
 * @returns {Promise<{text: string, originalLanguage: string, wasTranslated: boolean, sizeMb: number}>}
 */
export async function prepareDocument(buffer, originalName) {
    validateFileSize(buffer);

    const rawText = await extractTextFromBuffer(buffer, originalName);

    if (!rawText || rawText.trim().length < 20) {
        throw new Error('Document appears empty or unreadable. Please check the file and try again.');
    }

    // Sanitize: strip null bytes and control characters that break JSON parsing
    const sanitized = rawText.replace(/\0/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');

    const { text, originalLanguage, wasTranslated } = await prepareDocumentText(sanitized);

    return {
        text,
        originalLanguage,
        wasTranslated,
        sizeMb: Math.round((buffer.length / (1024 * 1024)) * 100) / 100,
    };
}
