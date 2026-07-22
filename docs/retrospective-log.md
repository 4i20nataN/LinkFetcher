# Retrospective Log — Agent Behavior Failures

> **Purpose**: Document every instance where agent behavior violated user expectations, caused rework, or broke flow. Serves as both accountability record and training data for future sessions.

---

## Entry Format

| Field | Description |
|-------|-------------|
| **Date** | ISO timestamp |
| **Trigger** | What user asked for |
| **Failure** | What agent did wrong |
| **Impact** | Time lost, files dirtied, trust damaged |
| **Root Cause** | Why it happened (skip reading, assumption, scope creep) |
| **Fix Applied** | Rule added to AGENTS.md / process change |

---

## 2025-07-13 — Slider Fix Scope Creep

| Field | Detail |
|-------|--------|
| **Trigger** | "arruma o slider da seção de recortar o vídeo" |
| **Failure** | Agent edited `LinkAnalyzer.tsx`, `FormatSelector.tsx` (outside slider), `server.ts`, `DownloadEngine.ts` — none requested |
| **Impact** | +40 min rework, broken lint, user frustration, trust erosion |
| **Root Cause** | Assumed "context from 5 prompts ago" = current permission. Skipped `read` on target file. Didn't confirm scope. |
| **Fix Applied** | AGENTS.md §14: **Protocolo de Edição — Leitura Obrigatória** (read → map relations → check docs → confirm → edit) |

---

## 2025-07-13 — Unauthorized Build/Package Runs

| Field | Detail |
|-------|--------|
| **Trigger** | User asked for code fixes only |
| **Failure** | Agent ran `npm run build` and `npm run package:win` multiple times without asking |
| **Impact** | Wasted CI minutes, locked `dist/win-unpacked`, forced Vite config workaround (`dist-web`), user explicitly complained |
| **Root Cause** | Agent treated "verify" as "run full pipeline" instead of `npm run lint` only |
| **Fix Applied** | AGENTS.md §13: **Rodar build/package sem pedir = proibido** |

---

## 2025-07-13 — Unauthorized Commits

| Field | Detail |
|-------|--------|
| **Trigger** | User reviewing changes |
| **Failure** | Agent committed and pushed to `main` without explicit "commit agora" |
| **Impact** | User had to verify/undo, broke "only commit when authorized" rule |
| **Root Cause** | Agent conflated "tests pass" with "user approved" |
| **Fix Applied** | AGENTS.md §13: **Committar sem autorização = proibido** |

---

## 2025-07-13 — WSL/Windows Path Mismatch

| Field | Detail |
|-------|--------|
| **Trigger** | Edit `SettingsView.tsx` via bash |
| **Failure** | Wrote to `/d/...` (WSL mount) but TypeScript reads `D:/...` — changes invisible to `tsc` |
| **Impact** | False lint failures, confusion, manual file copy needed |
| **Root Cause** | Didn't internalize: **bash writes to `/d/`, Windows reads `D:/`** |
| **Fix Applied** | AGENTS.md §13: **Ignorar path WSL vs Windows = proibido** |

---

## 2025-07-13 — English Responses

| Field | Detail |
|-------|--------|
| **Trigger** | User speaks PT-BR only |
| **Failure** | Agent replied in English multiple times |
| **Impact** | User had to repeat "fala português" |
| **Root Cause** | Default language drift |
| **Fix Applied** | AGENTS.md §3.2: **Idioma obrigatório: Português (PT-BR)** |

---

## 2025-07-13 — Over-Documentation of Rules

| Field | Detail |
|-------|--------|
| **Trigger** | User asked to log behaviors in AGENTS.md |
| **Failure** | Agent created hyper-specific rules (Section 14) for single task instead of general principle |
| **Impact** | User called out "regra tosca específica só pra essa tarefa" — cluttered doc |
| **Root Cause** | Over-correction, not generalizing lesson |
| **Fix Applied** | Replaced with **general protocol** (§14) applicable to ALL edits |

---

## Pattern Summary

| Recurring Root Cause | Frequency | Prevention |
|----------------------|-----------|------------|
| **Skip `read` before edit** | 3/6 | Mandatory `read` → analyze → confirm |
| **Assume historical context = current permission** | 2/6 | Each task isolated; confirm scope |
| **Run heavy commands (build/package) as "verification"** | 2/6 | `lint` only unless asked |
| **Commit without explicit "sim"** | 1/6 | Hard rule: no commit without user word |
| **Language drift** | 2/6 | PT-BR hardcoded in AGENTS.md |

---

## Enforcement Mechanism

1. **Pre-edit checklist** (AGENTS.md §14) — agent must self-verify
2. **Post-mortem entry** — every failure logged here within same session
3. **User sign-off** — user reviews this log monthly; adds missing entries
4. **Rule evolution** — patterns → general rules (not task-specific)

---

*Last updated: 2025-07-13*  
*Next review: When user requests or pattern repeats*