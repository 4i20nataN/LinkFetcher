# 06 — Rede, IPC (limite real) e Console

## Rede — o que é visível

`list_network_requests` (`resourceTypes`, `pageIdx`, `pageSize`,
`includePreservedRequests`) e `get_network_request` (`reqid`,
`requestFilePath`, `responseFilePath`) cobrem tudo que o renderer faz via
`fetch`/`XHR`/recursos (scripts, imagens, WebSocket) — inclusive chamadas
do app para APIs externas (ex.: a checagem de update do GitHub, se feita
do lado do renderer; se feita no processo main, não aparece aqui, ver
abaixo).

Uso: diagnosticar CORS, requisições duplicadas, payloads grandes,
respostas lentas, cache mal configurado (`Cache-Control` na resposta),
chamadas de rede desnecessárias em cada re-render.

## IPC do Electron — NÃO é visível aqui

`ipcRenderer.invoke`/`ipcMain.handle` não trafega como request de rede —
é comunicação interna via Chromium Mojo, fora do domínio `Network` do
CDP. `list_network_requests` **nunca** vai mostrar uma chamada IPC. Isso
é uma limitação real da ferramenta, não um bug de configuração — não
tente "achar" IPC ali.

### Como medir IPC de qualquer forma (instrumentação, não a tool nativa)

1. **Instrumentar o preload/renderer via `evaluate_script`**, injetando um
   wrapper que mede tempo ao redor de cada chamada exposta (ex.:
   monkey-patch de `window.api.downloadMedia` para logar
   `performance.now()` antes/depois e empilhar em `window.__ipcMetrics`).
   Depois, ler `window.__ipcMetrics` com outro `evaluate_script`.
2. **`performance.mark`/`performance.measure` no próprio código do app**
   (se o time de dev instrumentar isso), que aí sim aparece na timeline do
   trace de performance (`04`) como "User Timing".
3. **Console logging temporário** no handler do main (`ipcMain.handle`)
   com timestamp — só visível no terminal/log do processo main, não no
   DevTools; correlacionar manualmente com o timestamp do lado renderer.
4. **Node Inspector** (`--inspect`) para profiling real do processo main
   (ver `01`) — é o único jeito de ver o tempo gasto dentro do handler em
   si, não só a latência round-trip percebida pelo renderer.

Reporte volume/latência de IPC sempre citando qual dos 4 métodos acima
gerou o número — nunca atribua a `list_network_requests`.

## Console

- `list_console_messages` (`types`, `pageIdx`, `pageSize`,
  `includePreservedMessages`) — captura `log`/`warn`/`error`/exceções,
  com stack trace source-mapped.
- `get_console_message(msgid)` — detalhe de uma mensagem específica.

Uso: baseline de erros pré-existentes (rodar sempre antes de qualquer
stress test, ver `03`), detectar warnings de CSP/mixed-content/
deprecation, exceções não capturadas durante os cenários de stress.

## Diagnosticando erros de rede/console em conjunto

Fluxo típico ("por que essa imagem não carrega", "por que o form falha
depois de digitar o email"): `list_console_messages` para erro relatado
pelo app → `list_network_requests` filtrando o tipo de recurso relevante
→ `get_network_request` no request específico para ver status/headers/
body → `evaluate_script` para inspecionar o estado do DOM/JS no momento
da falha, se necessário.
