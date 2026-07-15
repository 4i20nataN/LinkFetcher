# 05 — Forense de Memória

## Escopo real: heap JS do renderer selecionado, só isso

`take_heapsnapshot` captura o heap de **JavaScript do renderer
atualmente selecionado** (V8 heap). Isso não inclui: memória nativa
(buffers do Node, alocações C++ do Chromium/GPU), heap do processo main,
nem memória de outros renderers não selecionados. Para uma visão completa
de RAM do app inteiro, combine com métricas do próprio Electron
(`app.getAppMetrics()`, expõe RSS/CPU por processo — não é uma tool do
MCP, é código a rodar no processo main do app, relatar como fonte
separada).

## Ferramentas

- `take_heapsnapshot(filePath)` — salva um `.heapsnapshot`.
- `get_heapsnapshot_summary(filePath)` — estatísticas agregadas (requer
  `--experimentalMemory=true`).
- `get_heapsnapshot_details(filePath, pageIdx?, pageSize?)` — detalhes
  paginados por classe/tipo de nó.
- `get_heapsnapshot_class_nodes(filePath, id, ...)` — instâncias de uma
  classe específica com seus IDs de nó.
- `get_heapsnapshot_retainers(filePath, nodeId, ...)` — cadeia de
  retenção de um nó específico (**a ferramenta mais importante para achar
  a causa raiz de um leak** — responde "quem está segurando essa
  referência viva").

## Protocolo de investigação de leak

1. Snapshot A: baseline, logo após boot estável.
2. Executar N ciclos do cenário suspeito (ex.: abrir/fechar um modal 20x,
   trocar de rota 20x, processar 20 downloads).
3. Forçar GC se a página expuser um gatilho (via `evaluate_script`
   chamando `window.gc?.()` se o app rodar com `--js-flags=--expose-gc`
   em dev; caso contrário, aguardar um intervalo e aceitar que o
   resultado inclui alguma margem de objetos ainda não coletados —
   registrar isso como limitação da medição, não ocultar).
4. Snapshot B.
5. `get_heapsnapshot_summary` de A e B — cresceu no total? Por quanto?
6. `get_heapsnapshot_details` de B, ordenado/paginado por tamanho
   retido — identificar as classes que mais cresceram entre A e B (diff
   manual entre os dois summaries/details, já que a tool não faz diff
   automático).
7. `get_heapsnapshot_class_nodes` na classe suspeita → pega os `nodeId`s.
8. `get_heapsnapshot_retainers` em alguns desses nós → identifica se são
   retidos por: listener de evento nunca removido, closure de callback de
   IPC, entrada de cache/Map que nunca expira, nó de DOM destacado
   (`Detached HTMLDivElement` etc.) ainda referenciado.
9. Repetir o ciclo mais uma vez (Snapshot C) — só é "leak confirmado
   com confiança Alta" se o crescimento for **monotônico e proporcional**
   ao número de ciclos (A < B < C na mesma classe suspeita), não um
   platô natural de cache com limite.

## Padrões clássicos a procurar

- **Listener não removido**: handler passado para `addEventListener`/
  `ipcRenderer.on` sem `removeEventListener`/`removeListener`
  correspondente ao desmontar um componente/fechar uma view.
- **DOM destacado retido**: elemento removido da árvore mas ainda
  referenciado por uma closure/array/cache — aparece como
  `Detached <TagName>` no heap com retainers levando a uma variável viva.
- **Cache sem limite** (Map/Array crescendo sem TTL/tamanho máximo).
- **Promise pendurada**: promise nunca resolvida/rejeitada mantendo vivo
  todo o closure que a criou — comum em chamadas de IPC sem timeout (ver
  `references/02-preload-ipc.md` da skill de segurança, mesmo problema
  visto pelo ângulo de memória agora).

## Nunca

- Concluir "leak" a partir de uma única comparação de snapshot sem um
  terceiro ponto confirmando a tendência.
- Atribuir crescimento de heap a uma causa sem seguir a cadeia de
  `get_heapsnapshot_retainers` até uma variável/objeto identificável —
  "parece vazamento" não é diagnóstico, é hipótese (confiança Baixa até
  ter o retainer).
