// ============================================================
// YRE AI Scorer — Phase 3.1 (Chrome AI + Gemini API Fallback)
// ============================================================
// Priority:
//   1. Chrome Built-in AI (window.ai) — zero-cost, on-device
//   2. Gemini API (gemini-2.0-flash) — free tier, 15 RPM
//   3. Graceful fallback — no AI, heuristic scores only
// ============================================================

const YRE_AIScorer = {
    _session: null,
    _isAvailable: null,
    _mode: null,         // 'chrome-ai' | 'gemini-api' | null
    _geminiKey: null,
    _rateLimitUntil: 0,  // timestamp when rate limit expires
    _requestCount: 0,
    _requestWindow: 0,

    // ========== AVAILABILITY CHECK ==========
    async isAvailable() {
        if (this._isAvailable !== null) return this._isAvailable;

        // --- Try 1: Chrome Built-in AI ---
        try {
            if (window.ai && window.ai.languageModel) {
                const capabilities = await window.ai.languageModel.capabilities();
                if (capabilities.available !== 'no') {
                    this._isAvailable = true;
                    this._mode = 'chrome-ai';
                    console.log('[YRE AI] ✔️ Chrome On-Device AI is available');
                    return true;
                }
            } else if (window.ai && window.ai.assistant) {
                const capabilities = await window.ai.assistant.capabilities();
                if (capabilities.available !== 'no') {
                    this._isAvailable = true;
                    this._mode = 'chrome-ai';
                    console.log('[YRE AI] ✔️ Chrome On-Device AI is available');
                    return true;
                }
            }
        } catch (e) {
            // Chrome AI not available, try fallback
        }

        // --- Try 2: Gemini API key from storage ---
        try {
            const result = await new Promise(resolve => {
                chrome.storage.local.get(['yre_gemini_key'], resolve);
            });
            if (result.yre_gemini_key) {
                this._geminiKey = result.yre_gemini_key;
                this._isAvailable = true;
                this._mode = 'gemini-api';
                console.log('[YRE AI] ✔️ Gemini API mode (key found in storage)');
                return true;
            }
        } catch (e) {
            // storage error
        }

        // --- Try 3: Check for key in window (set via console for testing) ---
        if (window.YRE_GEMINI_KEY) {
            this._geminiKey = window.YRE_GEMINI_KEY;
            this._isAvailable = true;
            this._mode = 'gemini-api';
            console.log('[YRE AI] ✔️ Gemini API mode (key from window.YRE_GEMINI_KEY)');
            return true;
        }

        this._isAvailable = false;
        this._mode = null;
        console.log('[YRE AI] ❌ No AI backend available. To enable:');
        console.log('[YRE AI]    1. Get a free key at https://aistudio.google.com/apikey');
        console.log('[YRE AI]    2. Run in console: YRE_AIScorer.setGeminiKey("YOUR_KEY")');
        return false;
    },

    // ========== SET GEMINI API KEY ==========
    async setGeminiKey(key) {
        if (!key || typeof key !== 'string') {
            console.error('[YRE AI] Invalid key');
            return;
        }
        this._geminiKey = key.trim();
        this._isAvailable = true;
        this._mode = 'gemini-api';

        // Persist to storage
        try {
            await new Promise(resolve => {
                chrome.storage.local.set({ yre_gemini_key: this._geminiKey }, resolve);
            });
            console.log('[YRE AI] ✅ Gemini API key saved! AI scoring is now active.');
            console.log('[YRE AI] Reload the YouTube page to see AI-enhanced scores.');
        } catch (e) {
            console.log('[YRE AI] ✅ Key set for this session (storage save failed).');
        }
    },

    // ========== GET / CREATE CHROME AI SESSION ==========
    async _getOrCreateModel() {
        if (this._session) return this._session;
        const systemPrompt = "You are an expert YouTube video recommendation scorer. Return ONLY a valid JSON object with 'score' (integer 0-100) and 'reason' (1 short sentence). No markdown, no explanation.";

        if (window.ai && window.ai.languageModel) {
            this._session = await window.ai.languageModel.create({ systemPrompt });
        } else if (window.ai && window.ai.assistant) {
            this._session = await window.ai.assistant.create({ systemPrompt });
        }
        return this._session;
    },

    // ========== RATE LIMITER (for Gemini free tier: 15 RPM) ==========
    _canMakeRequest() {
        const now = Date.now();
        if (now < this._rateLimitUntil) return false;

        // Reset window every 60s
        if (now - this._requestWindow > 60000) {
            this._requestCount = 0;
            this._requestWindow = now;
        }

        // Gemini free tier: 15 RPM, we keep buffer at 12
        if (this._requestCount >= 12) {
            this._rateLimitUntil = this._requestWindow + 60000;
            console.warn('[YRE AI] Rate limit reached, pausing AI scoring for ~1 min');
            return false;
        }

        return true;
    },

    // ========== GEMINI API CALL ==========
    async _callGeminiAPI(prompt) {
        if (!this._geminiKey) return null;
        if (!this._canMakeRequest()) return null;

        this._requestCount++;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this._geminiKey}`;

        const body = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 150,
                responseMimeType: "application/json"
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 429) {
                this._rateLimitUntil = Date.now() + 60000;
                console.warn('[YRE AI] Gemini API rate limited, pausing for 60s');
            } else {
                console.error(`[YRE AI] Gemini API error ${response.status}:`, errText);
            }
            return null;
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || null;
    },

    // ========== MAIN SCORING METHOD ==========
    async enhanceScore(videoData, profile, history, session) {
        if (!await this.isAvailable()) return null;

        try {
            // Build the prompt
            const topChannels = Object.keys(profile?.preferences?.topChannels || {}).slice(0, 10).join(', ');
            const topKeywords = Object.keys(profile?.preferences?.topKeywords || {}).slice(0, 15).join(', ');

            const prompt = `Evaluate how much the user will like this YouTube video.

USER PROFILE:
- Favorite Channels: ${topChannels || 'Unknown'}
- Favorite Keywords: ${topKeywords || 'Unknown'}

VIDEO TO SCORE:
- Title: "${videoData.title}"
- Channel: "${videoData.channel}"

Return ONLY a valid JSON object: {"score": 85, "reason": "Short explanation why"}`;

            console.groupCollapsed(`[YRE AI] Scoring "${videoData.title}" via ${this._mode}`);
            console.log("📝 PROMPT:\n", prompt);

            const startTime = performance.now();
            let responseText = null;

            // === Route to correct backend ===
            if (this._mode === 'chrome-ai') {
                const model = await this._getOrCreateModel();
                responseText = await model.prompt(prompt);
            } else if (this._mode === 'gemini-api') {
                responseText = await this._callGeminiAPI(prompt);
            }

            if (!responseText) {
                console.log('⏭️ Skipped (rate limited or no response)');
                console.groupEnd();
                return null;
            }

            const endTime = performance.now();
            console.log(`⏱️ Response: ${(endTime - startTime).toFixed(0)}ms`);
            console.log("🤖 RAW:", responseText);

            // Parse JSON from response
            let parsed = null;
            try {
                let jsonStr = responseText;
                const match = responseText.match(/\{[\s\S]*\}/);
                if (match) jsonStr = match[0];
                parsed = JSON.parse(jsonStr);
                console.log("✅ PARSED:", parsed);
            } catch (e) {
                console.warn('❌ JSON parse failed:', responseText);
                console.groupEnd();
                return null;
            }

            console.groupEnd();

            if (parsed && typeof parsed.score === 'number' && parsed.reason) {
                const aiLabel = this._mode === 'chrome-ai' ? '✨ AI' : '🌐 Gemini';
                console.log(`[YRE AI] ${aiLabel}: "${videoData.title}" → ${parsed.score}%`);
                return {
                    score: Math.min(100, Math.max(0, parsed.score)),
                    reason: `${aiLabel}: ${parsed.reason}`,
                    isAiGenerated: true
                };
            }
        } catch (e) {
            console.error('[YRE AI] Error:', e);
            this._session = null; // Reset Chrome AI session if it crashed
        }

        return null;
    }
};

window.YRE_AIScorer = YRE_AIScorer;
