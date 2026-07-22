# 04 — Engenharia de Performance

## Ferramentas reais e para que servem

- `performance_start_trace` (`reload`, `autoStop`, `filePath`) — grava um
  trace de performance da página selecionada. Se `reload`/`autoStop`
  forem usados, navegue para a URL certa com `navigate_page` **antes**.
- `performance_stop_trace` — encerra e retorna o trace (ou salva em
  arquivo se `filePath`).
- `performance_analyze_insight` (`insightName`, `insightSetId`) — detalha
  um insight específico do trace (ex.: `"LCPBreakdown"`,
  `"DocumentLatency"`) usando o `insightSetId` retornado pela análise do
  trace — nunca inventar um `insightName` fora do que o resultado do
  trace já listou.
- `lighthouse_audit` (`device`, `mode`) — acessibilidade, SEO, boas
  práticas, "agentic browsing". **Não inclui performance** — para
  performance, é sempre via trace, não Lighthouse.

## Metodologia: nunca otimizar sem antes/depois medido

1. `navigate_page` para o estado/rota a medir.
2. `performance_start_trace`.
3. Executar a interação alvo (ex.: abrir uma tela pesada, rolar uma lista
   grande, disparar o fluxo que o usuário reportou como lento).
4. `performance_stop_trace`.
5. Ler os insights retornados, aprofundar com
   `performance_analyze_insight` nos que aparecerem sinalizados.
6. Aplicar a mudança de código.
7. Repetir passos 1–5 **na mesma rota/interação/máquina/condições de
   emulação** — comparação só é válida se o cenário for idêntico.
8. Só então registrar "ganho de X" — com os dois números, nunca com um
   único trace "olhando bom".

## O que interpretar do trace

- **FPS / frames descartados** — jank visível ao usuário; correlacionar
  com Long Tasks na main thread.
- **Long Tasks** — bloqueio da main thread >50ms; raiz comum de input lag.
- **Layout/Paint/Raster/Composite** — layout thrashing (forçar
  reflow repetido lendo propriedades geométricas logo após escrever
  estilo) é a causa mais comum de custo de layout alto.
- **Startup/Cold boot vs Warm boot** — para Electron, "cold boot" real
  (processo do zero) só é medido de fora do CDP (tempo até
  `list_pages` retornar o primeiro target útil); o trace mede o que
  acontece *dentro* do renderer depois que ele já existe. Diferencie os
  dois no relatório — não misture "tempo de boot do app" com "tempo do
  primeiro trace".
- **Core Web Vitals (LCP/CLS/INP)** — fazem sentido para conteúdo que
  navega/carrega como página; para uma SPA Electron de tela única que só
  troca de view em client-side routing, LCP mede o carregamento inicial
  (relevante uma vez), CLS/INP continuam relevantes por interação — não
  reporte LCP repetidamente por navegação interna que não é uma
  navegação real de documento.

## Bundle / module loading / lazy loading

- Visível via `list_network_requests` (tamanho e tempo de cada chunk JS
  carregado) combinado com o trace (quando cada chunk é parseado/
  executado). Redução de bundle é medida por diff de tamanho de arquivo
  (`get_network_request` no asset) e por tempo de "Script Evaluation" no
  trace antes/depois de code-splitting.

## Nunca

- Reportar "FPS melhorou" sem um trace antes e um trace depois na mesma
  condição de `emulate` (throttling, viewport).
- Extrapolar um trace de 5 segundos para "o app é rápido" em geral —
  cubra pelo menos os cenários da matriz de `03`.
