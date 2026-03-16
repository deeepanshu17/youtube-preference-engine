# YouTube Preference Engine — Chrome Extension

A personal YouTube recommendation scoring engine that runs 100% locally. It observes your viewing behavior, builds a local profile, and displays real **Match %** badges on Home feed videos showing how well each recommendation fits your actual interests.

**Zero network requests. Zero data sharing. Everything stays on your machine.**

---

## 📦 Installation

1. Clone or download this folder
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select this `YTExtension` folder
5. Navigate to [youtube.com](https://www.youtube.com) — badges will appear on Home feed

---

## ✅ Phase 1 (Complete)
- Page context detection (Home / Watch)
- Home feed card extraction with metadata
- Watch page tracking (video ID, title, channel)
- `chrome.storage.local` persistence
- SPA navigation handling
- Basic badge injection

## ✅ Phase 2 (Current)
### A) Real Scoring Engine
Computes a genuine **Match %** for each visible Home feed recommendation using weighted heuristics:

| Signal | Weight | Description |
|---|---|---|
| **Topic Relevance** | 30% | Title token overlap vs. profile keywords & recent history |
| **Channel Affinity** | 22% | How often you watch this creator (frequency-normalized) |
| **Session Match** | 20% | Overlap with your current browsing session (rabbit-hole detection) |
| **Native YouTube Hints** | 12% | Mix playlists, partially watched, red progress bars |
| **Length Preference** | 8% | Matches your short/medium/long content preferences |
| **Freshness** | 5% | How recent the upload is + light popularity signal |
| **Diversity Baseline** | 3% | Ensures exploration content gets a small positive signal |

**Key safeguards:**
- Score clamped to **35–98** range
- **Cold start mode** for users with < 5 history items (moderate 52–76 scores)
- **Stable micro-variance** (deterministic per videoId, no random boosts)
- Stop-word filtering prevents generic words from inflating scores
- Missing metadata degrades gracefully

### B) Explanation Engine
Each badge shows the **strongest contributing signal** as a human-readable reason:
- "Watched similar topics recently"
- "You watch [Channel] often"
- "Matches your current session"
- "You've already started watching this"
- "YouTube Mix curated for your taste"
- "Cold start estimate — building your profile"

### C) Visual Badge UI
- **Two-line badge**: Match % + reason text
- **Three-tier color coding**: 🟢 Green (80+), 🟡 Gold (60–79), 🟠 Amber (<60)
- **Dark & light mode** aware (uses YouTube's `html[dark]` attribute)
- Glassmorphism backdrop-blur styling
- Non-blocking (doesn't interfere with clicking)
- Duplicate-safe injection with SPA cleanup
- Re-renders on dynamic feed scroll

---

## 🔧 Architecture

```
manifest.json           — Chrome Extension config (MV3)
background.js           — Service worker: SPA URL change detection
content.js              — Main orchestrator: init → extract → score → inject
utils/
  storage.js            — Profile + Session + History persistence layer
  extractors.js         — DOM scrapers for watch page & home feed cards
  scorer.js             — Weighted heuristic scoring engine
  ui.js                 — Badge creation and injection logic
styles/
  badge.css             — Dark/light mode badge styles
icons/                  — Extension icons
```

### Data Schema

**User Profile** (`yre_user_profile`):
```json
{
  "meta": { "version": 2, "createdAt": ..., "lastUpdatedAt": ... },
  "watchHistory": { "totalTracked": 42, "lastTrackedAt": ... },
  "preferences": {
    "topChannels": { "Fireship": 12, "3Blue1Brown": 8, ... },
    "topKeywords": { "react": 15, "python": 9, "tutorial": 7, ... },
    "lengthBuckets": { "short": 10, "medium": 25, "long": 7, "unknown": 0 }
  }
}
```

**Session** (`yre_current_session`):
```json
{
  "id": "sess_abc123_...",
  "startedAt": ...,
  "lastActive": ...,
  "recentVideos": [
    { "videoId": "...", "title": "...", "channel": "...", "timestamp": ... }
  ]
}
```

---

## 🚀 Future Phases

- **Phase 3**: Popup dashboard, profile viewer, settings panel
- **Phase 4**: Topic clustering, content fatigue detection, diversity tuning
- **Phase 5**: Export/import profiles, cross-device sync
