---
name: Android download bugs fixed
description: Root causes and fixes for LinkFetcher Android/Capacitor download failures.
---

# LinkFetcher Android Download Bugs

## Root causes found and fixed

**Why:** All five bugs caused silent failures on Android, making downloads impossible.

### Bug 1 — probeUrlWithAdapter platform order (CRITICAL)
`src/core/ytdlp/YtDlpAdapter.ts` — The three `*WithAdapter` exported functions tried
Electron first (throws), then Capacitor, then fetched `/api/probe` which does NOT exist
in the standalone APK. If Capacitor failed for any reason, fell through to a network error.

**Fix:** Reordered to: Capacitor → Electron → Web fetch. Short-circuits on Capacitor.

### Bug 2 — format string fallback (CRITICAL)
`src/core/engine/DownloadEngine.ts` — Both Electron and Capacitor branches used
`item.formatString || item.format.id`. When formatString was absent, item.format.id
(raw DASH ID like "137") was passed as `-f 137`, downloading video-only without audio.

**Fix:** Fallback changed to `'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b'` in both branches.

### Bug 3 — addListener without await (MEDIUM)
`src/core/engine/DownloadEngine.ts` — `plugin.addListener(...)` was not awaited inside
`.then()`. Listener cleanup race condition: `.remove()` could fire before native side confirmed.

**Fix:** Made `.then()` callback `async`, added `await` before `addListener`.

### Bug 4 — No lazy re-init in Kotlin plugin (MEDIUM)
`android/app/.../YtDlpPlugin.kt` — If `YoutubeDL.getInstance().init()` failed silently
on cold-start (slow emulator, first boot), `initialized=false` permanently; every call rejected.

**Fix:** Added `tryInitIfNeeded()` which retries init on every operation. Also widened
catch from `YoutubeDLException` to `Exception` in `load()`.

### Bug 5 — Directory.ExternalStorage on Android 10+ (LOW)
`src/core/engine/DownloadEngine.ts` — Direct file downloads used `Directory.ExternalStorage`
(root /sdcard), blocked on API 29+ without the legacy WRITE_EXTERNAL_STORAGE permission.

**Fix:** Changed to `Directory.External` (app-scoped, no permission needed). Files land at
`Android/data/<pkg>/files/Download/`.

**How to apply:** For future Capacitor Filesystem writes: use Directory.External for
app-private storage. For public Downloads folder, use MediaStore via Kotlin (as YtDlpPlugin already does).
