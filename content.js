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
    }

    async init() {
        console.log('[YRE] Phase 2 — Initializing...');

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

        chrome.runtime.onMessage.addListener((request) => {
            if (request.type === 'URL_CHANGED') {
                setTimeout(() => this.handlePageChange(), 1000);
            }
        });

        document.addEventListener('yt-navigate-finish', () => {
            this.handlePageChange();
        });

        this.handlePageChange();
        this.setupObserver();
    }

    async _loadAllData() {
        this.history = await window.YRE_Storage.getWatchHistory();
        this.profile = await window.YRE_Storage.getProfile();
        this.session = await window.YRE_Storage.getSession();
    }

    async handlePageChange() {
        await this._loadAllData();
        this.dataReady = true;

        if (window.YRE_Extractors.isWatch()) {
            this.checkWatchPage();
        } else if (window.YRE_Extractors.isHome()) {
            window.YRE_UI.clearAllBadges();
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
        if (!window.YRE_Extractors.isHome()) return;
        if (!this.dataReady) {
            console.warn('[YRE] ⚠️ Data not ready yet, skipping card processing');
            return;
        }

        const cards = window.YRE_Extractors.getRecommendedCards();
        if (cards.length === 0) return;

        console.log(`[YRE] Scoring ${cards.length} cards. Profile has ${Object.keys(this.profile?.preferences?.topChannels || {}).length} channels, ${Object.keys(this.profile?.preferences?.topKeywords || {}).length} keywords`);

        // Log first card for debugging
        if (cards.length > 0) {
            const c = cards[0];
            console.log('[YRE] Sample card:', { title: c.title, channel: c.channel, isMix: c.isMix, isPartiallyWatched: c.isPartiallyWatched });
        }

        window.YRE_Storage.logHomeFeedCards(cards);

        cards.forEach(cardData => {
            const scoreInfo = window.YRE_Scorer.calculateScore(
                cardData,
                this.history,
                this.profile,
                this.session
            );
            window.YRE_UI.injectBadge(cardData.cardElement, scoreInfo);

            if (window.YRE_AIScorer) {
                window.YRE_AIScorer.enhanceScore(cardData, this.profile, this.history, this.session)
                    .then(aiScoreInfo => {
                        if (aiScoreInfo) {
                            window.YRE_UI.updateBadge(cardData.cardElement, aiScoreInfo);
                        }
                    })
                    .catch(e => {
                        console.error('[YRE] AI Enhancement error:', e);
                    });
            }
        });
    }

    setupObserver() {
        if (this.observer) this.observer.disconnect();

        this.observer = new MutationObserver(() => {
            if (!window.YRE_Extractors.isHome()) return;
            if (!this.dataReady) return; // Don't score until data is ready

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
