// ============================================================
// YRE Scorer — Phase 2.3 (Robust Matching + Mix Detection)
// ============================================================
//
// Base + Adjustments model with aggressive cross-referencing:
//   Base: 52
//   + Topic:    -5 to +25  (keyword + artist name matches)
//   + Channel:  -3 to +22  (creator affinity, FUZZY match)
//   + Session:  -2 to +20  (current rabbit hole)
//   + Length:   -4 to +6
//   + Fresh:    -2 to +6
//   + Meta:     -3 to +8
//
// Mix/Watched fast-paths: 82–96
// Cold start: 52–78
// ============================================================

const YRE_Scorer = {

  BASE_SCORE: 52,
  COLD_START_THRESHOLD: 5,

  // ========== MAIN ENTRY ==========
  calculateScore(videoData, history, profile, session) {
    const historyLen = (history && history.length) || 0;
    const isColdStart = historyLen < this.COLD_START_THRESHOLD;

    // === MIX DETECTION (multiple methods) ===
    const titleLower = (videoData.title || '').toLowerCase();
    const isMixDetected = videoData.isMix ||
      titleLower.startsWith('mix -') ||
      titleLower.startsWith('mix –') ||
      titleLower.startsWith('mix —') ||
      /^mix\s*[-–—]/.test(titleLower);

    if (isMixDetected) {
      return this._nativeFastPath(videoData, 'mix', profile);
    }
    if (videoData.isPartiallyWatched) {
      return this._nativeFastPath(videoData, 'watched', profile);
    }
    if (isColdStart) {
      return this._coldStart(videoData, history);
    }

    const prefs = (profile && profile.preferences) || {};
    const sessionVideos = (session && session.recentVideos) || [];

    // Compute each adjustment
    const topicAdj = this._topicAdj(videoData, prefs, history);
    const channelAdj = this._channelAdj(videoData, prefs, history);
    const sessionAdj = this._sessionAdj(videoData, sessionVideos, history);
    const lengthAdj = this._lengthAdj(videoData, prefs);
    const freshAdj = this._freshAdj(videoData);
    const metaAdj = this._metaAdj(videoData);

    // === SYNERGY BONUSES ===
    // When multiple signals align, the match is stronger than their sum
    let comboBonus = 0;
    if (channelAdj >= 6 && topicAdj >= 4) comboBonus += 8;  // Known creator + relevant topic
    if (channelAdj >= 6 && sessionAdj >= 3) comboBonus += 5; // Known creator + matches session
    if (topicAdj >= 8 && sessionAdj >= 6) comboBonus += 4;   // Strong topic + session alignment

    const totalAdj = topicAdj + channelAdj + sessionAdj + lengthAdj + freshAdj + metaAdj + comboBonus;
    let rawScore = this.BASE_SCORE + totalAdj + this._sv(videoData.videoId, 2);
    const score = Math.floor(Math.min(98, Math.max(35, rawScore)));

    const bd = {
      topic: topicAdj, channel: channelAdj, session: sessionAdj,
      length: lengthAdj, fresh: freshAdj, meta: metaAdj, combo: comboBonus
    };
    const reason = this._reason(videoData, bd);

    if (typeof DEBUG !== 'undefined' && DEBUG) {
      console.log(
        `[YRE] "${(videoData.title || '').substring(0, 40)}" → ${score}%`,
        `[t:${topicAdj} c:${channelAdj} s:${sessionAdj} l:${lengthAdj} f:${freshAdj} m:${metaAdj} combo:${comboBonus}]`,
        `"${reason}"`
      );
    }

    return { score, reason, breakdown: bd };
  },

  // ============================================================
  // TOPIC ADJUSTMENT: -5 to +25
  // Checks video title tokens against profile keywords AND
  // also checks channel/artist tokens from title
  // ============================================================
  _topicAdj(videoData, prefs, history) {
    const vTokens = this._tok(videoData.title);
    // Also get tokens from channel name shown on card
    const chTokens = this._tok(videoData.channel);
    // Merge all tokens from the card
    const allCardTokens = [...new Set([...vTokens, ...chTokens])];

    if (allCardTokens.length === 0) return 0;

    const topKW = prefs.topKeywords || {};
    if (Object.keys(topKW).length === 0) return 0;

    // A: How many card tokens match profile keywords?
    let matchCount = 0;
    let matchWeight = 0;
    allCardTokens.forEach(tok => {
      const count = topKW[tok] || 0;
      if (count > 0) {
        matchCount++;
        matchWeight += Math.min(5, 1 + Math.log2(count + 1));
      }
    });

    // B: Recent history title overlap
    const recent = (history || []).slice(0, 25);
    let histOverlap = 0;
    recent.forEach((h, idx) => {
      const hTokens = this._tok(h.title);
      // Also include channel tokens from history
      const hChTokens = this._tok(h.channel);
      const hAll = [...new Set([...hTokens, ...hChTokens])];
      const overlap = allCardTokens.filter(t => hAll.includes(t)).length;
      if (overlap > 0) {
        histOverlap += overlap * Math.max(0.3, 1 - idx / 25);
      }
    });

    let adj = 0;

    // Keyword matching
    if (matchCount >= 4) adj += 16;
    else if (matchCount >= 3) adj += 12;
    else if (matchCount >= 2) adj += 8;
    else if (matchCount >= 1) adj += 4;

    // Weighted frequency bonus
    adj += Math.min(7, Math.round(matchWeight));

    // History overlap
    if (histOverlap >= 5) adj += 7;
    else if (histOverlap >= 3) adj += 4;
    else if (histOverlap >= 1) adj += 2;

    return Math.min(25, Math.max(-5, adj));
  },

  // ============================================================
  // CHANNEL ADJUSTMENT: -3 to +22
  // FUZZY match: checks if ANY word from the card's channel name
  // matches ANY stored channel name (handles "Zayn, Taylor Swift, and more")
  // ============================================================
  _channelAdj(videoData, prefs, history) {
    const channel = (videoData.channel || '').trim();
    if (!channel) return 0;
    const channelLower = channel.toLowerCase();

    const topCh = prefs.topChannels || {};
    const topKW = prefs.topKeywords || {};
    const storedChannels = Object.keys(topCh);

    if (storedChannels.length === 0) return 0;

    // === Method 1: Exact match (case-insensitive) ===
    let watchCount = 0;
    for (const [key, count] of Object.entries(topCh)) {
      if (key === channelLower) {
        watchCount = count;
        break;
      }
    }

    // === Method 2: FUZZY — check if any stored channel name is CONTAINED in card channel ===
    // e.g., card says "Zayn, Taylor Swift, and more" → contains "zayn" stored channel
    if (watchCount === 0) {
      for (const [key, count] of Object.entries(topCh)) {
        if (channelLower.includes(key) || key.includes(channelLower)) {
          watchCount = Math.max(watchCount, count);
        }
      }
    }

    // === Method 3: Token overlap — channel name tokens vs stored channel tokens ===
    if (watchCount === 0) {
      const cardChTokens = this._tok(channel);
      for (const storedCh of storedChannels) {
        const storedTokens = this._tok(storedCh);
        const overlap = cardChTokens.filter(t => storedTokens.includes(t));
        if (overlap.length > 0) {
          watchCount = Math.max(watchCount, topCh[storedCh] || 0);
          break;
        }
      }
    }

    // === Method 4: Cross-reference with keywords ===
    if (watchCount === 0) {
      const cardChTokens = this._tok(channel);
      const kwMatch = cardChTokens.some(t => (topKW[t] || 0) >= 2);
      return kwMatch ? 4 : 0;
    }

    // User HAS watched this channel (or a fuzzy match)
    let adj = 7;
    if (watchCount >= 10) adj += 15;
    else if (watchCount >= 5) adj += 12;
    else if (watchCount >= 3) adj += 10;
    else if (watchCount >= 2) adj += 8;

    // Recent views (fuzzy channel match)
    const recentSlice = (history || []).slice(0, 12);
    const recentViews = recentSlice.filter(h => {
      const hCh = (h.channel || '').toLowerCase();
      return hCh === channelLower || channelLower.includes(hCh) || hCh.includes(channelLower);
    }).length;
    if (recentViews >= 2) adj += 4;
    else if (recentViews >= 1) adj += 2;

    return Math.min(22, adj);
  },

  // ============================================================
  // SESSION ADJUSTMENT: -2 to +20
  // ============================================================
  _sessionAdj(videoData, sessionVideos, history) {
    const recent = (sessionVideos && sessionVideos.length >= 2)
      ? sessionVideos
      : (history || []).slice(0, 10).map(h => ({ title: h.title, channel: h.channel }));
    if (recent.length < 2) return 0;

    const vTokens = this._tok(videoData.title);
    const vChTokens = this._tok(videoData.channel);
    const allVTokens = [...new Set([...vTokens, ...vChTokens])];
    const vChannel = (videoData.channel || '').toLowerCase();

    let adj = 0;

    // Title + channel token overlap
    let totalOverlap = 0;
    recent.forEach(sv => {
      const svTokens = [...new Set([...this._tok(sv.title), ...this._tok(sv.channel)])];
      totalOverlap += allVTokens.filter(t => svTokens.includes(t)).length;
    });
    if (totalOverlap >= 6) adj += 10;
    else if (totalOverlap >= 3) adj += 6;
    else if (totalOverlap >= 1) adj += 3;

    // Channel overlap (fuzzy)
    if (vChannel) {
      const chMatches = recent.filter(sv => {
        const sc = (sv.channel || '').toLowerCase();
        return sc === vChannel || vChannel.includes(sc) || sc.includes(vChannel);
      }).length;
      if (chMatches >= 3) adj += 8;
      else if (chMatches >= 2) adj += 5;
      else if (chMatches >= 1) adj += 3;
    }

    // Rabbit hole detection
    if (recent.length >= 4) {
      const freqs = {};
      recent.forEach(sv => {
        [...this._tok(sv.title), ...this._tok(sv.channel)].forEach(t => {
          freqs[t] = (freqs[t] || 0) + 1;
        });
      });
      const thresh = Math.max(2, Math.ceil(recent.length * 0.3));
      const hotTokens = Object.keys(freqs).filter(t => freqs[t] >= thresh);
      if (hotTokens.length > 0) {
        const hits = allVTokens.filter(t => hotTokens.includes(t)).length;
        if (hits >= 2) adj += 6;
        else if (hits >= 1) adj += 3;
      }
    }

    return Math.min(20, Math.max(-2, adj));
  },

  // ========== LENGTH: -4 to +6 ==========
  _lengthAdj(videoData, prefs) {
    const b = prefs.lengthBuckets || {};
    const vb = videoData.lengthBucket || 'unknown';
    if (vb === 'unknown') return 0;
    const total = (b.short || 0) + (b.medium || 0) + (b.long || 0);
    if (total < 3) return 0;
    const pref = (b[vb] || 0) / total;
    if (pref >= 0.6) return 6;
    if (pref >= 0.4) return 3;
    if (pref >= 0.2) return 0;
    return -4;
  },

  // ========== FRESHNESS: -2 to +6 ==========
  _freshAdj(videoData) {
    if (!videoData.publishText) return 0;
    const p = videoData.publishText.toLowerCase();
    if (p.includes('minute') || p.includes('hour')) return 6;
    if (p.includes('day')) return 3;
    if (p.includes('week')) return 1;
    if (p.includes('year')) return -2;
    return 0;
  },

  // ========== METADATA: -3 to +8 ==========
  _metaAdj(videoData) {
    let adj = 0;
    if (videoData.viewsText) {
      const vt = videoData.viewsText.toLowerCase();
      const n = parseFloat((vt.match(/[\d.]+/) || ['0'])[0]);
      if (vt.includes('b')) adj += 4;
      else if (vt.includes('m') && n >= 10) adj += 3;
      else if (vt.includes('m')) adj += 2;
      else if (vt.includes('k') && n >= 100) adj += 1;
    }
    if (videoData.isVerified) adj += 2;
    if (videoData.isShort) adj += 1;
    return Math.min(8, Math.max(-3, adj));
  },

  // ========== NATIVE FAST PATHS (Mix / Partially Watched) ==========
  _nativeFastPath(videoData, type, profile) {
    let score, reason;
    if (type === 'mix') {
      // Mixes get extra boost if they contain known artists
      let artistBoost = 0;
      if (profile && profile.preferences) {
        const topCh = profile.preferences.topChannels || {};
        const titleLower = (videoData.title || '').toLowerCase();
        for (const ch of Object.keys(topCh)) {
          if (titleLower.includes(ch)) {
            artistBoost = Math.min(6, topCh[ch] * 2);
            break;
          }
        }
      }
      score = 84 + artistBoost + this._sv(videoData.videoId, 4);
      score = Math.floor(Math.min(96, Math.max(82, score)));
      reason = 'YouTube Mix curated for your taste';

      // Better reason if we matched a known artist
      if (artistBoost > 0) {
        reason = 'Personalized Mix based on your favorites';
      }
    } else {
      score = 89 + this._sv(videoData.videoId, 5);
      score = Math.floor(Math.min(96, Math.max(85, score)));
      reason = "You've already started watching this";
    }
    return { score, reason, breakdown: { native: type } };
  },

  // ========== COLD START ==========
  _coldStart(videoData, history) {
    let base = 58;
    const vTokens = this._tok(videoData.title);
    const vChTokens = this._tok(videoData.channel);
    const allTokens = [...new Set([...vTokens, ...vChTokens])];
    const vCh = (videoData.channel || '').toLowerCase();

    (history || []).forEach(h => {
      const hCh = (h.channel || '').toLowerCase();
      if (hCh && vCh && (hCh === vCh || vCh.includes(hCh) || hCh.includes(vCh))) base += 5;
      const hAll = [...this._tok(h.title), ...this._tok(h.channel)];
      if (allTokens.some(t => hAll.includes(t))) base += 3;
    });

    if (videoData.isPartiallyWatched) base += 14;
    const tl = (videoData.title || '').toLowerCase();
    if (videoData.isMix || /^mix\s*[-–—]/.test(tl)) base += 12;

    base += this._sv(videoData.videoId, 3);
    return {
      score: Math.floor(Math.min(78, Math.max(52, base))),
      reason: 'Building your preference profile',
      breakdown: { coldStart: true }
    };
  },

  // ========== REASON PICKER ==========
  _reason(videoData, bd) {
    const { topic, channel, session, length, fresh, meta } = bd;
    const ch = videoData.channel || 'this creator';

    if (channel >= 8 && topic >= 8) return `Relevant topic from ${ch}`;
    if (channel >= 10) return `You watch ${ch} often`;
    if (channel >= 6) return `Based on watching ${ch}`;
    if (session >= 8) return "Matches what you're watching right now";
    if (topic >= 12) return 'Watched similar topics recently';
    if (channel >= 3 && topic >= 5) return `Matches your taste in ${ch}`;
    if (session >= 4) return 'Fits your current viewing session';
    if (topic >= 8) return 'Related to topics you enjoy';
    if (topic >= 5) return 'Related to your interests';
    if (channel >= 3) return `Related to ${ch}`;
    if (topic >= 2) return 'Related to your viewing history';
    if (fresh >= 4) return 'Fresh upload you might enjoy';
    if (length >= 3 && videoData.lengthBucket !== 'unknown') {
      const lb = { short: 'short-form', medium: 'mid-length', long: 'long-form' };
      return `Fits your ${lb[videoData.lengthBucket]} preference`;
    }
    if (meta >= 3) return 'Popular on YouTube right now';
    if (fresh >= 1) return 'Fresh content to explore';
    return 'Discover something new';
  },

  // ========== UTILITIES ==========
  _tok(text) {
    if (window.YRE_Tokenize) return window.YRE_Tokenize(text);
    if (!text) return [];
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2);
  },

  _sv(id, range) {
    if (!id) return 0;
    let h = 0;
    for (let i = 0; i < id.length; i++) {
      h = ((h << 5) - h) + id.charCodeAt(i);
      h |= 0;
    }
    return (Math.abs(h) % (range * 2 + 1)) - range;
  }
};

window.YRE_Scorer = YRE_Scorer;
