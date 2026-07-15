# 02 — Topologia e Descoberta Autônoma

## Mapa mental: o que é cada coisa sob CDP

| Camada Electron | Visível via chrome-devtools-mcp? | Como |
|---|---|---|
| Renderer de cada `BrowserWindow`/`WebContentsView` | Sim | `list_pages` → um "page" por renderer |
| Preload script | Indiretamente | roda no contexto do renderer antes do isolamento do mundo principal; inspecionável via `evaluate_script` checando o que foi exposto em `window` (ex.: `window.api`), não como arquivo separado |
| Workers (Web Worker, Service Worker) do renderer | Parcialmente | podem não aparecer em `list_pages` diretamente; usar `evaluate_script` para introspecção via `navigator.serviceWorker`/mensagens, e console/network para efeitos observáveis |
| GPU process | Não diretamente | efeitos observáveis via trace de performance (raster/composite), não como target próprio |
| Main process (Node) | Não | precisa de `--inspect` separado, ver `01` |
| Utility process (Electron `utilityProcess`) | Não | processo Node separado, mesma limitação do main |
| IPC (`ipcMain`/`ipcRenderer`) | Não nativamente | ver `06-network-ipc-console.md` |

## Playbook de descoberta (rodar sempre no início, sem esperar pedido)

1. `list_pages` → lista todas as janelas/renderers ativos.
2. Para cada página: `select_page` → `take_snapshot` (árvore de
   acessibilidade — preferir a screenshot para descoberta estrutural,
   mais barato e mais informativo sobre hierarquia/uid de elementos).
3. `take_screenshot` (fullPage) de cada janela para registro visual do
   estado inicial — parte da evidência do relatório final.
4. `evaluate_script` para inventariar, sem depender de UI visível:
   - Rotas/state da SPA, se exposto em algum objeto global (ex.:
     `window.__APP_STATE__`, roteador React/Vue montado).
   - Storage: `localStorage`, `sessionStorage`, `indexedDB.databases()`,
     `document.cookie` (tamanho/quantidade de chaves — nunca o conteúdo
     de dado sensível no relatório).
   - Superfície exposta pelo preload: `Object.keys(window.api ?? {})`
     e se está congelada (`Object.isFrozen(window.api)`).
   - Workers registrados: `navigator.serviceWorker.getRegistrations()`.
5. `list_console_messages` — captura erros/warnings já presentes no boot,
   antes de qualquer interação (baseline).
6. `list_network_requests` — captura chamadas de rede do boot (útil para
   achar chamadas desnecessárias/duplicadas de inicialização).
7. Descoberta de elementos interativos ocultos: menus de contexto, atalhos
   de teclado, modais — via `take_snapshot` (a árvore a11y expõe
   `role="menuitem"`, `role="dialog"` etc.) combinado com `press_key`
   para abrir menus de contexto (`Shift+F10`/tecla de menu) e
   `evaluate_script` para listar `document.querySelectorAll('[role]')`.
8. Popups/novas janelas: disparar ações que tipicamente abrem nova janela
   (menu "Sobre", preferências, links externos) e chamar `list_pages`
   de novo após cada ação — nunca assumir que só a janela inicial existe.

## Catalogar antes de testar

Produza (mentalmente ou em nota de trabalho, não precisa virar arquivo)
um inventário: N janelas, para cada uma — rotas internas, modais
conhecidas, storage em uso, workers ativos. Esse inventário vira o
"mapa de cobertura" da bateria de stress test em `03` — nenhuma parte do
app auditada "porque foi a única que apareceu na tela".
