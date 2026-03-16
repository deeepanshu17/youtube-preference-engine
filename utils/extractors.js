// ============================================================
// YRE Extractors — Phase 2.3 (Robust YouTube 2026 DOM Selectors)
// ============================================================
// Handles:
//   1. Regular video cards (ytd-rich-item-renderer)
//   2. Mix/Radio cards (yt-lockup-view-model, ytd-radio-renderer)
//   3. Compact cards (ytd-compact-video-renderer)
//   4. Grid cards (ytd-grid-video-renderer)
// ============================================================

const YRE_Extractors = {

    // ========== Page Context ==========
    isHome() {
        return window.location.pathname === '/' || window.location.pathname === '/web';
    },

    isWatch() {
        return window.location.pathname.startsWith('/watch');
    },

    // ========== Watch Page Info ==========
    getCurrentVideoInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');
        if (!videoId) return null;

        const titleEl = document.querySelector(
            'h1.ytd-watch-metadata yt-formatted-string, h1.title yt-formatted-string'
        );
        const channelEl = document.querySelector(
            'ytd-video-owner-renderer ytd-channel-name yt-formatted-string, #owner-name a'
        );
        if (!titleEl || !channelEl) return null;

        return {
            videoId,
            title: titleEl.innerText.trim(),
            channel: channelEl.innerText.trim(),
            timestamp: Date.now(),
            lengthBucket: this._detectLengthBucketFromPlayer()
        };
    },

    // ========== Home Feed Cards ==========
    getRecommendedCards() {
        const results = [];

        // === TYPE 1: Regular video cards ===
        document.querySelectorAll('ytd-rich-item-renderer').forEach(card => {
            if (card.dataset.yreProcessed) return;
            const data = this._extractRegularCard(card);
            if (data) results.push(data);
        });

        // === TYPE 2: Grid video cards ===
        document.querySelectorAll('ytd-grid-video-renderer').forEach(card => {
            if (card.dataset.yreProcessed) return;
            const data = this._extractRegularCard(card);
            if (data) results.push(data);
        });

        // === TYPE 3: Compact video cards (sidebar) ===
        document.querySelectorAll('ytd-compact-video-renderer').forEach(card => {
            if (card.dataset.yreProcessed) return;
            const data = this._extractRegularCard(card);
            if (data) results.push(data);
        });

        return results;
    },

    // ========== REGULAR CARD EXTRACTION ==========
    _extractRegularCard(card) {
        // --- TITLE: Try multiple selectors, validate result ---
        let title = '';
        let href = '';
        let videoId = '';

        // Strategy 1: #video-title-link (best for rich-item-renderer)
        const titleLink = card.querySelector('a#video-title-link');
        if (titleLink) {
            // IMPORTANT: Use .title attribute first (always has full clean title)
            // innerText can contain duration text from overlays
            title = titleLink.getAttribute('title') || '';
            href = titleLink.getAttribute('href') || '';
            if (!title) {
                // Fallback: get text from the yt-formatted-string inside
                const fmtStr = titleLink.querySelector('yt-formatted-string');
                title = fmtStr ? (fmtStr.getAttribute('title') || fmtStr.innerText || '').trim() : '';
            }
        }

        // Strategy 2: a#video-title (search results, compact cards)
        if (!title) {
            const titleEl = card.querySelector('a#video-title');
            if (titleEl) {
                title = titleEl.getAttribute('title') || titleEl.innerText.trim() || '';
                href = titleEl.getAttribute('href') || '';
            }
        }

        // Strategy 3: #video-title (yt-formatted-string directly)
        if (!title) {
            const titleEl = card.querySelector('#video-title');
            if (titleEl) {
                title = titleEl.getAttribute('title') || titleEl.innerText.trim() || '';
                // Find href from parent or nearby link
                const parentLink = titleEl.closest('a');
                if (parentLink) href = parentLink.getAttribute('href') || '';
            }
        }

        // Strategy 4: h3 > a (generic)
        if (!title) {
            const h3Link = card.querySelector('h3 a');
            if (h3Link) {
                title = h3Link.getAttribute('title') || h3Link.innerText.trim() || '';
                href = h3Link.getAttribute('href') || '';
            }
        }

        // Strategy 5: Any yt-formatted-string in details area
        if (!title) {
            const detailsTitle = card.querySelector('#details yt-formatted-string, #meta yt-formatted-string');
            if (detailsTitle) {
                title = detailsTitle.getAttribute('title') || detailsTitle.innerText.trim() || '';
            }
        }

        // If still no href, find it from thumbnail link (but DON'T use its text!)
        if (!href) {
            const thumbLink = card.querySelector('a#thumbnail, a[href*="/watch"]');
            if (thumbLink) href = thumbLink.getAttribute('href') || '';
        }

        // Validate href and extract videoId
        if (!href || !href.includes('/watch')) return null;
        const videoIdMatch = href.match(/[?&]v=([^&]+)/);
        videoId = videoIdMatch ? videoIdMatch[1] : '';
        if (!videoId) return null;

        // Validate title is NOT a duration (the bug we're fixing!)
        if (this._isDuration(title)) {
            // Title is a duration string, try harder
            if (typeof DEBUG !== 'undefined' && DEBUG) {
                console.warn(`[YRE-Extract] Extracted duration "${title}" as title, trying .title attribute...`);
            }
            // Try to find the real title via aria-label on the card or link
            const ariaTitle = card.getAttribute('aria-label') ||
                card.querySelector('a[aria-label]')?.getAttribute('aria-label') || '';
            if (ariaTitle && !this._isDuration(ariaTitle)) {
                title = ariaTitle.split(' by ')[0].trim(); // "Song Title by Artist 1,234 views" → "Song Title"
            } else {
                title = ''; // Give up, will score as unknown
            }
        }

        // --- CHANNEL ---
        let channel = '';
        const channelSelectors = [
            'ytd-channel-name yt-formatted-string a',
            'ytd-channel-name yt-formatted-string',
            'ytd-channel-name a',
            '#channel-name yt-formatted-string',
            '#channel-name a',
            '#byline-container a[href*="/@"]',
            'a.yt-formatted-string[href*="/@"]'
        ];
        for (const sel of channelSelectors) {
            const el = card.querySelector(sel);
            if (el) {
                channel = el.innerText.trim();
                if (channel) break;
            }
        }

        // --- METADATA (views + publish time) ---
        const metadataSpans = card.querySelectorAll('#metadata-line span.ytd-video-meta-block');
        let viewsText = '';
        let publishText = '';
        if (metadataSpans.length >= 2) {
            viewsText = metadataSpans[0].innerText.trim();
            publishText = metadataSpans[1].innerText.trim();
        } else if (metadataSpans.length === 1) {
            viewsText = metadataSpans[0].innerText.trim();
        }

        // Alt metadata selectors
        if (!viewsText) {
            const metaLine = card.querySelector('#metadata-line');
            if (metaLine) {
                const spans = metaLine.querySelectorAll('span');
                if (spans.length >= 2) {
                    viewsText = spans[0].innerText.trim();
                    publishText = spans[1].innerText.trim();
                }
            }
        }

        // --- DURATION / LENGTH BUCKET ---
        const durationEl = card.querySelector(
            'ytd-thumbnail-overlay-time-status-renderer #text, ' +
            'ytd-thumbnail-overlay-time-status-renderer span'
        );
        const durationText = durationEl ? durationEl.innerText.trim() : '';
        const lengthBucket = this._parseLengthBucket(durationText);

        // --- NATIVE HINTS ---
        const titleLower = title.toLowerCase();
        const isMix = !!(
            titleLower.startsWith('mix -') ||
            titleLower.startsWith('mix –') ||
            titleLower.startsWith('mix —') ||
            /^mix\s*[-–—]/.test(titleLower) ||
            card.querySelector('ytd-thumbnail-overlay-bottom-panel-renderer') ||
            card.querySelector('ytd-radio-renderer')
        );

        const isPartiallyWatched = !!(
            card.querySelector('ytd-thumbnail-overlay-resume-playback-renderer, #progress')
        );

        const isVerified = !!(
            card.querySelector('.badge-shape-icon, ytd-badge-supported-renderer')
        );

        const isShort = !!(
            href.includes('/shorts/') ||
            durationText === 'SHORTS' ||
            (lengthBucket === 'short' && durationText && this._durationToSeconds(durationText) <= 60)
        );

        return {
            cardElement: card,
            videoId,
            title: title.trim(),
            channel: channel.trim(),
            viewsText,
            publishText,
            durationText,
            lengthBucket,
            isMix,
            isPartiallyWatched,
            isVerified,
            isShort
        };
    },

    // ========== VALIDATION HELPERS ==========
    _isDuration(text) {
        if (!text) return false;
        const t = text.trim();
        // Matches patterns like "3:12", "41:13", "1:38:48", "SHORTS"
        return /^\d{1,2}(:\d{2}){1,2}$/.test(t) ||
            t === 'SHORTS' ||
            t === 'LIVE' ||
            /^\d+:\d+\s/.test(t); // "3:12 Now playing"
    },

    // ========== DURATION HELPERS ==========
    _parseLengthBucket(durationText) {
        if (!durationText) return 'unknown';
        const secs = this._durationToSeconds(durationText);
        if (secs <= 0) return 'unknown';
        if (secs <= 240) return 'short';
        if (secs <= 1200) return 'medium';
        return 'long';
    },

    _durationToSeconds(text) {
        if (!text) return 0;
        const parts = text.trim().split(':').map(Number);
        if (parts.some(isNaN)) return 0;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return 0;
    },

    _detectLengthBucketFromPlayer() {
        try {
            const player = document.querySelector('video.html5-main-video');
            if (player && player.duration && isFinite(player.duration)) {
                const secs = player.duration;
                if (secs <= 240) return 'short';
                if (secs <= 1200) return 'medium';
                return 'long';
            }
        } catch (e) { /* ignore */ }
        return 'unknown';
    }
};

window.YRE_Extractors = YRE_Extractors;
