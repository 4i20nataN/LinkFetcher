<div align="center">

# 🔗 LinkFetcher

**Modern desktop media downloader powered by yt-dlp**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-success)](https://github.com/natanvanim/LinkFetcher)
[![Node](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-37-47848F?logo=electron)](https://www.electronjs.org/)
[![yt-dlp](https://img.shields.io/badge/yt--dlp-latest-red?logo=youtube)](https://github.com/yt-dlp/yt-dlp)

</div>

---

## ✨ Overview

LinkFetcher is a **privacy-first desktop application** for downloading videos, audio, playlists, subtitles, and metadata from 1000+ sites. Built on **yt-dlp** and **ffmpeg** with a polished React + Electron interface.

**Key differentiator**: Zero cloud dependencies. Everything runs locally on your hardware — no accounts, no API keys, no telemetry.

---

## 🚀 Features

| Category | Capabilities |
|----------|--------------|
| **Video** | Up to 8K, any codec, merge formats (MP4, MKV, WebM) |
| **Audio** | Extract to MP3, AAC, FLAC, M4A, OPUS, WAV with quality presets |
| **Subtitles** | Download, auto-generated, embed, multiple languages (SRT/ASS/VTT) |
| **Advanced** | SponsorBlock removal, time-range trimming, FPS limit, concurrent fragments |
| **Metadata** | Embed thumbnail, chapters, tags, cover art |
| **Search** | Built-in YouTube search (yt-dlp flat-playlist) |
| **Queue** | Persistent download queue with progress, speed, ETA, pause/resume/cancel |
| **Dual-mode** | Native Electron (IPC) + Web fallback (Express + SSE) |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript 5, Vite 6 |
| **Styling** | Tailwind CSS 4, Motion (Framer Motion) |
| **Desktop** | Electron 37, electron-builder 26 |
| **Core Engine** | yt-dlp (bundled), ffmpeg (bundled) |
| **Dev Server** | Express + tsx (fallback mode) |
| **Packaging** | NSIS installer + Portable ZIP |

---

## 📦 Installation

### Pre-built (Recommended)
Download latest `LinkFetcher Setup *.exe` or `LinkFetcher *.exe` (portable) from [Releases](https://github.com/natanvanim/LinkFetcher/releases).

### From Source

```bash
# 1. Clone
git clone https://github.com/natanvanim/LinkFetcher.git
cd LinkFetcher

# 2. Install deps
npm install

# 3. Place binaries (required for dev)
# Download yt-dlp.exe + ffmpeg.exe from official releases
# Place in: electron/resources/
# Or run: npm run prepare:resources (if yt-dlp/ folder exists)

# 4. Development (Electron + Vite HMR)
npm run electron:dev

# 5. Production build + installer
npm run package:win
# Output: release/LinkFetcher Setup *.exe + release/LinkFetcher *.exe
```

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RENDERER (React)                         │
│  LinkAnalyzer → FormatSelector → DownloadEngine → Queue UI     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ YtDlpAdapter (transport abstraction)
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌─────────────────────┐   ┌─────────────────────┐
    │   ELECTRON MAIN     │   │   EXPRESS SERVER    │
    │  (Production)       │   │  (Dev / Fallback)   │
    │  IPC: yt-dlp-*      │   │  REST: /api/*       │
    │  spawn yt-dlp.exe   │   │  SSE: /download     │
    │  bundled binaries   │   │  .cache/yt-dlp.exe  │
    └─────────────────────┘   └─────────────────────┘
```

**Key design decisions** documented in [`docs/architecture.md`](docs/architecture.md):
- **No runtime binary downloads** — production ships with yt-dlp/ffmpeg in `electron/resources/`
- **Single transport layer** — `YtDlpAdapter` routes to IPC (Electron) or HTTP (Web) transparently
- **Format options as typed contract** — `FormatOptions` interface flows from UI → Engine → yt-dlp args
- **Persistent queue** — `localStorage` survives app restarts

---

## 📁 Project Structure

```
LinkFetcher/
├── electron/
│   ├── main.cjs              # Main process: window, IPC handlers, binary resolution
│   ├── preload.cjs           # Secure contextBridge: invoke/on/off only
│   └── resources/            # yt-dlp.exe, ffmpeg.exe (gitignored, bundled at build)
├── scripts/
│   ├── prepare-resources.cjs # Copies yt-dlp/ffmpeg → electron/resources/
│   └── electron-dev.cjs      # Dev: starts Vite + Electron together
├── src/
│   ├── core/
│   │   ├── engine/DownloadEngine.ts      # Queue, persistence, IPC/SSE bridge
│   │   ├── ytdlp/
│   │   │   ├── YtDlpManager.ts           # Binary resolution, spawn, buildArgs()
│   │   │   └── YtDlpAdapter.ts           # IPC ↔ HTTP abstraction
│   │   └── plugins/Providers.ts          # MediaInfo extraction from yt-dlp JSON
│   ├── features/
│   │   ├── analyzer/LinkAnalyzer.tsx     # URL input → probe → FormatSelector
│   │   ├── downloads/FormatSelector.tsx  # **Full options UI** (Media/Advanced tabs)
│   │   ├── youtube/YouTubeSearch.tsx     # Search via yt-dlp flat-playlist
│   │   └── settings/SettingsView.tsx     # Config + yt-dlp status
│   ├── context/AppContext.tsx            # Global state (settings, queue, theme)
│   ├── types.ts                          # **Single source of truth** — all interfaces
│   └── global.d.ts                       # window.electron types
├── docs/
│   ├── architecture.md       # Stack, data flows, Mermaid diagrams
│   ├── rules.md              # Invariants (NON-NEGOTIABLE)
│   ├── context-map.md        # File→responsibility map
│   ├── design-system.md      # Visual system, components, motion
│   └── setup-deployment.md   # Dev env, build pipeline, CI/CD
├── package.json              # build.directories.output = "release"
├── vite.config.ts            # base: './' (critical for file:// protocol)
└── AGENTS.md                 # Agent operating guide
```

---

## 🎯 Roadmap

- [ ] Playlist / channel bulk download
- [ ] Download scheduler
- [ ] Browser extension (companion)
- [ ] Media library / history view
- [ ] Auto-updater (electron-updater)
- [ ] Linux .AppImage / .deb / macOS .dmg builds
- [ ] Plugin system for custom extractors

---

## 🤝 Contributing

1. Read [`AGENTS.md`](AGENTS.md) — operating rules for this repo
2. Check [`docs/rules.md`](docs/rules.md) — invariants you must not break
3. Open an Issue for discussion (features, bugs, design)
4. PR with **atomic commits** (Conventional Commits)
5. `npm run lint` + `npm run build` must pass

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

## ⭐ Acknowledgments

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — the incredible engine behind this app
- **[ffmpeg](https://ffmpeg.org/)** — media processing backbone
- **[Electron](https://www.electronjs.org/)** — desktop runtime
- **[Tailwind CSS](https://tailwindcss.com/)** — utility-first styling

---

<div align="center">

**Built with ❤️ for offline media freedom**

[Report Bug](https://github.com/natanvanim/LinkFetcher/issues) • [Request Feature](https://github.com/natanvanim/LinkFetcher/issues/new)

</div>