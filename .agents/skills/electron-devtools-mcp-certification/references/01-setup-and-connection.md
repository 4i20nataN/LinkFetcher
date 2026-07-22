# 01 — Instalação, Conexão e Verificação

## Instalação (config MCP genérica)

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}
```

Funciona na maioria dos clientes MCP baseados em JSON (a chave pode ser
`mcpServers` ou `servers` dependendo do cliente). Em Claude Code, via CLI:

```
claude mcp add --transport stdio chrome-devtools -- npx -y chrome-devtools-mcp@latest
```

Isso, sozinho, faz o MCP **abrir seu próprio Chrome novo** — inútil para
auditar um Electron, que é um binário próprio, não uma aba de Chrome. Para
Electron, sempre usar um dos modos de conexão manual abaixo.

## Modos de conexão (decisão)

| Situação | Flag | Nota |
|---|---|---|
| App **web comum** rodando em `localhost` | nenhuma (padrão) | MCP abre e navega sozinho |
| **Electron**, app já rodando, quer inspecionar renderer | `--browserUrl=http://127.0.0.1:<porta>` (ou `-u`) | ver seção Electron abaixo |
| Conectar via WebSocket direto (ex.: atrás de proxy) | `--wsEndpoint=ws://127.0.0.1:<porta>/devtools/browser/<id>` | alternativa a `--browserUrl` |
| Ambiente sandboxado (MCP não pode lançar processo) | `--browserUrl` obrigatório | o MCP não consegue criar seu próprio sandbox Chrome dentro de um sandbox externo |
| Rodar headless | `--headless` | útil em CI |
| Perfil temporário (não reaproveitar entre execuções) | `--isolated` | limpa `user-data-dir` ao fechar |

`--autoConnect` (Chrome ≥144, pede permissão via diálogo) **não se aplica a
Electron** — é um recurso da UI do navegador Chrome real
(`chrome://inspect/#remote-debugging`), que o Chromium embutido do Electron
não expõe. Para Electron, o caminho é sempre manual via
`--browserUrl`/`--wsEndpoint`.

## Habilitando o CDP no Electron (o alvo, não o MCP)

O app precisa expor a porta de debug do Chromium embutido — isso é
configuração do **Electron**, não do MCP:

```ts
// main process — só em build de dev/staging, NUNCA em produção pública
if (process.env.ENABLE_DEVTOOLS_MCP === '1') {
  app.commandLine.appendSwitch('remote-debugging-port', '9492');
  // Chromium recente bloqueia por origem por padrão; sem isso, a conexão
  // do MCP pode ser rejeitada mesmo com a porta aberta:
  app.commandLine.appendSwitch('remote-allow-origins', '*');
}
```

Ou, para o binário empacotado, via linha de comando:
`LinkFatcher.exe --remote-debugging-port=9492 --remote-allow-origins=*`.

Depois, configurar o MCP apontando para essa porta:

```json
{
  "mcpServers": {
    "chrome-devtools-electron": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--browserUrl=http://127.0.0.1:9492"]
    }
  }
}
```

### Isso NÃO cobre o processo main

`--remote-debugging-port` expõe apenas os **renderers** (cada
`BrowserWindow`/`webContents` vira um "page" CDP, como se fosse uma aba).
Para inspecionar o **Node.js do processo main** (IPC handlers, updater,
filesystem), é um protocolo diferente:

```
electron --inspect=9229        # ou --inspect-brk para pausar na primeira linha
```

Conectado via `chrome://inspect` num Chrome real, ou um debugger Node
externo (VSCode, `node --inspect` client) — **não** pelo chrome-devtools-mcp,
que não fala o protocolo V8 Inspector standalone do Node fora de um
contexto de página. Nunca reportar uma métrica do main process como se
tivesse vindo de uma tool do chrome-devtools-mcp.

### Risco de segurança do próprio mecanismo de debug

Uma porta de remote debugging aberta é uma porta de controle total do
processo (equivalente a RCE se acessível remotamente) — nunca deixar
habilitada em build de produção distribuído a usuários finais. Ligar via
env var explícita (`ENABLE_DEVTOOLS_MCP`), nunca por padrão; bind em
`127.0.0.1`, nunca `0.0.0.0`; e nas Electron Fuses do build de produção,
`EnableNodeCliInspectArguments: false` bloqueia `--inspect` no binário
empacotado (ver skill `electron-security-architecture`,
`references/08-anti-tampering-debug.md`).

## Verificação de instalação (rodar sempre antes de auditar)

1. `list_pages` — deve retornar as janelas reais do app (título/URL
   correspondendo ao esperado), não uma página `about:blank` de um Chrome
   solto. Se vazio ou errado: a porta configurada não é a do app, ou o app
   não foi iniciado com o switch de debug.
2. `select_page` na janela principal.
3. `take_snapshot` — confirma que a árvore de acessibilidade retorna
   conteúdo real do app (não uma página em branco/erro).
4. `list_console_messages` — confirma que o app não está travado em erro
   de boot antes de prosseguir.
5. Diagnóstico manual (fora do MCP, via `curl`/navegador) se `list_pages`
   falhar: `http://127.0.0.1:<porta>/json/list` deve listar os targets CDP
   brutos — se isso falhar, o problema é na configuração do Electron
   (`remote-debugging-port`/`remote-allow-origins`), não do MCP.

## Múltiplas janelas, targets e sessões

- Cada `BrowserWindow` (incluindo janelas ocultas com `show:false`,
  popups, modais implementados como `BrowserWindow` separado) aparece como
  uma entrada de `list_pages`. Utility processes do Electron (API
  `utilityProcess`) e o processo main **não aparecem aqui** — são Node puro.
- `select_page`/`new_page`/`close_page` gerenciam o contexto ativo. Antes
  de qualquer ação dirigida, confirmar com `list_pages` qual página está
  selecionada — ações em janela errada invalidam a evidência coletada.
- Sessão "stale": se uma janela do app foi fechada e recriada (comum em
  Electron — várias apps recriam a janela principal em vez de reusar),
  `list_pages` deixa de listar o `pageId` antigo. Sempre re-chamar
  `list_pages` após qualquer ação que possa ter fechado/recriado janela,
  nunca reusar um `pageId` sem revalidar.
- Reiniciar sessão: se a conexão cair (app crashou, foi fechado), o MCP
  perde o `browserUrl`. Reabrir o app com o mesmo switch de porta restaura
  a conectividade — não requer reconfigurar o MCP se a porta é fixa.

## Inventário de ferramentas

Lista completa e oficial (fonte:
`github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md`).
Nunca assumir uma tool fora desta lista.

**Automação de input** — `click`, `click_at` (requer `--experimentalVision=true`),
`drag`, `fill`, `fill_form`, `handle_dialog`, `hover`, `press_key`,
`type_text`, `upload_file`.

**Navegação** — `list_pages`, `select_page`, `new_page`, `close_page`,
`navigate_page`, `wait_for`.

**Emulação** — `emulate` (CPU throttling, rede, viewport, geolocation,
color scheme, headers), `resize_page`.

**Performance** — `performance_start_trace`, `performance_stop_trace`,
`performance_analyze_insight`.

**Rede** — `list_network_requests`, `get_network_request`.

**Debug/diagnóstico** — `evaluate_script`, `list_console_messages`,
`get_console_message`, `take_screenshot`, `take_snapshot`,
`lighthouse_audit`, `screencast_start`/`screencast_stop` (requer
`--experimentalScreencast=true`).

**Memória** — `take_heapsnapshot`, `get_heapsnapshot_summary`,
`get_heapsnapshot_details`, `get_heapsnapshot_class_nodes`,
`get_heapsnapshot_retainers` (as últimas 4 requerem
`--experimentalMemory=true`).

**Extensões** (requer `--categoryExtensions=true`) — `install_extension`,
`list_extensions`, `reload_extension`, `trigger_extension_action`,
`uninstall_extension`. Pouco relevante para Electron (não tem
extensões de Chrome), relevante só se o app expõe uma superfície similar.

**Third-party / WebMCP** (requerem
`--categoryExperimentalThirdParty=true` / `--categoryExperimentalWebmcp=true`)
— tools que a própria página do app expõe, se o app implementar isso.

Flags relevantes para habilitar tudo isso numa auditoria completa:

```
npx chrome-devtools-mcp@latest \
  --browserUrl=http://127.0.0.1:9492 \
  --experimentalVision=true \
  --experimentalMemory=true \
  --experimentalScreencast=true \
  --performanceCrux=false
```

`--performanceCrux=false` desliga o envio de URLs para a CrUX API do
Google durante traces — desligar por padrão ao auditar um app desktop
(não faz sentido para um app que não é uma URL pública indexada, e evita
telemetria desnecessária).
