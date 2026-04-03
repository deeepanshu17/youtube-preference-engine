<p align="center">
  <img src="icons/icon128.png" alt="YouTube Preference Engine Logo" width="80" />
</p>

<h1 align="center">YouTube Preference Engine</h1>

<p align="center">
  <strong>Know why YouTube recommends what it does — before you click.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/version-2.1.0-green?style=flat-square" alt="Version 2.1.0" />
  <img src="https://img.shields.io/badge/privacy-100%25_local-purple?style=flat-square" alt="100% Local" />
  <img src="https://img.shields.io/badge/AI-Chrome_Built--in-ff6600?style=flat-square" alt="Chrome Built-in AI" />
  <img src="https://img.shields.io/badge/license-MIT-orange?style=flat-square" alt="MIT License" />
</p>

<p align="center">
  A Chrome extension that scores every video on your YouTube feed with a <strong>Match %</strong> badge — showing how well each recommendation aligns with <em>your</em> actual interests. Powered by on-device AI. Fully local. Zero data leaves your browser.
</p>

---

## ✨ What It Does

YouTube Preference Engine learns your viewing preferences over time and **scores every recommendation** across your Home feed, Search results, and Watch page sidebar — all in real time.

Each video gets a sleek glassmorphism badge overlay:

- 🎯 **Match %** — How relevant this video is to *your* interests
- 💬 **Reason** — A one-line explanation (e.g., *"You watch Fireship often"*)

> **Example:** `92% Match · Relevant topic from Fireship`

### Badge Tiers

| Score | Color | Meaning |
|:---:|:---:|---|
| **80–98%** | 🟢 Green | Strong match — right in your wheelhouse |
| **60–79%** | 🟡 Gold | Moderate match — somewhat aligned |
| **< 60%** | 🟠 Amber | Weak match — likely outside your usual interests |

### Works Everywhere on YouTube

- 🏠 **Home Feed** — Full badges with match % and reason
- 🔍 **Search Results** — Score how relevant search results are to you
- ▶️ **Watch Page Sidebar** — Clean percentage pills on recommended videos

---

## 🧠 How It Works

The engine combines **preference learning** with **on-device AI** to score every video:

1. **Preference Tracking** — As you watch videos, the engine silently builds a profile of your favorite channels, recurring topics, and content preferences — all stored locally in your browser.

2. **Smart Scoring** — Every video card is analyzed against your profile using multiple signals including topic relevance, creator affinity, session context, and content freshness.

3. **AI Enhancement** — When available, Chrome's Built-in AI (Gemini Nano) provides deeper contextual analysis, refining scores with natural language understanding of video titles and your viewing patterns.

4. **Real-time Badges** — Scores are injected as sleek overlay badges directly on YouTube's UI, updating as new cards load.

> The engine gets smarter the more you browse. Early on, you'll see "Building your preference profile" — after a few videos, personalized reasons kick in.

---

## 🚀 Installation

### From Source (Developer Mode)

1. **Clone** this repository:
   ```bash
   git clone https://github.com/deeepanshu17/youtube-preference-engine.git
   ```
2. Open **Chrome** and navigate to:
   ```
   chrome://extensions/
   ```
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **"Load unpacked"** and select the project folder
5. Go to [youtube.com](https://www.youtube.com) — badges will appear on your feed!

> **Tip:** The extension starts learning immediately. The more you browse, the smarter the scores get.

---

## 🔒 Privacy First

Your data never leaves your browser. Period.

| Question | Answer |
|---|---|
| Does it send data anywhere? | **No.** Zero network requests. Everything runs locally. |
| Where is my data stored? | `chrome.storage.local` — your browser only. |
| Can websites see my profile? | **No.** Content scripts are sandboxed by Chrome. |
| Does it use external APIs? | **No.** AI scoring uses Chrome's Built-in AI (on-device). |
| Can I delete everything? | Yes — uninstall the extension or clear extension data. |

---

## 🎨 Design

The extension features a modern UI that blends seamlessly with YouTube:

- **Glassmorphism badges** with frosted-glass effect and accent borders
- **Dark & Light mode** — automatically adapts to YouTube's theme
- **Smooth animations** — fade-in on inject, hover scaling
- **Non-intrusive** — badges overlay thumbnails without blocking content
- **Popup dashboard** — view your profile, top channels, and keyword cloud

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

Open Chrome DevTools on any YouTube page and filter the console by `[YRE]` to see real-time scoring logs and badge injection events.

---

## 🗺️ Roadmap

| Phase | Status | Description |
|:---:|:---:|---|
| **Phase 1** | ✅ Done | Watch tracking, history storage, preference extraction |
| **Phase 2** | ✅ Done | Scoring engine, AI enhancement, visual badges |
| **Phase 3** | ✅ Done | Multi-page support (Home, Search, Sidebar), popup dashboard |
| **Phase 4** | 🔜 Next | Topic clustering, content fatigue detection |
| **Phase 5** | 📋 Planned | Export/import profiles, cross-device sync |

---

## 🤝 Contributing

Contributions are welcome! To get started:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

> Check the [issues](https://github.com/deeepanshu17/youtube-preference-engine/issues) page for open tasks.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Built with ❤️ for a more transparent YouTube experience.</sub>
</p>
