# Download Flow Trace — LinkFetcher

> Trace completo do fluxo: botão click → yt-dlp spawn
> Gerado em: 2025-07-13
> Status: Todos os line numbers verificados no código atual

## Fluxo Resumido

```
[1] User clicks download button
[2] LinkAnalyzer.handleStartDownload()
[3] DownloadEngine.addDownload(mediaInfo, selectedFormat, formatOptions)
[4] DownloadEngine.processQueue()
[5] DownloadEngine.startYtDlpDownload()
[6] window.electron.invoke('yt-dlp-download', params)  ← Electron
   ou EventSource('/api/download/start?...')             ← Web/SSE
[7] main.cjs IPC handler → spawnDownload()
[8] YtDlpManager.spawnDownload() → build args → spawn yt-dlp
```

---

## Detalhe Por Step

### [1] Botão de Download

- **Arquivo**: `src/features/analyzer/LinkAnalyzer.tsx`
- **Linha**: 516-526
- **Condição**: `disabled={!selectedFormat}` (linha 518)
- **selectedFormat**: `null` inicialmente (linha 36), setado para `info.formats[0]` em `handleAnalyze` (linha 123)

```tsx
// LinkAnalyzer.tsx:516-526
<button
  onClick={handleStartDownload}
  disabled={!selectedFormat}
  ...
>
  <Download size={18} />
  {t('btnDownloadSelected')}
</button>
```

### [2] handleStartDownload()

- **Arquivo**: `src/features/analyzer/LinkAnalyzer.tsx`
- **Linha**: 171-185
- **Guard**: `if (!mediaInfo || !selectedFormat) return;` (linha 172)
- **Ação**: Chama `DownloadEngine.addDownload(mediaInfo, selectedFormat, formatOptions)` (linhas 174-178)
- **Side-effect**: After 1200ms, auto-redireciona para aba `manager` (linhas 182-184)

```ts
// LinkAnalyzer.tsx:171-185
const handleStartDownload = () => {
  if (!mediaInfo || !selectedFormat) return;   // ← guard silencioso (bug #4)
  DownloadEngine.addDownload(mediaInfo, selectedFormat, formatOptions);
  setSuccessMsg(...);
  setTimeout(() => { setActiveTab('manager'); }, 1200);
};
```

### [3] DownloadEngine.addDownload()

- **Arquivo**: `src/core/engine/DownloadEngine.ts`
- **Linha**: 100-158
- **Duplicate check**: linhas 101-106 — evita download duplicado (mesmo URL + format + status ativo)
- **Size estimation**: linhas 108-115 — usa `format.sizeBytes` ou fallback por tipo

#### Mapeamento formatOptions → DownloadItem

| Campo | Linha | Source | ✅/❌ |
|-------|-------|--------|-------|
| `formatString` | 123 | `formatOptions?.format` | ✅ |
| `audioOnly` | 124 | `formatOptions?.audioOnly` | ✅ |
| `audioFormat` | 125 | `formatOptions?.audioFormat` | ✅ |
| `audioQuality` | 126 | `formatOptions?.audioQuality` | ✅ |
| `writeSubs` | 127 | `formatOptions?.writeSubs` | ✅ |
| `writeAutoSubs` | 128 | `formatOptions?.writeAutoSubs` | ✅ |
| `subLangs` | 129 | `formatOptions?.subLangs` | ✅ |
| `subFormat` | 130 | `formatOptions?.subFormat` | ✅ |
| `embedSubs` | 131 | `formatOptions?.embedSubs` | ✅ |
| `writeThumbnail` | 132 | `formatOptions?.writeThumbnail` | ✅ |
| `embedThumbnail` | 133 | `formatOptions?.embedThumbnail` | ✅ |
| `embedMetadata` | 134 | `formatOptions?.embedMetadata` | ✅ |
| `mergeOutputFormat` | 135 | `formatOptions?.audioOnly ? audioFormat : undefined` | ✅ |
| `concurrentFragments` | 136 | `formatOptions?.concurrentFragments` | ✅ |
| `retries` | 137 | `formatOptions?.retries` | ✅ |
| `restrictFilenames` | 138 | `formatOptions?.restrictFilenames` | ✅ |
| `noOverwrites` | 139 | `formatOptions?.noOverwrites` | ✅ |
| `keepVideo` | 140 | `formatOptions?.keepVideo` | ✅ |
| `videoOnly` | 141 | `formatOptions?.videoOnly` | ✅ |
| `downloadSections` | 142 | `formatOptions?.downloadSections` | ✅ |
| `sponsorblockRemove` | 143 | `formatOptions?.sponsorblockRemove` | ✅ |
| `fpsMax` | 144 | `formatOptions?.fpsMax` | ✅ |
| **`bandLimit`** | — | **AUSENTE** | ❌ **Bug #1** |

> `bandLimit` é definido em `FormatOptions` (linha 57 do LinkAnalyzer.tsx) e existe no
> `DownloadItem` (types.ts:85), mas **nunca é mapeado** nesta seção.
> Resultado: `item.bandLimit` será sempre `undefined` → `0` no payload IPC.

### [4] processQueue()

- **Arquivo**: `src/core/engine/DownloadEngine.ts`
- **Linha**: 252-265
- **Lógica**: Conta downloads ativos, se < `maxConcurrent` (default 3), pega próximo `queued` e chama `startRealDownload`

```ts
// DownloadEngine.ts:252-265
private processQueue() {
  const downloadingCount = this.items.filter(i => i.status === 'downloading').length;
  const max = this.settings.maxConcurrent || 3;
  if (downloadingCount < max) {
    const next = this.items.find(i => i.status === 'queued');
    if (next) {
      next.status = 'downloading';
      this.notify();
      this.startRealDownload(next);
      this.processQueue(); // Fill remaining slots
    }
  }
}
```

### [5] startRealDownload → startYtDlpDownload

- **Arquivo**: `src/core/engine/DownloadEngine.ts`
- **startRealDownload**: linhas 270-281 — decide entre `startYtDlpDownload` (yt-dlp platforms) e `startProxyDownload` (generic/direct URLs)
- **YT_DLP_PLATFORMS**: linha 19-21 — `youtube, tiktok, instagram, facebook, x, reddit, soundcloud, twitch, vimeo`
- **startYtDlpDownload**: linhas 283-476

#### Electron path (linhas 288-382)

1. **Detecta bridge**: `hasElectronBridge` (linha 288)
2. **Registra progress listener**: `electron.on('yt-dlp-progress', onProgress)` (linha 331)
3. **Envia payload IPC**: `electron.invoke('yt-dlp-download', {...})` (linhas 339-375)

#### Payload IPC completo (linhas 339-375)

```ts
{
  id: item.id,
  url: item.url,
  title: item.title,
  format: item.formatString || item.format.id,   // linha 343
  outputDir: this.settings.defaultDir || undefined,
  audioOnly: isAudio,
  audioFormat: item.audioFormat || (isAudio ? 'mp3' : undefined),
  audioQuality: item.audioQuality,
  writeSubs: item.writeSubs,
  writeAutoSubs: item.writeAutoSubs,
  subLangs: item.subLangs,
  subFormat: item.subFormat,
  embedSubs: item.embedSubs,
  writeThumbnail: item.writeThumbnail,
  embedThumbnail: item.embedThumbnail,
  embedMetadata: item.embedMetadata,
  mergeOutputFormat: item.mergeOutputFormat,
  restrictFilenames: item.restrictFilenames,
  concurrentFragments: item.concurrentFragments,
  retries: item.retries,
  bandLimit: item.bandLimit || 0,              // ← sempre 0 (bug #1)
  noOverwrites: item.noOverwrites,
  keepVideo: item.keepVideo,
  videoOnly: item.videoOnly,
  downloadSections: item.downloadSections,
  sponsorblockRemove: item.sponsorblockRemove,
  fpsMax: item.fpsMax,
}
```

#### Web/SSE fallback path (linhas 384-475)

- Monta `URLSearchParams` (linhas 385-412)
- Abre `EventSource('/api/download/start?...')` (linha 414)
- Handler `onmessage` processa `progress`, `complete`, `error` (linhas 417-461)

### [6] IPC Handler (Electron main process)

- **Arquivo**: `electron/main.cjs`
- **Linha**: 147-211
- **Import dinâmico**: `import('../src/core/ytdlp/YtDlpManager.ts')` (linha 148)
- **Resolve binários**: `resolveYtDlpPath()` + `resolveFfmpegPath()` (linhas 149-150)
- **Guard binário**: se `!resolvedYtDlpPath`, envia erro via webContents (linhas 154-159)
- **Output dir**: `params.outputDir || app.getPath('downloads')` (linha 161)
- **Chama spawnDownload**: linhas 164-201 — repassa **todos os campos** do params

```js
// electron/main.cjs:164-201 (resumo)
const child = spawnDownload({
  url: params.url,
  outputDir,
  format: params.format,
  audioOnly: params.audioOnly,
  // ... todos os campos repassados ...
  fpsMax: params.fpsMax,
  onProgress: (data) => { mainWindow?.webContents.send('yt-dlp-progress', {...}); },
  onComplete: (filePath) => { mainWindow?.webContents.send('yt-dlp-progress', {...}); },
  onError: (error) => { mainWindow?.webContents.send('yt-dlp-progress', {...}); },
});
```

### [7] spawnDownload()

- **Arquivo**: `src/core/ytdlp/YtDlpManager.ts`
- **Linha**: 141-317
- **Params type**: interface inline (linhas 141-170)

#### Args construction (linhas 176-249)

| Arg | Linha | Condição |
|-----|-------|----------|
| `--no-playlist` | 177 | Sempre |
| `--no-warnings` | 178 | Sempre |
| `--newline` | 179 | Sempre |
| `--progress` | 180 | Sempre |
| `--no-mtime` | 181 | Sempre |
| `--format <finalFormat>` | 200 | Sempre |
| `--extract-audio` | 203 | `audioOnly` |
| `--audio-format` | 204 | `audioOnly && audioFormat` |
| `--audio-quality` | 205 | `audioOnly && audioQuality` |
| `--merge-output-format` | 208 | `mergeOutputFormat` |
| `--write-subs` | 210 | `writeSubs` |
| `--write-auto-subs` | 211 | `writeAutoSubs` |
| `--sub-langs` | 212 | `subLangs` |
| `--sub-format` | 213 | `subFormat` |
| `--embed-subs` | 214 | `embedSubs` |
| `--write-thumbnail` | 216 | `writeThumbnail` |
| `--embed-thumbnail` | 217 | `embedThumbnail` |
| `--embed-metadata` | 218 | `embedMetadata` |
| `--restrict-filenames` | 220 | `restrictFilenames` |
| `--no-overwrites` | 221 | `noOverwrites` |
| `--keep-video` | 222 | `keepVideo` |
| `--download-sections` | 224-226 | `downloadSections` |
| `--sponsorblock-remove` | 228-230 | `sponsorblockRemove` |
| `--limit-rate <N>K` | 232-234 | `bandLimit > 0` |
| `--concurrent-fragments <N>` | 236-238 | `concurrentFragments > 1` |
| `--retries <N>` | 240-242 | `retries > 0` |
| `-o <outputDir>/%(title)s.%(ext)s` | 244-245 | Sempre |
| `--ffmpeg-location <path>` | 247 | `ffmpegPath` truthy |
| `<url>` | 249 | Sempre (último arg) |

#### Format string transformations

1. **videoOnly** (linhas 187-193): remove `+ba[ext=...]`, `+ba`, `/ba`, `/b` do format string
2. **fpsMax** (linhas 195-198): append fallback `/bv*[fps<=N]+ba/b[fps<=N]` — **mutação de string frágil (bug #3)**

### [8] spawn()

- **Arquivo**: `src/core/ytdlp/YtDlpManager.ts`
- **Binary resolution**: `await ensureYtDlp()` (linha 256) → `getBinaryPath()` (linha 109-111)
- **Spawn**: `spawn(binary, args)` (linha 257)
- **stdout parsing**: linhas 261-284 — regex `[download] X% of Y at Z/s ETA W`
- **stderr handling**: linhas 286-291 — log warnings
- **close handler**: linhas 293-302 — `code === 0` → `onComplete`, senão `onError`
- **Return**: função de cancelamento `() => { proc?.kill('SIGTERM') }` (linhas 313-316)

---

## Campos do DownloadItem (types.ts:57-96)

```
id, title, thumbnailUrl, platform, format, formatString, audioOnly,
audioFormat, audioQuality, writeSubs, writeAutoSubs, subLangs, subFormat,
embedSubs, writeThumbnail, embedThumbnail, embedMetadata, mergeOutputFormat,
restrictFilenames, noOverwrites, keepVideo, concurrentFragments, retries,
downloadSections, videoOnly, sponsorblockRemove, fpsMax, bandLimit,
sizeTotal, sizeDownloaded, progress, speed, eta, status, addedAt, finishedAt, url, error
```

> **Nota**: `bandLimit` existe no tipo (types.ts:85) e no `FormatOptions`
> (LinkAnalyzer.tsx:57), mas nunca é copiado em `addDownload()`.

---

## Bugs Conhecidos no Fluxo

| # | Bug | Arquivo | Linha | Severidade |
|---|-----|---------|-------|------------|
| 1 | `bandLimit` não mapeado de `formatOptions` → `DownloadItem` em `addDownload()` | `DownloadEngine.ts` | 100-158 (ausente entre 144-145) | 🔴 Alta — limitador de velocidade nunca funciona |
| 2 | `buildArgs()` é dead code — nunca chamado no flow Electron nem Web | `YtDlpManager.ts` | 433-517 | 🟡 Média — duplica lógica de args sem ser usada |
| 3 | `fpsMax` em `spawnDownload` usa mutação de string do format (regex frágil) | `YtDlpManager.ts` | 195-198 | 🟡 Média — `buildArgs` usa `--format-sort` (linha 449) que é mais robusto |
| 4 | `handleStartDownload` retorna silenciosamente se `selectedFormat` é null | `LinkAnalyzer.tsx` | 172 | 🟢 Baixa — UX confusa mas sem crash |
| 5 | `openFileLocation` engole erros: `.catch(() => {})` | `DownloadEngine.ts` | 481 | 🟢 Baixa — falha silenciosa ao abrir pasta |
| 6 | `global.d.ts` usa `Promise<any>` para `invoke()` em vez de tipos específicos | `global.d.ts` | 8 | 🟢 Baixa — perde type safety no renderer |

---

## Diagrama de Chamadas

```
LinkAnalyzer.tsx                    DownloadEngine.ts                   YtDlpManager.ts
      │                                   │                                   │
      │  [1] click button (L516)          │                                   │
      │  ─────────────────────>           │                                   │
      │  [2] handleStartDownload (L171)   │                                   │
      │  ─────────────────────>           │                                   │
      │                          [3] addDownload (L100)                       │
      │                          map formatOptions→item (L123-144)            │
      │                          ❌ bandLimit NOT mapped                      │
      │                          processQueue (L252)                          │
      │                          ────────────────>                            │
      │                          [5] startYtDlpDownload (L283)                │
      │                          IPC invoke (L339)                            │
      │                          ─────────────────────────────>               │
      │                                    │    [6] main.cjs handler (L147)   │
      │                                    │    import YtDlpManager (L148)    │
      │                                    │    ──────────────────────────>   │
      │                                    │    [7] spawnDownload (L141)      │
      │                                    │    build args (L176-249)         │
      │                                    │    ensureYtDlp (L256)            │
      │                                    │    spawn(binary, args) (L257)    │
      │                                    │    <── stdout ── progress ──>    │
      │                          <── onProgress callback ──                  │
      │  <── yt-dlp-progress events ──────                                   │
```
