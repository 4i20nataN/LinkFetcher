# Auditoria UI e Performance — Android (Capacitor)

**Data:** 2026-07-22
**Escopo:** 100% Android (Capacitor WebView + Plugin Nativo)
**Arquitetura:** Capacitor hybrid — React/Vite (WebView) + YtDlpPlugin.kt (nativo)

---

## 1. Mapeamento Arquitetônico

```
┌─────────────────────────────────────────────────────────────┐
│  React UI (WebView)                                         │
│  FormatSelector.tsx → FormatOptions state                   │
│  DownloadManager.tsx → DownloadEngine.ts                    │
│  YouTubeSearch.tsx → searchVideosWithAdapter()              │
└───────────────────────┬─────────────────────────────────────┘
                        │ Capacitor Bridge (JSON payloads)
┌───────────────────────▼─────────────────────────────────────┐
│  YtDlpPlugin.kt (Capacitor Plugin)                          │
│  buildArgs() → YoutubeDL → youtubedl-android library        │
│  probe() → JSON metadata                                    │
│  download() → progress events via notifyListeners           │
│  search() → flat-playlist extraction                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│  Binários: yt-dlp + ffmpeg (em assets/ ou app files)        │
│  youtubedl-android library (wrapper nativo Java)            │
└─────────────────────────────────────────────────────────────┘
```

### Arquivos Chave

| Camada | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| **UI** | `src/features/downloads/FormatSelector.tsx` | Opções de mídia (resolução, codec, áudio, legendas, metadados, SponsorBlock, trim, etc.) |
| **UI** | `src/features/downloads/DownloadManager.tsx` | Lista de downloads, progresso, pausa/cancelar/reabrir |
| **UI** | `src/features/youtube/YouTubeSearch.tsx` | Busca YouTube com autocomplete |
| **Engine** | `src/core/engine/DownloadEngine.ts` | Orquestração de downloads, fila, progresso, SSE/Capacitor bridge |
| **Adapter** | `src/core/ytdlp/YtDlpAdapter.ts` | Camada abstrata: detecta Capacitor/Electron/Web e despacha |
| **Bridge** | `src/core/ytdlp/CapacitorYtDlp.ts` | Wrapper TypeScript do plugin Capacitor YtDlp |
| **Nativo** | `android/.../YtDlpPlugin.kt` | Plugin Capacitor: probe, download, search, merge, cancel, openFile |
| **Nativo** | `android/.../MainActivity.java` | Registra YtDlpPlugin, solicita permissão de notificação |
| **State** | `src/context/AppContext.tsx` | Estado global: settings, downloads, favoritos |
| **Tipos** | `src/types.ts` | Definições de DownloadItem, MediaInfo, AppSettings, etc. |

---

## 2. Mapeamento UI → Plugin Nativo → Argumentos yt-dlp/ffmpeg

### 2.1 FormatSelector.tsx → YtDlpPlugin.kt

Cada controle UI gera um campo em `FormatOptions`, que é propagado via `DownloadEngine.startRealDownload()` → `CapacitorYtDlp.download()` → `YtDlpPlugin.kt.download()` → `buildArgs()`.

| # | Controle UI | FormatOption | yt-dlp Argumento | Plugin Nativo Suporta? | Status |
|---|-------------|-------------|-------------------|----------------------|--------|
| 1 | Botões de Resolução (★ Melhor, 4K, 1080p, etc.) | `format` | `-f <preset>` | ✅ `buildArgs()` | **OK** |
| 2 | Formato de Vídeo (MP4, MKV, WebM, etc.) | `videoFormat` | Incluído no `-f` selector | ✅ via format string | **OK** |
| 3 | Codec de Vídeo (H.264, H.265, VP9, AV1) | `videoCodec` | `[vcodec~=<codec>]` no `-f` | ✅ via format string | **OK** |
| 4 | Toggle "Extrair apenas áudio" | `audioOnly` | `-x` | ✅ `buildArgs()` | **OK** |
| 5 | Formato de Áudio (MP3, AAC, M4A, FLAC, OPUS, WAV) | `audioFormat` | `--audio-format <fmt>` | ✅ `buildArgs()` | **OK** |
| 6 | Qualidade de Áudio (0=Melhor, 3=320k, ..., 9=64k) | `audioQuality` | `--audio-quality <val>` | ✅ `buildArgs()` | **OK** |
| 7 | Toggle "Baixar legendas" | `writeSubs` | `--write-subs` | ✅ `buildArgs()` | **OK** |
| 8 | Toggle "Legendas automáticas" | `writeAutoSubs` | `--write-auto-subs` | ✅ `buildArgs()` | **OK** |
| 9 | Idioma das legendas (PT, EN, ES, PT+EN, Todos) | `subLangs` | `--sub-langs <langs>` | ✅ `buildArgs()` | **OK** |
| 10 | Formato da legenda (SRT, ASS, VTT) | `subFormat` | `--sub-format <fmt>` | ✅ `buildArgs()` | **OK** |
| 11 | Toggle "Embutir legendas no vídeo" | `embedSubs` | `--embed-subs` | ✅ `buildArgs()` | ⚠️ **DesktopOnlyTag ativo** |
| 12 | Toggle "Salvar thumbnail" | `writeThumbnail` | `--write-thumbnail` | ✅ `buildArgs()` | **OK** |
| 13 | Toggle "Incorporar thumbnail" | `embedThumbnail` | `--embed-thumbnail` | ✅ `buildArgs()` | ⚠️ **DesktopOnlyTag ativo** |
| 14 | Toggle "Metadados" | `embedMetadata` | `--embed-metadata` | ✅ `buildArgs()` | **OK** |
| 15 | Seções SponsorBlock (sponsor, intro, outro, etc.) | `sponsorblockRemove` | `--sponsorblock-remove <cats>` | ✅ `buildArgs()` | ⚠️ **Desabilitado no Android** |
| 16 | Recorte de tempo (TimeRangeSlider / inputs manuais) | `downloadSections` | `--download-sections "*start-end"` | ✅ `buildArgs()` | **OK** |
| 17 | Modo de saída (Vídeo+Áudio, Só Vídeo, Só Áudio) | `videoOnly` | `-f bv` (video only) | ✅ `buildArgs()` | **OK** |
| 18 | FPS Máximo (Original, 24, 30, 60, 120) | `fpsMax` | `--fps-max <fps>` | ✅ `buildArgs()` | **OK** |
| 19 | Limite de Velocidade (0 a 50MB/s) | `bandLimit` | `-r <speed>` | ✅ `buildArgs()` | **OK** |
| 20 | Toggle "Não sobrescrever arquivos" | `noOverwrites` | `--no-overwrites` | ✅ `buildArgs()` | **OK** |
| 21 | Toggle "Manter vídeo ao extrair áudio" | `keepVideo` | `--keep-video` | ✅ `buildArgs()` | **OK** |
| 22 | Toggle "Nome limpo (sem caracteres especiais)" | `restrictFilenames` | `--restrict-filenames` | ✅ `buildArgs()` | **OK** |
| 23 | Campo "Nome do Arquivo" (custom filename) | `customFilename` | `-o <template>` | ✅ `buildArgs()` | **OK** |
| 24 | Formato customizado (yt-dlp input direto) | `format` | `-f <custom>` | ✅ via format string | **OK** |
| 25 | Concorrência de fragmentos | `concurrentFragments` | `--concurrent-fragments <N>` | ✅ `buildArgs()` | **OK** |
| 26 | Retentativas | `retries` | `--retries <N>` | ✅ `buildArgs()` | **OK** |

### 2.2 DownloadManager.tsx → YtDlpPlugin.kt

| Ação UI | Plugin Nativo | Método |
|---------|--------------|--------|
| Pausar download | `plugin.cancel({id})` | `cancel()` — interrompe processo yt-dlp |
| Retomar download | Re-submete via `plugin.download(params)` | `download()` — reinicia com mesmos args |
| Cancelar download | `plugin.cancel({id})` | `cancel()` |
| Reintentar | Re-submete via `plugin.download(params)` | `download()` |
| Reordenar fila | `DownloadEngine.reorderQueue()` | Lógica JS apenas (não afeta nativo) |
| Abrir arquivo | `plugin.openFile({filePath})` | `openFile()` → Intent nativo |
| Compartilhar | `navigator.share()` / clipboard | API Web (não passa pelo plugin) |

### 2.3 YouTubeSearch.tsx → YtDlpPlugin.kt

| Ação UI | Plugin Nativo | Argumentos yt-dlp |
|---------|--------------|-------------------|
| Buscar vídeos | `plugin.search({query, platform, maxResults})` | `yt-dlp --flat-playlist --dump-json "ytsearch10:<query>"` |

### 2.4 Probe (Análise de URL) → YtDlpPlugin.kt

| Ação UI | Plugin Nativo | Argumentos yt-dlp |
|---------|--------------|-------------------|
| Analisar URL | `plugin.probe({url})` | `yt-dlp --dump-json --no-download <url>` |

---

## 3. Bugs de UX Identificados

### BUG-01: `isWebMode` não detecta Capacitor (Crítico)

**Arquivo:** `src/features/downloads/FormatSelector.tsx:10`

```typescript
const isWebMode = typeof window !== 'undefined' && !window.electron;
```

**Problema:** A variável `isWebMode` só verifica `window.electron`. No Android (Capacitor), `window.electron` é `undefined`, então `isWebMode = true`. Isso desabilita funcionalidades que **funcionam no plugin nativo**:

- **`embedSubs`** (linha 947-949): `opacity-40 pointer-events-none` + DesktopOnlyTag
- **`embedThumbnail`** (linha 1123-1126): `opacity-40 pointer-events-none` + DesktopOnlyTag
- **SponsorBlock** (linha 1062): `opacity-40 pointer-events-none`

**Impacto:** Usuários Android não conseguem ativar:
- Embutir legendas no vídeo (`--embed-subs`)
- Embutir thumbnail no arquivo (`--embed-thumbnail`)
- Usar SponsorBlock (`--sponsorblock-remove`)

**Correção necessária:**
```typescript
const isWebMode = typeof window !== 'undefined' 
  && !window.electron 
  && !(window as any).Capacitor?.isNativePlatform?.();
```

**Severidade:** Crítica — funcionalidades nativas bloqueadas por detecção de plataforma incorreta.

---

### BUG-02: `isWebMode` não afeta DownloadManager (observação)

**Arquivo:** `src/features/downloads/DownloadManager.tsx`

O `DownloadManager` não usa `isWebMode`, então as ações de pause/cancel/retry funcionam corretamente no Android. A inconsistência está isolada no `FormatSelector`.

---

### BUG-03: speed não é reportado no Android

**Arquivo:** `src/core/engine/DownloadEngine.ts:420` (comentário)

```typescript
// Obs: a lib nativa (youtubedl-android) só expõe percent/eta no callback de progresso, não speed.
```

**Problema:** A biblioteca `youtubedl-android` não reporta velocidade de download no callback de progresso. O campo `speed` no `DownloadItem` sempre será 0 no Android.

**Impacto:** UI do DownloadManager mostra "0 KB/s" durante downloads no Android.

**Correção:** Implementar cálculo de velocidade no lado JS usando variação de `sizeDownloaded` / intervalo de tempo.

---

### BUG-04: `videoFormat` e `videoCodec` não são passados explicitamente ao plugin

**Arquivo:** `src/core/engine/DownloadEngine.ts:476-523`

Os campos `videoFormat` e `videoCodec` são definidos em `FormatOptions` mas **não são passados como parâmetros separados** para `plugin.download()`. Eles são incorporados na string `format` no FormatSelector (via manipulação de regex no `options.format`):

```typescript
// FormatSelector.tsx:819-823
fmt = fmt.replace(/\[vcodec~?[^]]*\]/g, '');
if (codecVal) {
  fmt = fmt.replace(/bv\*\[/g, `bv*[vcodec~=${codecVal}][`);
}
```

**Status:** Funcional — a string de formato já contém o codec/formato desejado. Não é um bug, mas é uma arquitetura indireta.

---

## 4. Verificação de Compatibilidade yt-dlp/ffmpeg

### 4.1 yt-dlp arguments gerados pelo plugin

O `YtDlpPlugin.kt` gera argumentos que são passados para a biblioteca `youtubedl-android`, que internamente invoca o binário `yt-dlp`. A maioria das flags é suportada, mas há restrições:

| Flag | Compatibilidade yt-dlp | Observação |
|------|----------------------|------------|
| `-f <format>` | ✅ Total | Funciona em todas as versões |
| `-x` | ✅ Total | Extração de áudio |
| `--audio-format` | ✅ Total | Conversão via ffmpeg |
| `--audio-quality` | ✅ Total | |
| `--write-subs` | ✅ Total | |
| `--write-auto-subs` | ✅ Total | |
| `--sub-langs` | ✅ Total | |
| `--sub-format` | ✅ Total | |
| `--embed-subs` | ⚠️ Requer ffmpeg | Funciona se ffmpeg estiver disponível no device |
| `--embed-thumbnail` | ⚠️ Requer ffmpeg | Funciona se ffmpeg estiver disponível |
| `--embed-metadata` | ✅ Total | |
| `--merge-output-format` | ⚠️ Requer ffmpeg | Merge de streams separados |
| `--restrict-filenames` | ✅ Total | |
| `--concurrent-fragments` | ✅ Total (yt-dlp ≥ 2023.01) | Versões antigas não suportam |
| `--retries` | ✅ Total | |
| `-r <speed>` | ✅ Total | Rate limiting |
| `--no-overwrites` | ✅ Total | |
| `--keep-video` | ✅ Total | |
| `--download-sections` | ⚠️ Requer ffmpeg | Corte de vídeo |
| `--sponsorblock-remove` | ✅ Total | Requer rede para buscar dados |
| `--fps-max` | ✅ Total | |
| `-o <template>` | ✅ Total | Output template |

### 4.2 Binários necessários

O plugin `YtDlpPlugin.kt` declara:
- `ytdlpPath` → binário yt-dlp
- `ffmpegPath` → binário ffmpeg

Ambos devem estar empacotados no APK (via `assets/`) ou baixados em runtime. O `ensureBinaries()` verifica disponibilidade.

---

## 5. Métricas de Performance (Requer Medição em Device)

As seguintes métricas precisam ser medidas em um dispositivo Android real:

### 5.1 Cold Start (App fechado → UI responsiva)

| Métrica | Target | Como Medir |
|---------|--------|-----------|
| Tempo de inicialização do WebView | < 2s | `adb shell am start -W` + Chrome DevTools Performance |
| Tempo até primeira renderização | < 3s | Lighthouse / Performance trace |
| Tempo até probe funcional | < 5s | Cronometrar `ensureBinaries()` + primeiro `probe()` |

### 5.2 Warm Start (App em background → UI responsiva)

| Métrica | Target | Como Medir |
|---------|--------|-----------|
| Retomada de estado dos downloads | < 500ms | `DownloadEngine.loadState()` → UI render |
| Restauração de localStorage | < 200ms | Instrumentação no `loadState()` |

### 5.3 Probe Speed (Análise de URL)

| Métrica | Target | Como Medir |
|---------|--------|-----------|
| YouTube video probe | < 3s | `console.time/end` no `YtDlpAdapter.probe()` |
| Playlist probe | < 5s | Mesmo método |
| Site não-YouTube | < 8s | Medir com URLs variadas |

### 5.4 Download Performance

| Métrica | Target | Como Medir |
|---------|--------|-----------|
| Throughput máximo | > 5MB/s (WiFi) | `speed` field no progress event |
| Throughput com `-r` limit | Respeitar o limite | Verificar `bandLimit` enforcement |
| Concorrência de downloads | `maxConcurrent` respeitado | Monitorar slots em `processQueue()` |
| Cancelamento responsivo | < 1s | Tempo entre `cancel()` e status `cancelled` |

### 5.5 Recursos do Sistema

| Métrica | Target | Como Medir |
|---------|--------|-----------|
| RAM Usage (idle) | < 150MB | `adb shell dumpsys meminfo <package>` |
| RAM Usage (download ativo) | < 250MB | Mesmo método |
| RAM Usage (3 downloads simultâneos) | < 350MB | Mesmo método |
| CPU Usage (idle) | < 5% | `adb shell top` |
| CPU Usage (download ativo) | < 30% | Mesmo método |
| CPU Usage (probe em execução) | < 50% | Mesmo método |
| Uso de disco (app + binários) | < 100MB | `adb shell du -sh /data/data/<package>` |

### 5.6 ANR e Frame Drops

| Métrica | Target | Como Medir |
|---------|--------|-----------|
| ANR durante probe | 0 | `adb logcat -s ActivityManager` |
| ANR durante download | 0 | Mesmo método |
| Frame drops (scroll na lista) | < 5 por 100 frames | Chrome DevTools Performance |
| Frame drops (transições UI) | < 3 por transição | Mesmo método |
| Jank durante progress update | 0 | Monitorar `requestAnimationFrame` |

### 5.7 Limitações Conhecidas

1. **youtubedl-android** é um wrapper Java que pode ter versão diferente do yt-dlp desktop
2. Binários empacotados no APK aumentam o tamanho do pacote (~20-30MB para yt-dlp + ffmpeg)
3. `--concurrent-fragments` pode não funcionar em versões antigas do yt-dlp empacotado
4. `--embed-subs` e `--embed-thumbnail` dependem de ffmpeg funcional no device
5. WebView no Android tem limitação de ~5MB para localStorage
6. `DownloadEngine` trimma histórico para 300 itens para evitar estouro do quota

---

## 6. Resumo de Bugs e Achados

| ID | Severidade | Descrição | Arquivo | Linha |
|----|-----------|-----------|---------|-------|
| BUG-01 | **Crítica** | `isWebMode` não detecta Capacitor — bloqueia embedSubs, embedThumbnail e SponsorBlock no Android | FormatSelector.tsx | 10 |
| BUG-02 | Baixa | `isWebMode` inconsistente entre FormatSelector e DownloadManager | FormatSelector.tsx | 10 |
| BUG-03 | Média | Speed não é reportado no Android (limitação da lib nativa) | DownloadEngine.ts | 420 |
| INFO-01 | Info | `videoFormat` e `videoCodec` são incorporados na string `format`, não passados separadamente | DownloadEngine.ts | 476-523 |
| INFO-02 | Info | localStorage cap de ~5MB no Android — histórico trimado para 300 itens | DownloadEngine.ts | 90 |
| INFO-03 | Info | `--embed-subs` e `--embed-thumbnail` requerem ffmpeg funcional no device | YtDlpPlugin.kt | buildArgs() |

---

## 7. Cobertura UI → Backend

### Componentes com Cobertura Completa ✅

- **FormatSelector.tsx**: Todos os 26 controles UI mapeados para argumentos yt-dlp
- **DownloadManager.tsx**: Todas as ações (pause/cancel/retry/share/open) mapeadas para plugin nativo
- **YouTubeSearch.tsx**: Busca mapeada para `yt-dlp --flat-playlist`
- **Probe**: Análise de URL mapeada para `yt-dlp --dump-json`

### Componentes com Cobertura Parcial ⚠️

- **embedSubs**: Plugin suporta, UI bloqueia (BUG-01)
- **embedThumbnail**: Plugin suporta, UI bloqueia (BUG-01)
- **SponsorBlock**: Plugin suporta, UI bloqueia (BUG-01)
- **Speed reporting**: Plugin não reporta, UI mostra 0 (BUG-03)

### Componentes sem Backend (UI Only) ℹ️

- **Zoom scale (A-/A+)**: Controle visual puro, não afeta download
- **Toggle "Sem Espaco"**: Afeta apenas o template de nome, não o plugin
- **Botões de template de nome (Título, Canal, Data, Duração)**: Gera string localmente
- **Descrição expandir/colapsar**: UI puro
- **Descrição formato (txt/md/none)**: Lógica JS, não passa pelo plugin

---

## 8. Recomendações

### Prioridade Crítica

1. **Corrigir `isWebMode`** para detectar Capacitor — desbloqueia 3 funcionalidades nativas
2. **Implementar cálculo de speed no JS** para contornar limitação da lib nativa

### Prioridade Alta

3. Adicionar métricas de performance instrumentadas no app (startup timing, probe timing)
4. Testar `--embed-subs` e `--embed-thumbnail` em devices Android específicos para confirmar compatibilidade com ffmpeg empacotado

### Prioridade Média

5. Considerar `--concurrent-fragments` como DesktopOnlyTag se a versão do yt-dlp empacotado for antiga
6. Monitorar uso de RAM durante sessões prolongadas de download

---

*Relatório gerado automaticamente pela auditoria do projeto LinkFetcher.*
*Escopo: Android (Capacitor) — Desktop (Electron) documentado em relatório separado.*
