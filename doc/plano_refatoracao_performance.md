# Plano de Refatoração de Performance — Android

**Status:** Proposta
**Prioridade:** Alta
**Device Target:** Samsung Galaxy A15 (SM-A156M), Helio G88, 3.6GB RAM
**Baseline:** gfxInfo 78% janky, 99th percentile 1400ms, 1092/7036 missed VSyncs

---

## Fase 1: Redução de Overhead no WebView (Est. 2-3 dias)

### 1.1 Memoização de Re-renders no FormatSelector
**Problema:** FormatSelector re-renderiza a cada mudança de estado em `FormatOptions`, incluindo seções colapsadas.

**Ação:**
- `React.memo()` em `AccordionSection` e `SmallToggle`
- `useCallback` em `update()` e handlers de toggle
- `useMemo` para cálculos de formatos derivados

**Arquivo:** `src/features/downloads/FormatSelector.tsx`
**Impacto estimado:** 20-30% redução de re-renders

### 1.2 Virtualização da Lista de Downloads
**Problema:** `DownloadManager.tsx` renderiza todos os downloads na DOM.

**Ação:**
- Implementar `react-window` ou `@tanstack/virtual` para lista de downloads
- Renderizar apenas itens visíveis + buffer de 3-5 itens
- Lazy load de thumbnails/ícones

**Arquivo:** `src/features/downloads/DownloadManager.tsx`
**Impacto estimado:** 40-60% redução de DOM nodes para listas >10 itens

### 1.3 Debounce no YouTube Search
**Problema:** `YouTubeSearch.tsx` dispara busca a cada caractere.

**Ação:**
- Debounce de 300ms no input de busca
- Cache de resultados anteriores (LRU, max 20 entradas)
- Abort de requests anteriores via AbortController

**Arquivo:** `src/features/youtube/YouTubeSearch.tsx`
**Impacto estimado:** 50-70% redução de chamadas de busca

---

## Fase 2: Otimização do Bridge Capacitor (Est. 2-3 dias)

### 2.1 Batch de Progress Events
**Problema:** Cada progress event do Kotlin gera uma chamada `notifyListeners()` → bridge JSON → WebView.

**Ação:**
- No Kotlin: agregar progress events por 100ms antes de enviar
- No TypeScript: batch de updates no DOM via `requestAnimationFrame`
- Considerar `SharedArrayBuffer` para dados de alta frequência (se viável)

**Arquivo:** `YtDlpPlugin.kt` + `CapacitorYtDlp.ts`
**Impacto estimado:** 30-50% redução de overhead de bridge

### 2.2 Lazy Loading do Plugin
**Problema:** `YtDlpPlugin` é carregado na inicialização do app.

**Ação:**
- Dynamic import do plugin apenas quando necessário
- Preload em idle time (requestIdleCallback)

**Arquivo:** `CapacitorYtDlp.ts`
**Impacto estimado:** 100-200ms redução no Time to Interactive

### 2.3 Compactação de JSON no Bridge
**Problema:** Payloads JSON do plugin são completos e podem conter dados冗余.

**Ação:**
- Definir schema mínimo para cada tipo de evento (progress, probe, search)
- Strip campos não utilizados antes do bridge
- Considerar MessagePack ou flatbuffers para payloads grandes (probe results)

**Arquivo:** `YtDlpPlugin.kt` + `CapacitorYtDlp.ts`
**Impacto estimado:** 15-25% redução de tamanho de payload

---

## Fase 3: React Query + State Management (Est. 3-4 dias)

### 3.1 migração para TanStack Query
**Problema:** Estado de downloads gerenciado manualmente em `AppContext` + `DownloadEngine`.

**Ação:**
- `useQuery` para probe results (cache TTL: 5min)
- `useMutation` para downloads
- `useInfiniteQuery` para YouTube search (paginação)
- Invalidação inteligente de cache

**Arquivos:** `AppContext.tsx`, `DownloadEngine.ts`, componentes UI
**Impacto estimado:** 30-40% redução de lógica de estado, melhor UX com stale-while-revalidate

### 3.2 Estado de Downloads via Zustand
**Problema:** `DownloadEngineClass` é um singleton monolítico.

**Ação:**
- Migrar para Zustand store para downloads
- Separar concerns: queue, progress, file management
- DevTools para debug

**Arquivo:** `src/core/engine/DownloadEngine.ts`
**Impacto estimado:** Melhor testabilidade, 20% redução de bundle size (tree-shaking)

---

## Fase 4: Bundle Optimization (Est. 1-2 dias)

### 4.1 Code Splitting por Rota
**Ação:**
- Lazy load de `FormatSelector`, `YouTubeSearch`, `SettingsView`
- `React.lazy()` + Suspense com fallback skeleton
- Split de `motion/react` (framer-motion) em chunk separado

**Impacto estimado:** 15-20% redução de bundle inicial

### 4.2 Tree Shaking de Ícones
**Problema:** Lucide React importa biblioteca completa.

**Ação:**
- Importar apenas ícones utilizados: `import { Download } from 'lucide-react'`
- Verificar que tree shaking está ativo no Vite

**Impacto estimado:** 5-10% redução de bundle

### 4.3 Optimização de Imagens/Assets
**Ação:**
- Converter assets estáticos para WebP
- Implementar lazy loading de imagens
- Usar `loading="lazy"` em todas as imgs não-críticas

---

## Fase 5: Android Native Optimizations (Est. 2-3 dias)

### 5.1 WakeLock Inteligente
**Status:** Parcialmente implementado (commit `754fbcd`)
**Melhoria:** Ativar WakeLock apenas durante download ativo, liberar em pausa/erro.

### 5.2 Notificação de Progresso Nativa
**Ação:**
- ProgressBar nativa no notification shade
- Ações rápidas: pausar, cancelar, abrir arquivo
- Remover notificação após completion

**Arquivo:** `YtDlpPlugin.kt` (Android NotificationManager)

### 5.3 Database SQLite para Downloads
**Problema:** Downloads persistidos em `localStorage` (limitado a 5MB).

**Ação:**
- Migrar para Capacitor SQLite plugin
- Schema: downloads, settings, favorites, history
- Índices para queries frequentes

**Impacto estimado:** Melhor performance em listas grandes, suporte a 1000+ downloads

---

## Priorização (Recomendada)

| Fase | Impacto | Esforço | Prioridade |
|------|---------|---------|------------|
| 1.1 Memoização FormatSelector | Alto | Baixo | **P0** |
| 1.3 Debounce YouTube Search | Alto | Baixo | **P0** |
| 4.1 Code Splitting | Médio | Baixo | **P0** |
| 2.1 Batch Progress Events | Alto | Médio | **P1** |
| 3.1 TanStack Query | Alto | Alto | **P1** |
| 1.2 Virtualização Downloads | Médio | Médio | **P2** |
| 5.2 Notificação Nativa | Médio | Médio | **P2** |
| 5.3 SQLite | Médio | Alto | **P3** |
| 2.2 Lazy Loading Plugin | Baixo | Baixo | **P3** |
| 3.2 Zustand Store | Médio | Alto | **P3** |

---

## Métricas de Sucesso

| Métrica | Target |
|---------|--------|
| gfxInfo janky frames | < 40% (de 78%) |
| 99th percentile | < 800ms (de 1400ms) |
| Missed VSyncs | < 400 (de 1092) |
| Time to Interactive | < 2s (medir baseline) |
| Bundle size (initial) | < 300KB gzipped |
| Download start latency | < 1s |

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Breaking changes no Capacitor Bridge | Testes E2E antes de cada fase |
| React Query overhead em listas pequenas | Hybrid: Query para probe, manual para progress |
| SQLite migration data loss | Script de migração com backup |
| framer-motion split breaking lazy load | Testar com chunk analysis |

---

## Próximos Passos Imediatos

1. **Fase 1.1 + 1.3 + 4.1** (P0): Memoização, debounce, code splitting — implementar primeiro
2. Medir baseline com Chrome DevTools MCP antes/depois
3. Criar branch `feat/performance-optimization`
4. Implementar Fase 1 completa
5. Deploy + medição em device real
6. Iterar baseado em métricas
