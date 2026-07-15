# Guia de Testes via Chrome DevTools MCP

> **Objetivo:** Executar a bateria de 15 testes de download usando o MCP Chrome DevTools
> **Público-alvo:** Agente de IA que vai executar os testes sem conhecimento prévio do app
> **Status:** Bug de inicialização CORRIGIDO (formatOptions prop agora é lido no mount). Workaround via evaluate_script ainda necessário para MCP clicks.

---

## 1. Arquitetura do App (Resumo Rápido)

```
LinkAnalyzer (pai)
  ├── FormatSelector (filho) — gerencia state LOCAL de formatOptions
  │     └── Chama onFormatSelect(options) via useEffect
  ├── Botão "Baixar no Formato Escolhido"
  │     └── handleStartDownload() → DownloadEngine.addDownload(formatOptions)
  └── download-flow-trace.md → spawnDownload() → yt-dlp CLI
```

**Fluxo de dados:**
1. Usuário clica toggle no FormatSelector → `update()` muda state local
2. `useEffect` em `FormatSelector.tsx:394` deveria chamar `onFormatSelect(options)`
3. `onFormatSelect` = `setFormatOptions` do LinkAnalyzer (pai)
4. Botão "Baixar" lê `formatOptions` do LinkAnalyzer e chama `DownloadEngine.addDownload()`

---

## 2. Bug Corrigido: Inicialização do FormatSelector

### O que foi corrigido
`FormatSelector.tsx:319` — `useState` agora lê o prop `formatOptions` no mount:
```typescript
const [options, setOptions] = useState<FormatOptions>(() => ({
    ...defaults,
    ...formatOptions,  // ← NOVO: inicializa do prop
}));
```

### O que AINDA requer workaround
MCP `evaluate_script` que muta `state.memoizedState` diretamente não dispara React's useEffect. Para testes que mudam configuração, usar `evaluate_script` + chamada manual de `onFormatSelect`:

```javascript
// Dentro do walk, após obter options:
state.memoizedState = { ...options };
node.memoizedProps.onFormatSelect({ ...options });
```

---

## 3. Como Usar o Chrome DevTools MCP

### 3.1 Conexão
O MCP conecta no Vite renderer em `http://localhost:3000` (NÃO no Electron main process).
- **Não ver:** logs do main process (YtDlpManager, main.cjs)
- **Ver:** UI do React, DOM, console do renderer

### 3.2 Ferramentas Principais

| Ferramenta | Quando Usar |
|-----------|-------------|
| `chrome-devtools_list_pages` | Verificar páginas abertas |
| `chrome-devtools_take_snapshot` | Ver estado atual da UI (elementos + UIDs) |
| `chrome-devtools_click` | Clicar em elemento por UID |
| `chrome-devtools_fill` | Preencher input por UID |
| `chrome-devtools_evaluate_script` | Rodar JS no contexto da página (WORKAROUND PRINCIPAL) |
| `chrome-devtools_navigate_page` | Navegar para URL |
| `chrome-devtools_wait_for` | Esperar texto aparecer |

### 3.3 Regras Críticas

1. **UIDs MUDAM a cada snapshot** — nunca reutilize UIDs de snapshots anteriores
2. **Sempre tirar snapshot antes de clicar** — para ter UIDs atualizados
3. **Clique pode redirecionar** — após download, o app vai para aba "Downloads"
4. **usevaluate_script para configs complexas** — toggles via MCP são instáveis
5. **Log em `~/Downloads/linkfetcher-debug.log`** —唯一的 forma de ver args do yt-dlp

### 3.4 Fluxo Padrão de Cada Teste

```
1. Limpar log:          "" | Out-File -FilePath "$env:USERPROFILE\Downloads\linkfetcher-debug.log"
2. Navegar p/ Analyzer: chrome-devtools_click no botão "Analisar Link"
3. Snapshot:            chrome-devtools_take_snapshot
4. Configurar opções:   evaluate_script (workaround) OU click direto
5. Clicar Baixar:       chrome-devtools_click no botão "Baixar no Formato Escolhido"
6. Aguardar:            Start-Sleep 5-8 segundos
7. Ler log:             Get-Content ... linkfetcher-debug.log | Select-String "FINAL ARGS"
8. Verificar arquivo:   Get-ChildItem no diretório de downloads
9. Voltar p/ Analyzer:  chrome-devtools_click "Analisar Link" (para próximo teste)
```

---

## 4. Configuração Inicial

### 4.1 Diretórios
- **App:** `D:\VISUAL STUDIO Projetos\LinkFetcher`
- **Downloads:** `C:\Users\ntn\Downloads`
- **Log:** `C:\Users\ntn\Downloads\linkfetcher-debug.log`
- **Output dir do app:** `C:\Users\ntn\Downloads\TESTE MCP DEV TOOLS` (configurado no app)

### 4.2 Vídeo de Teste
- **URL:** `https://www.youtube.com/watch?v=AyPh15IUWHA`
- **Título:** "What Lies Beneath Our Steps | Surreal Nature AI Short Film by Mamta B Herland"
- **Duração:** 3:35
- **Resolução máx:** 1920x1080

### 4.3 Iniciar App
```powershell
# Matar processos anteriores
Get-Process | Where-Object { $_.ProcessName -match "electron" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Iniciar em background
Start-Process -FilePath "node" -ArgumentList "scripts/electron-dev.cjs" -WorkingDirectory "D:\VISUAL STUDIO Projetos\LinkFetcher" -WindowStyle Hidden

# Aguardar (Vite ~10s + Electron ~5s)
Start-Sleep -Seconds 15

# Verificar portas
netstat -ano | Select-String "9222|:3000.*LISTENING"
```

### 4.4 Conectar MCP
```
chrome-devtools_list_pages
# Deve mostrar: "My Google AI Studio App (http://localhost:3000/)"
```

---

## 5. Bateria de Testes — Execução Detalhada

### TESTE 01 — Download Padrão (Baseline) ✅ EXECUTADO
- **Config:** Tudo default (Melhor, MP4)
- **Método:** Click direto no botão (sem workaround necessário)
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --embed-metadata
  --windows-filenames
  --sub-langs en        (default do FormatSelector)
  --sub-format srt      (default do FormatSelector)
  --retries 3           (default do FormatSelector)
  ```
- **Args reais (confirmados):** ✅ Idênticos
- **Arquivo:** `.mp4` criado em `C:\Users\ntn\Downloads\TESTE MCP DEV TOOLS\`
- **Status:** ✅ PASSOU

---

### TESTE 02 — Apenas Áudio (MP3)
- **Config:** Audio Only ON, Formato MP3, Qualidade 320
- **Método:** evaluate_script (workaround obrigatório)

**Script para configurar:**
```javascript
(() => {
  const rootEl = document.getElementById('root');
  const containerKey = Object.keys(rootEl).find(k => k.startsWith('__reactContainer'));
  let fiber = rootEl[containerKey];
  
  function walk(node, depth) {
    if (!node || depth > 60) return null;
    const name = node.type?.name;
    if (name === 'FormatSelector') {
      let state = node.memoizedState;
      let count = 0;
      while (state && count < 4) { state = state.next; count++; }
      const options = { ...state.memoizedState };
      
      options.audioOnly = true;
      options.audioFormat = 'mp3';
      options.audioQuality = '3';  // 320kbps = value '3'
      
      state.memoizedState = options;
      node.memoizedProps.onFormatSelect({ ...options });
      return { done: true, audioOnly: options.audioOnly, audioFormat: options.audioFormat };
    }
    if (node.child) { const r = walk(node.child, depth + 1); if (r) return r; }
    if (node.sibling) { const r = walk(node.sibling, depth + 1); if (r) return r; }
    return null;
  }
  return walk(fiber, 0);
})();
```

- **Args esperados:**
  ```
  --extract-audio
  --audio-format mp3
  --audio-quality 3
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Arquivo `.mp3` existe, player de áudio abre

---

### TESTE 03 — Apenas Áudio (FLAC lossless)
- **Config:** Audio Only ON, Formato FLAC, Qualidade Melhor (0)
- **Script:** Mesmo do TESTE 02, mas com:
  ```javascript
  options.audioFormat = 'flac';
  options.audioQuality = '0';
  ```
- **Args esperados:**
  ```
  --extract-audio
  --audio-format flac
  --audio-quality 0
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Arquivo `.flac` existe

---

### TESTE 04 — Resolução 720p
- **Config:** Resolução 720p, Formato MP4
- **Método:** Click direto no botão "720p" (UID muda, pegar do snapshot)

**Script alternativo (mais seguro):**
```javascript
(() => {
  const rootEl = document.getElementById('root');
  const containerKey = Object.keys(rootEl).find(k => k.startsWith('__reactContainer'));
  let fiber = rootEl[containerKey];
  
  function walk(node, depth) {
    if (!node || depth > 60) return null;
    const name = node.type?.name;
    if (name === 'FormatSelector') {
      let state = node.memoizedState;
      let count = 0;
      while (state && count < 4) { state = state.next; count++; }
      const options = { ...state.memoizedState };
      
      options.format = 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]';
      
      state.memoizedState = options;
      node.memoizedProps.onFormatSelect({ ...options });
      return { done: true, format: options.format };
    }
    if (node.child) { const r = walk(node.child, depth + 1); if (r) return r; }
    if (node.sibling) { const r = walk(node.sibling, depth + 1); if (r) return r; }
    return null;
  }
  return walk(fiber, 0);
})();
```

- **Args esperados:**
  ```
  --format bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Resolução do vídeo ≤ 720p

---

### TESTE 05 — FPS Limitado a 30
- **Config:** Resolução Melhor, FPS Max = 30
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.fpsMax = 30;
  // format fica como default: 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b'
  ```
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --format-sort fps:30
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Framerate do vídeo ≤ 30fps

---

### TESTE 06 — Container MKV
- **Config:** Resolução Melhor, Formato MKV
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.format = 'bv*[ext=mkv]+ba[ext=m4a]/bv*+ba/b';
  ```
- **Args esperados:**
  ```
  --format bv*[ext=mkv]+ba[ext=m4a]/bv*+ba/b
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Arquivo `.mkv` existe

---

### TESTE 07 — Legendas (PT + EN, SRT)
- **Config:** Legendas ON, Auto-subs ON, Idioma `pt,en`, Formato SRT, Embutir ON
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.writeSubs = true;
  options.writeAutoSubs = true;
  options.subLangs = 'pt,en';
  options.subFormat = 'srt';
  options.embedSubs = true;
  ```
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --write-subs
  --write-auto-subs
  --sub-langs pt,en
  --sub-format srt
  --embed-subs
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Arquivo `.mp4` com legendas embutidas

---

### TESTE 08 — Apenas Vídeo (sem áudio)
- **Config:** videoOnly ON
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.videoOnly = true;
  ```
- **Args esperados:**
  ```
  --format bv*[ext=mp4]/bv*/b
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Arquivo `.mp4` SEM faixa de áudio

---

### TESTE 09 — Thumbnail (write)
- **Config:** Thumbnail ON, Incorporar OFF
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.writeThumbnail = true;
  options.embedThumbnail = false;
  ```
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --write-thumbnail
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Arquivo `.mp4` + arquivo `.jpg` ou `.webp` existe

---

### TESTE 10 — Thumbnail Embutido
- **Config:** Thumbnail ON, Incorporar ON
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.writeThumbnail = true;
  options.embedThumbnail = true;
  ```
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --write-thumbnail
  --embed-thumbnail
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Arquivo `.mp4` com thumbnail embutido

---

### TESTE 11 — Recorte de Tempo (Trim)
- **Config:** Trim de 0:05 a 0:15 (10 segundos)
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.downloadSections = '*0:05-0:15';
  ```
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --download-sections *0:05-0:15
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Arquivo `.mp4` com duração ~10s

---

### TESTE 12 — Limite de Velocidade
- **Config:** Limite = 512 KB/s
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.bandLimit = 512;
  ```
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --limit-rate 512K
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Download mais lento, arquivo existe

---

### TESTE 13 — Nome Limpo + Não Sobrescrever
- **Config:** Restrict Filenames ON, No Overwrites ON
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.restrictFilenames = true;
  options.noOverwrites = true;
  ```
- **Args esperados:**
  ```
  --format bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b
  --restrict-filenames
  --no-overwrites
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Nome sem caracteres especiais, sem sobrescrever

---

### TESTE 14 — WebM Container
- **Config:** Resolução Melhor, Formato WebM
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.format = 'bv*[ext=webm]+ba[ext=webm]/bv*+ba/b';
  ```
- **Args esperados:**
  ```
  --format bv*[ext=webm]+ba[ext=webm]/bv*+ba/b
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Arquivo `.webm` existe

---

### TESTE 15 — Combinação Completa (Stress Test)
- **Config:** 720p, MP3 192kbps, Legendas PT auto, Thumbnail embutido, Metadados
- **Script:**
  ```javascript
  // Dentro do walk, após obter options:
  options.format = 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]';
  options.audioOnly = true;
  options.audioFormat = 'mp3';
  options.audioQuality = '5';  // 192kbps
  options.writeSubs = true;
  options.writeAutoSubs = true;
  options.subLangs = 'pt';
  options.subFormat = 'srt';
  options.embedSubs = true;
  options.writeThumbnail = true;
  options.embedThumbnail = true;
  ```
- **Args esperados:**
  ```
  --format bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]
  --extract-audio
  --audio-format mp3
  --audio-quality 5
  --write-subs
  --write-auto-subs
  --sub-langs pt
  --sub-format srt
  --embed-subs
  --write-thumbnail
  --embed-thumbnail
  --embed-metadata
  --windows-filenames
  ```
- **Validação:** Arquivo `.mp3` + `.mp4` com legendas e thumbnail

---

## 6. Verificação de Resultados

### 6.1 Ler Log de Debug
```powershell
Get-Content "$env:USERPROFILE\Downloads\linkfetcher-debug.log" -ErrorAction SilentlyContinue | Select-String "FINAL ARGS" -Context 0,30
```

### 6.2 Verificar Arquivo Existe
```powershell
Get-ChildItem "$env:USERPROFILE\Downloads\TESTE MCP DEV TOOLS" -File | Sort-Object LastWriteTime -Descending | Select-Object Name, Length, LastWriteTime -First 5
```

### 6.3 Verificar Tamanho > 0
```powershell
Get-ChildItem "$env:USERPROFILE\Downloads\TESTE MCP DEV TOOLS" -File | ForEach-Object { "$($_.Name) → $([math]::Round($_.Length/1MB, 2)) MB" }
```

### 6.4 Limpar Log Antes de Cada Teste
```powershell
"" | Out-File -FilePath "$env:USERPROFILE\Downloads\linkfetcher-debug.log" -Encoding utf8
```

---

## 7. Ordem de Execução

| # | Teste | Método Config | Complexidade |
|---|-------|---------------|-------------|
| 1 | TESTE 01 — Padrão | Click direto | Baixa |
| 2 | TESTE 04 — 720p | evaluate_script | Baixa |
| 3 | TESTE 06 — MKV | evaluate_script | Baixa |
| 4 | TESTE 14 — WebM | evaluate_script | Baixa |
| 5 | TESTE 05 — FPS 30 | evaluate_script | Baixa |
| 6 | TESTE 12 — Rate Limit | evaluate_script | Baixa |
| 7 | TESTE 13 — Nome Limpo | evaluate_script | Baixa |
| 8 | TESTE 02 — Áudio MP3 | evaluate_script | Média |
| 9 | TESTE 03 — Áudio FLAC | evaluate_script | Média |
| 10 | TESTE 08 — Só Vídeo | evaluate_script | Média |
| 11 | TESTE 09 — Thumbnail | evaluate_script | Média |
| 12 | TESTE 10 — Thumb Embutido | evaluate_script | Média |
| 13 | TESTE 07 — Legendas | evaluate_script | Média |
| 14 | TESTE 11 — Trim | evaluate_script | Média |
| 15 | TESTE 15 — Stress | evaluate_script | Alta |

---

## 8. Relatório de Resultados

Após cada teste, preencher:

| Teste | Args OK? | Arquivo OK? | Tamanho | Status | Observação |
|-------|----------|-------------|---------|--------|------------|
| 01 | ✅/❌ | ✅/❌ | X MB | PASS/FAIL | |
| 02 | ✅/❌ | ✅/❌ | X MB | PASS/FAIL | |
| ... | ... | ... | ... | ... | |

---

## 9. Troubleshooting

### "App redirecionou para aba Downloads"
→ Clicar em "Analisar Link" no menu lateral para voltar

### "Element with uid X no longer exists"
→ Tirar novo snapshot antes de clicar — UIDs mudam a cada render

### "Toggle não propagou (audioOnly=true no FormatSelector mas false no LinkAnalyzer)"
→ Usar evaluate_script com o workaround da Seção 2

### "Download file already skipped"
→ O arquivo já existe. Usar customFilename para renomear, ou deletar manualmente:
```powershell
Remove-Item "$env:USERPROFILE\Downloads\TESTE MCP DEV TOOLS\What Lies*" -Force
```

### "Chrome DevTools MCP tool not available"
→ Verificar se MCP está conectado em `chrome-devtools_list_pages`. Se não, reiniciar Electron com `--remote-debugging-port=9222`.

### "Log vazio após download"
→ Verificar se o app está em modo web (localhost:3000) ou Electron (porta 9222). LogDebug só funciona no Electron main process.
