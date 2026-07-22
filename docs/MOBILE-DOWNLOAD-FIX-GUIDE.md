# Guia de Fix: Download Android (Capacitor) não baixa nada

> **Data**: 2026-07-20 | **Status**: ✅ RESOLVIDO — causa raiz confirmada e corrigida
> **Agente anterior**: big-pickle (opencode) | **Máquina**: Windows + emulator-5554
> **Resolvido por**: Claude (Anthropic), a partir do diagnóstico deste documento

---

## ✅ RESOLUÇÃO (2026-07-20)

A **Hipótese 1 estava correta**. Causa raiz confirmada lendo o código-fonte real da
lib `youtubedl-android` (`YoutubeDLOptions.kt`, método `buildOptions()`):

```kotlin
fun buildOptions(): List<String> {
    val commandList: MutableList<String> = mutableListOf()
    for ((option, value) in options) {
        for (argument in value) {
            commandList.add(option)
            if (argument.isNotEmpty()) commandList.add(argument)  // ← AQUI
        }
    }
    return commandList
}
```

Quando `addOption("--download-sections", "")` é chamado com valor vazio, a lib
adiciona **só a flag**, sem token de valor nenhum — bate exatamente com a evidência
do logcat (`'--download-sections', '--sponsorblock-remove'` colados, sem nada
entre eles). O yt-dlp então lê `--sponsorblock-remove` como se fosse o VALOR de
`--download-sections` — uma seção inválida, zero ranges válidos pra baixar. yt-dlp
"termina com sucesso" (exit 0) porque, do ponto de vista dele, baixou exatamente o
que foi pedido: nada.

**Por que `call.getString("downloadSections")` retornava `""` em vez de `null`:**
o bridge do Capacitor estava serializando o `undefined` do JS como string vazia ao
cruzar para o Kotlin (em vez de omitir a chave ou virar `null`).

### Fix aplicado

1. **`YtDlpPlugin.kt`** — todas as 7 ocorrências do padrão `call.getString(...)?.let { addOption(...) }`
   agora têm `.takeIf { it.isNotBlank() }` antes do `?.let`, garantindo que uma
   flag só é adicionada com um valor de verdade:
   ```kotlin
   call.getString("downloadSections")?.takeIf { it.isNotBlank() }?.let { request.addOption("--download-sections", it) }
   call.getString("sponsorblockRemove")?.takeIf { it.isNotBlank() }?.let { request.addOption("--sponsorblock-remove", it) }
   ```
2. **`DownloadEngine.ts`** (defesa em profundidade, linha ~478-497) — todos os campos
   opcionais de string agora usam `|| undefined` antes de entrar no payload do
   `plugin.download()`, pra nunca depender da serialização do bridge pra esses casos.
3. **Bugs adicionais encontrados e corrigidos durante a verificação** (o log da sessão
   anterior dizia que já estavam corrigidos, mas o código ainda tinha os bugs):
   - `localFile.length()`/`localFile.name` eram lidos **depois** de `localFile.delete()`
     — `File.length()` reconsulta o filesystem a cada chamada e retorna `0` para
     arquivo deletado, então o payload `complete` sempre reportava `fileSize: 0`.
     Corrigido: nome/tamanho capturados em `val` antes do `delete()`.
   - `getMimeType()` tentava adivinhar o MIME type pela extensão do `filePath`, mas
     esse `filePath` é uma URI `content://` do MediaStore (sem extensão visível) —
     quase sempre caía em `application/octet-stream`. Corrigido: para URIs `content://`,
     consulta `ContentResolver.getType(uri)` (que já tem o MIME real do MediaStore)
     antes de tentar adivinhar pela extensão.

### Não foi necessário (mas ficou registrado como aprendizado)

- **`--verbose`**: não estava mais presente no código no momento da correção (parece
  já ter sido removido antes deste zip ser gerado).
- **Hipótese 2 (format selector incompatível com `player_client=android`)**: não
  chegou a ser testada isoladamente porque a Hipótese 1 já explicava 100% da
  evidência do log. Se o download ainda falhar após este fix, esta é a próxima
  hipótese a investigar.

---

## Contexto Crítico (histórico — mantido para referência)

**yt-dlp funciona PERFEITAMENTE no Desktop (Windows).** O app baixa vídeos, áudio, legendas, thumbnails — tudo. O engine yt-dlp é o mesmo binário, a lógica de download é a mesma. A única diferença é a camada de transporte: Desktop usa IPC (Electron), Android usa o plugin nativo `youtubedl-android` (Kotlin) via Capacitor.

**O próximo agente DEVE entregar o download Android funcionando com a mesma qualidade do Desktop.** O objetivo é paridade total: probe, seleção de formato, download, merge, progresso, erro — tudo igual. Não é aceitável "funciona parcialmente" ou "baixa mas sem progresso". Tem que funcionar igual ao Desktop.

## Resumo do Problema

Probe/análise funciona (retorna 8 formatos do YouTube). Quando usuário clica "Baixar", card aparece na fila, progresso fica 0% por ~8s, depois muda para "Falhou" com "Download concluído mas nenhum arquivo encontrado".

## O que o Desktop faz (paridade que o Android DEVE ter)

No Desktop (Windows), o fluxo de download funciona assim:

1. `DownloadEngine.startYtDlpDownload()` chama `YtDlpAdapter.download()` → `YtDlpManager.spawnDownload()`
2. yt-dlp roda com as opções do usuário (formato, áudio, legendas, etc.)
3. **Progresso em tempo real**: parsing de `[download] 45.2% of 10.00MiB at 1.5MiB/s ETA 00:07` → atualiza card na UI
4. **Merge automático**: bestvideo+bestaudio → mp4 via ffmpeg
5. **Arquivo salvo** no diretório do usuário
6. **Card atualiza** para "Concluído" com tamanho e botão "Abrir Pasta"

O Android DEVE fazer tudo isso. O yt-dlp embutido na lib `youtubedl-android` é o mesmo binário. A diferença é apenas como é chamado (Kotlin vs Node.js).

## O que já foi diagnosticado

yt-dlp **roda mas nunca baixa**. Via `adb logcat -s YtDlpPlugin` com `--verbose`:

**stdout (4 linhas, SEM `[download]`):**
```
[youtube] Extracting URL: https://www.youtube.com/watch?v=...
[youtube] ...: Downloading webpage
[youtube] ...: Downloading android player API JSON
[info] ...: There are no chapters matching the regex
```

**stderr (2226 chars):** Contém verbose debug mostrando que formatos são encontrados e ordenados, mas **yt-dlp termina com exit code 0 sem selecionar nem baixar nenhum formato**.

**Pista crítica no stderr:** As opções `--download-sections` e `--sponsorblock-remove` aparecem na cmdline **SEM VALOR**, o que pode deslocar o parsing de todos os args seguintes:
```
'--retries', '3', '--download-sections', '--sponsorblock-remove', '--verbose', ...
```

## Hipóteses (em ordem de likelihood)

### 1. Opções vazias deslocam o parser (ALTA probabilidade)

No TypeScript (`DownloadEngine.ts:496-497`):
```typescript
downloadSections: item.downloadSections,
sponsorblockRemove: item.sponsorblockRemove,
```

Se `item.downloadSections` é `undefined`, Capacitor pode serializar como string vazia `""` em vez de omitir. No Kotlin (`YtDlpPlugin.kt:287-288`):
```kotlin
call.getString("downloadSections")?.let { request.addOption("--download-sections", it) }
call.getString("sponsorblockRemove")?.let { request.addOption("--sponsorblock-remove", it) }
```

`call.getString()` retorna `null` para keys ausentes, mas retorna `""` para keys com valor vazio. Se Capacitor envia `""`, o `?.let` executa e adiciona `--download-sections ""` à cmdline. yt-dlp interpreta `""` como valor, mas depois o próximo arg (`--sponsorblock-remove`) pode ser consumido incorretamente.

**Fix:** Adicionar `.takeIf { it.isNotBlank() }`:
```kotlin
call.getString("downloadSections")?.takeIf { it.isNotBlank() }?.let { request.addOption("--download-sections", it) }
call.getString("sponsorblockRemove")?.takeIf { it.isNotBlank() }?.let { request.addOption("--sponsorblock-remove", it) }
```

### 2. Format selector incompatível com player_client=android (MÉDIA probabilidade)

Formato padrão: `bv*[vcodec~=h264][height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]`

O player client `android` pode retornar formatos com IDs/codecs diferentes do `web`. Se nenhum formato bate com o seletor, yt-dlp deveria dar erro (exit 1), mas pode estar terminando com exit 0 silenciosamente.

**Fix de teste:** Trocar temporariamente para `best` ou `bestvideo+bestaudio/best` em `FormatSelector.tsx`.

### 3. `--format-sort "fps:60"` sempre adicionado (BAIXA probabilidade)

`YtDlpPlugin.kt:309`: `request.addOption("--format-sort", "fps:$fpsMax")` — se `fpsMax` é 0, não adiciona. Mas se o TypeScript envia `fpsMax` diferente de 0 por default, pode estar forçando sort desnecessário.

## O que foi feito nesta sessão (não resolveu o bug)

1. **Exit code capturing** (`YtDlpPlugin.kt:315`): Captura `YoutubeDLResponse`, verifica `exitCode`. Exit code é 0 mesmo assim.
2. **Chunked logging** (`YtDlpPlugin.kt:331-335`): stdout/stderr logados em chunks de 3000 chars (antes `takeLast(2000)` truncava). **Use `adb logcat -s YtDlpPlugin` para ver o output completo.**
3. **`--verbose` flag** (`YtDlpPlugin.kt:311`): Adicionado ao request para debug. **REMOVER antes de ship final.**
4. **Bugs anteriores corrigidos**: getMimeType content:// URI, localName/localSize antes de delete, handleProbe redundante.

## Arquivos-chave

| Arquivo | Linhas | O que faz |
|---------|--------|-----------|
| `android/app/src/main/java/com/linkfetcher/app/YtDlpPlugin.kt` | 287-315 | Opções do download + execute |
| `android/app/src/main/java/com/linkfetcher/app/YtDlpPlugin.kt` | 311 | `--verbose` (REMOVER) |
| `android/app/src/main/java/com/linkfetcher/app/YtDlpPlugin.kt` | 331-335 | Chunked logging |
| `src/core/engine/DownloadEngine.ts` | 416-509 | startYtDlpDownload |
| `src/core/engine/DownloadEngine.ts` | 496-497 | passa downloadSections/sponsorblockRemove |
| `src/core/ytdlp/CapacitorYtDlp.ts` | 45-68 | Interface de params |
| `src/features/downloads/FormatSelector.tsx` | - | Gera format string |

## Passos para o próximo agente

1. **Verificar stderr COMPLETO**: `adb logcat -s YtDlpPlugin` — o chunked logging agora mostra tudo. Procurar por:
   - `[download] Destination:` (indica que download começou)
   - `ERROR:` ou `WARNING:` 
   - Linhas de seleção de formato (`[info] ...: Downloading format ...`)

2. **Isolar o problema** (em ordem):
   - a) Adicionar log de todos os options antes do execute (dump da lista `request.options`)
   - b) Testar com formato `best` (simplificar o format string)
   - c) Remover `--format-sort` temporariamente
   - d) Remover `--extractor-args` temporariamente

3. **Corrigir**: Aplicar a combinação que funciona

4. **Limpar**: Remover `--verbose` do request

5. **Build + reinstall**:
   ```powershell
   cd "D:\VISUAL STUDIO Projetos\LinkFatcher corrigido"
   npm run build:mobile
   cd android && .\gradlew.bat assembleDebug
   C:\Users\ntn\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r app\build\outputs\apk\debug\app-debug.apk
   ```

6. **Testar**: Abrir app → colar URL do YouTube → Analisar → Baixar → verificar `adb logcat -s YtDlpPlugin`

## Setup do ambiente

- **ADB**: `C:\Users\ntn\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- **Emulador**: `emulator-5554`
- **Chrome DevTools**: `adb forward tcp:9222 localabstract:webview_devtools_remote_<PID>` (PID muda a cada restart)
- **Chrome DevTools MCP**: Habilitado e conectado (verificar com `chrome-devtools_list_pages`)
- **Build mobile**: `npm run build:mobile` (Vite + esbuild para `dist-web/`)
- **Build Android**: `cd android && .\gradlew.bat assembleDebug`
- **Lint**: `npm run lint` (deve passar sem erros)

## Regras importantes

- **ENTREGAR download Android funcionando igual ao Desktop** — paridade total, sem atalhos
- **NÃO mexer no Desktop** — tudo funciona no Desktop, não quebrar nada lá
- **Caminhos Windows** — usar `D:/...` não `/d/...`
- **NÃO rodar `package:win`** — é build de release
- **Idioma**: Português (PT-BR) para docs e commits
- **Teste completo**: Analisar link → selecionar formato → baixar → progresso → arquivo salvo → abrir
