# Bateria de Testes — Download Options

> **Status:** Aguardando vídeo curto do usuário para executar
> **Método:** Chrome DevTools MCP (renderer) + logDebug (main process → `~/Downloads/linkfetcher-debug.log`)
> **Pré-requisito:** Electron reiniciado com código novo, DevTools MCP conectado

---

## Configuração dos Testes

- **Vídeo:** (a definir pelo usuário — curto, preferencialmente público do YouTube)
- **Diretório de saída:** `C:\Users\ntn\Downloads`
- **Log principal:** `C:\Users\ntn\Downloads\linkfetcher-debug.log`
- **Verificação pós-cada-teste:** 
  1. Ler log com args finais do yt-dlp
  2. Verificar arquivo(s) existe(m) em `C:\Users\ntn\Downloads`
  3. Confirmar tamanho > 0
  4. Verificar se container está correto (extensão do arquivo)

---

## Cenários de Teste

### TESTE 01 — Download Padrão (Baseline)
- **Objetivo:** Confirmar que o fluxo básico funciona
- **Config:** Resolução "Melhor", Formato MP4, tudo mais no default
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.mp4` existe, tamanho > 0, player abre

### TESTE 02 — Apenas Áudio (MP3)
- **Objetivo:** Extrair áudio em MP3
- **Config:** Audio Only ON, Formato MP3, Qualidade 320kbps
- **Args esperados:**
  ```
  --extract-audio
  --audio-format mp3
  --audio-quality 3
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.mp3` existe, player de áudio abre

### TESTE 03 — Apenas Áudio (FLAC lossless)
- **Objetivo:** Extrair áudio lossless
- **Config:** Audio Only ON, Formato FLAC, Qualidade Melhor (0)
- **Args esperados:**
  ```
  --extract-audio
  --audio-format flac
  --audio-quality 0
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.flac` existe

### TESTE 04 — Resolução 720p
- **Objetivo:** Forçar resolução específica
- **Config:** Resolução 720p, Formato MP4
- **Args esperados:**
  ```
  --format bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Resolução do vídeo ≤ 720p

### TESTE 05 — FPS Limitado a 30
- **Objetivo:** Limitar framerate
- **Config:** Resolução Melhor, FPS Max = 30
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --embed-metadata
  --windows-filenames
  --format-sort fps:30
  ```
- **Validação:** Framerate do vídeo ≤ 30fps

### TESTE 06 — Container MKV
- **Objetivo:** Trocar container para MKV
- **Config:** Resolução Melhor, Formato MKV
- **Args esperados:**
  ```
  --format bv*[ext=mkv]+ba[ext=m4a]/bv*+ba/b
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.mkv` existe

### TESTE 07 — Legendas (PT + EN, SRT)
- **Objetivo:** Baixar com legendas embutidas
- **Config:** Legendas ON, Auto-subs ON, Idioma `pt,en`, Formato SRT, Embutir ON (Desktop)
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --write-subs
  --write-auto-subs
  --sub-langs pt,en
  --sub-format srt
  --embed-subs
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.mp4` com legendas embutidas (verificar com ffprobe ou player)

### TESTE 08 — Apenas Vídeo (sem áudio)
- **Objetivo:** Baixar stream de vídeo sem áudio
- **Config:** Modo de saída "Só Vídeo"
- **Args esperados:**
  ```
  --format bv*[ext=mp4]/bv*/b
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.mp4` existe, SEM faixa de áudio (verificar com ffprobe)

### TESTE 09 — Thumbnail (write)
- **Objetivo:** Baixar thumbnail separado
- **Config:** Thumbnail ON, Incorporar OFF
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --write-thumbnail
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.mp4` + arquivo `.jpg` ou `.webp` (thumbnail) existe

### TESTE 10 — Thumbnail Embutido
- **Objetivo:** Incorporar thumbnail no vídeo
- **Config:** Thumbnail ON, Incorporar ON (Desktop)
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --write-thumbnail
  --embed-thumbnail
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.mp4` com thumbnail embutido (verificar com ffprobe)

### TESTE 11 — Recorte de Tempo (Trim)
- **Objetivo:** Baixar apenas trecho do vídeo
- **Config:** Trim de 0:05 a 0:15 (10 segundos)
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --download-sections *0:05-0:15
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.mp4` com duração ~10s

### TESTE 12 — Limite de Velocidade
- **Objetivo:** Testar rate limit
- **Config:** Limite = 512 KB/s
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --limit-rate 512K
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Download ocorre mais lento, arquivo existe

### TESTE 13 — Nome Limpo + Não Sobrescrever
- **Objetivo:** Testar comportamento de filename
- **Config:** Restrict Filenames ON, No Overwrites ON
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --restrict-filenames
  --no-overwrites
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Nome do arquivo sem caracteres especiais, sem sobrescrever existente

### TESTE 14 — WebM Container
- **Objetivo:** Container WebM
- **Config:** Resolução Melhor, Formato WebM
- **Args esperados:**
  ```
  --format bv*[ext=webm]+ba[ext=webm]/bv*+ba/b
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.webm` existe

### TESTE 15 — Combinação Completa (Stress Test)
- **Objetivo:** Múltiplas opções ativas simultaneamente
- **Config:** 720p, MP3 192kbps, Legendas PT auto, Thumbnail embutido, Metadados
- **Args esperados:**
  ```
  --format bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]
  --extract-audio
  --audio-format mp3
  --audio-quality 5
  --write-subs
  --write-auto-subs
  --sub-langs pt
  --sub-format srt
  --embed-subs
  --write-thumbnail
  --embed-thumbnail
  --embed-metadata
  --windows-filenames
  --format-sort fps:0
  ```
- **Validação:** Arquivo `.mp3` + `.mp4` com legendas e thumbnail embutidos

---

## Ordem de Execução Recomendada

| # | Teste | Complexidade | Risco |
|---|-------|-------------|-------|
| 1 | TESTE 01 — Padrão | Baixa | Baixo |
| 2 | TESTE 04 — 720p | Baixa | Baixo |
| 3 | TESTE 02 — Áudio MP3 | Baixa | Baixo |
| 4 | TESTE 06 — MKV | Baixa | Baixo |
| 5 | TESTE 08 — Só Vídeo | Média | Médio |
| 6 | TESTE 09 — Thumbnail | Média | Médio |
| 7 | TESTE 07 — Legendas | Média | Médio |
| 8 | TESTE 10 — Thumb Embutido | Média | **Alto** |
| 9 | TESTE 11 — Trim | Média | **Alto** |
| 10 | TESTE 05 — FPS 30 | Baixa | Baixo |
| 11 | TESTE 03 — FLAC | Baixa | Baixo |
| 12 | TESTE 12 — Rate Limit | Baixa | Baixo |
| 13 | TESTE 13 — Nome Limpo | Baixa | Baixo |
| 14 | TESTE 14 — WebM | Baixa | Baixo |
| 15 | TESTE 15 — Stress | Alta | **Alto** |

---

## Métricas de Sucesso

| Métrica | Esperado |
|---------|----------|
| Arquivo criado em Downloads | 15/15 testes |
| Tamanho > 0 | 15/15 testes |
| Container correto (extensão) | 15/15 testes |
| Player abre o arquivo | 15/15 testes |
| Args no log = args esperados | 15/15 testes |
| Sem erros no console/renderer | 15/15 testes |
