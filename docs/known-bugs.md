# Known Bugs — LinkFetcher

> Status: 2025-07-13
> Contexto: Análise após agente anterior quebrou funcionalidade de download

## 🔴 Bugs Críticos (quebram funcionalidade)

### BUG-000: Download nunca baixa nada no Android (Capacitor) — NÃO RESOLVIDO
- **Arquivo**: `android/app/src/main/java/com/linkfetcher/app/YtDlpPlugin.kt`
- **Linha**: ~287-315 (opções + execute)
- **Sintoma**: Probe/análise funciona (retorna formatos corretamente). Card de download aparece na fila, progresso fica em 0% por ~8s, depois muda para "Falhou" com mensagem "Download concluído mas nenhum arquivo encontrado".
- **Diagnóstico (via adb logcat com --verbose)**: yt-dlp roda, extrai URL, baixa webpage, baixa android player API JSON, encontra e ordena formatos... mas **nunca seleciona formato nem inicia download**. Exit code = 0, mas nenhum arquivo gerado. Stdout = 4 linhas apenas (sem nenhuma linha `[download]`). Stderr = 2226 chars de debug (`--verbose`).
- **Causa raiz provável (2 hipóteses)**:
  1. **Opções sem valor deslocam o parser do yt-dlp**: `--download-sections` e `--sponsorblock-remove` aparecem na cmdline SEM VALOR. yt-dlp pode estar consumindo o próximo `--flag` como valor do anterior, quebrando silenciosamente o parsing.
  2. **Format selector incompatível com player_client=android**: `bv*[vcodec~=h264][height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]` pode não corresponder a nenhum formato do player android.
- **Fix provável**: (1) `call.getString("downloadSections")?.takeIf { it.isNotBlank() }` no Kotlin para não enviar opções vazias. (2) Usar `bestvideo+bestaudio/best` temporariamente para isolar.
- **Estado**: `--verbose` adicionado para debug, chunked logging de stderr (3000/chunk) implementado. Exit code capture compilando e rodando. **Próximo agente deve isolar e corrigir.**
- **Arquivos afetados**: `YtDlpPlugin.kt` (linhas 287-315), `DownloadEngine.ts` (linhas 496-497), `FormatSelector.tsx`

### BUG-001: bandLimit não mapeado de FormatOptions para DownloadItem
- **Arquivo**: `src/core/engine/DownloadEngine.ts`
- **Linha**: ~100-158 (addDownload)
- **Sintoma**: Limite de velocidade definido pelo usuário é ignorado; yt-dlp roda sem limite
- **Causa**: `addDownload()` copia todos os campos de `formatOptions` para `DownloadItem`, exceto `bandLimit`. Todos os demais campos (formatString, audioOnly, audioFormat, audioQuality, writeSubs, writeAutoSubs, subLangs, subFormat, embedSubs, writeThumbnail, embedThumbnail, embedMetadata, mergeOutputFormat, concurrentFragments, retries, restrictFilenames, noOverwrites, keepVideo, videoOnly, downloadSections, sponsorblockRemove, fpsMax) são mapeados, mas `bandLimit` foi omitido.
- **Fluxo quebrado**: FormatSelector → `update({ bandLimit: kbps })` → formatOptions local → mas `addDownload()` não lê `formatOptions.bandLimit` → DownloadItem.bandLimit = undefined
- **Verificação**: `DownloadItem.bandLimit` existe em types.ts:85 (`bandLimit?: number`)
- **Fix**: Adicionar `bandLimit: formatOptions?.bandLimit,` na linha ~144 de `addDownload()`, após `fpsMax: formatOptions?.fpsMax,`
- **Impacto**: Todos os downloads com bandLimit definido são afetados — o limite nunca é aplicado

### BUG-002: bandLimit em SSE fallback cai para 0 por causa do BUG-001
- **Arquivo**: `src/core/engine/DownloadEngine.ts`
- **Linha**: ~389 (SSE params)
- **Sintoma**: Mesmo que BUG-001 seja corrigido, verificar se o SSE fallback propagará o valor corretamente
- **Estado atual**: A linha 389 usa `bandLimit: String(item.bandLimit || 0)`, que é **correta** (lê de item, não de settings). Porém, como BUG-001 impede que item.bandLimit seja setado, o resultado é sempre `0`.
- **Fix**: Corrigir BUG-001 resolve este automaticamente — nenhum fix adicional necessário no SSE path
- **Nota**: A linha 360 (Electron IPC path) também usa `item.bandLimit || 0`, que é igualmente correta

## 🟡 Bugs Médios (funcionalidade degradada)

### BUG-003: fpsMax usa abordagem diferente em spawnDownload vs buildArgs
- **Arquivo**: `src/core/ytdlp/YtDlpManager.ts`
- **Linhas**: spawnDownload:195-198 vs buildArgs:447-449
- **Sintoma**: Duas implementações paralelas para o mesmo comportamento:
  - `spawnDownload` muta a string de formato: `` `${finalFormat}/bv*[fps<=${fpsMax}]+ba/b[fps<=${fpsMax}]` `` (frágil, depende da estrutura do format string base)
  - `buildArgs` usa `--format-sort` com `fps<=N` (abordagem robusta recomendada pelo yt-dlp)
- **Impacto**: fpsMax pode não ser aplicado corretamente se o formato base já resolver antes do filtro fps
- **Fix**: Padronizar para `--format-sort "fps<=N"` em ambos, ou consolidar spawnDownload para chamar buildArgs

### BUG-004: buildArgs() é dead code
- **Arquivo**: `src/core/ytdlp/YtDlpManager.ts`
- **Linha**: 433+
- **Sintoma**: Função exportada mas nunca chamada — grep por `buildArgs` retorna apenas a definição (linha 433). Nenhum import ou chamada em todo o codebase.
- **Impacto**: Manutenção confusa — duas implementations paralelas de arg-building (spawnDownload monta args inline, buildArgs exporta utilitário não usado)
- **Fix**: OU remover buildArgs (simplificação) OU refatorar spawnDownload para delegar a buildArgs (DRY)

## 🟢 Bugs Baixos (UX / clean code)

### BUG-005: handleStartDownload retorna silenciosamente
- **Arquivo**: `src/features/analyzer/LinkAnalyzer.tsx`
- **Linha**: 171-172
- **Sintoma**: Se `!mediaInfo || !selectedFormat`, a função retorna sem feedback ao usuário
- **Impacto**: Baixo — o botão fica `disabled={!selectedFormat}` (linha 518), então o retorno silencioso só ativa quando `!mediaInfo` (cenário raro, pois o card só renderiza quando `mediaInfo && !loading`)
- **Fix**: Adicionar toast/notificação de erro, ou manter como defensive check (baixa prioridade)

### BUG-006: openFileLocation error swallow
- **Arquivo**: `src/core/engine/DownloadEngine.ts`
- **Linha**: 481
- **Sintoma**: `.catch(() => {})` esconde erros de abertura de pasta do sistema
- **Impacto**: Baixo — se `shell:openPath` falhar, o usuário não tem feedback (mas o download já foi concluído com sucesso)
- **Fix**: Log no console (`console.warn`) ou toast de erro não-bloqueante

### BUG-007: global.d.ts usa Promise<any>
- **Arquivo**: `src/global.d.ts`
- **Linha**: 8
- **Sintoma**: Perde type-safety em todas as chamadas IPC — qualquer `electron.invoke()` retorna `Promise<any>`, impedindo type-checking em chamadas como `invoke('yt-dlp-download', ...)` ou `invoke('shell:openPath', ...)`
- **Fix**: Usar tipos específicos por channel (ex: `invoke(channel: 'yt-dlp-download', ...): Promise<void>`, `invoke(channel: 'shell:openPath', ...): Promise<void>`) ou pelo menos `Promise<unknown>` como mínimo

## 📋 Bugs Resolvidos (pelo agente anterior)

| Bug | Solução | Status |
|-----|---------|--------|
| Parity Electron ↔ Web (18 params faltando) | server.ts + DownloadEngine.ts atualizados | ✅ Resolvido |
| Trim slider não alinhava | Thumbs customizadas + CSS pointer-events | ✅ Resolvido |
| defaultDir hardcoded | Storage.ts muda para '' (detected dynamically) | ✅ Resolvido |
| shell:openPath não funcionava | main.cjs corrigido para detectar file vs dir | ✅ Resolvido |
| shell:getDownloadsPath não existia | IPC handler adicionado | ✅ Resolvido |
| URLSearchParams com undefined | YtDlpAdapter.ts filtra undefined/null | ✅ Resolvido |

## ⚠️ Observações

1. **Todos os bugs acima são verificáveis** — cada um tem arquivo, linha, e fluxo documentado
2. **Nenhum bug é de "funcionalidade completamente quebrada"** — o download PODE funcionar, mas com parameters perdidos
3. **O bug mais impactante é BUG-001** (bandLimit) — afeta todos os downloads onde o usuário definiu limite de velocidade
4. **BUG-002 é uma consequência direta de BUG-001** — o SSE path já usa `item.bandLimit` corretamente, mas como o valor nunca é setado, cai para 0
5. **O agente anterior documentou bem as correções que fez** (docs/analysis-yt-dlp-parity.md), mas negligenciou o mapeamento bandLimit em addDownload()
6. **buildArgs() (BUG-004) é funcionalmente equivalente a spawnDownload** mas com abordagem mais limpa para fpsMax — vale considerar unificação
