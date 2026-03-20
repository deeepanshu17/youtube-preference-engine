// ============================================================
// YRE AI Scorer — Phase 3 (Chrome Built-in AI)
// ============================================================

const YRE_AIScorer = {
    _session: null,
    _isAvailable: null,

    async isAvailable() {
        if (this._isAvailable !== null) return this._isAvailable;

        try {
            if (window.ai && window.ai.languageModel) {
                const capabilities = await window.ai.languageModel.capabilities();
                if (capabilities.available === 'no') {
                    this._isAvailable = false;
                } else {
                    this._isAvailable = true;
                }
            } else if (window.ai && window.ai.assistant) {
                const capabilities = await window.ai.assistant.capabilities();
                if (capabilities.available === 'no') {
                    this._isAvailable = false;
                } else {
                    this._isAvailable = true;
                }
            } else {
                this._isAvailable = false;
            }
        } catch (e) {
            this._isAvailable = false;
        }

        if (this._isAvailable) {
            console.log('[YRE AI] ✔️ Chrome On-Device AI is available');
        } else {
            console.log('[YRE AI] ❌ Chrome On-Device AI is NOT available');
        }
        return this._isAvailable;
    },

    async _getOrCreateModel() {
        if (this._session) return this._session;
        if (window.ai && window.ai.languageModel) {
            this._session = await window.ai.languageModel.create({
                systemPrompt: "You are an expert YouTube video recommendation scorer. Your job is to return a JSON object with 'score' (an integer 0-100) and 'reason' (a short 1-sentence string explaining why)."
            });
        } else if (window.ai && window.ai.assistant) {
            this._session = await window.ai.assistant.create({
                systemPrompt: "You are an expert YouTube video recommendation scorer. Your job is to return a JSON object with 'score' (an integer 0-100) and 'reason' (a short 1-sentence string explaining why)."
            });
        }
        return this._session;
    },

    async enhanceScore(videoData, profile, history, session) {
        if (!await this.isAvailable()) return null;

        try {
            const model = await this._getOrCreateModel();

            // Build the prompt using profile data
            const topChannels = Object.keys(profile?.preferences?.topChannels || {}).slice(0, 10).join(', ');
            const topKeywords = Object.keys(profile?.preferences?.topKeywords || {}).slice(0, 15).join(', ');

            const prompt = `Evaluate how much the user will like this video.
USER PROFILE: 
- Liked Channels: ${topChannels || 'Unknown'}
- Liked Keywords: ${topKeywords || 'Unknown'}

VIDEO TO SCORE:
- Title: "${videoData.title}"
- Channel: "${videoData.channel}"

Return ONLY a valid JSON object like this: {"score": 85, "reason": "Because you love tech channels like this."}`;

            console.groupCollapsed(`[YRE AI] Scoring "${videoData.title}"`);
            console.log("📝 PROMPT SENT TO AI:\n", prompt);

            const startTime = performance.now();
            const response = await model.prompt(prompt);
            const endTime = performance.now();

            console.log(`⏱️ RESPONSE TIME: ${(endTime - startTime).toFixed(2)}ms`);
            console.log("🤖 RAW AI RESPONSE:\n", response);

            // Try to parse JSON from the response
            let parsed = null;
            try {
                // Extract JSON if model wraps it in block quotes
                let jsonStr = response;
                const match = response.match(/\{[\s\S]*\}/);
                if (match) {
                    jsonStr = match[0];
                }
                parsed = JSON.parse(jsonStr);
                console.log("✅ PARSED JSON:\n", parsed);
            } catch (e) {
                console.warn('❌ FAILED TO PARSE JSON:\n', response);
                console.groupEnd();
                return null;
            }

            console.groupEnd();

            if (parsed && typeof parsed.score === 'number' && parsed.reason) {
                console.log(`[YRE AI] Enhanced score for "${videoData.title}" -> ${parsed.score}%`);
                return {
                    score: Math.min(100, Math.max(0, parsed.score)),
                    reason: "✨ AI: " + parsed.reason,
                    isAiGenerated: true
                };
            }
        } catch (e) {
            console.error('[YRE AI] Error enhancing score:', e);
            // Re-create the session if it crashed
            this._session = null;
        }

        return null;
    }
};

window.YRE_AIScorer = YRE_AIScorer;
