# 08 — Evidência, Nível de Confiança e Relatório Enterprise

Requisito mais importante de toda esta skill: **nenhuma conclusão sem a
evidência que a gerou, e toda conclusão carrega um nível de confiança
explícito.**

## Classificação de confiança

| Nível | Critério | Exemplo |
|---|---|---|
| **Alta** | Medido, reproduzido ≥2 vezes, com números de antes/depois na mesma condição | Heap cresceu de 40MB → 78MB → 116MB em 3 ciclos idênticos, retainer identificado via `get_heapsnapshot_retainers` |
| **Média** | Medido uma vez, ou padrão reconhecido mas sem reprodução múltipla | Um trace mostrou 1 Long Task de 300ms; não repetido ainda |
| **Baixa** | Hipótese a partir de padrão de código/heurística, sem medição direta | "Esse padrão de listener costuma vazar" sem heap snapshot confirmando |

Nunca promover Baixa/Média para Alta sem a medição correspondente. Nunca
omitir o nível — toda linha do relatório final que afirma um problema ou
um ganho vem etiquetada.

## Distinguir três categorias de achado

1. **Problema comprovado** — evidência de tool, reproduzido.
2. **Hipótese** — padrão observado, mecanismo plausível, sem confirmação
   completa (ex.: retainer aponta para um Map crescendo, mas não foi
   testado se ele eventualmente estabiliza sob uso normal).
3. **Oportunidade de melhoria** — nenhum problema hoje, mas prática abaixo
   do ideal (ex.: bundle poderia ser menor com code-splitting, mas o
   tempo de load atual já está dentro do aceitável).

## Estrutura do relatório final

1. **Resumo executivo** — 3–5 frases, decisão de deploy (certificar,
   certificar com ressalvas, não certificar) e por quê.
2. **Visão geral da arquitetura** — janelas/renderers mapeados (`02`).
3. **Análise de performance** — traces citados, métricas com
   antes/depois, confiança de cada.
4. **Análise de memória** — snapshots citados (nome/timestamp de cada
   `.heapsnapshot`), crescimento por classe, retainers.
5. **Análise de renderização/GPU** — jank, long tasks, composite cost.
6. **Análise de IPC** — método de instrumentação usado (`06`), números
   coletados, com a ressalva de que não vêm da tool nativa de rede.
7. **Análise de segurança** — resultado de `07`, cruzado com o checklist
   da skill `electron-security-architecture` se disponível.
8. **Acessibilidade** — resultado de `lighthouse_audit`/`take_snapshot`.
9. **Resultados de stress test** — tabela cenário → resultado → confiança
   (usar a matriz de `03` como esqueleto).
10. **Production Readiness Score** e **Electron Compliance Score** — nota
    justificada item a item (não um número solto), seguindo o mesmo
    espírito de pontuação do `checklists/production-certification-checklist.md`.
11. **Evidência anexada** — screenshots, traces (`.json`/`.json.gz`),
    heap snapshots (`.heapsnapshot`), paths de arquivo de cada um —
    nunca só descrição textual quando o arquivo bruto existe.
12. **Comparação antes/depois** — só as métricas que de fato têm os dois
    lados medidos; se só existe "depois", declarar explicitamente que não
    há baseline, não estimar um "antes" hipotético.
13. **Ganhos realistas** (performance/memória/CPU/GPU/startup) — cada
    número com confiança e método.
14. **Roadmap de otimização e dívida técnica** — o que ficou como
    hipótese/oportunidade, não corrigido nesta rodada.
15. **Riscos futuros e recomendação de deploy**.

## Regra de fechamento

Se uma seção não tem evidência suficiente para uma afirmação forte,
a seção diz isso explicitamente ("não foi possível medir X nesta rodada
porque Y") em vez de preencher com uma estimativa apresentada como fato.
