# 03 — Bateria de Stress Test

## Princípio

Todo cenário de stress gera uma medição de antes/depois (console limpo?
FPS mantido? memória retornou ao baseline?) — stress sem medição
associada é só "clicar por clicar" e não produz evidência de nada.

## Matriz de interação (via tools reais)

| Cenário | Tools | O que observar depois |
|---|---|---|
| Clique repetido rápido | `click` em loop no mesmo `uid` | `list_console_messages` (erros de handler duplicado), FPS via trace |
| Clique em múltiplos elementos simultâneo/sequência rápida | `click` sequencial em vários `uid` sem esperar animação | race conditions em state, erros de console |
| Duplo clique | `click` com `dblClick: true` | handlers que assumem single-click quebrando |
| Drag and drop | `drag` (from_uid/to_uid) | reordenação de lista, upload por drop |
| Navegação por teclado | `press_key` (`Tab`, `Shift+Tab`, `Enter`, `Escape`, setas) | foco visível, trap de foco em modais, atalhos conflitantes |
| Formulários em massa | `fill_form` (preferir a múltiplos `fill`) | validação client-side, IPC disparado por submit |
| Diálogos nativos (confirm/alert/prompt) | `handle_dialog` (`accept`/`dismiss`) | app não trava esperando diálogo indefinidamente |
| Upload de arquivo | `upload_file` | tamanho grande, extensão inesperada, nome com caracteres especiais |
| Resize de janela | `resize_page` (extremos: muito pequeno, muito grande) | layout quebrado, scroll infinito, elementos cortados |
| Zoom / alto DPI | `emulate` (`viewport` com `devicePixelRatio` alto) | blur de ícones, texto cortado |
| Rede lenta/offline | `emulate` (`networkConditions: 'Offline'`, `'Slow 3G'`) | app trata falha de rede sem crashar, mostra estado de erro claro |
| CPU degradada | `emulate` (`cpuThrottlingRate: 4` ou mais) | jank, animações travando, input lag |
| Tema claro/escuro | `emulate` (`colorScheme`) | contraste, ícones que não trocam |
| Sessão longa | manter app aberto, repetir `performance_start_trace`/`stop_trace` a cada N minutos | crescimento de heap ao longo do tempo (ver `05`) |

## Cenários específicos de Electron (fora do alcance direto do MCP)

Abrir/fechar `BrowserWindow` repetidamente, suspender/retomar após sleep do
SO, mudança de monitor/DPI do SO — o `chrome-devtools-mcp` não cria
janelas Electron (`new_page` cria uma aba dentro do Chromium existente,
não uma nova instância de `BrowserWindow` do app). Esses cenários exigem
automação **no nível do app** (script que chama os handlers de IPC que
abrem/fecham janelas, ou automação de UI do SO). O papel do MCP aqui é
medir o efeito (memória/console/performance) antes e depois de cada
ciclo, não provocar o ciclo em si — deixe claro essa fronteira no
relatório em vez de implicar que o MCP "testou a criação de janelas".

## Protocolo de execução

1. Baseline: screenshot + `list_console_messages` + heap snapshot leve
   (ver `05`) antes de qualquer stress.
2. Executar o cenário.
3. Capturar imediatamente depois: `list_console_messages` (novos erros?),
   `take_screenshot` (UI ainda íntegra?), FPS/jank se havia trace ativo.
4. Aguardar alguns segundos (assentar GC/layout) e capturar de novo —
   diferencia problema transitório de problema permanente.
5. Repetir o cenário N vezes (defina N por cenário — cliques rápidos:
   dezenas; resize: poucas vezes já expõe bug de layout) antes de
   concluir "resistente" — uma única repetição sem erro não é evidência
   de robustez, é ausência de teste insuficiente.
6. Registrar cada cenário com resultado (passou/falhou/degradou) e a
   confiança da conclusão (ver `08`).
