# Context Map — LinkFetcher

## Quick Reference: File → Responsibility

| Path | Role | Key Exports / Symbols |
|------|------|----------------------|
| **Core Engine** |
| `src/core/engine/DownloadEngine.ts` | Queue manager, persistence, progress bridge | `DownloadEngine` (singleton), `addDownload()`, `cancelDownload()`, `retryDownload()`, `removeDownload()`, `onChange(listener)` |
| `src/core/engine/DownloadEngine.ts` | EventSource/IPC subscription logic | `startYtDlpDownload()`, `startProxyDownload()`, `processQueue()` |
| **yt-dlp Layer** |
| `src/core/ytdlp/YtDlpManager.ts` | Binary resolution, spawn, arg building | `ensureYtDlp()`, `getBinaryPath()`, `getFfmpegPath()`, `spawnDownload()`, `buildArgs()`, `probeUrl()`, `searchVideos()`, `getVideoInfo()` |
| `src/core/ytdlp/YtDlpAdapter.ts` | Transport abstraction (IPC ↔ HTTP) | `probeUrlWithAdapter()`, `searchVideosWithAdapter()`, `getYtDlpStatusWithAdapter()`, `YtDlpAdapter` (legacy object) |
| `src/core/plugins/Providers.ts` | MediaInfo extraction from yt-dlp JSON | `YouTubeProvider`, `VimeoProvider`, `GenericProvider`, `DirectFileProvider`, `buildMediaInfoFromProbe()` |
| **Features (UI + Logic)** |
| `src/features/analyzer/LinkAnalyzer.tsx` | URL input → probe → format select → queue | `LinkAnalyzer` component, `handleAnalyze()`, `handleProbe()`, `handleStartDownload()` |
| `src/features/downloads/FormatSelector.tsx` | **Full options UI** (tabs: Media/Advanced) | `FormatSelector`, `FormatOptions` interface, `VIDEO_PRESETS`, `AUDIO_FORMATS`, `TimeRangeSlider` |
| `src/features/youtube/YouTubeSearch.tsx` | Search via yt-dlp flat-playlist | `YouTubeSearch`, `searchVideosWithAdapter()` |
| `src/features/settings/SettingsView.tsx` | App config + yt-dlp status | `SettingsView`, `getYtDlpStatusWithAdapter()` |
| **State & Context** |
| `src/context/AppContext.tsx` | Global React state (settings, queue, theme) | `useApp()`, `AppProvider`, `Settings`, `DownloadItem[]` |
| `src/types.ts` | **Single source of truth** — all interfaces | `MediaInfo`, `MediaFormat`, `DownloadItem`, `FormatOptions`, `DownloadOptions`, `ProbeOptions`, `SearchOptions`, `SearchResult`, `AppSettings`, `PlatformId`, `MediaType` |
| **Electron** |
| `electron/main.cjs` | Main process: window, IPC handlers, binary resolution | `createWindow()`, `resolveYtDlpPath()`, `resolveFfmpegPath()`, IPC: `yt-dlp-probe`, `yt-dlp-search`, `yt-dlp-status`, `yt-dlp-download`, `yt-dlp-cancel`, `shell:openPath`, `shell:openExternal` |
| `electron/preload.cjs` | Secure bridge: `contextBridge.exposeInMainWorld('electron', { invoke, on, off })` | — |
| `electron/resources/` | Bundled binaries (gitignored) | `yt-dlp.exe`, `ffmpeg.exe` |
| **Build & Scripts** |
| `vite.config.ts` | Vite config: `base: './'`, remove `crossorigin` | `defineConfig()`, plugin `remove-crossorigin` |
| `scripts/prepare-resources.cjs` | Copies `yt-dlp/` → `electron/resources/` | — |
| `scripts/electron-dev.cjs` | Dev: starts Vite (port 3000) + Electron | `waitForPort()`, `killPort()` |
| `package.json` | Scripts, deps, electron-builder config | `build.directories.output = "release"` |

---

## Telemetry / Critical Points

| Area | Where to Look | What to Monitor |
|------|---------------|-----------------|
| **Download start** | `DownloadEngine.addDownload()` → `startYtDlpDownload()` | `params` passed to IPC/HTTP |
| **Progress updates** | `DownloadEngine` event handler for `yt-dlp-progress` | `percent`, `speed`, `eta` parsing |
| **Binary resolution** | `YtDlpManager.getBundledBinaryPath()` / `main.cjs resolveYtDlpPath()` | Candidate paths logged |
| **Format → args** | `YtDlpManager.buildArgs()` | Final argv array |
| **Queue persistence** | `DownloadEngine.saveState()` / `loadState()` | `localStorage['linkfetcher-state']` |
| **Settings persistence** | `AppContext` `useEffect` watches | `localStorage['linkfetcher-*']` |

---

## Entry Points by Task

| Task | Start Here |
|------|------------|
| Add new download option | 1. `types.ts` → `FormatOptions` 2. `FormatSelector.tsx` → UI 3. `YtDlpManager.buildArgs()` → argv |
| Add new platform support | `Providers.ts` → new class extending `MediaProvider` |
| Modify IPC channel | 1. `main.cjs` → handler 2. `preload.cjs` → expose 3. `global.d.ts` → types 4. `YtDlpAdapter` → call |
| Change binary location | `YtDlpManager.getBundledBinaryPath()` + `main.cjs resolveYtDlpPath()` |
| Add new setting | 1. `types.ts` → `AppSettings` 2. `AppContext` → default + persist 3. `SettingsView` → UI |
| Debug download stall | Check `DownloadEngine.startYtDlpDownload()` → IPC vs SSE branch → progress handler |

---

## Dependency Graph (Simplified)

```
AppContext (state)
    │
    ├─► LinkAnalyzer ──► YtDlpAdapter ──► IPC/HTTP
    │       │
    │       └─► FormatSelector ──► FormatOptions
    │                        │
    └─► DownloadEngine ◄─────┘
            │
            ├─► Electron: YtDlpAdapter.invoke('yt-dlp-download') ──► main.cjs ──► YtDlpManager.spawnDownload()
            │
            └─► Web: SSE /api/download/start ──► server.ts ──► YtDlpManager.spawnDownload()

SettingsView ──► AppContext (settings) ──► localStorage
YouTubeSearch ──► YtDlpAdapter.searchVideosWithAdapter()
```