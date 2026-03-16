<p align="center">
  <img src="icons/icon128.png" alt="YouTube Preference Engine Logo" width="80" />
</p>

<h1 align="center">YouTube Preference Engine</h1>

<p align="center">
  <strong>Know why YouTube recommends what it does — before you click.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/version-2.0.0-green?style=flat-square" alt="Version 2.0.0" />
  <img src="https://img.shields.io/badge/privacy-100%25_local-purple?style=flat-square" alt="100% Local" />
  <img src="https://img.shields.io/badge/license-MIT-orange?style=flat-square" alt="MIT License" />
</p>

<p align="center">
  A Chrome extension that scores every video on your YouTube Home feed with a <strong>Match %</strong> badge — showing how well each recommendation fits <em>your</em> actual viewing habits. Fully local. Zero data leaves your browser.
</p>

---

## ✨ What It Does

YouTube Preference Engine watches what you watch (locally), builds a personal profile, and then **scores every recommendation** on your Home feed in real time.

Each video gets a sleek glassmorphism badge overlay showing:

- 🎯 **Match %** — How relevant this video is to *your* interests
- 💬 **Reason** — A one-line explanation of *why* it scored that way

> **Example:** `92% Match · You watch Fireship often`

### Badge Tiers

| Score | Color | Meaning |
|:---:|:---:|---|
| **80–98%** | 🟢 Green | Strong match — right in your wheelhouse |
| **60–79%** | 🟡 Gold | Moderate match — somewhat aligned |
| **< 60%** | 🟠 Amber | Weak match — likely outside your usual interests |

---

## 🚀 Installation

### From Source (Developer Mode)

1. **Clone** or **download** this repository:
   ```bash
   git clone https://github.com/your-username/YTExtension.git
   ```
2. Open **Chrome** and navigate to:
   ```
   chrome://extensions/
   ```
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **"Load unpacked"** and select the `YTExtension` folder
5. Go to [youtube.com](https://www.youtube.com) — badges will appear on your Home feed!

> **Tip:** The extension starts learning immediately. The more you browse, the smarter the scores get.

---

## 🧠 How Scoring Works

The engine uses a **weighted heuristic model** with 7 independent signals, combined into a final score:

| Signal | Weight | What It Measures |
|---|:---:|---|
| **Topic Relevance** | 30% | Title keywords vs. your profile's top topics |
| **Channel Affinity** | 22% | How frequently you watch this creator |
| **Session Match** | 20% | Overlap with your current browsing session |
| **Native YT Hints** | 12% | Mix playlists, partially watched, progress bars |
| **Length Preference** | 8% | Matches your short / medium / long preference |
| **Freshness** | 5% | Recency of upload + light popularity signal |
| **Diversity Baseline** | 3% | Ensures new content still gets a fair chance |

### Smart Safeguards

- 📊 **Score range:** Clamped to `35–98%` (no fake extremes)
- 🧊 **Cold start mode:** New users with < 5 videos get moderate `52–76%` scores
- 🎲 **Stable variance:** Deterministic per video ID — no random fluctuation
- 🚫 **Stop-word filtering:** Common words like "the", "how", "this" don't inflate scores
- ⚡ **Fast paths:** YouTube Mixes and partially-watched videos get instant high scores
- 🔄 **Graceful degradation:** Missing metadata lowers confidence, doesn't break scoring

---

## 🔒 Privacy First

| Concern | Answer |
|---|---|
| Does it send data anywhere? | **No.** Zero network requests. |
| Where is my data stored? | `chrome.storage.local` — your browser only. |
| Can websites see my profile? | **No.** Content scripts are sandboxed. |
| Can I delete everything? | Yes — uninstall the extension or clear extension data. |

---

## 📁 Project Structure

```
YTExtension/
├── manifest.json          # Chrome Extension config (Manifest V3)
├── background.js          # Service worker — SPA URL change detection
├── content.js             # Main orchestrator — init → extract → score → inject
├── utils/
│   ├── storage.js         # Profile, session & watch history persistence
│   ├── extractors.js      # DOM scrapers for watch page & home feed cards
│   ├── scorer.js          # Weighted heuristic scoring engine
│   └── ui.js              # Badge creation, injection & cleanup
├── styles/
│   └── badge.css          # Glassmorphism badge styles (dark + light mode)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🗂️ Data Schema

The extension stores three objects locally:

<details>
<summary><strong>User Profile</strong> (<code>yre_user_profile</code>)</summary>

```json
{
  "meta": {
    "version": 2,
    "createdAt": "2026-03-14T...",
    "lastUpdatedAt": "2026-03-16T..."
  },
  "watchHistory": {
    "totalTracked": 42,
    "lastTrackedAt": "2026-03-16T..."
  },
  "preferences": {
    "topChannels": { "Fireship": 12, "3Blue1Brown": 8 },
    "topKeywords": { "react": 15, "python": 9, "tutorial": 7 },
    "lengthBuckets": { "short": 10, "medium": 25, "long": 7 }
  }
}
```

</details>

<details>
<summary><strong>Current Session</strong> (<code>yre_current_session</code>)</summary>

```json
{
  "id": "sess_abc123_...",
  "startedAt": "2026-03-16T...",
  "lastActive": "2026-03-16T...",
  "recentVideos": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Never Gonna Give You Up",
      "channel": "Rick Astley",
      "timestamp": 1742164200000
    }
  ]
}
```

</details>

<details>
<summary><strong>Watch History</strong> (<code>yre_watch_history</code>)</summary>

```json
[
  {
    "videoId": "abc123",
    "title": "React 19 — What's New",
    "channel": "Fireship",
    "watchedAt": "2026-03-15T...",
    "duration": "12:34"
  }
]
```

</details>

---

## 🛠️ Development

### Prerequisites
- Google Chrome (v116+)
- Basic familiarity with Chrome DevTools

### Making Changes

1. Edit any file in the project
2. Go to `chrome://extensions/`
3. Click the **↻ refresh** icon on the extension card
4. Reload YouTube to see your changes

### Debugging

Open Chrome DevTools on any YouTube page and filter the console by `[YRE]` to see:
- Profile data loaded at startup
- Cards being scored with breakdowns
- Badge injection events

---

## 🗺️ Roadmap

| Phase | Status | Description |
|:---:|:---:|---|
| **Phase 1** | ✅ Done | Watch tracking, history storage, basic extraction |
| **Phase 2** | ✅ Done | Scoring engine, explanation engine, visual badges |
| **Phase 3** | 🔜 Next | Popup dashboard, profile viewer, settings panel |
| **Phase 4** | 📋 Planned | Topic clustering, content fatigue detection |
| **Phase 5** | 📋 Planned | Export/import profiles, cross-device sync |

---

## 🤝 Contributing

Contributions are welcome! To get started:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Built with ❤️ for a more transparent YouTube experience.</sub>
</p>
