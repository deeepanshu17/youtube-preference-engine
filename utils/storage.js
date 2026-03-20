// ============================================================
// YRE Storage Layer — Phase 2 (Profile + Session + History)
// ============================================================
// Backward-compatible: Phase 1 history key "yre_watch_history" is preserved.
// New keys: "yre_user_profile", "yre_current_session", "yre_feed_logs"
// Migration-safe: if old history exists but no profile, we auto-build one.
// ============================================================

const YRE_STORAGE_KEYS = {
    HISTORY: 'yre_watch_history',
    PROFILE: 'yre_user_profile',
    SESSION: 'yre_current_session',
    FEED_LOGS: 'yre_feed_logs'
};

const MAX_HISTORY = 200;
const MAX_SESSION_VIDEOS = 20;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_FEED_SNAPSHOTS = 10;
const DEBUG = true;

// --------------- STOP WORDS for keyword extraction ---------------
const STOP_WORDS = new Set([
    'official', 'video', 'trailer', 'full', 'song', 'episode', 'new',
    'live', 'shorts', 'reaction', 'clip', 'the', 'and', 'for', 'with',
    'this', 'that', 'from', 'you', 'your', 'are', 'was', 'were', 'has',
    'have', 'had', 'not', 'but', 'can', 'all', 'will', 'just', 'been',
    'its', 'into', 'about', 'than', 'them', 'then', 'what', 'when',
    'how', 'who', 'why', 'out', 'more', 'some', 'other', 'one', 'two',
    'also', 'back', 'after', 'use', 'our', 'most', 'very', 'make',
    'like', 'over', 'such', 'take', 'only', 'come', 'could', 'get',
    'part', 'feat', 'prod', 'lyric', 'lyrics', 'audio', 'music',
    'best', 'ever', 'first', 'last', 'every', 'much', 'many'
]);

// --------------- Tokenizer ---------------
function tokenize(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

// --------------- Safe Chrome Storage Wrapper ---------------
// Prevents "Extension context invalidated" crashes when extension
// is reloaded while old content scripts are still running.
function safeChromeStorage(method, ...args) {
    return new Promise((resolve) => {
        try {
            if (!chrome?.storage?.local) {
                console.warn('[YRE-Storage] Extension context lost, skipping storage call.');
                resolve(method === 'get' ? {} : undefined);
                return;
            }
            if (method === 'get') {
                chrome.storage.local.get(...args, (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[YRE-Storage] Storage read error:', chrome.runtime.lastError.message);
                        resolve({});
                    } else {
                        resolve(result);
                    }
                });
            } else if (method === 'set') {
                chrome.storage.local.set(...args, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('[YRE-Storage] Storage write error:', chrome.runtime.lastError.message);
                    }
                    resolve();
                });
            }
        } catch (e) {
            console.warn('[YRE-Storage] Context invalidated:', e.message);
            resolve(method === 'get' ? {} : undefined);
        }
    });
}

// --------------- Empty Profile Schema ---------------
function getEmptyProfile() {
    return {
        meta: {
            version: 2,
            createdAt: Date.now(),
            lastUpdatedAt: Date.now(),
            migratedFromV1: false
        },
        watchHistory: {
            totalTracked: 0,
            lastTrackedAt: null
        },
        preferences: {
            topChannels: {},     // { channelName: count }
            topKeywords: {},     // { keyword: count }
            lengthBuckets: { short: 0, medium: 0, long: 0, unknown: 0 }
        }
    };
}

// --------------- The Storage Module ---------------
const YRE_Storage = {

    // ========== INITIALIZATION ==========
    async initialize() {
        const res = await safeChromeStorage('get', [YRE_STORAGE_KEYS.HISTORY, YRE_STORAGE_KEYS.PROFILE]);
        const toSet = {};
        const history = res[YRE_STORAGE_KEYS.HISTORY] || [];

        // Always rebuild profile from history to ensure
        // case-normalized channels and up-to-date keywords
        const profile = getEmptyProfile();
        if (history.length > 0) {
            profile.meta.migratedFromV1 = true;
            profile.watchHistory.totalTracked = history.length;
            profile.watchHistory.lastTrackedAt = history[0]?.timestamp || Date.now();
            history.forEach(item => {
                this._processWatchIntoProfile(profile, item);
            });
            if (DEBUG) console.log(`[YRE-Storage] Built profile from ${history.length} history items. Channels: ${Object.keys(profile.preferences.topChannels).join(', ')}`);
        }
        toSet[YRE_STORAGE_KEYS.PROFILE] = profile;

        if (!res[YRE_STORAGE_KEYS.HISTORY]) {
            toSet[YRE_STORAGE_KEYS.HISTORY] = [];
        }

        await safeChromeStorage('set', toSet);
        if (DEBUG) console.log('[YRE-Storage] Initialization complete.');
    },

    // ========== WATCH HISTORY ==========
    async getWatchHistory() {
        const result = await safeChromeStorage('get', [YRE_STORAGE_KEYS.HISTORY]);
        return result[YRE_STORAGE_KEYS.HISTORY] || [];
    },

    async addWatchedVideo(video) {
        let history = await this.getWatchHistory();

        // Anti-bounce: skip if same video at top within 60 seconds
        if (history.length > 0 && history[0].videoId === video.videoId) {
            if ((Date.now() - (history[0].timestamp || 0)) < 60000) {
                if (DEBUG) console.log('[YRE-Storage] Duplicate/bounce watch detected. Skipping.');
                return history;
            }
        }

        // Mark revisits
        video.isRevisit = history.some(h => h.videoId === video.videoId);

        history.unshift(video);
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }

        // Update profile
        const profile = await this.getProfile();
        this._processWatchIntoProfile(profile, video);
        profile.meta.lastUpdatedAt = Date.now();
        profile.watchHistory.totalTracked += 1;
        profile.watchHistory.lastTrackedAt = Date.now();

        // Update session
        await this._updateSession(video);

        await safeChromeStorage('set', {
            [YRE_STORAGE_KEYS.HISTORY]: history,
            [YRE_STORAGE_KEYS.PROFILE]: profile
        });

        if (DEBUG) console.log(`[YRE-Storage] Added to watch history. Total: ${history.length}`);
        return history;
    },

    // ========== PROFILE ==========
    async getProfile() {
        const result = await safeChromeStorage('get', [YRE_STORAGE_KEYS.PROFILE]);
        return result[YRE_STORAGE_KEYS.PROFILE] || getEmptyProfile();
    },

    /** Internal: process a single video into profile preferences */
    _processWatchIntoProfile(profile, videoMeta) {
        const prefs = profile.preferences;

        // Channel frequency — store lowercase for consistent matching
        const chName = videoMeta.channel;
        if (chName) {
            const chKey = chName.toLowerCase().trim();
            prefs.topChannels[chKey] = (prefs.topChannels[chKey] || 0) + 1;

            // ALSO add channel name tokens as keywords
            // so artist names like "zayn", "karan", "aujla" become searchable
            tokenize(chName).forEach(tk => {
                prefs.topKeywords[tk] = (prefs.topKeywords[tk] || 0) + 1;
            });
        }

        // Keyword frequency from title (filtered)
        const tokens = tokenize(videoMeta.title);
        tokens.forEach(tk => {
            prefs.topKeywords[tk] = (prefs.topKeywords[tk] || 0) + 1;
        });

        // Length bucket
        const lb = videoMeta.lengthBucket || 'unknown';
        if (prefs.lengthBuckets[lb] !== undefined) {
            prefs.lengthBuckets[lb] += 1;
        }
    },

    // ========== SESSION ==========
    async getSession() {
        const result = await safeChromeStorage('get', [YRE_STORAGE_KEYS.SESSION]);
        const session = result[YRE_STORAGE_KEYS.SESSION];
        const now = Date.now();

        if (!session || (now - (session.lastActive || 0)) > SESSION_TIMEOUT_MS) {
            const newSession = {
                id: 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + now,
                startedAt: now,
                lastActive: now,
                recentVideos: []
            };
            await safeChromeStorage('set', { [YRE_STORAGE_KEYS.SESSION]: newSession });
            return newSession;
        }
        return session;
    },

    async _updateSession(video) {
        const session = await this.getSession();
        session.lastActive = Date.now();

        // Push video to recent session list
        session.recentVideos.push({
            videoId: video.videoId,
            title: video.title || '',
            channel: video.channel || '',
            timestamp: Date.now()
        });

        if (session.recentVideos.length > MAX_SESSION_VIDEOS) {
            session.recentVideos.shift();
        }

        await safeChromeStorage('set', { [YRE_STORAGE_KEYS.SESSION]: session });
    },

    // ========== FEED LOGS ==========
    async logHomeFeedCards(cards) {
        if (!cards || cards.length === 0) return;
        const res = await safeChromeStorage('get', [YRE_STORAGE_KEYS.FEED_LOGS]);
        let snapshots = res[YRE_STORAGE_KEYS.FEED_LOGS] || [];
        snapshots.unshift({
            timestamp: Date.now(),
            count: cards.length,
            cards: cards.map(c => ({
                id: c.videoId, ch: c.channel,
                type: c.isMix ? 'mix' : 'organic'
            }))
        });
        if (snapshots.length > MAX_FEED_SNAPSHOTS) {
            snapshots = snapshots.slice(0, MAX_FEED_SNAPSHOTS);
        }
        await safeChromeStorage('set', { [YRE_STORAGE_KEYS.FEED_LOGS]: snapshots });
    }
};

// Export for content scripts
window.YRE_Storage = YRE_Storage;
window.YRE_Tokenize = tokenize;
window.YRE_STOP_WORDS = STOP_WORDS;
