// ============================================================
// YRE Content Script — Phase 2 (Main Orchestrator)
// ============================================================

class YouTubeRecommendationExplainer {
    constructor() {
        this.history = [];
        this.profile = null;
        this.session = null;
        this.observer = null;
        this.processTimeout = null;
        this.lastVideoId = null;
        this.dataReady = false;
        this.destroyed = false;
    }

    // Detect if the extension context is still valid
    _isContextValid() {
        try {
            // This throws if context is invalidated
            void chrome.runtime.id;
            return true;
        } catch (e) {
            return false;
        }
    }

    // Gracefully shut down when context is invalidated
    _destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        console.log('[YRE] Extension context invalidated — shutting down gracefully.');
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.processTimeout) {
            clearTimeout(this.processTimeout);
            this.processTimeout = null;
        }
    }

    async init() {
        console.log('[YRE] Phase 2 — Initializing...');

        if (!this._isContextValid()) { this._destroy(); return; }

        try {
            await window.YRE_Storage.initialize();
            await this._loadAllData();
            this.dataReady = true;

            // === DIAGNOSTIC LOG ===
            const topCh = this.profile?.preferences?.topChannels || {};
            const topKW = this.profile?.preferences?.topKeywords || {};
            console.log('[YRE] ✅ Data loaded:', {
                historyLen: this.history.length,
                channels: Object.entries(topCh).map(([k, v]) => `${k}(${v})`).join(', '),
                keywordCount: Object.keys(topKW).length,
                topKeywords: Object.entries(topKW).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}(${v})`).join(', '),
                sessionVideos: this.session?.recentVideos?.length || 0
            });
        } catch (e) {
            console.error('[YRE] ❌ Error during init:', e);
        }

        try {
            chrome.runtime.onMessage.addListener((request) => {
                if (this.destroyed) return;
                if (request.type === 'URL_CHANGED') {
                    setTimeout(() => this.handlePageChange(), 1000);
                }
            });
        } catch (e) {
            // Extension context already gone — expected after reload
        }

        document.addEventListener('yt-navigate-finish', () => {
            if (this.destroyed) return;
            this.handlePageChange();
        });

        this.handlePageChange();
        this.setupObserver();
    }

    async _loadAllData() {
        if (!this._isContextValid()) { this._destroy(); return; }
        this.history = await window.YRE_Storage.getWatchHistory();
        this.profile = await window.YRE_Storage.getProfile();
        this.session = await window.YRE_Storage.getSession();
    }

    async handlePageChange() {
        if (this.destroyed) return;
        if (!this._isContextValid()) { this._destroy(); return; }
        await this._loadAllData();
        if (this.destroyed) return; // could have been destroyed during load
        this.dataReady = true;

        if (window.YRE_Extractors.isWatch()) {
            this.checkWatchPage();
            // Score sidebar cards after video metadata loads
            setTimeout(() => this.processRecommendedCards(), 2000);
        } else if (window.YRE_Extractors.isHome() || window.YRE_Extractors.isSearch()) {
            window.YRE_UI.clearAllBadges();
            const pageType = window.YRE_Extractors.isSearch() ? 'Search' : 'Home';
            console.log(`[YRE] Processing ${pageType} page cards...`);
            setTimeout(() => this.processRecommendedCards(), 800);
        }
    }

    checkWatchPage() {
        let retry = 0;
        const interval = setInterval(async () => {
            const info = window.YRE_Extractors.getCurrentVideoInfo();
            if (info) {
                clearInterval(interval);
                if (this.lastVideoId !== info.videoId) {
                    console.log('[YRE] Tracked video:', info.title, '| channel:', info.channel);
                    this.history = await window.YRE_Storage.addWatchedVideo(info);
                    this.lastVideoId = info.videoId;
                    this.profile = await window.YRE_Storage.getProfile();
                    this.session = await window.YRE_Storage.getSession();
                }
            } else {
                retry++;
                if (retry > 10) clearInterval(interval);
            }
        }, 1000);
    }

    processRecommendedCards() {
        if (this.destroyed) return;
        if (!this._isContextValid()) { this._destroy(); return; }
        if (!window.YRE_Extractors.isScoringPage()) return;
        if (!this.dataReady) {
            console.warn('[YRE] ⚠️ Data not ready yet, skipping card processing');
            return;
        }

        // Use the unified card extractor — works for Home & Search
        const cards = window.YRE_Extractors.getAllScoringCards();
        if (cards.length === 0) return;

        const pageType = window.YRE_Extractors.isWatch() ? 'Sidebar' : (window.YRE_Extractors.isSearch() ? 'Search' : 'Home');
        console.log(`[YRE] Scoring ${cards.length} ${pageType} cards. Profile has ${Object.keys(this.profile?.preferences?.topChannels || {}).length} channels, ${Object.keys(this.profile?.preferences?.topKeywords || {}).length} keywords`);

        // Log first card for debugging
        if (cards.length > 0) {
            const c = cards[0];
            console.log('[YRE] Sample card:', { title: c.title, channel: c.channel, isMix: c.isMix, isPartiallyWatched: c.isPartiallyWatched });
        }

        window.YRE_Storage.logHomeFeedCards(cards);

        const isWatchPage = window.YRE_Extractors.isWatch();

        cards.forEach(cardData => {
            const scoreInfo = window.YRE_Scorer.calculateScore(
                cardData,
                this.history,
                this.profile,
                this.session
            );
            window.YRE_UI.injectBadge(cardData.cardElement, scoreInfo, !!cardData.isSidebar);
        });

        // AI enhancement: staggered batch (max 6 cards, 3s apart)
        if (window.YRE_AIScorer) {
            const AI_BATCH_LIMIT = 6;
            const AI_STAGGER_MS = 3000; // 3 seconds between calls
            const aiCards = cards.slice(0, AI_BATCH_LIMIT);

            aiCards.forEach((cardData, index) => {
                setTimeout(() => {
                    window.YRE_AIScorer.enhanceScore(cardData, this.profile, this.history, this.session)
                        .then(aiScoreInfo => {
                            if (aiScoreInfo) {
                                window.YRE_UI.updateBadge(cardData.cardElement, aiScoreInfo);
                            }
                        })
                        .catch(() => {}); // silently skip failures
                }, index * AI_STAGGER_MS);
            });
        }
    }

    setupObserver() {
        if (this.observer) this.observer.disconnect();

        this.observer = new MutationObserver(() => {
            if (this.destroyed) return;
            if (!this._isContextValid()) { this._destroy(); return; }
            if (!window.YRE_Extractors.isScoringPage()) return;
            if (!this.dataReady) return;

            if (this.processTimeout) clearTimeout(this.processTimeout);
            this.processTimeout = setTimeout(() => {
                this.processRecommendedCards();
            }, 1500);
        });

        this.observer.observe(document.body, { childList: true, subtree: true });
    }
}

// Bootstrap
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new YouTubeRecommendationExplainer().init();
    });
} else {
    new YouTubeRecommendationExplainer().init();
}
