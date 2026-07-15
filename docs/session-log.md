# Session Log — LinkFetcher

Compact history of development sessions. One line per significant change with brief context.

---

## 2026-07-15 (feat/ui-redesign)

- `d83c5d7` fix(desc): spacing and 'Nenhuma' option for description format, hide tag when none selected
  - Added 'none' default to `descFormat`; SummaryPanel only shows tag when txt/md selected
- `260dfcb` fix(spacing): remove border-t separator from codec block to match other blocks pattern
  - Codec block now uses `space-y-1.5` + `BlockTitle` + `grid` layout like Resolução/Formatos
- `8c2ee06` feat(desc): description format buttons now selectable (txt/md), download on main trigger, tag in SummaryPanel
  - `Btn` components for txt/md/none; `descFormat` in `FormatOptions`; download triggered from `handleStartDownload` in LinkAnalyzer
- `61b5d4d` refactor(sections): move 'Extrair apenas audio' to Audio section, reorder: Resolução, Formatos, Descrição, Áudio, Legendas
  - Removed yellow warning banner; audioOnly toggle now lives at top of Audio section
- `ecb8018` feat(description): video description preview with expand/collapse and TXT/MD download
  - 5-line clamp preview + 'Ver completa' toggle; IPC `save-description` handler writes to Downloads
- `d30ee16` fix: date format DD/MM/YYYY, zoom 0-100% text-only scaling
  - `fmtDate` helper for upload_date; CSS `fs-*` classes use `--ui-scale` var (0-100%) mapping to 6-18px
- `afcf9a6` fix(layout): move 'Nome limpo' toggle to same row as template chips and underscore toggle
  - All filename options now inline: [Titulo] [Canal] [Data] [Duracao] | _/toggle | Nome limpo
- `83e17a0` fix(zoom): uniform scaling across all elements, add 🔍 indicator with P/M/G size letter
  - All `text-[Npx]` replaced with `fs-xs/sm/md/lg`; BlockTitle, BlockIcon, Toggle, Btn, inputs all scale
- `d470160` fix(hmr): move AUDIO_QUALITY_PRESETS to constants.ts, add scalable fs-* CSS classes for zoom
  - Fixed Fast Refresh warning; `--ui-scale` CSS var drives `calc()` font sizes
- `...` FormatSelector UI redesign (27 suggestions): BlockTitle sentence-case, VIDEO_PRESETS friendly labels, Btn pill + green checkmark, Toggle 52x28, TooltipWrapper CSS, tabs underline indicator, AccordionSection smooth animation, Video info card (64px thumb + channel/views/date), SponsorBlock multi-select chips, Filename template chips with resolved values + underscore toggle, Codec tooltips, Dangerous options amber box, space-y-4 spacing, SummaryPanel live config, Format/Legendas split, Custom format to advanced tab, Best preset single yellow star, Font sizes +5-9%, Zoom controls A-/A+, AccordionSection pb-4 header padding

---

## 2026-07-14 (fix/download-engine)

- `...` fix: image download pipeline (GenericProvider, DownloadEngine, IPC handlers)
  - GenericProvider skips yt-dlp probe for direct images; detects real resolution from headers
- `...` fix: Canvas-based image conversion (PNG/JPEG/WebP) via Electron IPC
  - `fetch-image-base64` → Canvas `toDataURL()` → `save-image-dataurl` IPC; verified 17KB/7.5KB/4.9KB outputs
- `...` fix: JPEG format selection bug (useEffect guard for images)
  - `findMatchingFormat()` now skips for `mediaInfo.type === 'image'` to preserve user's explicit format choice
- `...` fix: mergeOutputFormat audio bug, videoFormat container bug
  - `DownloadEngine.ts:136` guard `mergeOutputFormat` with `!audioOnly`; added `videoFormat` prop mapping
- `...` fix: "Abrir Pasta" IPC, thumbnails via dialog
  - `shell:openPath` IPC for folder; `download-file` uses `dialog.showSaveDialog` for thumbnails
- `...` 14/15 tests passing (VP9 403 is YouTube limitation)

---

## 2026-07-13 (setup / foundation)

- `...` Electron 37 + React 19 + Vite 6 + Tailwind 4 setup
- `...` yt-dlp + ffmpeg binaries embedded
  - `electron/resources/yt-dlp.exe` (18MB), `ffmpeg.exe` (102MB)
- `...` YtDlpAdapter (IPC ↔ HTTP unified transport)
  - Single `FormatOptions` payload works for both Electron IPC and web Express+SSE
- `...` Chrome DevTools MCP configured for Electron debugging
  - `--remote-debugging-port=9222`; MCP saved globally in `~/.config/opencode/opencode.json`