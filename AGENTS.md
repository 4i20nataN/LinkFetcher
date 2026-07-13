# AGENTS.md — LinkFetcher Project

> **Guia obrigatório para qualquer agente de IA operando neste repositório.**
> Leia **completo** antes de fazer qualquer alteração.

---

## 1. Visão Rápida do Projeto

| Item | Valor |
|------|-------|
| **Nome** | LinkFetcher |
| **Tipo** | Desktop app (Electron) + Web fallback |
| **Core** | yt-dlp + ffmpeg (binários bundled) |
| **Stack** | React 19 + TypeScript + Vite 6 + Tailwind 4 + Electron 37 |
| **Package Manager** | npm |
| **Branch principal** | `main` |
| **Branch atual** | `feat/electron-web-version` |

**Arquitetura**: Dual-mode — Electron (IPC) em produção, Express + SSE em dev/fallback. Camada de transporte única: `YtDlpAdapter`.

---

## 2. Documentação de Referência (LEIA ESTES ARQUIVOS)

| Arquivo | Propósito | Quando Consultar |
|---------|-----------|------------------|
| `docs/architecture.md` | Stack, fluxos de dados, diagrama Mermaid, decisões críticas | Antes de qualquer mudança arquitetural |
| `docs/rules.md` | **Regras invariantes (NON-NEGOTIABLE)** — binários, IPC, engine, build | **SEMPRE** — antes de editar código |
| `docs/context-map.md` | Mapa arquivo→responsabilidade, pontos de telemetria, entry points por tarefa | Para achar onde mexer |
| `docs/design-system.md` | Sistema visual, componentes, motion, padrões obsoletos | Antes de tocar UI |
| `docs/setup-deployment.md` | Dev env, build pipeline, electron-builder config, CI/CD | Para build/teste/deploy |

> **Regra**: Não invente — consulte a doc. Se a doc não cobre, pergunte antes de assumir.

---

## 3. Regras de Personalidade do Agente

### 3.1 Como Operar

| Princípio | Aplicação |
|-----------|-----------|
| **Precisão > Velocidade** | Leia os arquivos reais antes de editar. `grep`/`read` > `guess`. |
| **Contexto Mínimo** | Leia apenas o necessário. Use `context-map.md` para achar o arquivo certo. |
| **Commits Atômicos** | Uma mudança lógica = um commit. Mensagens no padrão Conventional Commits. |
| **Zero Assumptions** | Se não tem certeza se algo é legado ou intencional, pergunte. |
| **Respeite Invariantes** | `rules.md` lista o que **nunca** quebrar. Violação = rollback imediato. |

### 3.2 Estilo de Comunicação

- **Idioma obrigatório: Português (PT-BR)** — o usuário **só fala português**. Responda **sempre em português**.
- Direto, técnico, sem floreios
- Use **tabelas** para comparações, **listas** para passos, **código** para exemplos
- Destaque termos-chave em **negrito** para ancoragem RAG
- Se houver trade-off, apresente **opções + recomendação** em 3 linhas máx.

### 3.3 O Que NÃO Fazer

| ❌ Proibido | ✅ Correto |
|-------------|-----------|
| Editar sem ler o arquivo original | `read` → analisar → `edit` |
| Assumir que `server.ts` é só dev | É fallback web — mantido intencionalmente |
| Baixar yt-dlp em runtime | **Proibido** — binários vêm em `electron/resources/` |
| Adicionar IPC sem atualizar `preload.cjs` + `global.d.ts` | Atualize os 3 juntos |
| Committar binários ou `release/` | Estão no `.gitignore` |
| Mudar `FormatSelector` sem atualizar `FormatOptions` + `buildArgs` | Contrato UI→Engine é tipado |

---

## 4. Fluxo de Trabalho Padrão

```
1. LEIA: docs/rules.md (invariant check)
2. LOCALIZE: docs/context-map.md → "Entry Points by Task"
3. ENTENDA: docs/architecture.md → fluxo relevante
4. IMPLEMENTE: edite arquivos mínimos necessários
5. VALIDE: npm run lint + npm run build
6. COMMIT: mensagem Conventional Commits
```

### Exemplo de Commit Message

```
feat(download): adiciona suporte a SponsorBlock no FormatSelector

- FormatSelector: grid SponsorBlock (Off/Sponsor/Intro+Outro/All)
- types.ts: sponsorblockRemove em FormatOptions
- YtDlpManager.buildArgs: mapeia para --sponsorblock-remove
- DownloadEngine: passa opção no spawnDownload
```

---

## 5. Estrutura de Arquivos Críticos

```
LinkFetcher/
├── electron/
│   ├── main.cjs          # Main process — IPC handlers, binary resolution
│   ├── preload.cjs       # ContextBridge — invoke/on/off ONLY
│   └── resources/        # yt-dlp.exe, ffmpeg.exe (gitignored)
├── scripts/
│   ├── prepare-resources.cjs   # Copia binários → electron/resources/
│   └── electron-dev.cjs        # Dev: Vite + Electron together
├── src/
│   ├── core/
│   │   ├── engine/DownloadEngine.ts      # Queue, persistence, IPC/SSE bridge
│   │   ├── ytdlp/YtDlpManager.ts         # Binary resolution, spawn, buildArgs
│   │   ├── ytdlp/YtDlpAdapter.ts         # Transport abstraction (IPC ↔ HTTP)
│   │   └── plugins/Providers.ts          # MediaInfo extraction from yt-dlp JSON
│   ├── features/
│   │   ├── analyzer/LinkAnalyzer.tsx     # URL → probe → FormatSelector
│   │   ├── downloads/FormatSelector.tsx  # **Most complex UI** — tabs Media/Advanced
│   │   ├── youtube/YouTubeSearch.tsx     # Search via yt-dlp flat-playlist
│   │   └── settings/SettingsView.tsx     # Config + yt-dlp status
│   ├── context/AppContext.tsx            # Global state (settings, queue, theme)
│   ├── types.ts                          # **Single source of truth** — all interfaces
│   └── global.d.ts                       # window.electron types
├── docs/
│   ├── architecture.md
│   ├── rules.md
│   ├── context-map.md
│   ├── design-system.md
│   └── setup-deployment.md
├── package.json                          # build.directories.output = "release"
├── vite.config.ts                        # base: './' (critical for file://)
└── .gitignore                            # Ignores release/, electron/resources/, .cache/, yt-dlp/
```

---

## 6. Invariantes Técnicos (Resumo de `rules.md`)

| Área | Regra Crítica |
|------|---------------|
| **Binários** | Nunca auto-download em produção. `ensureYtDlp()` lança erro se faltar. |
| **Transporte** | `YtDlpAdapter` = Electron-first → HTTP fallback. Payloads idênticos. |
| **Engine** | `DownloadEngine` = single source of truth. Persiste em `localStorage['linkfetcher-state']`. |
| **Formato** | UI **nunca** monta args yt-dlp. `FormatSelector` → `FormatOptions` → `YtDlpManager.buildArgs()`. |
| **IPC** | Apenas `invoke/on/off` no preload. `contextIsolation: true`, `nodeIntegration: false`. |
| **Build** | `vite.config.ts: base: './'` obrigatório. Output em `release/` via `electron-builder`. |
| **Settings** | Persistem em `localStorage['linkfetcher-*']`. Nunca secrets. |

---

## 7. Tarefas Comuns — Onde Mexer

| Tarefa | Arquivos (ordem) |
|--------|------------------|
| Nova opção de download | `types.ts` → `FormatSelector.tsx` → `YtDlpManager.buildArgs()` → `DownloadEngine` |
| Novo provider (site) | `Providers.ts` → nova classe `MediaProvider` |
| Novo canal IPC | `main.cjs` → `preload.cjs` → `global.d.ts` → `YtDlpAdapter` |
| Novo setting | `types.ts` (AppSettings) → `AppContext.tsx` → `SettingsView.tsx` |
| Ajuste visual | `design-system.md` → componente alvo + `index.css` se novo token |
| Debug download travado | `DownloadEngine.startYtDlpDownload()` → branch IPC vs SSE → progress handler |

---

## 8. Comandos Úteis

```bash
# Dev (Electron + Vite)
npm run electron:dev

# Build completo + installer
npm run prepare:resources && npm run package:win

# Apenas build (sem installer)
npm run build

# Lint / TypeCheck
npm run lint

# Limpar artifacts
npm run clean
```

---

## 9. Checklist Pré-Commit

- [ ] `npm run lint` passa (TypeScript strict)
- [ ] `npm run build` gera `dist/` sem erros
- [ ] Não committou binários (`electron/resources/*.exe`, `release/`)
- [ ] Mensagem de commit no padrão Conventional Commits
- [ ] Se mexeu em IPC: atualizou `preload.cjs` + `global.d.ts`
- [ ] Se mexeu em formato: atualizou `types.ts` + `buildArgs` + `FormatSelector`
- [ ] Se mexeu em UI: seguiu `design-system.md` (cores, spacing, motion)

---

## 10. Contato / Escalação

Se a documentação não cobre o caso, ou há ambiguidade nas regras:
**Pare. Pergunte ao humano.** Não assuma.

---

*Este arquivo vive na raiz do projeto. Atualize quando houver mudança estrutural.*
---

## 11. 🛡️ HARNESS SYSTEM: RETROSPECTIVE ANTI-LOOP & SELF-CORRECTION

To optimize performance, prevent token draining (Input/Output thresholds), and eliminate redundant code rewriting, you must operate under a strict Retrospective Self-Correction workflow.

### 1. Loop Prevention & Redundant Rewrite Guardrails
*   **Zero-Redundancy Rule:** Before modifying, rewriting, or regenerating any file (e.g., Electron main/preload scripts, server components), you MUST verify if the modification is structurally strictly necessary. Do not rewrite whole codeblocks for minor tweaks.
*   **Command Fail-Safe:** If a terminal command, build script, or execution fails on the first attempt, DO NOT execute the exact same command or variations of it more than twice. If it fails twice, stop immediately and pivot the technical strategy.

### 2. Retrospective Learning Cache (Dynamic Heuristics)
*   **Error Abstraction:** Every time a decision, path, library, or command yields an unexpected result, error, or syntax mismatch, you must treat this as a "Local Edge Case" rather than an absolute rule.
*   **Context-Aware Diagnostics:** Absorb the failure immediately. Analyze *why* the path failed (e.g., outdated documentation, breaking changes in packages, missing TypeScript language server mapping) and calculate the shortest alternative route.
*   **Dynamic Adaptation:** For all subsequent steps within this session, use this learned failure to bypass obsolete patterns. Do not hallucinate or attempt documented pathways that your live terminal testing has already proven to be incorrect or incompatible with the current project state.

---

## 12. 🎯 AGENT OPERATING PROTOCOL: FOCUSED FIX & RETROSPECTIVE REPORTING

**MANDATORY WORKFLOW FOR ALL TASKS:**

1.  **ANALYZE FIRST** — Before making any changes, fully explore the codebase to understand the complete context, data flows, and root causes. Map the entire affected surface area.
2.  **MINIMAL SURGERY** — Only modify files directly related to the reported issue. Do NOT refactor unrelated code, reformat files, or "improve" things outside the scope.
3.  **VERIFY THE FIX** — Run lint, type-check, and build to confirm the specific issue is resolved without regressions.
4.  **RETROSPECTIVE REPORT** — At completion, you MUST provide:
    *   ✅ **Result**: What was fixed (specific to the user's request)
    *   🔍 **Observations**: What else you noticed during analysis (related or unrelated)
    *   ⚠️ **Alerts**: Technical debt, bugs, or risks discovered but not fixed
    *   💡 **Suggestions**: Actionable next steps or improvements for future work

This protocol prevents scope creep, ensures accountability, and builds a knowledge base for continuous improvement.
