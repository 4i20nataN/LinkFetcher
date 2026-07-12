# Architecture Overview — LinkFetcher

## Stack
| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React 19 + TypeScript + Vite 6 | Latest |
| **Styling** | Tailwind CSS 4 + Motion (Framer Motion) | Latest |
| **Desktop** | Electron 37 + electron-builder 26 | Latest |
| **Backend (dev/fallback)** | Express + tsx | 4.x |
| **Core Engine** | yt-dlp (bundled binary) + ffmpeg (bundled) | Static |
| **Package Manager** | npm | — |

---

## Runtime Modes (Dual-Mode Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON MODE (Production)               │
├─────────────────────────────────────────────────────────────────┤
│  Renderer (React)                                               │
│    │                                                            │
│    ▼  window.electron.invoke('yt-dlp-*')                        │
│  Preload (contextBridge) ──────► Main Process (Node)            │
│                                       │                         │
│                                       ▼                         │
│                              spawn yt-dlp.exe / ffmpeg.exe      │
│                              (from electron/resources/)         │
│                                       │                         │
│                                       ▼                         │
│                              IPC Events: yt-dlp-progress      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        WEB MODE (Dev / Fallback)                │
├─────────────────────────────────────────────────────────────────┤
│  Renderer (React)                                               │
│    │                                                            │
│    ▼  fetch('/api/probe|search|download/start')                 │
│  Express Server (server.ts) ──────► spawn yt-dlp (from .cache/) │
│                                       │                         │
│                                       ▼                         │
│                              SSE: /api/download/start          │
└─────────────────────────────────────────────────────────────────┘
```

**Key Decision**: Single codebase, two execution paths. `YtDlpAdapter` abstracts the transport (IPC vs HTTP).

---

## Core Data Flow

### 1. Probe / Analyze URL
```
User Input URL
      │
      ▼
LinkAnalyzer.handleAnalyze()
      │
      ▼
probeUrlWithAdapter({ url })  ◄── YtDlpAdapter (Electron-first → HTTP fallback)
      │
      ▼
Providers.ts → buildMediaInfoFromProbe() → MediaInfo (formats, duration, thumbnails)
      │
      ▼
FormatSelector renders formats → User picks → FormatOptions
      │
      ▼
DownloadEngine.addDownload(mediaInfo, format, formatOptions)
```

### 2. Download Execution
```
DownloadEngine.addDownload()
      │
      ├─► Electron Mode: window.electron.invoke('yt-dlp-download', params)
      │                    │
      │                    ▼
      │              Main Process: spawnDownload() from YtDlpManager
      │                    │
      │                    ▼
      │              IPC Events: 'yt-dlp-progress' → Renderer → Engine updates item
      │
      └─► Web Mode (fallback): SSE /api/download/start
                           │
                           ▼
                      server.ts → spawnDownload() → SSE events
```

---

## Critical Design Decisions

| Decision | Rationale |
|----------|-----------|
| **No auto-download yt-dlp at runtime** | Production apps must ship binaries. `YtDlpManager.ensureYtDlp()` throws if missing. Dev: place in `electron/resources/` or set `YTDLP_PATH`. |
| **Bundled binaries via `extraResources`** | `electron-builder` copies `electron/resources/` → `resources/` in asar. `process.resourcesPath` resolves at runtime. |
| **`base: './'` in Vite** | Required for `file://` protocol in packaged Electron app. |
| **ContextBridge (preload) only exposes `invoke/on/off`** | No `nodeIntegration`, no `remote`. Secure by default. |
| **FormatSelector outputs `FormatOptions` (not format string)** | Engine builds final yt-dlp args. UI stays declarative. |
| **DownloadEngine is single source of truth for queue state** | Persists to `localStorage` (`linkfetcher-state`). Survives reload. |
| **Dual-mode transport via Adapter** | Same UI works in Electron (fast, native) and Web (server fallback). |

---

## Mermaid: High-Level Component Diagram

```mermaid
graph TB
    subgraph Renderer[Renderer Process - React]
        LA[LinkAnalyzer]
        FS[FormatSelector]
        DE[DownloadEngine]
        YT[YouTubeSearch]
        SV[SettingsView]
    end

    subgraph Adapter[Transport Abstraction]
        YTA[YtDlpAdapter]
    end

    subgraph Main[Main Process - Electron]
        IPC[IPC Handlers]
        YTM[YtDlpManager]
        BIN[(yt-dlp.exe + ffmpeg.exe)]
    end

    subgraph Server[Express Server - Fallback]
        API[/api/*]
        YTM2[YtDlpManager]
        BIN2[(.cache/yt-dlp.exe)]
    end

    LA --> YTA
    FS --> DE
    DE --> YTA
    YT --> YTA
    SV --> YTA

    YTA -.->|Electron: invoke| IPC
    YTA -.->|Web: fetch| API

    IPC --> YTM
    YTM --> BIN

    API --> YTM2
    YTM2 --> BIN2
```

---

## File Structure (Relevant to Architecture)

```
src/
├── core/
│   ├── engine/DownloadEngine.ts       # Queue, persistence, progress, IPC/SSE bridge
│   ├── ytdlp/YtDlpManager.ts          # Binary resolution, spawn, args builder
│   ├── ytdlp/YtDlpAdapter.ts          # Electron-first / HTTP fallback transport
│   └── plugins/Providers.ts           # MediaInfo extraction from yt-dlp JSON
├── features/
│   ├── analyzer/LinkAnalyzer.tsx      # URL input → probe → MediaInfo
│   ├── downloads/FormatSelector.tsx   # Full options UI (tabs: Media/Advanced)
│   ├── youtube/YouTubeSearch.tsx      # Search via yt-dlp flat-playlist
│   └── settings/SettingsView.tsx      # Config + yt-dlp status
├── components/                        # UI primitives (Sidebar, ThemeWrapper)
├── context/AppContext.tsx             # Global state (settings, queue, theme)
├── types.ts                           # **Single source of truth** for all interfaces
└── global.d.ts                        # window.electron types
electron/
├── main.cjs                           # Main process, IPC handlers, binary resolution
├── preload.cjs                        # contextBridge: invoke/on/off
└── resources/                         # Bundled binaries (gitignored)
scripts/
├── electron-dev.cjs                   # Dev: Vite + Electron together
├── package-windows.cjs                # Legacy packager (deprecated)
└── prepare-resources.cjs              # Copies yt-dlp/ffmpeg → electron/resources/
```