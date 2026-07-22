# AGENTS.md — LinkFetcher Project

> **Diretiva de Execução:** Este arquivo define as restrições mecânicas de operação no repositório. O idioma obrigatório para toda comunicação e documentação é Português (PT-BR). Seja direto, técnico e elimine saudações ou introduções conversacionais.

---

## 1. Mapeamento Técnico de Contexto

| Item | Valor Técnico / Especificação |
|------|-------------------------------|
| **Nome** | LinkFetcher |
| **Tipo** | Desktop App (Electron 37) + Web Fallback (Express + SSE em dev) |
| **Core Engine** | yt-dlp + ffmpeg (Binários locais embarcados em `electron/resources/`) |
| **Stack** | React 19 + TypeScript (Strict) + Vite 6 + Tailwind 4 |
| **Transporte** | Camada abstrata única via YtDlpAdapter (IPC ↔ HTTP JSON payloads idênticos) |
| **Branch Atual** | `feat/electron-web-version` |

---

## 2. Grafo de Documentação do Repositório

Antes de propor alterações ou debugar, você deve ler o arquivo correspondente ao escopo da tarefa na árvore abaixo:

```
[Raiz] ──> AGENTS.md (Protocolo de Operação e Comportamento)
            ├── docs/rules.md              ──> Invariantes técnicas (Binários, IPC)
            ├── docs/architecture.md       ──> Fluxo de dados e arquitetura da Engine
            ├── docs/context-map.md        ──> Mapa de responsabilidade de cada arquivo
            ├── docs/design-system.md      ──> Cores, spacing e componentes (Tailwind 4)
            ├── docs/setup-deployment.md   ──> Pipeline de Build e electron-builder
            ├── docs/known-bugs.md         ──> Histórico de falhas conhecidas e soluções
            ├── docs/download-flow-trace.md──> Rastreamento do ciclo de vida do download
            └── docs/yt-dlp-reference.md   ──> Parâmetros e flags oficiais do yt-dlp
```

---

## 3. Estilo de Comunicação e Resposta

- **Direto ao Ponto:** Elimine desculpas, confirmações polidas ("Com certeza", "Entendido") ou introduções. Vá direto para a solução ou dados.
- **Ancoragem Visual:** Use negrito estritamente para destacar o nome de funções, tipagens, componentes ou arquivos alvos da edição.
- **Apresentação de Trade-offs:** Se houver mais de uma solução técnica, apresente no formato: **Opção A vs Opção B** | Recomendação em no máximo 3 linhas.

---

## 4. Matriz de Comportamentos Proibidos (Bloqueios Mecânicos)

| ❌ AÇÃO PROIBIDA | ✅ COMPORTAMENTO CORRETO |
|-------------------|--------------------------|
| Executar scripts de build ou empacotamento (`npm run build`, `package:win`) | Rodar apenas testes locais e checagem de tipos (`npm run lint`), build só sob ordem explícita. |
| Escrever comandos, scripts ou caminhos de arquivo no formato WSL (`/d/`) | Usar caminhos nativos do Windows (`D:/...`) para compatibilidade com o compilador `tsc`. |
| Gerar commits automáticos no repositório | Realizar edições no workspace e aguardar o comando de commit do usuário. |
| Refatorar código funcional adjacente por estética | Aplicar a alteração unicamente no escopo restrito do problema reportado. |
| Montar strings de argumentos do yt-dlp na camada de UI | Alterar apenas `FormatOptions` em `types.ts`. A conversão para string ocorre em `YtDlpManager.buildArgs()`. |
| Repetir comandos idênticos que falharam no terminal | Falhou 2 vezes seguidas? Pare a execução, mude a abordagem técnica ou pergunte ao usuário. |
| Implementar ou corrigir features diretamente na versão Web antes do Desktop | Toda feature/fix deve funcionar perfeito na versão **Electron Desktop** primeiro, e só depois ser adaptada para a versão **Web (Express + SSE)**. |

---

## 5. Pipeline de Edição Cirúrgica

Siga rigidamente estes passos para qualquer alteração de código:

1. **Ler:** Use a ferramenta de leitura para carregar o arquivo alvo completo. Não adivinhe assinaturas de funções.
2. **Localizar:** Consulte `docs/context-map.md` para identificar impactos colaterais nos arquivos dependentes.
3. **Declarar:** Escreva no chat: *"Modificando função X no arquivo Y, linha Z. Prosseguindo."* antes de editar.
4. **Editar:** Substitua apenas o bloco exato de código necessário, mantendo o restante do arquivo intacto.

---

## 6. Dicionário de Entrada por Tarefa

| Caso de Uso / Feature | Fluxo de Arquivos (Ordem Estrita de Modificação) |
|------------------------|--------------------------------------------------|
| Nova opção de mídia/download | `src/types.ts` → `FormatSelector.tsx` → `YtDlpManager.buildArgs()` → `DownloadEngine.ts` |
| Novo Endpoint/Canal IPC | `electron/main.cjs` → `electron/preload.cjs` → `src/global.d.ts` → `YtDlpAdapter.ts` |
| Persistência / Estado | `src/context/AppContext.tsx` (Chave: `localStorage['linkfetcher-*']`) → `SettingsView.tsx` |
| Extração de Dados/Streaming | `src/core/plugins/Providers.ts` → Processamento do JSON nativo do yt-dlp |

---

## 7. 🛠️ DEBUG PROTOCOL & TRATAMENTO DE ERROS

Quando um bug for reportado ou um comando falhar, aplique este procedimento em vez de tentar correções aleatórias:

1. **Diagnóstico Inicial:** Execute `npm run lint` ou checagem de tipos via compilador para isolar o erro de sintaxe.
2. **Leitura de Erro Completa:** Se o `tsc` ou o processo falhar, leia o log de erro completo gerado no terminal. Não tente adivinhar a correção com base apenas na primeira linha do erro.
3. **Consulta ao Histórico:** Verifique o arquivo `docs/known-bugs.md` para garantir que a falha atual não é um problema recorrente ou já solucionado anteriormente.
4. **Validação do Fluxo:** Abra o arquivo `docs/download-flow-trace.md` se o problema envolver progresso, travamento ou quebra no ciclo de vida de downloads.

---

## 8. 🤖 PROTOCOLO DE SUB-AGENTS (SPAWN MECÂNICO)

Se a sua ferramenta permitir a criação de sub-agentes ou tarefas em background, utilize o recurso apenas sob as seguintes condições:

- **Critério de Uso:** A tarefa exige alterações em arquivos de camadas totalmente separadas (ex: sincronizar `main.cjs` e `FormatSelector.tsx`) ou exige processamento isolado de logs longos.
- **Prompt de Inicialização Obrigatório:** O sub-agente criado deve receber esta instrução exata no topo do prompt:

  > *"Você é um sub-agente focado em tarefa atômica. Regras estritas: Idioma obrigatório Português (PT-BR), caminhos nativos Windows (não use WSL), alteração estrita apenas no arquivo designado pelo agente principal, sem refatorações adjacentes."*

- **Restrição de Escrita:** Sub-agentes não possuem autorização para executar comandos globais como `git commit` ou alterar arquivos de configuração como `package.json`.
- **Validação de Saída:** O agente principal deve inspecionar o código retornado pelo sub-agente antes de mesclá-lo, garantindo o cumprimento da Seção 4 (Matriz de Proibições).

---

## 9. RELATÓRIO RETROSPECTIVO OBRIGATÓRIO

Ao finalizar a tarefa, execute `npm run lint` localmente para verificar a integridade das tipagens. Em seguida, envie um relatório final estruturado exatamente sob este formato:

```
✅ RESULTADO: O que foi modificado e corrigido (focado estritamente no pedido do usuário).
🔍 OBSERVAÇÕES: Comportamentos incomuns ou inconsistências encontradas no código durante a análise da tarefa.
⚠️ ALERTAS: Débitos técnicos, potenciais falhas de concorrência ou riscos identificados no fluxo que ficaram intactos por estarem fora do escopo.
💡 SUGESTÕES: Próximas ações recomendadas para melhoria contínua da arquitetura.
```

---

## 10. LIMPEZA E BUILD CORRETO

**NUNCA** rode `package:win` sem limpar antes — o asar fica stale e o app abre tela branca.

```powershell
# 1. Limpar tudo
Remove-Item -Recurse -Force dist, dist-web, release -ErrorAction SilentlyContinue

# 2. Build + Package
npm run build && npx electron-builder --win
```

O `npm run build` gera `dist-web/` (Vite) e `dist/electron/` (esbuild). O `electron-builder` empacota no asar. Se pular a limpeza, arquivos antigos com hashes diferentes ficam no asar e o Electron não encontra o `index.html`.

---

## 11. ATUALIZAÇÃO DO SESSION LOG

Ao concluir cada sessão de trabalho, adicione uma entrada resumida em **docs/session-log.md** sob a data corrente. Cada entrada deve conter:

- **Commit/Change tag** (ex: `fix(desc): ...` ou `...` para trabalho em andamento)
- **Descrição curta** (1-2 linhas) explicando o que foi feito e como
- Foco em mudanças significativas, não em cada pequeno ajuste

Exemplo de formato:

```markdown
## 2026-07-15 (feat/ui-redesign)

- `d83c5d7` fix(desc): spacing and 'Nenhuma' option for description format
  - Added 'none' default to `descFormat`; SummaryPanel only shows tag when txt/md selected
```
