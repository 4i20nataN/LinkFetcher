# Auditoria de Performance & Segurança — 2026-07-17

> Ferramenta: Chrome DevTools MCP (Eletron via `--remote-debugging-port=9222`)
> Modo: Trace interativo com navegação agressiva entre telas + Lighthouse snapshot/navigation

---

## 1. Performance — Métricas Core Web Vitals

| Métrica | Valor | Status |
|---------|-------|--------|
| **LCP** (Largest Contentful Paint) | 927ms | ✅ Bom (<2500ms) |
| **CLS** (Cumulative Layout Shift) | 0.00 | ✅ Perfeito |
| **INP** (Interaction to Next Paint) | 256ms | ⚠️ Needs improvement (>200ms) |
| **FCP** (First Contentful Paint) | 512ms | ✅ Bom |
| **DOM Content Loaded** | 381ms | ✅ Bom |
| **Load Complete** | 396ms | ✅ Bom |

---

## 2. Problemas Encontrados

### 🔴 CRÍTICO — Imagens re-baixando a cada troca de aba (sem cache)

**Impacto:** 18 requests HTTP para apenas 4 thumbnails únicos durante navegação entre 6 abas. Cada ida e volta re-baixa tudo.

**Evidência:** Network tab mostrou 18 GET requests para `i.ytimg.com` com os mesmos 4 URLs repetidos 4-5x cada.

**Causa raiz:** As imagens de thumbnail são renderizadas por componente React que desmonta ao trocar de aba. Sem `loading="lazy"` + `decoding="async"` + cache do browser, cada re-render dispara novo request.

**Correção:**
- Adicionar `loading="lazy"` e `decoding="async"` nas tags `<img>` de thumbnails
- Considerar prefetch em background ou cache em localStorage/blob
- Thumbnails do YouTube (`i.ytimg.com`) possuem cache HTTP curto — considerar proxy local ou service worker

**Arquivos afetados:**
- `src/features/analyzer/LinkAnalyzer.tsx` — thumbnail display
- `src/features/downloads/FormatSelector.tsx` — thumbnail in media info
- Componentes de card de resultado

---

### ⚠️ MÉDIO — INP 256ms (pointerdown)

**Impacto:** Clique percebido com leve delay.

**Breakdown:**
- Input delay: 3ms ✅
- Processing duration: 188ms ⚠️ (gasto em callbacks React)
- Presentation delay: 65ms ✅

**Causa:** Fluxo de state update no pointerdown gera re-render complexo.

**Correção:** Otimizar batch de state updates no handler de clique, usar `startTransition` pra clicks que disparam navegação.

---

### ⚠️ MÉDIO — Forced Reflow 38ms (motion_react)

**Impacto:** Layout thrashing durante animações de accordion/accordion open.

**Causa:** `measureScroll` no `motion_react` (Framer Motion) lê propriedades geométricas após mudança de DOM.

**Correção:** Limitar uso de `motion.div` com `height: auto` animation. Usar `transform` em vez de layout properties quando possível. Pode ser mitigado com `will-change: transform` nos accordion panels.

**Arquivo:** `src/features/downloads/FormatSelector.tsx` — AccordionSection usa `<motion.div>` com `height: 'auto'` animation.

---

### ⚠️ MÉDIO — Render delay no LCP (919ms / 927ms total)

**Impacto:** 98% do LCP é render delay, não network.

**Causa:** Canvas (NeuralConstellationBackground) + backdrop-filter pesados competem com paint inicial.

**Correção:** Considerar `will-change: backdrop-filter` nos containers principais. Canvas já foi otimizado (60 nodes, 35 particles) mas o custo combinado com blur(20px) nos containers ainda é significativo.

---

### ℹ️ BAIXO — Erro React no console

```
Received `%s` for a non-boolean attribute `%s`.
true font-semibold font-semibold true font-semibold
```

**Causa:** Provavelmente um componente passando `true` como valor de classe CSS em vez de string.

**Correção:** Investigar qual componente está passando boolean em vez de string para className.

---

## 3. Lighthouse Scores

| Categoria | Score |
|-----------|-------|
| Best Practices | 100 ✅ |
| Accessibility | 81 ⚠️ |
| SEO | 83 ⚠️ |

### Accessibility (81) — Issues:
- Possíveis problemas de contraste em textos small (text-[10px], text-[11px])
- Botões sem aria-label explícitos em alguns toggles
- Foco de teclado pode não ser visível em todos os elementos customizados

### SEO (83) — Issues:
- Meta description ausente (irrelevante para app desktop, mas afeta score)
- heading hierarchy inconsistente (h2 → h5 sem h3/h4 intermediários)

---

## 4. Segurança

### ✅ PASSA
- **Best Practices:** 100/100
- **CSP:** Não via meta tag, mas Electron pode usar CSP via `webPreferences` (verificar `main.cjs`)
- **External scripts:** Nenhum carregado de CDN externo
- **XSS:** Sem `dangerouslySetInnerHTML` detectado
- **Forms:** Nenhum form HTML nativo (inputs controlados por React)
- **Autocomplete:** 2 inputs sem `autocomplete` attribute

### ⚠️ ATENÇÃO
- **Link externo sem `rel="noopener"`:** 1 link (`youtube.com/watch?v=...`) sem rel attribute — baixo risco mas boa prática adicioná-lo
- **Permissions-Policy:** Ausente — considerar adicionar header mesmo em Electron
- **Inputs sem autocomplete:** O textbox de URL não tem `autocomplete="off"` — pode sugerir URLs anteriores indesejavelmente
- **CSP no Electron:** Verificar se `main.cjs` configura `webPreferences.csp` — essencial pra Electron desktop

---

## 5. Memória

- **Heap snapshot salvo:** `docs/performance-audit-heap.heapsnapshot` (analisar com Chrome DevTools Memory tab)
- **Long tasks:** Nenhum detectado durante avaliação
- **Memory leaks potenciais:** Canvas animation loop precisa de cleanup adequado no unmount

---

## 6. Plano de Correção (Priorizado)

### P0 — Imediato
1. [ ] Adicionar `loading="lazy" decoding="async"` em todas as `<img>` de thumbnails
2. [ ] Investigar e corrigir erro React `non-boolean attribute` no console

### P1 — Alta
3. [ ] Otimizar cache de thumbnails (verificar se service worker ou prefetch resolve)
4. [ ] Adicionar `will-change: transform` nos AccordionSection motion.div
5. [ ] Usar `startTransition` nos clicks de navegação do sidebar
6. [ ] Verificar CSP configuration no Electron main.cjs

### P2 — Média
7. [ ] Adicionar `autocomplete="off"` no textbox de URL
8. [ ] Adicionar `rel="noopener noreferrer"` em links externos
9. [ ] Corrigir heading hierarchy (h2 → h3 em vez de h2 → h5)
10. [ ] Melhorar contraste de textos small (10px/11px) pra Accessibility score

### P3 — Baixa
11. [ ] Considerar `will-change: backdrop-filter` nos containers com blur(20px)
12. [ ] Meta description para SEO (mesmo sendo desktop app,有助 para documentação)

---

## 7. Dados do Trace

- **Trace duration:** ~39.6s (navegação interativa entre todas as telas)
- **CPU throttling:** 1x (sem limitação)
- **Network:** Direto (sem throttling)
- **Requests totais:** 60 recursos
- **Transfer size:** ~9KB (HTML/CSS/JS only — imagens externas não contabilizadas no transferSize do performance API)
