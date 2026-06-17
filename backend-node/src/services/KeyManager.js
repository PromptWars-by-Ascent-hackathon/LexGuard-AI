import { sendLimitAlertSMS } from './smsService.js';
import { GoogleGenAI } from '@google/genai';

class GeminiKeyManager {
    constructor() {
        // Load keys from GEMINI_API_KEYS (comma separated)
        const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
        this.keys = keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);
        this.currentIndex = 0;
        
        if (this.keys.length === 0) {
            console.warn('[KeyManager] No Gemini API keys provided in environment variables.');
        }

        // We instantiate clients lazily or all at once. Let's do lazy instantiation.
        this.clients = {};
    }

    getClient() {
        if (this.keys.length === 0) {
            throw new Error('API key not configured.');
        }
        
        const currentKey = this.keys[this.currentIndex];
        
        if (!this.clients[currentKey]) {
            this.clients[currentKey] = new GoogleGenAI({ apiKey: currentKey });
        }
        
        return this.clients[currentKey];
    }

    async rotateKey(userPhone) {
        if (this.keys.length <= 1) {
            throw new Error('Gemini API limit reached and no fallback keys available.');
        }

        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        console.warn(`[KeyManager] Rotated to API key index ${this.currentIndex}`);
        
        // Send SMS alert in background (non-blocking)
        sendLimitAlertSMS(this.currentIndex, this.keys.length, userPhone).catch(() => {});
    }
}

export const keyManager = new GeminiKeyManager();
