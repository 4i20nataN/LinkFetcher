# Enterprise Production Certification — Checklist

Modo "zero tolerância": a certificação não fecha como aprovada até cada
linha abaixo estar com evidência (ver `references/08`), não com
suposição. Toda linha reprovada ou pendente vira item do roadmap, não
motivo para inflar a nota.

| # | Critério | Evidência exigida | Confiança mínima para aprovar |
|---|---|---|---|
| 1 | Sem erro de console não tratado no boot | `list_console_messages` baseline limpo | Alta |
| 2 | Sem erro/degradação após bateria de stress test (`03`) | comparação console/screenshot antes-depois por cenário | Alta |
| 3 | Sem crescimento monotônico de heap em ciclos repetidos | 3+ snapshots (`05`) mostrando platô, não crescimento | Alta |
| 4 | Sem Long Task recorrente acima do limiar aceitável do app | trace de performance nas rotas críticas (`04`) | Média ou Alta |
| 5 | FPS estável sob CPU throttling nas interações-chave | trace com `emulate(cpuThrottlingRate)` | Média ou Alta |
| 6 | App sobrevive a rede offline/lenta sem crash | `emulate(networkConditions)` + stress (`03`) | Alta |
| 7 | `nodeIntegration`/Node global não vazam ao renderer | `evaluate_script` (`07`) | Alta |
| 8 | Superfície do preload mínima e congelada | `evaluate_script` (`07`) | Alta |
| 9 | CSP presente e sem violação nos cenários testados | headers + console (`07`) | Alta |
| 10 | Navegação para origem não autorizada bloqueada | teste dirigido (`07`) | Alta |
| 11 | Lighthouse (acessibilidade/boas práticas) sem reprovação crítica | `lighthouse_audit` | Alta |
| 12 | IPC medido não mostra latência/volume anômalo nas ações críticas | instrumentação (`06`), com ressalva de método | Média |
| 13 | Nenhuma otimização reportada sem par antes/depois medido | seção de evidência do relatório | Alta |

## Pontuação

- Cada linha "Alta" reprovada ou sem evidência suficiente: certificação
  **não pode fechar como aprovada** — vira "aprovado com ressalvas" na
  melhor hipótese, nunca "aprovado".
- Cada linha "Média" pendente: registrar como risco conhecido no roadmap,
  não bloqueia certificação sozinha, mas soma ao score de risco geral.
- Só atribuir certificação plena quando todas as linhas "Alta" estiverem
  com evidência Alta anexada (arquivo de trace/snapshot/screenshot real).
