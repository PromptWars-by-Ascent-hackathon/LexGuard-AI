/**
 * @module googleGemini
 * @description Google Gemini AI service for LexGuard's legal analysis pipeline.
 *
 * LEGAL USE CASE:
 * This module powers the 5-agent pipeline that extracts, classifies, reasons about,
 * explains, and builds negotiation strategies for legal clauses found in contracts,
 * NDAs, employment agreements, SaaS terms, and other legal documents. Gemini 2.5 Flash
 * is used for fast inference (Agents 1, 2) while the same model handles deep reasoning
 * (Agents 3, 4, 5) — all within Gemini's family.
 *
 * Caching: A simple in-memory TTL cache (5 min) prevents duplicate Gemini calls for
 * the same document type detection requests.
 */

import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/** Primary model for all agents */
export const FLASH_MODEL = 'gemini-2.5-flash';
/** Alias kept for semantic clarity in reasoning agents */
export const PRO_MODEL = 'gemini-2.5-flash';

/** In-memory TTL cache for repeated identical prompts (e.g. document type detection) */
const responseCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Computes a SHA-256 hash for use as a cache key.
 * @param {string} input - The string to hash.
 * @returns {string} The hex digest.
 */
function hashKey(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Calls the Gemini generative AI model with a system prompt + user prompt.
 * Includes a TTL cache to avoid repeated identical API calls.
 *
 * @param {string} model - The Gemini model identifier (e.g. 'gemini-2.5-flash').
 * @param {string} systemPrompt - The system instruction defining the agent role.
 * @param {string} userPrompt - The document/clause content to analyze.
 * @param {number} [maxTokens=8192] - Maximum output tokens.
 * @param {boolean} [useCache=false] - Whether to use the TTL response cache.
 * @returns {Promise<string>} The raw text response from Gemini.
 * @throws {Error} Propagates Gemini API errors after logging them.
 */
export async function callGemini(model, systemPrompt, userPrompt, maxTokens = 8192, useCache = false) {
    if (useCache) {
        const cacheKey = hashKey(model + systemPrompt + userPrompt);
        const cached = responseCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
            return cached.value;
        }
    }

    try {
        const response = await ai.models.generateContent({
            model,
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.2,
                maxOutputTokens: maxTokens,
            },
        });

        const text = response.text;

        if (useCache) {
            const cacheKey = hashKey(model + systemPrompt + userPrompt);
            responseCache.set(cacheKey, { value: text, ts: Date.now() });
        }

        return text;
    } catch (err) {
        console.error(`[Gemini] API error on model ${model}:`, err?.message || err);
        throw err;
    }
}

/**
 * Parses a Gemini response that may be wrapped in a JSON markdown code block.
 * @param {string} text - Raw response text from Gemini.
 * @returns {*} Parsed JSON value.
 * @throws {SyntaxError} If the cleaned text is not valid JSON.
 */
export function parseGeminiJson(text) {
    let raw = text.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(raw.trim());
}
