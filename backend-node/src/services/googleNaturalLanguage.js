/**
 * @module googleNaturalLanguage
 * @description Google Cloud Natural Language API integration for LexGuard.
 *
 * LEGAL USE CASE:
 * Legal documents are dense with named entities — company names, people (parties),
 * monetary values, jurisdictions, and dates. This module calls Google's NL API to
 * automatically extract those entities from the uploaded document text, enriching
 * the pipeline results with structured party & entity data without relying solely
 * on the LLM for this structured extraction task.
 *
 * This is particularly useful for:
 * - Identifying all parties bound by a contract
 * - Extracting financial amounts and deadlines
 * - Detecting governing law jurisdictions
 *
 * Endpoint: POST https://language.googleapis.com/v1/documents:analyzeEntities
 * Auth: Uses GEMINI_API_KEY as the GCP API key for the NL API service.
 */

/**
 * Calls the Google Cloud Natural Language API to extract named entities from text.
 * Falls back gracefully if the API key lacks NL API access.
 *
 * @param {string} text - The legal document text to analyze.
 * @returns {Promise<{parties: string[], monetaryValues: string[], dates: string[], locations: string[], organizations: string[], rawEntities: Object[]}>}
 *   Structured entity extraction result.
 */
export async function extractLegalEntities(text) {
    const apiKey = process.env.GEMINI_API_KEY; // GCP API key (same project)
    const endpoint = `https://language.googleapis.com/v1/documents:analyzeEntities?key=${apiKey}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                document: {
                    type: 'PLAIN_TEXT',
                    content: text.slice(0, 10000), // NL API limit
                },
                encodingType: 'UTF8',
            }),
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            console.warn('[NL API] Entity extraction failed:', errBody?.error?.message || response.status);
            return buildFallback();
        }

        const data = await response.json();
        const entities = data.entities || [];

        const parties = [];
        const monetaryValues = [];
        const dates = [];
        const locations = [];
        const organizations = [];

        for (const entity of entities) {
            const name = entity.name;
            const type = entity.type;
            const salience = entity.salience || 0;

            if (salience < 0.01) continue; // Skip low-salience noise

            if (type === 'PERSON') parties.push(name);
            else if (type === 'ORGANIZATION') organizations.push(name);
            else if (type === 'LOCATION') locations.push(name);
            else if (type === 'DATE') dates.push(name);
            else if (type === 'PRICE' || type === 'NUMBER') monetaryValues.push(name);
        }

        return {
            parties: [...new Set(parties)],
            monetaryValues: [...new Set(monetaryValues)],
            dates: [...new Set(dates)],
            locations: [...new Set(locations)],
            organizations: [...new Set(organizations)],
            rawEntities: entities,
        };
    } catch (err) {
        console.warn('[NL API] Network error during entity extraction:', err?.message);
        return buildFallback();
    }
}

/**
 * Returns an empty fallback structure when the NL API is unavailable.
 * @returns {Object} Empty entity structure.
 */
function buildFallback() {
    return {
        parties: [],
        monetaryValues: [],
        dates: [],
        locations: [],
        organizations: [],
        rawEntities: [],
    };
}
