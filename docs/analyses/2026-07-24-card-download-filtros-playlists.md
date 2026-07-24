# Análise: Card de Download, Filtros, File Size e Playlists

**Data:** 2026-07-24
**Status:** Aprovado — em implementação
**Branch:** `feat/electron-web-version`

---

## 1. Problemas Identificados no Card de Download

| # | Problema | Localização |
|---|----------|-------------|
| 1 | **SizeTotal sempre 0** — formato default `bestvideo+bestaudio/best` é merge pattern → `sizeTotal = 0` → card mostra "0 Bytes (14%)" | `DownloadEngine.ts:144-148` |
| 2 | **Platform badge duplicado** — overlay na thumbnail + chip na feature tags | `DownloadManager.tsx:392-396` |
| 3 | **Format ext isolado** — `WEBM` aparece sozinho no canto do título sem contexto | `DownloadManager.tsx:408-410` |
| 4 | **Filtros de status + tipo de mídia** — substituir abas de status por tipo de mídia, manter status como chips secundários | `DownloadManager.tsx:55, 287-341` |

---

## 2. File Size — Causa Raiz

### Por que yt-dlp não reporta tamanho exato

1. yt-dlp baixa vídeo e áudio em arquivos temporários separados
2. Quando o download termina, chama o FFmpeg
3. FFmpeg junta (remuxa) vídeo + áudio em novo arquivo final
4. Cabeçalhos do contêiner são reescritos, metadados inseridos → tamanho final muda
5. O stdout do yt-dlp para de emitir relatórios no momento exato em que FFmpeg entra em ação

### Solução: OS-native file stat

| Plataforma | Implementação | Precisão |
|-----------|---------------|----------|
| Desktop (Electron) | `fs.promises.stat()` via IPC | 100% |
| Mobile (Android) | Capacitor `Filesystem.stat()` ou bridge nativa | 100% |
| Web (Navegador) | Backend faz fs.stat() + envia JSON | 100% (depende de backend) |

### Fluxo Arquitetural

**FASE 1 — Download em andamento:**
- Use estimativas do stdout do yt-dlp (`_total_bytes_str`) para barra de progresso

**FASE 2 — Finalização (<1ms):**
- Subprocesso fecha com exit code 0
- App chama API nativa de leitura de metadados de arquivo
- Desktop: `fs.promises.stat()` → tamanho exato em bytes da MFT/Inode
- Mobile: Bridge nativa → metadados sem carregar buffer em memória
- Web: Backend executa stat + envia payload JSON

---

## 3. Playlists — Estado Atual

### O que existe
- `--no-playlist` hardcoded em `getVideoInfo()`, `spawnDownload()`, `buildArgsPreview()`
- `--flat-playlist` usado apenas na busca (`searchVideos()`), não em URLs de playlist
- Nenhuma detecção de playlist URL
- Nenhum UI de playlist
- Nenhum multi-item handling

### O que precisa ser criado
- Detecção de playlist URL
- `probePlaylist()` com `--flat-playlist --dump-json`
- Tipos `PlaylistInfo`, `PlaylistItem`
- Componente `PlaylistCard` com expansão
- `addPlaylistDownloads()` no DownloadEngine

### Decisão: Fases

**Fase 1 (MVP):** Detectar playlist → mostrar lista → enfileirar um por um
**Fase 2:** Seleção individual, filtros por tipo
**Fase 3:** Download em massa com progresso agregado

---

## 4. Filtros de Mídia + Status

### Decisão do usuário
- **Substituir** os 5 status tabs (Todos/Em Andamento/Concluídos/Pausados/Falhas) por 5 media type tabs (Todos/🔊 Audio/🎞️ Video/🖼️ Imagem/📋 Playlists)
- **Manter** filtros de status como chips secundários com **multi-seleção (OR)**
- **Combinar** mídia (AND) + status (OR)

### Lógica de filtro
```
Se mediaFilter ≠ 'all' → item.format.type deve bater (AND)
Se statusFilters.size > 0 → item.status deve estar no Set (OR)
Se ambos vazios → mostra tudo
```

---

## 5. Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Badge de plataforma | Ícone Lucide + nome | `icon` já existe em `getPlatformConfig()`, nunca foi renderizado |
| Ext do formato | Chip na row de feature tags | Mais contexto visual que texto solto no título |
| Detecção de playlist | URL `list=` + probe `--flat-playlist` | Padrão yt-dlp, leve |
| File size stat | `fs.stat()` via IPC | Padrão de mercado, <1ms |
| Status filters | Multi-select com Set | OR logic, reativo |
