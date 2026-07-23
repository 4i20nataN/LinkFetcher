# LinkFetcher — Referência Completa de Opções da Interface

> Documento técnico de referência para todas as opções disponíveis na interface do LinkFetcher,
> mapeando cada opção da UI para o respectivo parâmetro yt-dlp/FFmpeg e seu comportamento.

---

## Índice

1. [Arquitetura Geral](#1-arquitetura-geral)
2. [Fluxo de Dados](#2-fluxo-de-dados)
3. [Tela Principal — LinkAnalyzer](#3-tela-principal--linkanalyzer)
4. [FormatSelector — Aba Mídia](#4-formatselector--aba-mídia)
5. [FormatSelector — Aba Avançado](#5-formatselector--aba-avançado)
6. [Modos de Saída](#6-modos-de-saída)
7. [Tabela de Parâmetros Completos](#7-tabela-de-parâmetros-completos)
8. [Mapeamento UI → yt-dlp → FFmpeg](#8-mapeamento-ui--yt-dlp--ffmpeg)
9. [Notas Técnicas](#9-notas-técnicas)

---

## 1. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                     INTERFACE DO USUÁRIO                     │
│  LinkAnalyzer.tsx  →  FormatSelector.tsx  →  FormatOptions  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE TRANSPORTE                      │
│  YtDlpAdapter.ts  →  IPC (Electron) ou HTTP (Web/Capacitor) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      MOTOR DE DOWNLOAD                       │
│  YtDlpManager.ts  →  buildArgs()  →  spawnDownload()       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     BINÁRIOS EXTERNOS                        │
│  yt-dlp (seleção + download)  →  FFmpeg (merge + conversão) │
└─────────────────────────────────────────────────────────────┘
```

**Regra de ouro:** A interface NUNCA gera argumentos yt-dlp diretamente. O fluxo é sempre:
`UI → FormatOptions → YtDlpManager.buildArgs() → yt-dlp CLI`

---

## 2. Fluxo de Dados

```
FormatSelector (UI)
    │
    ├── state: FormatOptions { format, audioOnly, audioFormat, ... }
    │
    ├── onFormatSelect(options) ──→ LinkAnalyzer
    │                                   │
    │                                   ├── handleStartDownload()
    │                                   │       │
    │                                   │       ▼
    │                                   │   onFormatSelect(options)
    │                                   │       │
    │                                   │       ▼
    │                                   │   startDownload(options)
    │                                   │       │
    │                                   │       ▼
    │                                   │   YtDlpAdapter.startDownload()
    │                                   │       │
    │                                   │       ▼
    │                                   │   YtDlpManager.buildArgs(options)
    │                                   │       │
    │                                   │       ▼
    │                                   │   spawn yt-dlp with args
    │                                   │       │
    │                                   │       ▼
    │                                   │   yt-dlp baixa + FFmpeg faz merge
    │                                   │
    │                                   └── onFormatChange(format) ← selecionar stream específico
    │
    └── update(options) ← atualiza state local do FormatSelector
```

---

## 3. Tela Principal — LinkAnalyzer

A tela inicial onde o usuário cola a URL e inicia o download.

### 3.1 Resumo de Opções (SummaryPanel)

Quando o usuário configura opções no FormatSelector, um painel de resumo aparece na tela principal:

| Ícone | Campo | Condição | Fonte |
|-------|-------|----------|-------|
| 🎵 | Formato de áudio | `audioOnly === true` | `formatOptions.audioFormat` |
| 🔊 | Qualidade de áudio | `audioOnly === true` | `formatOptions.audioQuality` |
| 🎬 | Container de vídeo | `audioOnly === false` | `formatOptions.videoFormat` |
| 📺 | Resolução | `audioOnly === false` | Extraído do `formatOptions.format` via regex `height<=XXXX` |
| 🎞 | Codec de vídeo | `audioOnly === false` e `videoCodec` definido | `formatOptions.videoCodec` |
| 🎞 | FPS Máximo | `audioOnly === false` e `fpsMax > 0` | `formatOptions.fpsMax` |
| 📄 | Descrição | `descFormat !== 'none'` e `mediaInfo.description` existe | `formatOptions.descFormat` |

### 3.2 Botões de Ação

| Botão | Ação | Parâmetros Enviados |
|-------|------|---------------------|
| **Baixar** | Inicia download com opções atuais | Todos os `FormatOptions` |
| **Favoritar** | Salva link nos favoritos | Apenas URL + metadados |
| **Baixar Depois** | Adia download | Apenas URL + metadados |

---

## 4. FormatSelector — Aba Mídia

### 4.1 Resolução (Presets de Qualidade)

Cada preset gera um seletor de formato específico para o yt-dlp.

| Preset | Label | Formato yt-dlp | Descrição |
|--------|-------|----------------|-----------|
| `best` | ★ Melhor | `bestvideo+bestaudio/best` | Melhor qualidade disponível (merge automático) |
| `2160p` | 4K Ultra | `bv*[height<=2160][ext=mp4]+ba[ext=m4a]/bv*[height<=2160]+ba/b[height<=2160]` | Até 4K, prefere mp4/m4a |
| `1440p` | 1440 QHD | `bv*[height<=1440][ext=mp4]+ba[ext=m4a]/bv*[height<=1440]+ba/b[height<=1440]` | Até 1440p |
| `1080p` | 1080 Full HD | `bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]` | Até 1080p |
| `720p` | 720 HD | `bv*[height<=720][ext=mp4]+ba[ext=m4a]/bv*[height<=720]+ba/b[height<=720]` | Até 720p |
| `480p` | 480 SD | `bv*[height<=480][ext=mp4]+ba[ext=m4a]/bv*[height<=480]+ba/b[height<=480]` | Até 480p |
| `360p` | 360 Baixa | `bv*[height<=360][ext=mp4]+ba[ext=m4a]/bv*[height<=360]+ba/b[height<=360]` | Até 360p |

**Sintaxe do formato:**
- `bv*` = melhor formato com vídeo (pode ter áudio)
- `[height<=1080]` = filtro por resolução máxima
- `[ext=mp4]` = preferência por container mp4
- `+ba[ext=m4a]` = melhor áudio em m4a
- `/bv*[height<=1080]+ba/b[height<=1080]` = fallback se mp4 não disponível

**Tecnologia:** yt-dlp `-f` (format selection)

### 4.2 Formato do Vídeo (Container)

Seleciona o container de saída após o merge.

| Opção | Flag yt-dlp | Descrição |
|-------|-------------|-----------|
| MP4 | `--merge-output-format mp4` | Mais compatível (TVs, celulares, players) |
| MKV | `--merge-output-format mkv` | Suporta múltiplos tracks, legendas embutidas |
| WEBM | `--merge-output-format webm` | Formato web, codecs VP9/AV1 |
| AVI | `--merge-output-format avi` | Formato legado |
| FLV | `--merge-output-format flv` | Flash Video (legado) |
| MOV | `--merge-output-format mov` | Apple QuickTime |
| TS | `--merge-output-format ts` | Transport Stream |

**Tecnologia:** yt-dlp `--merge-output-format` → FFmpeg faz o remux/merge

**Nota:** Containers suportados para merge: `avi, flv, mkv, mov, mp4, webm`

### 4.3 Codec de Vídeo

Seleciona preferência de codec via `--format-sort`.

| Opção | Flag yt-dlp | Prioridade padrão yt-dlp |
|-------|-------------|--------------------------|
| Auto | (nenhum) | av01 > vp9.2 > vp9 > h265 > h264 > vp8 |
| H.264 | `--format-sort vcodec:h264` | h264 > h265 > vp9 > av01 |
| H.265 | `--format-sort vcodec:h265` | h265 > h264 > vp9 > av01 |
| VP9 | `--format-sort vcodec:vp9` | vp9 > h265 > h264 > av01 |
| AV1 | `--format-sort vcodec:av01` | av01 > vp9 > h265 > h264 |

**Tecnologia:** yt-dlp `-S` (format-sort)

**Nota:** O codec selecionado é uma *preferência*, não uma restrição. Se o vídeo não existe no codec escolhido, o yt-dlp baixa o melhor disponível.

### 4.4 FPS Máximo

| Opção | Flag yt-dlp | Descrição |
|-------|-------------|-----------|
| Original | (nenhum) | Sem limite de FPS |
| 24 FPS | `--format-sort fps:24` | Limita a 24fps |
| 30 FPS | `--format-sort fps:30` | Limita a 30fps |
| 60 FPS | `--format-sort fps:60` | Limita a 60fps |
| 120 FPS | `--format-sort fps:120` | Limita a 120fps |

**Tecnologia:** yt-dlp `-S` (format-sort)

---

## 5. FormatSelector — Aba Avançado

### 5.1 Formato do Áudio

Seleciona o formato/conversão do áudio. **Habilitado em TODOS os modos** (vídeo+áudio e apenas áudio).

| Opção | Flag yt-dlp | Modo | Descrição |
|-------|-------------|------|-----------|
| MP3 | `--audio-format mp3` | Apenas áudio | Conversão via FFmpeg (2-5s extra) |
| AAC | `--audio-format aac` | Apenas áudio | Codec nativo de muitas plataformas |
| M4A | `--audio-format m4a` | Apenas áudio | Container MPEG-4 Audio |
| FLAC | `--audio-format flac` | Apenas áudio | Lossless (arquivo grande) |
| OPUS | `--audio-format opus` | Apenas áudio | Codec moderno, eficiente |
| WAV | `--audio-format wav` | Apenas áudio | Lossless sem compressão (enorme) |

**Tecnologia:**
- **Modo apenas áudio:** yt-dlp `--audio-format` → FFmpeg converte
- **Modo vídeo+áudio:** O formato de áudio é determinado pelo container (`--merge-output-format`). Ex: mp4 usa m4a/aac, mkv usa opus/vorbis

**Nota sobre MP3:** O YouTube não armazena arquivos MP3 nativos. O yt-dlp baixa em m4a/opus e o FFmpeg converte para MP3 (~2s extra).

### 5.2 Qualidade do Áudio

| Opção | Flag yt-dlp | Descrição |
|-------|-------------|-----------|
| Melhor (0) | `--audio-quality 0` | Melhor qualidade VBR (~320kbps) |
| 320 kbps (3) | `--audio-quality 3` | Alta qualidade |
| 256 kbps (4) | `--audio-quality 4` | Boa qualidade |
| 192 kbps (5) | `--audio-quality 5` | Qualidade padrão (default yt-dlp) |
| 128 kbps (7) | `--audio-quality 7` | Qualidade moderada |
| 64 kbps (9) | `--audio-quality 9` | Baixa qualidade (compacto) |

**Tecnologia:** yt-dlp `--audio-quality` → FFmpeg VBR encoding

**Nota:** Valores 0-10 são VBR (Variable Bit Rate). Também aceita bitrate fixo como `128K`, `320K`.

### 5.3 Extrair Apenas Áudio (Toggle)

| Estado | Efeito | Flag yt-dlp |
|--------|--------|-------------|
| DESLIGADO | Baixa vídeo + áudio | (nenhum) |
| LIGADO | Baixa apenas áudio | `--extract-audio` |

**Tecnologia:** yt-dlp `-x` / `--extract-audio`

**Interações:**
- Quando LIGADO: seções de Resolução e Formatos de vídeo ficam esmaecidas
- Quando DESLIGADO: Formato e Qualidade de áudio continuam habilitados

### 5.4 Legendas

#### Toggle: Baixar Legendas

| Estado | Flags yt-dlp |
|--------|-------------|
| DESLIGADO | (nenhum) |
| LIGADO | `--write-subs` + `--sub-langs` + `--sub-format` |

#### Idiomas Disponíveis

| Opção | Flag | Descrição |
|-------|------|-----------|
| PT | `--sub-langs pt` | Português |
| EN | `--sub-langs en` | Inglês |
| ES | `--sub-langs es` | Espanhol |
| PT+EN | `--sub-langs pt,en` | Português + Inglês |
| Todos | `--sub-langs all` | Todos os idiomas disponíveis |

#### Formato das Legendas

| Opção | Flag | Descrição |
|-------|------|-----------|
| SRT | `--sub-format srt` | SubRip (mais compatível) |
| ASS | `--sub-format ass` | Advanced SubStation Alpha (estilizado) |
| VTT | `--sub-format vtt` | WebVTT (web) |

#### Embutir no Vídeo

| Estado | Flag | Descrição |
|--------|------|-----------|
| DESLIGADO | (nenhum) | Legendas ficam como arquivo separado |
| LIGADO | `--embed-subs` | Legendas embutidas no container (mp4/webm/mkv) |

**Tecnologia:** yt-dlp `--write-subs`, `--write-auto-subs`, `--sub-langs`, `--sub-format`, `--embed-subs` → FFmpeg embute no container

### 5.5 Modo de Saída

Seleciona o modo de download: vídeo+áudio, apenas vídeo, ou apenas áudio.

| Modo | Botão | Flags yt-dlp | Efeito |
|------|-------|-------------|--------|
| **Vídeo + Áudio** | `Video + Audio` | `--format bestvideo+bestaudio/best` | Download completo com merge |
| **Só Vídeo** | `So Video` | `--format bv*` (remove `+ba`) | Apenas stream de vídeo |
| **Só Áudio** | `So Audio` | `--extract-audio --audio-format --audio-quality` | Apenas stream de áudio |

**Tecnologia:**
- **Vídeo+Áudio:** yt-dlp `-f` → FFmpeg faz merge
- **Só Vídeo:** yt-dlp `-f bv*` (regex remove parte de áudio do formato)
- **Só Áudio:** yt-dlp `-x` → FFmpeg converte

**⚠️ NOTA sobre botões duplicados:**
Existem DOIS controles para "apenas áudio":
1. **Toggle "Extrair apenas áudio"** — dentro da seção "Áudio"
2. **Botão "So Audio"** — dentro da seção "Modo de saída"

Ambos controlam o MESMO state (`options.audioOnly`). Não há conflito — são redundantes por UX. Ao ativar qualquer um, o outro reflete automaticamente.

---

## 6. Modos de Saída — Detalhamento

### 6.1 Vídeo + Áudio (Padrão)

```bash
yt-dlp \
  --format "bestvideo+bestaudio/best" \
  --merge-output-format mp4 \
  [outras flags]
  "URL"
```

**Fluxo:**
1. yt-dlp seleciona melhor vídeo + melhor áudio
2. Baixa ambos separadamente
3. FFmpeg faz merge no container escolhido
4. Arquivo final: vídeo + áudio juntos

### 6.2 Só Vídeo

```bash
yt-dlp \
  --format "bv*" \
  [outras flags]
  "URL"
```

**Fluxo:**
1. yt-dlp seleciona melhor formato com vídeo (pode ter áudio, mas prioriza só vídeo)
2. Baixa apenas o stream de vídeo
3. Arquivo final: apenas vídeo (sem áudio)

### 6.3 Só Áudio

```bash
yt-dlp \
  --format "bestvideo+bestaudio/best" \
  --extract-audio \
  --audio-format mp3 \
  --audio-quality 0 \
  [outras flags]
  "URL"
```

**Fluxo:**
1. yt-dlp seleciona melhor stream de áudio
2. `--extract-audio` extrai apenas o áudio
3. `--audio-format` converte para o formato desejado (FFmpeg)
4. `--audio-quality` define qualidade VBR
5. Arquivo final: apenas áudio

---

## 7. Tabela de Parâmetros Completos

| # | Parâmetro | Flag yt-dlp | Tecnologia | Modos Ativos | Padrão |
|---|-----------|-------------|------------|--------------|--------|
| 1 | `format` | `-f / --format` | yt-dlp | Todos | `bestvideo+bestaudio/best` |
| 2 | `videoFormat` | `--merge-output-format` | yt-dlp + FFmpeg | Vídeo+Áudio | `mp4` |
| 3 | `videoCodec` | `-S vcodec:XXX` | yt-dlp | Vídeo+Áudio, Só Vídeo | `Auto` |
| 4 | `fpsMax` | `-S fps:XXX` | yt-dlp | Vídeo+Áudio, Só Vídeo | `Original (0)` |
| 5 | `audioOnly` | `--extract-audio` | yt-dlp + FFmpeg | Todos | `false` |
| 6 | `audioFormat` | `--audio-format` | yt-dlp + FFmpeg | Apenas Áudio | `mp3` |
| 7 | `audioQuality` | `--audio-quality` | yt-dlp + FFmpeg | Apenas Áudio | `0` (melhor) |
| 8 | `videoOnly` | (regex no formato) | yt-dlp | Todos | `false` |
| 9 | `writeSubs` | `--write-subs` | yt-dlp | Todos | `false` |
| 10 | `writeAutoSubs` | `--write-auto-subs` | yt-dlp | Todos | `false` |
| 11 | `subLangs` | `--sub-langs` | yt-dlp | Todos | `en` |
| 12 | `subFormat` | `--sub-format` | yt-dlp | Todos | `srt` |
| 13 | `embedSubs` | `--embed-subs` | yt-dlp + FFmpeg | Todos | `false` |
| 14 | `writeThumbnail` | `--write-thumbnail` | yt-dlp | Todos | `false` |
| 15 | `embedThumbnail` | `--embed-thumbnail` | yt-dlp + FFmpeg | Todos | `false` |
| 16 | `embedMetadata` | `--embed-metadata` | yt-dlp + FFmpeg | Todos | `false` |
| 17 | `downloadSections` | `--download-sections` | yt-dlp + FFmpeg | Todos | (vazio) |
| 18 | `sponsorblockRemove` | `--sponsorblock-remove` | yt-dlp | Todos | (vazio) |
| 19 | `restrictFilenames` | `--restrict-filenames` | yt-dlp | Todos | `false` |
| 20 | `noOverwrites` | `--no-overwrites` | yt-dlp | Todos | `false` |
| 21 | `keepVideo` | `--keep-video` | yt-dlp | Apenas Áudio | `false` |
| 22 | `bandLimit` | `--limit-rate` | yt-dlp | Todos | `0` (ilimitado) |
| 23 | `concurrentFragments` | `-N / --concurrent-fragments` | yt-dlp | Todos | `1` |
| 24 | `retries` | `--extractor-retries` | yt-dlp | Todos | `3` |
| 25 | `customFilename` | `-o / --output` | yt-dlp | Todos | (padrão) |
| 26 | `descFormat` | N/A (app-only) | App | Todos | `none` |

---

## 8. Mapeamento UI → yt-dlp → FFmpeg

### 8.1 O que o yt-dlp faz sozinho (sem FFmpeg)

| Ação | Flag | Descrição |
|------|------|-----------|
| Selecionar formato | `-f` | Escolhe qual stream baixar |
| Ordenar formatos | `-S` | Altera definição de "melhor" |
| Baixar legendas | `--write-subs` | Salva .srt/.ass/.vtt |
| Baixar thumbnail | `--write-thumbnail` | Salva .jpg/.png |
| Extrair metadados | `--dump-json` | Probe sem download |
| Renomear arquivo | `-o` | Template de saída |
| Limitar velocidade | `--limit-rate` | Rate limiting |
| Não sobrescrever | `--no-overwrites` | Evita duplicatas |
| Restringir nomes | `--restrict-filenames` | ASCII only |
| Windows compat | `--windows-filenames` | Nomes seguros |
| Sections/recorte | `--download-sections` | Seleciona trecho |
| SponsorBlock | `--sponsorblock-remove` | Remove segmentos |
| Auth/cookies | `--cookies` / `--cookies-from-browser` | Autenticação |
| Proxy | `--proxy` | Proxy de rede |
| Concurrent fragments | `-N` | Downloads paralelos |

### 8.2 O que o yt-dlp precisa do FFmpeg

| Ação | Flag yt-dlp | Papel do FFmpeg |
|------|-------------|-----------------|
| Merge vídeo+áudio | `-f bv+ba` | Junta streams em um container |
| Extrair áudio | `-x` | Converte/extra áudio |
| Converter áudio | `--audio-format mp3` | Transcodificação |
| Remux container | `--merge-output-format` | Muda container sem re-encode |
| Embutir legendas | `--embed-subs` | mux legendas no container |
| Embutir thumbnail | `--embed-thumbnail` | mux thumbnail como cover art |
| Embutir metadados | `--embed-metadata` | mux metadados no container |
| Forçar keyframes | `--force-keyframes-at-cuts` | Re-encode nos cortes |
| Converter legendas | `--convert-subs` | Converte formato de legenda |

### 8.3 O que é 100% do App (sem yt-dlp nem FFmpeg)

| Função | Arquivo | Descrição |
|--------|---------|-----------|
| Extrair metadados | `LinkAnalyzer.tsx` | `probeUrlWithAdapter()` → JSON parse |
| Salvar favoritos | `AppContext.tsx` | localStorage |
| Baixar depois | `AppContext.tsx` | localStorage |
| Histórico de downloads | `DownloadManager.tsx` | Estado em memória |
| Detecção de clipboard | `LinkAnalyzer.tsx` | Event listener |
| Progresso em tempo real | `DownloadManager.tsx` | Parse de output yt-dlp |
| Descrição do vídeo | `LinkAnalyzer.tsx` | Extraído do JSON do yt-dlp |

---

## 9. Notas Técnicas

### 9.1 Sobre o Merge FFmpeg

Quando o yt-dlp baixa vídeo e áudio separados, o FFmpeg é invocado automaticamente para:
1. **Remux/merge** — Junta os streams no container escolhido (sem re-encode)
2. **Transcodificação** — Apenas se o codec/container de origem for incompatível

Exemplo de merge sem re-encode (instantâneo):
```bash
ffmpeg -i video.webm -i audio.m4a -c copy output.mp4
```

Exemplo com transcodificação (lento, ~2-5s):
```bash
ffmpeg -i video.webm -i audio.m4a -c:v copy -c:a libmp3lame -q:a 0 output.mp3
```

### 9.2 Sobre Formatos de Áudio no YouTube

| Formato Fonte | Codec | Container |
|---------------|-------|-----------|
| YouTube padrão | AAC / Opus | m4a / webm |
| YouTube Premium | AAC / Opus | m4a / webm |
| YouTube Music | AAC / Opus | m4a / webm |

**NÃO existe MP3 nativo no YouTube.** Sempre há conversão via FFmpeg.

### 9.3 Sobre a Sintaxe de Formato

```
bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]
│  │              │           │  │              │                │
│  │              │           │  │              │                └─ Fallback final
│  │              │           │  │              └─ Fallback 2: melhor vídeo + melhor áudio
│  │              │           │  └─ Melhor áudio em m4a
│  │              │           └─ Junção (+)
│  │              └─ Filtro: container mp4
│  └─ Filtro: resolução até 1080p
└─ Seletor: melhor vídeo (pode ter áudio)
```

### 9.4 Sobre o Formato Padrão

O formato padrão `bestvideo+bestaudio/best` significa:
1. **Tenta:** Melhor vídeo + melhor áudio (merge)
2. **Fallback 1:** Melhor formato combinado (vídeo + áudio juntos)
3. **Fallback 2:** Melhor disponível

Isso é o comportamento nativo do yt-dlp quando nenhum `-f` é especificado.

---

## 10. Resumo Visual

```
┌─────────────────────────────────────────────────────────────────┐
│                        FORMATSELECTOR                           │
├──────────────────────┬──────────────────────────────────────────┤
│     ABA MÍDIA        │           ABA AVANÇADO                  │
├──────────────────────┼──────────────────────────────────────────┤
│ • Resolução (7 presets)│ • Formato do Áudio (6 opções)          │
│ • Formato Vídeo (7)  │ • Qualidade do Áudio (6 opções)         │
│ • Codec Vídeo (5)    │ • Extrair Apenas Áudio (toggle)         │
│                      │ • Legendas (toggle + idioma + formato)   │
│                      │ • Modo de Saída (3 botões)               │
│                      │ • FPS Máximo (5 opções)                  │
│                      │ • Descrição (toggle + formato)           │
├──────────────────────┴──────────────────────────────────────────┤
│                    FLUXO PARA yt-dlp                             │
├─────────────────────────────────────────────────────────────────┤
│ FormatOptions → YtDlpManager.buildArgs() → spawn yt-dlp        │
│                       │                                         │
│                       ▼                                         │
│              yt-dlp baixa streams                               │
│                       │                                         │
│                       ▼                                         │
│              FFmpeg faz merge/conversão                         │
│                       │                                         │
│                       ▼                                         │
│              Arquivo final no disco                             │
└─────────────────────────────────────────────────────────────────┘
```
