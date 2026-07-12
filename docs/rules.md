# Rules & Invariants — LinkFetcher

## Binary Management (NON-NEGOTIABLE)

| Rule | Enforcement |
|------|-------------|
| **NEVER auto-download yt-dlp/ffmpeg at runtime in production** | `YtDlpManager.ensureYtDlp()` throws if binary missing. Binaries must be bundled via `electron/resources/` (copied by `prepare-resources.cjs`). |
| **Binary resolution order is fixed** | 1. `process.env.YTDLP_PATH` / `FFMPEG_PATH` 2. `process.resourcesPath/resources/` (packaged) 3. `process.cwd()/electron/resources/` (dev) 4. `process.cwd()/yt-dlp/` (legacy dev) |
| **ffmpeg is optional but required for merge/convert** | If missing, yt-dlp runs without `--ffmpeg-location`; merge/convert fails silently. |

---

## Transport Abstraction (YtDlpAdapter)

| Invariant | Description |
|-----------|-------------|
| **Electron-first** | `window.electron?.invoke` tried first. Only falls back to `fetch('/api/*')` if bridge unavailable. |
| **Identical payloads** | IPC and HTTP endpoints accept **exact same** parameter shapes (`ProbeOptions`, `SearchOptions`, `DownloadParams`). |
| **Progress via events (Electron) / SSE (Web)** | Engine subscribes to `yt-dlp-progress` (IPC) or `EventSource` (SSE). Payload shape: `{ id, type: 'progress'|'complete'|'error', percent, speed, eta, filename?, filePath?, message? }`. |

---

## Download Engine Invariants

| Invariant | Implementation |
|-----------|----------------|
| **Single source of truth for queue** | `DownloadEngine.items` (array) persisted to `localStorage['linkfetcher-state']`. Survives reload. |
| **No duplicate downloads** | `addDownload()` dedupes by `(url, format.id, formatOptions.hash)`. |
| **Concurrency = 1** | `processQueue()` runs one at a time. `settings.concurrentDownloads` not yet implemented. |
| **Progress capped at 99% until complete** | Prevents UI stuck at 100% before `onComplete` fires. |
| **Cancel = kill child process** | Electron: `cancelMap` stores kill fn. Web: `fetch('/api/download/cancel')`. |
| **On complete: open file location (Electron only)** | `shell.openPath(filePath)` via IPC `shell:openPath`. |

---

## FormatSelector → Engine Contract

`FormatSelector` **never** builds yt-dlp args. It outputs **`FormatOptions`** (typed in `types.ts`):

```ts
interface FormatOptions {
  format?: string;              // yt-dlp format selector string
  audioOnly: boolean;
  audioFormat?: string;         // mp3, aac, flac, m4a, opus, wav
  audioQuality?: string;        // 0-9 (0=best)
  writeSubs: boolean;
  writeAutoSubs: boolean;
  subLangs?: string;            // 'en', 'pt,en', 'all'
  subFormat?: string;           // srt, ass, vtt
  embedSubs: boolean;
  writeThumbnail: boolean;
  embedThumbnail: boolean;
  embedMetadata: boolean;
  mergeOutputFormat?: string;   // mp4, mkv, webm
  restrictFilenames: boolean;
  noOverwrites: boolean;
  keepVideo: boolean;
  concurrentFragments: number;  // 1,2,4,8,16
  retries: number;              // 1,3,5,10
  downloadSections?: string;    // "*00:30-01:00"
  sponsorblockRemove?: string;  // 'sponsor', 'intro,outro', 'all'
  fpsMax?: number;              // 0=auto, 24,30,60,120
  videoOnly?: boolean;
}
```

**Engine** (`DownloadEngine.startYtDlpDownload`) maps `FormatOptions` → yt-dlp argv.

---

## Settings Persistence

| Key | Storage | Schema |
|-----|---------|--------|
| `theme` | `localStorage['linkfetcher-theme']` | `'dark' \| 'light' \| 'system'` |
| `accentColor` | `localStorage['linkfetcher-accent']` | `'indigo' \| 'emerald' \| 'amber' \| 'rose' \| 'cyan' \| 'violet'` |
| `language` | `localStorage['linkfetcher-lang']` | `'pt' \| 'en'` |
| `bandLimit` | `localStorage['linkfetcher-bandlimit']` | `number` (KB/s, 0 = unlimited) |
| `downloadDir` | `localStorage['linkfetcher-download-dir']` | `string` (path) |
| `queue` | `localStorage['linkfetcher-state']` | `DownloadEngineState` (serialized) |

**Never** store secrets (cookies, tokens) in localStorage. Use `--cookies` file at runtime.

---

## yt-dlp Argument Building Rules (YtDlpManager.buildArgs)

| Condition | Arg Transformation |
|-----------|-------------------|
| `videoOnly: true` | Strip all audio selectors (`+ba`, `/ba`, `/b`) from format string; fallback to `bv*` |
| `fpsMax > 0` | Append `[fps<=N]` to video selector in format string |
| `audioOnly: true` | Add `--extract-audio --audio-format <fmt> --audio-quality <q>` |
| `mergeOutputFormat` | Add `--merge-output-format <fmt>` |
| `downloadSections` | Add `--download-sections <val>` (e.g., `*00:30-01:00`) |
| `sponsorblockRemove` | Add `--sponsorblock-remove <categories>` |
| `bandLimit > 0` | Add `--limit-rate <N>K` |
| `concurrentFragments > 1` | Add `--concurrent-fragments <N>` |
| `retries > 0` | Add `--retries <N>` |
| `ffmpegLocation` | Add `--ffmpeg-location <path>` |

**Base format default**: `bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b`

---

## Electron Security Rules

| Rule | Implementation |
|------|----------------|
| `contextIsolation: true` | Enforced in `BrowserWindow.webPreferences` |
| `nodeIntegration: false` | No Node APIs in renderer |
| `enableRemoteModule: false` | No `@electron/remote` |
| Preload only exposes `invoke/on/off` | No `send`, no `sendSync`, no `ipcRenderer` direct access |
| All IPC handlers **validate input** | `main.cjs` handlers assume trusted renderer but sanitize paths |

---

## Build & Packaging Rules

| Rule | Config |
|------|--------|
| Output directory = `release/` | `package.json > build > directories.output = "release"` |
| Vite base = `./` | `vite.config.ts > base: './'` (critical for `file://`) |
| Remove `crossorigin` from HTML | Vite plugin `remove-crossorigin` |
| Binaries bundled via `extraResources` | `from: electron/resources/, to: resources/` |
| Targets: NSIS + Portable | `win.target = ['nsis', 'portable']` |
| **Do not commit** `electron/resources/*.exe`, `.cache/`, `release/`, `yt-dlp/` | Enforced by `.gitignore` |

---

## Error Handling Contract

| Scenario | Electron Mode | Web Mode |
|----------|---------------|----------|
| Binary missing | `invoke` rejects → Engine marks item `failed` | SSE `error` event → Engine marks `failed` |
| yt-dlp exits non-zero | `onError` callback → IPC `error` event | SSE `error` event |
| Network timeout | yt-dlp `--retries` handles; Engine surfaces final error | Same |
| User cancels | `cancelMap` kill fn → `cancelled` status | `/api/download/cancel` → `cancelled` |

---

## Versioning & Naming

| Artifact | Convention |
|----------|------------|
| App version | `package.json > version` (semver) |
| Installer | `LinkFetcher Setup {version}.exe` |
| Portable | `LinkFetcher {version}.exe` |
| Internal binary names | `yt-dlp.exe`, `ffmpeg.exe` (Windows) |

---

## Forbidden Patterns (Agents Must Not Introduce)

- ❌ Dynamic `import()` of yt-dlp binary path in renderer
- ❌ `nodeIntegration: true` or `contextIsolation: false`
- ❌ Storing binary paths in localStorage
- ❌ Building yt-dlp args in UI components (only in `YtDlpManager.buildArgs`)
- ❌ Adding new IPC channels without updating `preload.cjs` + `global.d.ts`
- ❌ Committing binaries or build artifacts