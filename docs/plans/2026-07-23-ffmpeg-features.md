# Plano de Ação — Filtros FFmpeg + Cookies

> **Data:** 2026-07-23
> **Escopo:** 3 features novas no FormatSelector
> **Status:** Planejamento

---

## Features

### 1. Cookies do Navegador (`--cookies-from-browser`)

**Problema:** YouTube bloqueia downloads com "Sign in to confirm you're not a bot" ou 403 em vídeos privados/membros.

**Solução:** Toggle que passa `--cookies-from-browser chrome` (ou edge/firefox) pro yt-dlp. Ele lê os cookies do navegador instalado e autentica automaticamente.

**Flag yt-dlp:** `--cookies-from-browser BROWSER[:PROFILE]`

**Arquivos afetados:**
- `src/features/downloads/FormatSelector.tsx` — novo campo no `FormatOptions`, toggle na UI
- `src/core/ytdlp/YtDlpManager.ts` — `spawnDownload()` e `buildArgs()` adicionam a flag
- `src/core/engine/DownloadEngine.ts` — propaga o campo no download
- `src/types.ts` — campo `cookiesFromBrowser` no `DownloadItem`

**Detalhes técnicos:**
- Aceita: `chrome`, `edge`, `firefox`, `brave`, `vivaldi`, `opera`
- O yt-dlp detecta o perfil padrão automaticamente
- Funciona só no desktop (Electron) — no web/Capacitor não tem acesso ao navegador
- No Electron, o yt-dlp precisa estar na mesma máquina do navegador

**UI:**
```
┌─────────────────────────────────────┐
│  Autenticação                       │
│  [ ] Usar cookies do navegador      │
│  Navegador: [Chrome ▼]              │
└─────────────────────────────────────┘
```

**Validação:**
- Se `cookiesFromBrowser` está definido, NÃO passar `--cookies` (arquivo) ao mesmo tempo
- No Electron, verificar se o yt-dlp suporta o navegador escolhido

---

### 2. Normalizar Volume (`loudnorm`)

**Problema:** Vídeos/músicas vêm com volumes inconsistentes — um estoura, outro é baixo demais.

**Solução:** Toggle que aplica o filtro `loudnorm` do FFmpeg no pós-processamento de áudio.

**Flag yt-dlp:** `--postprocessor-args "ExtractAudio+ffmpeg:-af loudnorm=I=-16:LRA=11:TP=-1.5"`

**Parâmetros EBU R128:**
- `I=-16` — alvo de loudness (16 LUFS, padrão Spotify/YouTube)
- `LRA=11` — range de loudness (11 LU)
- `TP=-1.5` — pico máximo (-1.5 dBTP)

**Arquivos afetados:**
- `src/features/downloads/FormatSelector.tsx` — toggle na UI, campo no `FormatOptions`
- `src/core/ytdlp/YtDlpManager.ts` — `spawnDownload()` e `buildArgs()` concatenam o filtro

**Detalhes técnicos:**
- Só funciona quando `audioOnly=true` (o filtro é aplicado no `ExtractAudio`)
- Se o usuário ativar normalizar + extrair áudio, o yt-dlp passa o filtro pro FFmpeg
- O `loudnorm` em 1 passo funciona ok (não é perfeito, mas resolve 90% dos casos)

**UI:**
```
┌─────────────────────────────────────┐
│  Processamento de Áudio             │
│  [ ] Normalizar volume (padrão EBU) │
└─────────────────────────────────────┘
```

**Validação:**
- Só enviar a flag quando `audioOnly=true` E `normalizeAudio=true`
- Se `audioOnly=false`, ignorar o toggle (filtro não faz sentido em vídeo+áudio)

---

### 3. Nitidez de Vídeo (`unsharp`)

**Problema:** Vídeos em 720p ou comprimidos pelo YouTube parecem "embaçados" em telas grandes.

**Solução:** Toggle que aplica o filtro `unsharp` do FFmpeg no pós-processamento de vídeo.

**Flag yt-dlp:** `--postprocessor-args "ffmpeg:-vf unsharp=5:5:1.0:5:5:0.0"`

**Parâmetros do unsharp:**
- `5:5` — tamanho do kernel (5x5 pixels)
- `1.0` — intensidade do sharpening (luma)
- `5:5` — kernel para chroma
- `0.0` — intensidade do chroma (0 = não altera cores)

**Variações:**
| Nível | Kernel | Intensidade | Uso |
|-------|--------|-------------|-----|
| Leve | 3:3 | 0.5 | Vídeos já bons, toque sutil |
| Normal | 5:5 | 1.0 | Padrão, bom pra 720p |
| Forte | 7:7 | 1.5 | Vídeos muito borrados |

**Arquivos afetados:**
- `src/features/downloads/FormatSelector.tsx` — toggle + seletor de intensidade
- `src/core/ytdlp/YtDlpManager.ts` — `spawnDownload()` e `buildArgs()` concatenam o filtro

**Detalhes técnicos:**
- Funciona em qualquer modo (vídeo+áudio, só vídeo, ou só áudio — mas não faz sentido em áudio)
- O filtro é aplicado no pós-processamento, então o download primeiro acontece normal
- Se o usuário ativar normalizar + nitidez ao mesmo tempo, os filtros são concatenedos:
  - `loudnorm` vai no `ExtractAudio+ffmpeg:`
  - `unsharp` vai no `ffmpeg:`

**UI:**
```
┌─────────────────────────────────────┐
│  Processamento de Vídeo             │
│  [ ] Aumentar nitidez               │
│  Intensidade: [Leve | Normal | Forte]│
└─────────────────────────────────────┘
```

**Validação:**
- Se `audioOnly=true`, desabilitar visualmente o toggle de nitidez
- Se `videoOnly=true` ou `video+audio`, habilitar normalmente

---

## Ordem de Implementação

1. **Cookies do navegador** — maior impacto, resolve problema crítico
2. **Normalizar volume** — toggle simples, concatena com audio-only
3. **Nitidez vídeo** — toggle simples, concatena com formato de vídeo

Cada feature é independente — pode ser implementada e testada separadamente.

---

## Fluxo de Dados ( Todas as 3 )

```
FormatSelector (UI)
    │
    ├── options.cookiesFromBrowser → 'chrome' | '' 
    │
    ├── options.normalizeAudio → true | false
    │       └── Se true + audioOnly: postprocessorArgs += "loudnorm=I=-16:LRA=11:TP=-1.5"
    │
    └── options.videoSharpen → 'off' | 'light' | 'normal' | 'strong'
            └── Se ≠ 'off': postprocessorArgs += "unsharp=..."

    ↓

FormatOptions → DownloadEngine.addDownload()
    │
    ↓

YtDlpManager.spawnDownload() / buildArgs()
    │
    ├── cookiesFromBrowser → --cookies-from-browser chrome
    │
    └── postprocessorArgs → --postprocessor-args "ffmpeg:-vf unsharp=..."
        ou → --postprocessor-args "ExtractAudio+ffmpeg:-af loudnorm=..."
        ou → ambos (concatenados com espaço)
    │
    ↓

yt-dlp → FFmpeg processa no pós-processamento
```

---

## Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| `--cookies-from-browser` falha se navegador não encontrado | Mensagem de erro confusa | Tratar erro e mostrar "Navegador não encontrado" |
| `loudnorm` em 1 passo não é perfeito | Volume pode ficar levemente errado | Aceitável — 90% dos casos funciona |
| `unsharp` em vídeos 4K é desperdício | CPU desnecessária | Desabilitar nitidez se resolução >= 1440p |
| Dois postprocessor-args conflitantes | Um sobrescreve o outro | Concatenar com espaço, yt-dlp suporta múltiplos |
| `--cookies-from-browser` no Capacitor/web | Não funciona | Desabilitar toggle em plataformas web |
