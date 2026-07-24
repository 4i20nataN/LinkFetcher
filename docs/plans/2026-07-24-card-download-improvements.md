# Plano: Card de Download + Filtros + File Size

**Data:** 2026-07-24
**Status:** Em andamento
**Branch:** `feat/electron-web-version`
**Análise:** `docs/analyses/2026-07-24-card-download-filtros-playlists.md`

---

## Ordem de Implementação

| Passo | Frente | Descrição | Esforço | Status |
|-------|--------|-----------|---------|--------|
| 1 | F2 | Remover badge duplicado + mover ext | Baixo | Pendente |
| 2 | F1 | File size via fs.stat() | Médio | Pendente |
| 3 | F3 | Filtros mídia + status multi-select | Médio | Pendente |
| 4 | F5 | Cards imagem/áudio melhorados | Baixo | Pendente |
| 5 | F4 | Playlists MVP | Alto | Pendente (Fase 1) |

---

## F2: Badge Duplicado + Ext

**Arquivo:** `src/features/downloads/DownloadManager.tsx`

- [ ] Deletar platform badge overlay da thumbnail (linhas 392-396)
- [ ] Remover `<span>` isolado do ext do título (linhas 408-410)
- [ ] Adicionar ext como chip na row de feature tags (após platform badge)
- [ ] Renderizar ícone Lucide do platform (campo `icon` existente mas não utilizado)

---

## F1: File Size via OS-native stat

### Electron

**Arquivo:** `electron/main.cjs`
- [ ] Adicionar handler IPC `fs:stat` — recebe filePath, retorna `{ size: number }`

**Arquivo:** `electron/preload.cjs`
- [ ] Expotar `fs:stat` no bridge

**Arquivo:** `src/global.d.ts`
- [ ] Adicionar tipo do invoke `fs:stat`

### DownloadEngine

**Arquivo:** `src/core/engine/DownloadEngine.ts`
- [ ] No evento `complete` (Electron handler, linha ~378): chamar `fs:stat` após obter filePath
- [ ] No evento `complete` (Capacitor handler, linha ~488): chamar Filesystem.stat()
- [ ] Atualizar `target.sizeTotal` e `target.sizeDownloaded` com valor real

### UI

**Arquivo:** `src/features/downloads/DownloadManager.tsx`
- [ ] Linha 465-468: manter lógica existente (sizeTotal > 0 mostra "X / Y (Z%)", senão "X (Z%)")
- [ ] Agora sizeTotal será preenchido corretamente no evento complete

---

## F3: Filtros Mídia + Status

**Arquivo:** `src/features/downloads/DownloadManager.tsx`

- [ ] Adicionar state `mediaFilter` (all/audio/video/image/playlist)
- [ ] Adicionar state `statusFilters` (Set de strings)
- [ ] Criar função `getMediaType(item)` — detecta tipo baseado em format.type, audioOnly, URL
- [ ] Implementar filtro combinado AND (mídia) + OR (status)
- [ ] Criar função `toggleStatus(status)` — adiciona/remove do Set
- [ ] Renderizar Row 1: tabs de mídia (primários, com motion layoutId)
- [ ] Renderizar Row 2: chips de status (secundários, multi-select)
- [ ] Separador visual entre as duas rows

---

## F5: Cards Imagem/Áudio

### Imagem

**Arquivo:** `src/types.ts`
- [ ] Adicionar `imageSource?: 'user-link' | 'thumbnail'` em DownloadItem

**Arquivo:** `src/core/engine/DownloadEngine.ts`
- [ ] No `addDownload()`: detectar imageSource para format.type === 'image'

**Arquivo:** `src/features/downloads/DownloadManager.tsx`
- [ ] Badge "Imagem" ou "Thumbnail" no card baseado em imageSource

### Áudio

**Arquivo:** `src/features/downloads/DownloadManager.tsx`
- [ ] Expandir chip de áudio: mostrar formato + qualidade quando disponível

---

## F4: Playlists MVP (Fase 1)

**Status:** Planejado — não implementar ainda

### O que inclui na Fase 1
- Detecção de playlist URL (`list=`)
- `probePlaylist()` com `--flat-playlist --dump-json`
- Tipos `PlaylistInfo`, `PlaylistItem` em `types.ts`
- Card de playlist com contagem de itens
- Botão "Baixar Todos" enfileira um por um

### O que NÃO inclui na Fase 1
- Seleção individual de itens
- Filtros por tipo dentro da playlist
- Download em massa com progresso agregado
- UI de expansão/dobra

---

## Verificação Final

- [ ] `npx tsc --noEmit` — sem erros de tipo
- [ ] `npm run build` — build completo
- [ ] Teste visual no Electron Desktop
- [ ] Teste no Android (se disponível)
