# Análise de Gaps — Porte Android (Capacitor)

> **Data**: 2026-07-18
> **Objetivo**: Documentar o que está errado ou faltando no app para funcionar corretamente no Android. Focado no próximo agente corrigir.

---

## O Que Funciona End-to-End

| Feature | Caminho |
|---------|---------|
| Probe (extrair info de vídeo) | `YtDlpAdapter` → `plugin.probe()` → `YoutubeDL.getInstance().getInfo()` com timeout 30s |
| Search (buscar vídeos) | `YtDlpAdapter` → `plugin.search()` → `ytsearch{N}:query --flat-playlist --dump-json` |
| Download (baixar vídeo/áudio) | `DownloadEngine.startYtDlpDownload()` → `plugin.download()` com 25+ parâmetros |
| Progress events | Kotlin `notifyListeners("yt-dlp-progress")` → Capacitor listener → DownloadEngine state |
| Cancel download | `plugin.cancel()` → `destroyProcessById()` + `job.cancel()` |
| Open file after download | `plugin.openFile()` → Intent `ACTION_VIEW` com MIME correto |
| `.then` proxy fix | `CapacitorYtDlp` Proxy impede detecção thenable |
| YtDlpAdapter routing | `isCapacitor()` → plugin, fallback HTTP |
| Auto-update (check/download/install) | GitHub API + APK download + Intent |
| MainActivity registration | `registerPlugin(YtDlpPlugin.class)` |

---

## O Que Está Errado (Gaps)

### 1. Speed display durante download — SEMPRE 0 KB/s

**Arquivo**: `src/core/engine/DownloadEngine.ts:401-406`
**Problema**: O handler Capacitor não faz parse do `payload.speed`. A UI mostra 0 KB/s durante todo o download.

```typescript
// Linha 401-406 — speed NUNCA é processado
if (payload.type === 'progress') {
  const pct = Math.min(Math.round(payload.percent || 0), 99);
  target.progress = pct;
  target.sizeDownloaded = Math.floor((pct / 100) * target.sizeTotal);
  target.eta = this.parseEtaString(payload.eta || '');
  this.notify();
  // ← falta: target.speed = parseSpeedString(payload.speed)
}
```

O Kotlin emite `speed` no callback do `youtubedl-android` (`callback: (progress, etaInSeconds, speed) ->`), e o `notifyListeners` envia `{ id, type: 'progress', percent, eta, speed }`. Mas o JS ignora.

**Fix**: Adicionar `target.speed = this.parseSpeedString(payload.speed || '')` após a linha 405.

---

### 2. Description file save — ignora Capacitor

**Arquivo**: `src/features/analyzer/LinkAnalyzer.tsx:handleStartDownload()`
**Problema**: O branch de salvar descrição só tem `window.electron` vs browser blob. No Capacitor, cai no path do browser (`a.click()`), que não salva arquivo no Android.

```typescript
// Só dois branches:
if (window.electron) {
  window.electron.invoke('save-description', { filename, content });
} else {
  // Blob download via <a> — NÃO funciona no WebView Android
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
```

**Fix**: Adicionar branch `isCapacitor()` que chama `plugin.saveFile({ path, content })` ou similar, ou simplesmente ignorar com toast informativo.

---

### 3. POST_NOTIFICATIONS permission ausente

**Arquivo**: `android/app/src/main/AndroidManifest.xml`
**Problema**: Android 13+ (API 33) exige `POST_NOTIFICATIONS` para notificações. Ausente. `DownloadEngine.notifyCompletion()` falha silenciosamente.

**Fix**: Adicionar `<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />` no manifest + request de runtime na `MainActivity`.

---

### 4. Generic/direct file downloads — `a.click()` não funciona

**Arquivo**: `src/core/engine/DownloadEngine.ts:startProxyDownload()`
**Problema**: Para URLs diretas (mp4, jpg, etc.), usa `<a download>click()` para salvar. No WebView Android, isso pode não iniciar download real.

**Impacto**: Baixo — afeta apenas URLs diretas, que são raras (a maioria passa pelo plugin yt-dlp).

**Fix**: Adicionar branch Capacitor em `startProxyDownload` que delega para `plugin.download()` ou `plugin.saveFile()`.

---

### 5. Image format conversion — sem branch Capacitor

**Arquivo**: `src/core/engine/DownloadEngine.ts:convertAndSaveImageBase64()`
**Problema**: Usa `electron.invoke('save-image-dataurl')` sem branch Capacitor. Imagens com conversão de formato (PNG→JPEG etc) falham no Android.

**Impacto**: Baixo — afeta apenas conversão de formato de imagem.

---

### 6. Download folder selection — não funciona

**Arquivo**: `src/features/settings/SettingsView.tsx`
**Problema**: `handleSelectFolder` só tem branch Electron (`dialog.showOpenDialog`) vs Web (`showDirectoryPicker`). Capacitor cai no `showDirectoryPicker` que pode não existir.

**Impacto**: Médio — usuário não consegue mudar pasta de download no Android.

---

### 7. Open folder button — silenciosamente inoperante

**Arquivo**: `src/features/downloads/DownloadManager.tsx` (ou componente equivalente)
**Problema**: `handleOpenFolder` só funciona com `window.electron`. No Android, o botão não faz nada.

**Impacto**: Baixo — mas UX confusa.

---

### 8. tbr/fps null safety no probe

**Arquivo**: `android/app/src/main/java/com/linkfetcher/app/YtDlpPlugin.kt` — `probe()`
**Problema**: `fmt.tbr.toDouble()` e `fmt.fps.toDouble()` causam NPE se `tbr` ou `fps` vierem como `null` (campos opcionais no yt-dlp).

```kotlin
// Risco de crash:
"tbr" to (fmt.tbr.toDouble()),   // NPE se tbr == null
"fps" to (fmt.fps.toDouble()),   // NPE se fps == null
```

**Fix**: Usar `(fmt.tbr ?: 0f).toDouble()` ou `fmt.tbr?.toDouble() ?: 0.0`.

---

### 9. Build release sem keystore

**Arquivo**: `capacitor.config.ts`
**Problema**: `keystorePath: undefined`. Build de release só funciona com debug keystore padrão.

**Impacto**: Baixo para dev, bloqueante para produção.

---

## Gaps de Paridade Desktop → Android (Features que existem no Desktop mas não no Android)

| Feature | Desktop | Android |
|---------|---------|---------|
| `--cookies` / `--cookies-from-browser` | `YtDlpManager.buildArgs()` | ❌ Não suportado por `youtubedl-android` |
| `--proxy` | `YtDlpManager.buildArgs()` | ❌ Não suportado por `youtubedl-android` |
| `--ffmpeg-location` | Auto-detecta binário local | ❌ Lib bundla próprio ffmpeg (não configurável) |
| `--wait-for-video` / live stream retry | `YtDlpManager.buildArgs()` | ❌ Não implementado no plugin |
| `--download-sections` (trim) | `YtDlpManager.buildArgs()` | ✅ Implementado no Kotlin |
| `--sponsorblock-remove` | `YtDlpManager.buildArgs()` | ✅ Implementado no Kotlin |
| `--concurrent-fragments` | `YtDlpManager.buildArgs()` | ✅ Implementado no Kotlin |
| `--embed-subs/thumbnail/metadata` | `YtDlpManager.buildArgs()` | ✅ Implementado no Kotlin |
| `--restrict-filenames` | `YtDlpManager.buildArgs()` | ✅ Implementado no Kotlin |
| `--no-overwrites` | `YtDlpManager.buildArgs()` | ✅ Implementado no Kotlin |
| `--keep-video` | `YtDlpManager.buildArgs()` | ✅ Implementado no Kotlin |
| `--rate-limit` (bandLimit) | `YtDlpManager.buildArgs()` | ✅ Implementado no Kotlin |
| `--retries` | `YtDlpManager.buildArgs()` | ✅ Implementado no Kotlin |
| `--trim-filenames` | `YtDlpManager.buildArgs()` | ❌ Não implementado no plugin |
| `--windows-filenames` | `YtDlpManager.buildArgs()` | ❌ Não implementado (irrelevante no Android) |
| Resume/retry download | `DownloadEngine` (retry/retryActive) | ❌ Sem suporte a retry parcial |
| Active download tracking | `YtDlpManager.activeJobs` + SSE | ⚠️ `activeJobs` map existe mas não usado |

**Nota**: `--cookies`, `--proxy`, `--ffmpeg-location` são limitações da lib `youtubedl-android` — não são bugs do plugin, são restrições da lib nativa.

---

## Bugs Conhecidos (Desktop) que Afetam Android

| Bug | Arquivo | Impacto no Android |
|-----|---------|-------------------|
| `bandLimit` não mapeado de `formatOptions` → `DownloadItem` | `DownloadEngine.ts:addDownload()` | Limite de velocidade sempre 0 |
| `buildArgs()` é dead code | `YtDlpManager.ts` | N/A (Android não usa) |
| `fpsMax` usa string replace frágil | `YtDlpManager.ts:spawnDownload()` | N/A (Android usa `--format-sort` no Kotlin) |

---

## Gaps de Comportamento (Bugs de Plataforma)

### 10. Overflow hidden no body — scroll freeze

**Arquivo**: `src/index.css:44-46`
**Problema**: `overflow: hidden` em `html, body, #root` pode bloquear scroll em Android WebViews. O scroll depende do container interno ter `overflow-y: auto`, mas muitos WebViews Android bloqueiam scroll quando o body tem `overflow: hidden`.

```css
html, body, #root {
  height: 100%;
  overflow: hidden;  /* ← pode causar scroll freeze no Android */
}
```

**Onde investigar**: Qualquer scrollable container no app. Se `#root` não tiver `overflow-y: auto`, a UI trava inteira.

**Fix**: Adicionar `overscroll-behavior: contain` nos containers scrolláveis e garantir que `#root` tenha `overflow-y: auto`.

---

### 11. Overscroll-behavior ausente — scroll vaza para pull-to-refresh

**Arquivo**: `src/index.css` (nenhuma ocorrência)
**Problema**: Sem `overscroll-behavior: contain`, o scroll interno pode "vazar" para o pull-to-refresh do Chrome Android ou para a navegação back/forward do WebView.

**Onde investigar**: Buscar `overscroll` em todo o CSS. Nenhuma ocorrência encontrada.

---

### 12. Back button handler ausente

**Arquivo**: Nenhum em `src/`
**Problema**: Nenhum `App.addListener('backButton', ...)` registrado. Botão voltar do Android fecha o app em vez de navegar entre telas.

**Onde investigar**: Verificar se `@capacitor/app` está no `package.json` e se `MainActivity.kt` registrou `AppPlugin`. Buscar `backButton` em `src/`.

**Fix**: Adicionar listener em `App.tsx` que: (1) se há navegação no histórico → `router.back()`, (2) se está na home → minimizar app, (3) se há modal aberto → fecha modal.

---

### 13. StatusBar e safe area não tratados

**Arquivo**: Nenhum em `src/`
**Problema**: Nenhum `StatusBar.setStyle()`, nenhum `env(safe-area-inset-*)` no CSS. Header pode ficar atrás da barra de status ou do notch.

**Onde investigar**: Buscar `StatusBar` e `safe-area` em todo o projeto. Verificar `capacitor.config.ts` para configuração de status bar.

**Fix**: Configurar `StatusBar.setStyle({ style: Dark })` no init + adicionar `padding-top: env(safe-area-inset-top)` no header principal.

---

### 14. Keyboard resize — layout não se ajusta

**Arquivo**: Nenhum em `src/`
**Problema**: Quando o teclado virtual abre no Android, o layout não se ajusta. Inputs/CTA podem ficar truncados atrás do teclado.

**Onde investigar**: Buscar `visualViewport` e `resize` em `src/`. O único resize listener está em `NeuralConstellationBackground.tsx:218` (sem debounce).

**Fix**: Usar `@capacitor/keyboard` com `Keyboard.addListener('keyboardDidShow', ...)` para ajustar padding底部, ou usar `inputMode` + `resize` no WebView.

---

### 15. Resize listener sem debounce — teclado causa resize espúrio

**Arquivo**: `src/components/NeuralConstellationBackground.tsx:218-224`
**Problema**: `window.addEventListener('resize', onResize)` sem debounce. O teclado virtual dispara resize events que redimensionam o canvas incorretamente.

```tsx
window.addEventListener('resize', onResize);
// sem debounce — teclado abre/fecha causa flicker
```

**Fix**: Adicionar debounce de 150ms no resize handler, ou usar `visualViewport.resize` em vez de `window.resize`.

---

### 16. Notification API sempre falha no Android WebView

**Arquivo**: `src/core/engine/DownloadEngine.ts:730-739`
**Problema**: O objeto `Notification` existe no Android WebView mas `requestPermission()` retorna `'denied'` sem possibilidade de mudança. Notificações nunca aparecem.

```tsx
private notifyCompletion(item: DownloadItem) {
  if (this.settings.notifications && 'Notification' in window) {
    // Notification.requestPermission() → 'denied' silenciosamente no Android
  }
}
```

**Onde investigar**: Verificar `Notification.permission` no Android. Se for sempre `'denied'`, precisar de `@capacitor/local-notifications`.

**Fix**: Adicionar branch Capacitor que usa `LocalNotifications.schedule()` do `@capacitor/local-notifications` em vez de Web Notification API.

---

### 17. Share usa clipboard em vez de Web Share API

**Arquivo**: `src/features/downloads/DownloadManager.tsx:105-112`
**Problema**: `handleShare` copia URL para clipboard em vez de abrir share sheet nativa do Android. Funcional mas UX inferior.

```tsx
const handleShare = (item: DownloadItem) => {
  navigator.clipboard.writeText(item.url); // UX inferior
};
```

**Onde investigar**: Verificar se `navigator.share` está disponível. No Android WebView, `navigator.share()` abre o share sheet nativo.

**Fix**:
```tsx
if (navigator.share) {
  await navigator.share({ title: item.title, url: item.url });
} else {
  await navigator.clipboard.writeText(item.url);
}
```

---

### 18. Toasts ficam atrás da nav bar — sem safe-area

**Arquivos**: `src/features/settings/SettingsView.tsx:197`, `src/features/downloads/DownloadManager.tsx:152`
**Problema**: `fixed bottom-6 right-6` não considera `env(safe-area-inset-bottom)`. Toast pode ficar atrás da navigation bar do Android.

**Onde investigar**: Buscar `fixed bottom` em todos os componentes. Adicionar `pb-[env(safe-area-inset-bottom)]` ou usar `bottom-6` com `max(bottom-6, env(safe-area-inset-bottom))`.

---

### 19. Salvar estado ao fechar app — não existe

**Arquivo**: `src/core/engine/DownloadEngine.ts:77`
**Problema**: `saveState()` é chamado em `notify()` (durante downloads), mas não há `beforeunload` ou listener de shutdown. Se o app for fechado (swipe away), downloads em progresso podem ser perdidos.

**Onde investigar**: Buscar `beforeunload`, `unload`, `visibilitychange`, `App.addListener('appStateChange')` em `src/`. Nenhum encontrado.

**Fix**: Adicionar `App.addListener('appStateChange', ({ isActive }) => { if (!isActive) this.saveState(); })` no construtor do DownloadEngine quando no Capacitor.

---

### 20. Thumbnail download — cross-origin `<a download>` ignorado

**Arquivo**: `src/features/analyzer/LinkAnalyzer.tsx:385-392`
**Problema**: Thumbnail download usa proxy URL cross-origin (`/api/proxy-download?url=...`) com `<a download>`. Android WebView ignora `download` attribute em cross-origin URLs — abre nova tab em vez de baixar.

**Onde investigar**: Verificar se o proxy existe no Capacitor standalone (não existe). A URL `/api/proxy-download` só existe quando roda com Express server.

**Fix**: Branch Capacitor que usa `Capacitor.Http.request()` para baixar + `Capacitor.Filesystem.writeFile()` para salvar.

---

### 21. Proxy downloads — `/api/*` inexistente no standalone

**Arquivo**: `src/core/engine/DownloadEngine.ts:249,666,670,684`
**Problema**: Vários caminhos de download dependem de endpoints `/api/*` que não existem no Capacitor standalone.

```tsx
// Linha 249: fetch('/api/download/cancel', ...)
// Linha 666: const proxyFetchUrl = `/api/proxy-download?url=...`;
// Linha 684: fetch(proxyFetchUrl)
```

**Onde investigar**: Mapear todos os fetch para `/api/*` em `DownloadEngine.ts`. O adapter (`YtDlpAdapter`) tem fallback, mas o `DownloadEngine` internamente também chama `/api/*` diretamente.

**Fix**: Adicionar detecção `isCapacitor()` em cada ponto que faz fetch para `/api/*` e delegar para o plugin nativo.

---

### 22. Clipboard readText pode ser negado sem feedback

**Arquivo**: `src/features/analyzer/LinkAnalyzer.tsx:275`
**Problema**: `navigator.clipboard.readText()` requer permissão `clipboard-read` — pode ser negada no Android WebView sem indicação clara.

```tsx
const text = await navigator.clipboard.readText(); // pode falhar silenciosamente
```

**Onde investigar**: Verificar se o try/catch na linha 275 mostra mensagem de erro adequada ao usuário.

---

### 23. Touch events com passive:false — warning Chrome

**Arquivo**: `src/features/downloads/FormatSelector.tsx:186-196`
**Problema**: `addEventListener('touchmove', handler, { passive: false })` com `e.preventDefault()` gera warning no Chrome DevTools e pode causar jank.

**Onde investigar**: Verificar se o slider de formato funciona bem no touch. O `preventDefault()` bloqueia scroll durante o drag.

---

### 24. localStorage 5MB limit — pode estourar

**Arquivos**: `src/core/storage/Storage.ts`, `src/core/engine/DownloadEngine.ts:58,77`
**Problema**: `localStorage` no Android WebView tem limite de ~5MB. `saveState()` serializa TODA a fila de downloads a cada notificação. Com 200+ downloads, pode atingir o limite.

**Onde investigar**: Medir tamanho de `localStorage.getItem('universal_downloader_items')` com fila grande. Se > 4MB, migrar para `@capacitor/preferences` ou IndexedDB.

---

### 25. Open folder — botão completamente morto

**Arquivo**: `src/features/downloads/DownloadManager.tsx:115-121`
**Problema**: `handleOpenFolder` retorna silenciosamente se `window.electron` não existe. Botão visível mas inoperante.

```tsx
const handleOpenFolder = async (_item: DownloadItem) => {
  if (!window.electron?.invoke) return; // ← retorna sem fazer nada
  // ...
};
```

**Onde investigar**: Verificar se o botão está visível no Android (provavelmente sim, sem condicional de plataforma).

**Fix**: Branch Capacitor que usa `app.openFile()` ou `Share.share()` com o path do arquivo.

---

## Gaps de Paridade Desktop → Android (Features que existem no Desktop mas não no Android)

| Feature | Desktop | Android | Onde investigar |
|---------|---------|---------|-----------------|
| `--cookies` / `--cookies-from-browser` | `YtDlpManager.buildArgs()` | ❌ Não suportado por `youtubedl-android` | Limitação da lib nativa |
| `--proxy` | `YtDlpManager.buildArgs()` | ❌ Não suportado por `youtubedl-android` | Limitação da lib nativa |
| `--ffmpeg-location` | Auto-detecta binário local | ❌ Lib bundla próprio ffmpeg | Limitação da lib nativa |
| `--wait-for-video` / live stream retry | `YtDlpManager.buildArgs()` | ❌ Não implementado | Pode ser adicionado no plugin Kotlin |
| `--download-sections` (trim) | `YtDlpManager.buildArgs()` | ✅ Implementado | — |
| `--sponsorblock-remove` | `YtDlpManager.buildArgs()` | ✅ Implementado | — |
| `--concurrent-fragments` | `YtDlpManager.buildArgs()` | ✅ Implementado | — |
| `--embed-subs/thumbnail/metadata` | `YtDlpManager.buildArgs()` | ✅ Implementado | — |
| `--restrict-filenames` | `YtDlpManager.buildArgs()` | ✅ Implementado | — |
| `--no-overwrites` | `YtDlpManager.buildArgs()` | ✅ Implementado | — |
| `--keep-video` | `YtDlpManager.buildArgs()` | ✅ Implementado | — |
| `--rate-limit` (bandLimit) | `YtDlpManager.buildArgs()` | ✅ Implementado | — |
| `--retries` | `YtDlpManager.buildArgs()` | ✅ Implementado | — |
| `--trim-filenames` | `YtDlpManager.buildArgs()` | ❌ Não implementado | Pode ser adicionado no plugin Kotlin |
| `--windows-filenames` | `YtDlpManager.buildArgs()` | ❌ Irrelevante no Android | — |
| Resume/retry download | `DownloadEngine` (retry/retryActive) | ❌ Sem suporte | Plugin Kotlin não suporta resume parcial |
| Active download tracking | `YtDlpManager.activeJobs` + SSE | ⚠️ `activeJobs` map existe mas não usado | `DownloadEngine.ts` — verificar se `activeJobs` é populado no Capacitor |

---

## Bugs Conhecidos (Desktop) que Afetam Android

| Bug | Arquivo | Linha | Impacto no Android | Onde investigar |
|-----|---------|-------|-------------------|-----------------|
| `bandLimit` não mapeado de `formatOptions` → `DownloadItem` | `DownloadEngine.ts` | `addDownload()` | Limite de velocidade sempre 0 | Verificar se `formatOptions.bandLimit` chega ao item |
| `buildArgs()` é dead code | `YtDlpManager.ts` | — | N/A (Android não usa) | — |
| `fpsMax` usa string replace frágil | `YtDlpManager.ts` | `spawnDownload()` | N/A (Android usa `--format-sort`) | — |

---

## ⚠️ BUG BLOQUEANTE CRÍTICO — Download nunca baixa nada no Android (2026-07-20)

> **STATUS: NÃO RESOLVIDO — PRÓXIMO AGENTE DEVE CORRIGIR**

### Sintoma
Probe/análise funciona perfeitamente (retorna formatos, thumbnails, metadata). Mas quando o usuário clica "Baixar", o card aparece na fila com progresso 0%, depois de ~8s muda para "Falhou" com mensagem "Download concluído mas nenhum arquivo encontrado".

### Diagnóstico (via adb logcat + Chrome DevTools)
O yt-dlp é chamado corretamente, faz a extração da URL, baixa webpage, baixa android player API JSON... mas **nunca chega à fase de seleção de formato e download**. O processo termina com exit code 0 mas sem gerar nenhum arquivo.

**Stdout (4 linhas, sem `[download]`):**
```
[youtube] Extracting URL: https://www.youtube.com/watch?v=...
[youtube] ...: Downloading webpage
[youtube] ...: Downloading android player API JSON
[info] ...: There are no chapters matching the regex
```

**Stderr (2226 chars — versão anterior truncava em 2000, agora com chunked logging):**
O stderr contém `--verbose` output mostrando:
- yt-dlp versão `stable@2025.11.12`
- Formatos encontrados e ordenados (`Formats sorted by: hasvid, ie_pref, quality, res, fps...`)
- **Mas NENHUMA linha de seleção de formato ou download**

**Pista crítica no stderr**: Opções `--download-sections` e `--sponsorblock-remove` aparecem SEM VALOR na linha de comando, o que pode deslocar o parsing de todos os args seguintes:
```
'--retries', '3', '--download-sections', '--sponsorblock-remove', '--verbose', ...
```

### Causa raiz provável (2 hipóteses)

1. **Opções sem valor deslocam o parser**: `--download-sections` exige um valor (ex: `*1:30-2:00`). Sem ele, yt-dlp pode consumir `--sponsorblock-remove` como o valor de `--download-sections`, e `--verbose` como o valor de `--sponsorblock-remove`. Isso quebraria silenciosamente o parsing.
   - **Verificar**: Capacitor envia `undefined` para campos opcionais? Kotlin `call.getString()` retorna `null` para keys ausentes? Se `item.downloadSections` for `undefined` no JS, Capacitor pode serializar como `""` (empty string) em vez de omitir.
   - **Fix provável**: No Kotlin, NÃO adicionar `--download-sections` e `--sponsorblock-remove` quando o valor é null/empty:
     ```kotlin
     call.getString("downloadSections")?.takeIf { it.isNotBlank() }?.let { request.addOption("--download-sections", it) }
     call.getString("sponsorblockRemove")?.takeIf { it.isNotBlank() }?.let { request.addOption("--sponsorblock-remove", it) }
     ```

2. **Format selector incompatível com `player_client=android`**: O formato `bv*[vcodec~=h264][height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]` pode não corresponder a nenhum formato quando o YouTube retorna formatos para o player client "android" (que tem IDs e codecs diferentes do client "web").
   - **Fix provável**: Usar formato mais simples no Android: `bestvideo[height<=1080]+bestaudio/best[height<=1080]` ou apenas `best`.
   - **Alternativa**: Não forçar `--format-sort` quando fpsMax é 0.

### O que já foi feito (não resolveram o bug)
- Exit code checking (captura `YoutubeDLResponse`, verifica `exitCode`) — compilou e roda, mas o exit code é 0 mesmo assim
- `--verbose` adicionado ao request para debug — revelou o problema acima
- Chunked logging de stdout/stderr (3000 chars por chunk) — revelou que o stderr tem 2226 chars de info de debug
- Speed parsing (regex de linha crua do yt-dlp) — funciona, mas irrelevante se o download não inicia

### Arquivos afetados
- `android/app/src/main/java/com/linkfetcher/app/YtDlpPlugin.kt` — linhas 287-309 (opções do download), 315 (execute), 331-335 (logging)
- `src/core/engine/DownloadEngine.ts` — linhas 496-497 (passa downloadSections/sponsorblockRemove)
- `src/features/downloads/FormatSelector.tsx` — gera o format string `bv*[vcodec~=h264]...`

### Para o próximo agente
1. **Remover `--verbose`** antes de fix final (está na linha 311 do YtDlpPlugin.kt)
2. **Testar com formato simples**: trocar o format string para `best` ou `bestvideo+bestaudio/best` temporariamente para confirmar se o problema é o format selector
3. **Verificar se as opções vazias são o problema**: adicionar log de todos os options antes do execute, ou inspecionar `call.getString("downloadSections")` quando o usuário não configurou seções
4. **Verificar o stderr COMPLETO**: o chunked logging agora mostra tudo — procurar por linhas como `[download] Destination:` ou `ERROR:` ou `WARNING:` que podem estar escondidas

---

## Resumo Executivo

| Categoria | Qtd | Itens |
|-----------|-----|-------|
| **🔴 BLOQUEANTE** | 1 | **Download nunca baixa nada** (ver acima) |
| **Bugs (está errado)** | 5 | Speed zero, description save, null safety, overflow hidden, back button |
| **Features faltando** | 10 | POST_NOTIFICATIONS, folder selection, open folder, generic download, image conversion, keyboard resize, status bar, safe area, overscroll, share API |
| **Comportamento degradado** | 8 | Toasts behind nav bar, resize espúrio, thumbnail cross-origin, proxy inexistente, clipboard negado, touch passive, localStorage limit, save state no shutdown |
| **Paridade limitada** | 3 | Cookies, proxy, wait-for-video (limitações da lib) |
| **Build/release** | 1 | Keystore ausente |

**Prioridade de fix (ordenada por impacto)**:
0. **🔴 Download never downloads** — BLOQUEANTE, sem isso nada funciona
1. **overflow: hidden** no body — pode travar a UI inteira
2. **Back button handler** — navegação quebra
3. **Speed zero** — UX ruim
4. **Null safety no probe** — crash potencial
5. **POST_NOTIFICATIONS** — notificações quebradas
6. **Keyboard resize** — inputs truncados
7. **StatusBar/safe area** — overlap visual
8. **Open folder** — botão morto
9. **Description save** — feature ignorada
10. **Share API** — UX inferior
11. **Toast safe area** — invisível atrás da nav bar
12. **Overscroll behavior** — scroll vaza
13. **Resize debounce** — canvas flicker
14. **Thumbnail cross-origin** — download falha
15. **Proxy /api/* inexistente** — downloads diretos falham
16. **Save state no shutdown** — downloads perdidos
17. **localStorage limit** — estoura com muitos downloads
18. **Clipboard readText** — permissão negada
19. **Touch passive** — warning Chrome
20. **Keystore** — build release
