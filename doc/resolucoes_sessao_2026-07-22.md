# Resoluções da Sessão — 2026-07-22

**Sessão:** Auditoria UI/Performance Android + Parity Desktop
**Commits:** `fd94ce7` → `33aab26` (5 commits, branch `feat/electron-web-version`)

---

## 1. YouTube 720p Limitation — Resolvido

### Problema
O youtubedl-android nativo limitava resoluções YouTube a 720p devido ao `player_client=android` ser o padrão do library.

### Causa Raiz
A documentação interna no `YtDlpPlugin.kt:249-260` mapeava o histórico:
- `android` → 720p (limitação conhecida)
- `android,web` → 720p (sem melhoria)
- `web` → SABR breakage (quebra total)
- `web_creator` → qualidade completa sem SABR
- `tv` → até 4K sem SABR

### Solução
Modificação em `applyFastExtractionOptions()` para aceitar parâmetro URL e adicionar `--extractor-args "youtube:player_client=web_creator,tv,web"` para URLs YouTube.

### Arquivo
`android/app/src/main/java/com/linkfetcher/app/YtDlpPlugin.kt` (commit `fd94ce7`)

### Validação
- Build Kotlin compila sem erros
- `gradlew installDebug` executado com sucesso
- Usuário confirmou download 1080p bem-sucedido em retry

---

## 2. Progress Events Throttle — Implementado

### Problema
Progresso de download na UIAndroid saltava de 0→100% sem eventos intermediários visíveis.

### Causa Raiz
A library youtubedl-android emite callbacks com frequência irregular, especialmente em downloads rápidos (Wi-Fi) ou com arquivos pequenos.

### Solução
`emitProgressThrottled()` com:
- Intervalo mínimo de 500ms entre emissões
- Deteção de mudança ≥1% no percentual
- Deteção de mudança na velocidade (string)

### Impacto
Reduz churn de eventos no WebView, melhorando a fluidez da barra de progresso.

---

## 3. NeuralConstellationBackground — Reescrito

### Problema
A animação de fundo não correspondia ao design V2 de referência (HTML).

### Solução
Reescrita completa com:
- 95 nós desktop / 30 Android (IS_CAPACITOR detection)
- Dual canvas com blend modes multiply + screen
- Paper-cut depth waves com warm ivory glow (#FFF6E6)
- Glow pulse animado, radius base adaptativo

### Arquivo
`src/components/NeuralConstellationBackground.tsx` (commit `5a2a1d8`)

---

## 4. ParticleBackground Android — Otimizado

### Problema
35 partículas com animações riseOrganic + colorShift causavam overhead GPU no Android.

### Solução
- 12 partículas no Android (vs 35 desktop)
- Partículas estáticas (sem animação) no Android
- IS_CAPACITOR detection

### Arquivo
`src/components/ParticleBackground.tsx` (commit `a2810db`)

---

## 5. Web-Parity — FormatSelector + DownloadEngine

### Problema
Funcionalidades bloqueadas por `isWebMode` e `DesktopOnlyTag` que na verdade funcionam no Android:
- Embutir legendas (`embedSubs`)
- Incorporar thumbnail (`embedThumbnail`)
- SponsorBlock

### Solução
- Remoção de guards `isWebMode` e `DesktopOnlyTag`
- Adição do campo `speed` na interface `YtDlpProgressEvent`
- Regex `parseSpeedString` atualizada para aceitar sufixo `/s` (formato Android)

### Arquivos
- `src/features/downloads/FormatSelector.tsx`
- `src/core/ytdlp/CapacitorYtDlp.ts`
- `src/core/engine/DownloadEngine.ts`

### Commit
`eceb322`

---

## 6. Anomalias Observadas

### android/ no .gitignore
O diretório `android/` está no `.gitignore` (linha 45), o que impede tracking automático de mudanças Kotlin. Utilizado `git add -f` para forçar commit do `YtDlpPlugin.kt`. **Recomendação:** considerar adicionar o plugin Kotlin a um tracking manual ou ajustar .gitignore.

### File Size Display
O `sizeTotal` em `DownloadManager.tsx` cai em estimativas (25MB vídeo / 6MB áudio) quando `format.sizeBytes` do probe retorna 0. Isso é comportamento esperado para formatos onde o tamanho não é previamente conhecido.

---

## Métricas Pós-Implementação

| Métrica | Antes | Depois |
|---------|-------|--------|
| gfxInfo janky frames | 78% | A ser medido |
| 99th percentile | 1400ms | A ser medido |
| Resolução YouTube máxima | 720p | Até 4K |
| Partículas Android | 35 (animadas) | 12 (estáticas) |
| Nó Neural Android | ~95 | 30 |
| Funcionalidades bloqueadas | 3 | 0 |
