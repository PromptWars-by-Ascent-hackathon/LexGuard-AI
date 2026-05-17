/**
 * @module googleTranslate
 * @description Google Cloud Translation API integration for LexGuard.
 *
 * LEGAL USE CASE:
 * Legal documents in non-English languages are common in international contracts,
 * government notices, and cross-border agreements. This module uses the Google
 * Translate API to:
 * 1. Detect whether an uploaded document is in English.
 * 2. Translate non-English documents to English before feeding them into the
 *    analysis pipeline (which is optimized for English legal text).
 * 3. Mark clauses with `non_english_detected: true` for transparency.
 *
 * This enables LexGuard to serve multilingual users globally.
 *
 * Endpoint: POST https://translation.googleapis.com/language/translate/v2
 * Auth: Uses GEMINI_API_KEY as the GCP API key (same GCP project).
 */

/**
 * Detects the language of the given text using Google Translate API.
 *
 * @param {string} text - Text to detect language for (first 500 chars sampled).
 * @returns {Promise<{language: string, confidence: number}>} ISO 639-1 language code and confidence.
 */
export async function detectLanguage(text) {
    const apiKey = process.env.GEMINI_API_KEY;
    const endpoint = `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: text.slice(0, 500) }),
        });

        if (!response.ok) {
            console.warn('[Translate API] Language detection failed:', response.status);
            return { language: 'en', confidence: 1.0 };
        }

        const data = await response.json();
        const detection = data?.data?.detections?.[0]?.[0];
        return {
            language: detection?.language || 'en',
            confidence: detection?.confidence || 1.0,
        };
    } catch (err) {
        console.warn('[Translate API] Detection error:', err?.message);
        return { language: 'en', confidence: 1.0 };
    }
}

/**
 * Translates the given text to English using the Google Translate API.
 * Only translates if the source language is not English.
 *
 * @param {string} text - The text to translate.
 * @param {string} sourceLang - ISO 639-1 language code (e.g. 'fr', 'de', 'es').
 * @returns {Promise<{translatedText: string, wasTranslated: boolean}>} Translation result.
 */
export async function translateToEnglish(text, sourceLang) {
    if (sourceLang === 'en') {
        return { translatedText: text, wasTranslated: false };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: text.slice(0, 30000), // API limit
                source: sourceLang,
                target: 'en',
                format: 'text',
            }),
        });

        if (!response.ok) {
            console.warn('[Translate API] Translation failed:', response.status);
            return { translatedText: text, wasTranslated: false };
        }

        const data = await response.json();
        const translated = data?.data?.translations?.[0]?.translatedText || text;
        return { translatedText: translated, wasTranslated: true };
    } catch (err) {
        console.warn('[Translate API] Translation error:', err?.message);
        return { translatedText: text, wasTranslated: false };
    }
}

/**
 * Convenience function: detects language and translates to English if needed.
 * This is the main entry point called by the pipeline before clause extraction.
 *
 * @param {string} documentText - Raw document text.
 * @returns {Promise<{text: string, originalLanguage: string, wasTranslated: boolean}>}
 */
export async function prepareDocumentText(documentText) {
    const { language, confidence } = await detectLanguage(documentText);

    if (language === 'en' || confidence < 0.5) {
        return { text: documentText, originalLanguage: 'en', wasTranslated: false };
    }

    const { translatedText, wasTranslated } = await translateToEnglish(documentText, language);
    if (wasTranslated) {
        console.log(`[Translate API] Document translated from ${language} to English.`);
    }

    return { text: translatedText, originalLanguage: language, wasTranslated };
}
