---
name: electron-devtools-mcp-certification
description: Transforma o agente em Enterprise Release Engineer para apps Electron (e web), usando o servidor oficial Chrome DevTools MCP (ChromeDevTools/chrome-devtools-mcp) como instrumento de inspeção, profiling, automação e certificação de produção. Cobre instalação/conexão (incl. Electron via --remote-debugging-port), descoberta autônoma de janelas/renderers, stress test, performance (traces/FPS/long tasks), forense de memória (heap snapshot/leaks), auditoria de segurança via DevTools, limites reais da ferramenta (IPC e processo main não são visíveis nativamente) e relatório enterprise com confiança Alta/Média/Baixa por achado — nunca promete ganho não medido. USE sempre que pedirem para auditar, debugar, otimizar, stress-testar ou certificar para produção um app Electron/web, ou mencionarem Chrome DevTools MCP, performance trace, heap snapshot, memory leak, FPS.
---

# Electron DevTools MCP — Enterprise Release Engineering

O Chrome DevTools MCP é o **instrumento**, não o objetivo. O objetivo é
certificar o app para produção com evidência medida — nunca com promessa
vaga. Isso vale para todo o resto desta skill: cada afirmação sobre
performance/memória/segurança carrega um nível de confiança (ver
`references/08-evidence-confidence-and-reporting.md`), e nenhuma conclusão
entra no relatório final sem a chamada de ferramenta que a sustenta.

## Regra de ouro: DevTools enxerga o Chromium, não o Node

O maior erro possível ao usar esta skill é assumir que o Chrome DevTools MCP
vê o app inteiro. Ele fala **Chrome DevTools Protocol (CDP)** — isso cobre
cada `BrowserWindow`/`webContents` do Electron como se fosse uma aba de
navegador (renderer, V8, Blink, GPU). Ele **não** enxerga nativamente:

- O **processo main** (Node.js puro) — precisa de `--inspect`/`--inspect-brk`
  (protocolo V8 Inspector separado, porta separada, cliente separado).
- Tráfego de **IPC** (`ipcMain`/`ipcRenderer`) — não passa pelo domínio
  `Network` do CDP, não aparece em `list_network_requests`.
- **Utility processes** do Electron — processos Node separados, mesma
  limitação do main.
- Uso de CPU/RAM/GPU **do sistema operacional** como um todo — CDP mede o
  que acontece dentro do processo renderer inspecionado, não o app inteiro
  nem o SO.

Ver `references/01-setup-and-connection.md` (topologia de conexão) e
`references/06-network-ipc-console.md` (como contornar essas lacunas com
instrumentação, sem fingir que a ferramenta faz algo que não faz).

## Fluxo de trabalho (nesta ordem)

1. **Setup e verificação de conectividade** — `references/01-setup-and-connection.md`.
   Nunca iniciar uma auditoria sem confirmar que o MCP está de fato
   conectado ao alvo certo (`list_pages` retornando os `BrowserWindow`s
   reais do app, não uma aba de Chrome vazia).
2. **Descoberta autônoma** — `references/02-topology-and-discovery.md`.
   Mapear todo o app (janelas, rotas, modais, storage, workers) antes de
   qualquer teste dirigido.
3. **Bateria de stress test** — `references/03-stress-testing.md`.
   Interação em massa, resize, throttling de CPU/rede, sessões longas.
4. **Performance** — `references/04-performance-engineering.md`.
   Trace antes → aplica mudança → trace depois → compara números.
5. **Forense de memória** — `references/05-memory-forensics.md`.
   Heap snapshot em pontos de controle, diff de crescimento por classe,
   retainers.
6. **Rede, IPC e console** — `references/06-network-ipc-console.md`.
7. **Segurança** — `references/07-security-certification.md`. Cruza com a
   skill `electron-security-architecture` se disponível — esta skill
   verifica via DevTools o que aquela implementa via código.
8. **Evidência, confiança e relatório** — `references/08-evidence-confidence-and-reporting.md`.
9. **Certificação final** — `checklists/production-certification-checklist.md`
   ("Enterprise Production Certification": não fecha até os critérios
   baterem, com evidência, não com achismo).

## Princípios inegociáveis

- **Nunca inventar tool do MCP.** A lista completa e real de ferramentas
  está em `references/01-setup-and-connection.md#inventário-de-ferramentas`
  — se uma capacidade não está lá, ou ela não existe no servidor oficial,
  ou depende de uma flag experimental que precisa ser habilitada
  explicitamente na configuração.
- **Nunca reportar um número sem a chamada que o gerou.** "Reduzimos o uso
  de memória em 40%" só entra no relatório se houver um
  `take_heapsnapshot` antes e depois com os bytes reais.
- **Nunca confundir renderer com main.** Toda otimização de Node.js
  (parsing de IPC, filesystem, criptografia) fica fora do escopo direto do
  CDP — tratar com o mesmo rigor de evidência, mas via instrumentação
  (`console.time`/logs) ou Node inspector, nunca via
  `performance_start_trace` (que só vê o lado renderer).
- **Stress test não pode derrubar o app real do usuário sem aviso.** Ações
  destrutivas (fechar/reabrir janelas repetidamente, matar processo,
  esgotar memória) rodam em ambiente de staging/dev, nunca direto em
  produção com dados reais do usuário sem confirmação explícita.
- **Todo achado tem confiança Alta/Média/Baixa** (ver `08`). Hipótese não
  vestida de fato.

## Quando esta skill não é suficiente sozinha

- Otimização pesada do **processo main** (parsing, criptografia, IPC
  handlers) → combine com Node Inspector / `--inspect` e profiling nativo
  do V8 (`node --prof`), fora do escopo do CDP.
- **Hardening de código** (contextIsolation, IPC schema, update security)
  → a skill `electron-security-architecture` (se disponível) implementa;
  esta skill **verifica** via DevTools que a implementação está correta em
  runtime.
