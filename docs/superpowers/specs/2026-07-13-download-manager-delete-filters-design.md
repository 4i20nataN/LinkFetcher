# Design Spec — Download Manager: Delete em Lote + Filtros Avançados + Cards Ricos

> **Data:** 2026-07-13
> **Arquivo alvo:** `src/features/downloads/DownloadManager.tsx`
> **Status:** Aguardando aprovação

---

## 1. Contexto

A aba de Downloads já possui:
- Filtros por status (Todos, Ativos, Concluídos, Pausados, Falhou/Cancelado)
- Ações em lote (Pausar Todos, Retomar Todos, Cancelar Todos, Limpar Concluídos)
- Delete por item (ícone trash em cada card)

**Problemas:**
- Sem checkbox para selecionar múltiplos itens
- Sem botão de deletar selecionados no header
- Filtros limitados (só status)
- Cards com info insuficiente para distinguir downloads duplicados do mesmo vídeo
- Sem filtro por data, formato, plataforma ou tamanho

---

## 2. Componentes

### 2a. Checkbox + Select All (header dos filtros)

**Local:** Na barra de filtros de status (linha 232-286), à esquerda dos tabs.

**Comportamento:**
- Checkbox "Select All" à esquerda dos tabs de filtro
- Quando clicado: seleciona/desseleciona todos os itens **visíveis** (respeitando filtro ativo)
- Quando todos visíveis estão selecionados → checkbox fica checked
- Quando alguns estão selecionados → checkbox fica indeterminado
- Quando nenhum → checkbox vazio

**Botão "Deletar Selecionados":**
- Aparece ao lado do "Limpar Concluídos" (ou substitui ele quando há seleção)
- Só aparece quando `selectedIds.size > 0`
- Estilo: vermelho (rose), com ícone Trash2 + contagem "Deletar (3)"
- Ao clicar: confirmação simples (muda o botão para "Confirmar?" por 3 segundos, clique novamente confirma)
- Chama `DownloadEngine.removeDownload(id)` para cada selecionado

**State adicional:**
```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

### 2b. Checkbox por item

**Local:** Cada card de download, no canto superior esquerdo (antes da barra de status colorida).

**Comportamento:**
- Checkbox visual estilo toggle (rounded, accent color quando checked)
- Ao clicar: adiciona/remove o `item.id` do `selectedIds`
- Visível sempre (não só no hover)
- Quando hover no card: checkbox fica com borda mais visível

### 2c. Filtros Avançados (colapsável)

**Local:** Abaixo da barra de filtros de status, como um painel expansível.

**Toggle:** Botão "Filtros Avançados" com ícone SlidersHorizontal, à direita dos tabs.

**Filtros disponíveis:**

| Filtro | Tipo | Opções |
|--------|------|--------|
| **Data** | Select | Todos, Hoje, Esta Semana, Este Mês, Últimos 3 Meses |
| **Formato** | Select | Todos, MP4, MKV, WebM, MP3, FLAC, AAC, Outros |
| **Plataforma** | Select | Todas, + cada plataforma registrada no ProviderRegistry |
| **Tamanho** | Select | Todos, < 50MB, 50-200MB, 200MB-1GB, > 1GB |

**Comportamento:**
- Filtros se combinam com AND (data E formato E plataforma E tamanho)
- Todos começam em "Todos" (sem filtro)
- Botão "Limpar Filtros" reseta tudo
- Badge no botão "Filtros Avançados" mostra quantos filtros ativos (ex: "Filtros (2)")

**State adicional:**
```typescript
const [advancedFilters, setAdvancedFilters] = useState({
  dateRange: 'all' | 'today' | 'this_week' | 'this_month' | 'last_3_months',
  format: 'all' | 'mp4' | 'mkv' | 'webm' | 'mp3' | 'flac' | 'aac' | 'other',
  platform: 'all' | PlatformId,
  sizeRange: 'all' | 'under_50mb' | '50_200mb' | '200mb_1gb' | 'over_1gb',
});
const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
```

**Lógica de filtro:**
```typescript
const matchesAdvancedFilters = (item: DownloadItem): boolean => {
  // Date
  if (advancedFilters.dateRange !== 'all') {
    const added = new Date(item.addedAt);
    const now = new Date();
    if (advancedFilters.dateRange === 'today') {
      if (added.toDateString() !== now.toDateString()) return false;
    }
    if (advancedFilters.dateRange === 'this_week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (added < weekAgo) return false;
    }
    // ... etc
  }
  // Format
  if (advancedFilters.format !== 'all') {
    const ext = item.format.ext.toLowerCase();
    if (advancedFilters.format === 'other') {
      if (['mp4','mkv','webm','mp3','flac','aac'].includes(ext)) return false;
    } else if (ext !== advancedFilters.format) return false;
  }
  // Platform
  if (advancedFilters.platform !== 'all' && item.platform !== advancedFilters.platform) return false;
  // Size
  if (advancedFilters.sizeRange !== 'all') {
    const mb = item.sizeTotal / (1024 * 1024);
    // ... ranges
  }
  return true;
};
```

### 2d. Cards Ricos (mais informações)

**Mudanças no card atual:**

**Linha 1 (título):** Manter título truncado + extensão + tamanho

**Linha 2 (NOVA — metadados):**
```
📦 128.5 MB • 🎬 1080p • 🔊 MP3 320kbps • 📅 Hoje 14:32 • 🌐 YouTube
```

Campos adicionados:
- **Data de adição:** `item.addedAt` formatada ("Hoje 14:32", "Ontem 09:15", "12/07 16:45")
- **Plataforma:** nome do provider (já tem no badge da thumb, mas reforça na linha)
- **Audio info:** quando `audioOnly`, mostrar formato + qualidade (ex: "MP3 320kbps")
- **Subs info:** quando `writeSubs`, mostrar idioma (ex: "Legendas: PT, EN")

**Linha 3 (progresso):** Manter barra + métricas como está

**Layout visual proposto:**
```
[Checkbox] [Status Bar][Thumb] | Title truncated...          [EXT] [SIZE]
                               | 📅 Hoje 14:32 • 🌐 YouTube • 🔊 MP3 320kbps
                               | [████████░░░░░░] 67% • 85.2MB/128.5MB • 2.1MB/s • 20s
                               | [Pause] [Share] [Delete]
```

---

## 3. Fluxo de Dados

### Select All
```
User clicks "Select All" checkbox
  → if all visible selected: clear selectedIds
  → else: add all visible item IDs to selectedIds

User clicks per-item checkbox
  → toggle item.id in selectedIds

User clicks "Deletar (N)"
  → if first click: change button to "Confirmar?" (3s timeout)
  → if second click within 3s:
      → selectedIds.forEach(id => DownloadEngine.removeDownload(id))
      → setSelectedIds(new Set())
      → showToast("N downloads deletados")
  → after 3s: revert to "Deletar (N)"
```

### Advanced Filters
```
User toggles "Filtros Avançados"
  → showAdvancedFilters = !showAdvancedFilters

User changes a filter select
  → update advancedFilters state
  → filteredDownloads recalculates automatically (useMemo)

filteredDownloads = downloads
  .filter(matchesStatusFilter)     // existing
  .filter(matchesAdvancedFilters)  // new
```

---

## 4. Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/features/downloads/DownloadManager.tsx` | Adicionar checkboxes, filtros avançados, cards ricos, lógica de seleção |
| `src/types.ts` | Nenhuma mudança (DownloadItem já tem todos os campos necessários) |
| `src/core/engine/DownloadEngine.ts` | Nenhuma mudança (removeDownload já existe) |

---

## 5.Trade-offs

**Opção A — Tudo num arquivo (DownloadManager.tsx):**
| Prós | Contras |
|------|---------|
| Simples, não quebra imports | Arquivo cresce ~200 linhas |
| Tudo junto, fácil de debugar | Menos reutilizável |

**Opção B — Extrair componentes (DownloadFilters, DownloadCard, etc.):**
| Prós | Contras |
|------|---------|
| Modulares, reutilizáveis | Mais arquivos, mais imports |
| Mais limpo | Pode ser over-engineering para 1 feature |

**Recomendação:** Opção A. O arquivo já tem 483 linhas, vai chegar a ~700. Aceitável para uma tela autocontida. Se crescer mais, extrair depois.

---

## 6. Prioridade de Implementação

1. **Checkboxes + Select All + Deletar** (core functionality)
2. **Filtros Avançados** (data, formato, plataforma, tamanho)
3. **Cards Ricos** (data, áudio info, subs info)
4. **Confirmação de delete** (anti-clique acidental)
