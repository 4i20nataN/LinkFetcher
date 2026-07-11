# LinkFetcher - Full Production Implementation Design

**Date:** 2026-07-10
**Status:** Approved
**Author:** Brainstorming session with user

## 1. Overview

LinkFetcher is a desktop/web media downloader built with React + TypeScript + Vite + Express that wraps yt-dlp. Currently, it has a working download engine (SSE + yt-dlp spawn) but all media analysis, metadata extraction, and search features are mocked with hardcoded fake data. This design replaces all placebo code with real yt-dlp functionality and prepares the app for production.

## 2. Problem Statement

- All 14 providers in `Providers.ts` return fabricated data with artificial delays
- `getVideoInfo()` in `YtDlpManager.ts` implements `yt-dlp --dump-json` but is never called
- YouTube mock search generates fake results
- Settings UI labels say "(Simulado)"
- Update checker doesn't work
- "Open Folder" uses non-existent `shell` API
- Dead code references `GEMINI_API_KEY`

## 3. Goals

1. **Real metadata extraction** - Probe URLs using `yt-dlp --dump-json` for all providers
2. **Real search** - Replace mock YouTube search with yt-dlp search
3. **Full parameter exposure** - Expose format selection, subtitles, thumbnails, metadata embedding, audio extraction to the UI
4. **Production readiness** - Fix all broken features, remove dead code, clean labels
5. **Keep existing download engine** - The SSE + spawn mechanism works and stays

## 4. Non-Goals

- Mobile app (focus on desktop Electron + web desktop)
- Multi-user / accounts
- Cloud storage integration
- Video conversion beyond yt-dlp post-processing

## 5. Architecture

### 5.1 Data Flow (Current → New)

```
Current:
URL → LinkAnalyzer → Providers.analyze() [MOCKED] → Fake metadata → DownloadEngine → yt-dlp spawn [REAL]

New:
URL → LinkAnalyzer → /api/probe [NEW] → yt-dlp --dump-json → Real metadata → DownloadEngine → yt-dlp spawn [REAL]
URL → /api/search [NEW] → yt-dlp --flat-playlist / --dump-json → Search results → UI
```

### 5.2 Server-Side Changes

#### New Endpoints in `server.ts`

**`POST /api/probe`**
- Input: `{ url: string, cookies?: string, proxy?: string }`
- Calls `yt-dlp --dump-json --no-download "url"`
- Returns full metadata: title, duration, formats, thumbnails, subtitles, description, etc.
- Used by all providers' `analyze()` methods

**`POST /api/search`**
- Input: `{ query: string, platform: string, cookies?: string, proxy?: string }`
- Calls `yt-dlp "ytsearch10:{query}" --flat-playlist --dump-json`
- Returns array of search results with title, thumbnail, duration, URL
- For non-YouTube platforms, uses appropriate search syntax

#### Modified Endpoints

**`POST /api/download`** (existing, enhance)
- Add new fields to request body:
  - `format`: string (yt-dlp format selector, e.g., `"bv*[ext=mp4]+ba[ext=m4a]/b"`)
  - `audioOnly`: boolean (triggers `-x --audio-format mp3`)
  - `audioFormat`: string (`"mp3"`, `"aac"`, `"flac"`, etc.)
  - `audioQuality`: string (`"0"` to `"10"` or `"128K"`)
  - `writeSubs`: boolean
  - `writeAutoSubs`: boolean
  - `subLangs`: string (e.g., `"en,pt"`)
  - `subFormat`: string (`"srt"`, `"ass"`, etc.)
  - `embedSubs`: boolean
  - `embedMetadata`: boolean
  - `writeThumbnail`: boolean
  - `embedThumbnail`: boolean
  - `outputTemplate`: string (default `"%(title)s.%(ext)s"`)
  - `cookies`: string (path to cookies file)
  - `cookiesFromBrowser`: string (e.g., `"chrome"`)
  - `proxy`: string
  - `ffmpegLocation`: string (auto-detected from yt-dlp folder)
  - `restrictFilenames`: boolean
  - `noOverwrites`: boolean
  - `keepVideo`: boolean (for audio extraction, keep original)

### 5.3 Client-Side Changes

#### New Component: `FormatSelector`

Located at `src/features/downloads/FormatSelector.tsx`

Renders after URL probe returns, showing:
- **Quality preset buttons**: Best, 720p, 480p, Audio Only
- **Advanced mode toggle** showing:
  - Format string input (with tooltip explaining syntax)
  - Audio format dropdown (mp3, aac, flac, m4a, opus, wav)
  - Audio quality slider/input (0-10 VBR or bitrate)
- **Subtitles section**:
  - Toggle: Download subtitles
  - Toggle: Auto-generated subtitles
  - Language input (comma-separated codes)
  - Format dropdown (srt, ass, vtt)
  - Toggle: Embed in video
- **Thumbnails section**:
  - Toggle: Download thumbnail
  - Toggle: Embed as cover art
- **Metadata section**:
  - Toggle: Embed metadata
- **Advanced options**:
  - Output template input
  - Custom cookies path
  - Proxy input
  - Restrict filenames toggle
  - No overwrites toggle

#### Modified Component: `LinkAnalyzer`

In `src/features/analyzer/LinkAnalyzer.tsx`:
- After URL paste, call `/api/probe` instead of providers
- Show loading state while probing
- Display real metadata (title, thumbnail, duration, channel)
- Show `FormatSelector` component
- Pass all selected options to download

#### Modified Component: `YouTubeSearch`

In `src/features/ytSearch/YouTubeSearch.tsx`:
- Replace `searchVideos` (mock) with `/api/search` call
- Show real results from yt-dlp
- Clicking a result populates the URL input

#### Provider Rewrite

In `src/core/plugins/Providers.ts`:
- Each provider's `analyze()` method calls `/api/probe`
- Returns real metadata mapped to the `AnalyzedMediaInfo` interface
- Remove all `setTimeout` mock delays
- Add error handling for failed probes

### 5.4 YtDlpManager Changes

In `src/core/ytdlp/YtDlpManager.ts`:
- Add `searchVideos(query: string, options?: SearchOptions)` method
- Add `probeUrl(url: string, options?: ProbeOptions)` method (public wrapper around existing `getVideoInfo`)
- Extend existing `buildArgs()` method to accept new `DownloadOptions` fields and return complete yt-dlp argument array
- Auto-detect `ffmpegLocation` from same folder as yt-dlp binary

### 5.5 DownloadEngine Changes

In `src/core/engine/DownloadEngine.ts`:
- Remove simulation loop (`simulateProgress`) that runs even for real downloads
- Accept new `DownloadOptions` with all format/subs/thumb params
- Pass options through to `YtDlpManager.buildArgs()`
- Ensure real downloads don't trigger simulation progress

### 5.6 Types Update

In `src/types.ts`:
- Add `ProbeOptions` interface
- Add `SearchOptions` interface
- Add `SearchResult` interface
- Extend `DownloadOptions` with all new yt-dlp parameters
- Add `AnalyzedMediaInfo` fields: `formats`, `subtitles`, `thumbnails` (raw data from yt-dlp)

### 5.7 Settings Fixes

In `src/features/settings/SettingsView.tsx`:
- **Update checker**: Fix to properly compare versions against GitHub releases API
- **Open Folder**: Replace `shell` API with Electron's `ipcRenderer.invoke('shell:openPath')` or for web, use clipboard copy of path
- **Labels**: Remove "(Simulado)" from all labels
- **New settings section** for yt-dlp defaults:
  - Default format string
  - Default audio format
  - Default output template
  - Default cookies path
  - Default proxy
  - Default ffmpeg location

### 5.8 i18n Updates

In `src/core/i18n.ts`:
- Remove all "(Simulado)" / "(Mock)" labels
- Add translations for new UI elements (FormatSelector, etc.)

## 6. Implementation Order

1. **Server endpoints** (`/api/probe`, `/api/search`) - Core functionality
2. **YtDlpManager** new methods (`probeUrl`, `searchVideos`, `buildArgs` extension)
3. **Types** update with new interfaces
4. **Providers** rewrite to use real probe data
5. **FormatSelector** component
6. **LinkAnalyzer** integration with probe + FormatSelector
7. **YouTubeSearch** integration with real search
8. **DownloadEngine** cleanup (remove simulation)
9. **Settings** fixes (update checker, folder opener, labels)
10. **i18n** cleanup
11. **Dead code removal** (`useRealDownload.ts`, `MultiUrlInput.tsx`, `GEMINI_API_KEY`)
12. **Electron integration** (`shell.openPath`, auto-updates)

## 7. Error Handling

- Probe failures: Show user-friendly error, allow retry
- Missing yt-dlp binary: Clear error message with download link
- Missing ffmpeg: Warning, some features disabled
- Search failures: Fallback message, suggest checking query
- Download failures: SSE error events already handled, add retry button
- Network errors: Timeout after 30s, show connection error

## 8. Testing Strategy

- **Manual testing**: Primary method (Electron app)
- **Provider tests**: Verify each provider's `analyze()` returns real data
- **Format selector tests**: Verify correct yt-dlp args generated for each preset
- **Download tests**: Full flow from URL → probe → select format → download → verify file
- **Edge cases**: Invalid URLs, age-restricted content, geo-blocked content, private videos

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| yt-dlp API changes | Pin yt-dlp version, check compatibility |
| Slow probe responses | Cache probe results for 5 minutes |
| Large format lists | Paginate or limit display to top 20 |
| Browser cookie extraction | Document requirements, graceful fallback |
| Rate limiting on search | Add request throttling |

## 10. Future Considerations (Out of Scope)

- Playlist download mode
- Batch URL download from file
- Download history / resume
- Custom yt-dlp plugins
- SponsorBlock integration
