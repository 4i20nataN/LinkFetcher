# Setup & Deployment — LinkFetcher

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | ≥ 20 LTS | `winget install OpenJS.NodeJS` / `nvm install 20` |
| **npm** | ≥ 10 | Bundled with Node |
| **Git** | Latest | `winget install Git.Git` |
| **Python** | 3.10+ (for yt-dlp dev) | Optional |

---

## Local Development

### 1. Clone & Install
```bash
git clone <repo-url> LinkFetcher
cd LinkFetcher
npm install
```

### 2. Prepare Binaries (Required for Electron)
```bash
# Option A: Use prepare script (copies from yt-dlp/ folder if exists)
npm run prepare:resources

# Option B: Manual - place binaries in electron/resources/
# electron/resources/
#   ├── yt-dlp.exe
#   └── ffmpeg.exe
# Download from: https://github.com/yt-dlp/yt-dlp/releases / https://ffmpeg.org/download.html
```

### 3. Start Dev Server (Electron + Vite)
```bash
npm run electron:dev
# Starts Vite on http://localhost:3000 + Electron window
# Hot reload works for both renderer and main (via tsx watch)
```

### 4. Web-Only Dev (No Electron)
```bash
npm run dev
# Starts Express + Vite on http://localhost:3000
# Uses fallback HTTP API (/api/probe, /api/search, /api/download/start)
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `YTDLP_PATH` | No | Auto-resolved | Absolute path to `yt-dlp.exe` |
| `FFMPEG_PATH` | No | Auto-resolved | Absolute path to `ffmpeg.exe` |
| `NODE_ENV` | No | `development` | `production` skips binary pre-check |
| `DISABLE_HMR` | No | `false` | `true` disables Vite HMR (saves CPU) |
| `PORT` | No | `3000` | Vite/Express port |

**Resolution order** (YtDlpManager + main.cjs):
1. `process.env.YTDLP_PATH` / `FFMPEG_PATH`
2. `process.resourcesPath/resources/` (packaged app)
3. `process.cwd()/electron/resources/` (dev)
4. `process.cwd()/yt-dlp/` (legacy dev)

---

## Build Commands

| Command | Output | Description |
|---------|--------|-------------|
| `npm run build` | `dist/` | Vite build + esbuild server + `build:electron` |
| `npm run build:electron` | `dist/electron/main.cjs` + `preload.cjs` | Bundles main process |
| `npm run package:win` | `release/` | **Full pipeline**: build → electron-builder → NSIS + Portable |
| `npm run clean` | — | Removes `dist/` |

### Build Pipeline Details

```
npm run package:win
    │
    ├─► npm run build
    │     ├─► vite build          → dist/index.html, dist/assets/
    │     ├─► esbuild server.ts   → dist/server.cjs
    │     └─► npm run build:electron
    │           ├─► esbuild electron/main.cjs → dist/electron/main.cjs
    │           └─► copy preload.cjs → dist/electron/preload.cjs
    │
    └─► npx electron-builder --win
          ├─► Reads package.json > build config
          ├─► Copies files[] + extraResources[] → asar/app
          ├─► Creates release/LinkFetcher Setup 1.0.0.exe (NSIS)
          └─► Creates release/LinkFetcher 1.0.0.exe (Portable)
```

---

## electron-builder Config (package.json > build)

```json
{
  "directories": { "output": "release" },
  "files": [
    "dist/index.html",
    "dist/assets/**",
    "dist/electron/**",
    "dist/server.cjs",
    "dist/server.cjs.map",
    "electron/main.cjs",
    "electron/preload.cjs",
    "package.json"
  ],
  "extraResources": [{
    "from": "electron/resources/",
    "to": "resources/",
    "filter": ["**/*"]
  }],
  "win": { "target": ["nsis", "portable"] }
}
```

**Critical**: `base: './'` in `vite.config.ts` — without it, assets 404 in `file://` protocol.

---

## Output Artifacts

```
release/
├── LinkFetcher Setup 1.0.0.exe      # NSIS installer (per-user / admin)
├── LinkFetcher 1.0.0.exe            # Portable (no install)
├── win-unpacked/                    # Unpacked for debugging
│   ├── LinkFetcher.exe
│   ├── resources/
│   │   ├── yt-dlp.exe
│   │   └── ffmpeg.exe
│   └── ...
└── builder-effective-config.yaml    # Debug: resolved config
```

---

## Distribution Checklist

- [ ] `version` bumped in `package.json` (semver)
- [ ] Binaries present in `electron/resources/` (run `prepare:resources`)
- [ ] `npm run lint` passes (`tsc --noEmit`)
- [ ] `npm run package:win` completes without errors
- [ ] Test portable exe on clean Windows VM
- [ ] Test installer (NSIS) creates shortcuts, uninstaller works
- [ ] Verify `shell:openPath` opens download folder
- [ ] Verify auto-updater (if enabled) points to correct release URL

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| White screen in packaged app | `vite.config.ts` missing `base: './'` | Add `base: './'` |
| `yt-dlp not found` in production | Binaries not in `extraResources` | Verify `electron/resources/` copied to `extraResources` |
| `require is not defined` in main | ESM/CJS mismatch | Main must be `.cjs` or `"type": "module"` + dynamic import |
| Port 3000 in use on dev | Previous process stuck | `npm run electron:dev` kills it automatically |
| NSIS installer fails | Path too long / spaces | electron-builder handles; ensure no `node_modules` in `files[]` |
| `ffmpeg` missing at runtime | Not bundled | Add to `electron/resources/` + `extraResources` |
| Settings not persisting | `localStorage` blocked | Electron allows; Web needs HTTPS/localhost |

---

## CI/CD (GitHub Actions Example)

```yaml
# .github/workflows/release.yml
name: Release Windows
on:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run prepare:resources
      - run: npm run package:win
      - uses: softprops/action-gh-release@v1
        with:
          files: release/*.exe
```

---

## Updating yt-dlp / ffmpeg

```bash
# 1. Download new binaries
# 2. Replace in electron/resources/
# 3. Commit (binaries are gitignored, but prepare script expects them there for CI)
# 4. Tag release → CI builds new installer
```

**Version pinning**: yt-dlp updates frequently. Test before bundling.

---

## Debugging Packaged App

```bash
# Run unpacked with console
./release/win-unpacked/LinkFetcher.exe --enable-logging

# Or set env
DEBUG=electron* ./release/win-unpacked/LinkFetcher.exe
```

**Logs location**: `%APPDATA%\LinkFetcher\logs\` (NSIS) or stdout (portable)

---

## Architecture-Specific Notes

| Platform | Binary Names | Notes |
|----------|--------------|-------|
| **Windows (x64)** | `yt-dlp.exe`, `ffmpeg.exe` | Current target |
| **Windows (arm64)** | `yt-dlp.exe`, `ffmpeg.exe` | Untested |
| **macOS (x64)** | `yt-dlp_macos`, `ffmpeg` | Need `chmod +x` |
| **macOS (arm64)** | `yt-dlp_macos`, `ffmpeg` | Need codesign for distribution |
| **Linux (x64)** | `yt-dlp_linux`, `ffmpeg` | AppImage via electron-builder |

**Cross-compile**: Run `package:win` on Windows. For macOS/Linux, add respective targets to `build.win` → `build.mac`, `build.linux`.