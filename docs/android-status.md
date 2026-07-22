# LinkFetcher Android — Status Atual

## O que está funcionando
- **Capacitor 6 + Kotlin plugin** (`youtubedl-android` v0.18.1, binário yt-dlp auto-atualizado em runtime) com Python + ffmpeg embutidos
- **APK builda, instala e assina para release** (ver `docs/android-release-signing.md`)
- **Análise de vídeo**: URL YouTube → título, duração, thumbnail, formatos — confirmado com log real
- **Download**: probe → seleção de formato → progresso em tempo real (%, velocidade, ETA) → merge ffmpeg → salva em Downloads público (MediaStore) — confirmado com log real (download de 7.1GB completado até o merge)
- **UI**: fila de downloads, pausar/retomar/cancelar, botão voltar, StatusBar, safe-area, keyboard, share API, abrir arquivo

## Histórico do bug de download (RESOLVIDO — sessão 2026-07-21)

Três causas em cadeia, cada uma mascarando a próxima até serem corrigidas em sequência:

1. **`'NoneType' object has no attribute 'lower'`** — binário yt-dlp desatualizado dentro do `.aar`. **Fix**: self-update via `YoutubeDL.getInstance().updateYoutubeDL(context, UpdateChannel.STABLE)` em `load()`.
2. **`Requested format is not available`** (regressão temporária ao testar remover extractor-args) — YouTube ativou SABR streaming pro client `web`. **Fix**: manter `--extractor-args youtube:player_client=android,web` (client `android` não é afetado pelo SABR).
3. **`Postprocessing: ffmpeg not found`** — auto-registro interno da lib não confiável nesse ambiente. **Fix**: `resolveFfmpegBinary()` localiza o binário via reflection + fallback pro `nativeLibraryDir`, passa `--ffmpeg-location` explícito em toda `download()`.

Detalhes técnicos completos em `docs/session-log.md` (entrada "Android: pipeline completo probe→download→ffmpeg funcionando").

## Pendente antes do lançamento v1

| Item | Status | Bloqueante? |
|---|---|---|
| Testar fix #3 (ffmpeg-location) em device real do usuário | Aguardando confirmação | Sim — é o único fix ainda não validado em produção |
| Build assinado (`assembleRelease`) com keystore próprio | Configurado, não testado nesta sessão | Sim, pra publicar fora do `installDebug` |
| Tamanho de download por padrão (7.1GB observado num vídeo 4K) | Formato já limita a `height<=1080` mas fallback pode escapar disso — ver nota abaixo | Não, mas recomendado revisar antes do lançamento |
| `wifiOnly` / limite de conexão | Não implementado (`docs/pending-improvements.md`) | Não |

**Nota sobre tamanho de download**: o formato configurado já é `bestvideo[height<=1080]+bestaudio/.../b[height<=1080]`, mas o teste real baixou um WEBM de 7.1GB — sinal de que o fallback `b[height<=1080]` pode estar selecionando um formato pré-combinado de bitrate muito alto em vez de recodificar/escolher um mais eficiente. Vale investigar se isso é esperado (vídeo de VR/8K de origem) ou se o format selector precisa de um teto de bitrate também, antes do lançamento — mas não impede o app de funcionar.

## Comando para rebuild e testar
```bash
cd "D:\VISUAL STUDIO Projetos\LinkFatcher corrigido"
npm run build && npx cap sync android && cd android && ./gradlew installDebug
adb shell am force-stop com.linkfetcher.app && adb shell am start -n com.linkfetcher.app/.MainActivity
```

## Comando para ver logs
```bash
adb logcat -c
# testar no app...
adb logcat -d | findstr /i "YtDlpPlugin Exception ffmpeg-location updateYoutubeDL"
```

## Versões
- Capacitor: 6.x
- youtubedl-android: 0.18.1 (binário yt-dlp interno: auto-atualizado via `UpdateChannel.STABLE`)
- App ID: `com.linkfetcher.app`
- Branch: `feat/electron-web-version`

