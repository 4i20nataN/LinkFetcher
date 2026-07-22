# Diagnóstico de Arquitetura e Estratégia de Testes Automatizados (Android)

Este documento descreve o diagnóstico da arquitetura nativa/híbrida do aplicativo **LinkFetcher** no Android e estabelece a estratégia de inspeção interativa via ADB, UI Automator e Logcat.

---

## 1. Mapeamento da Arquitetura Atual

- **Tipo de Aplicativo:** Híbrido de Alto Desempenho. 
  - **Frontend / UI:** Single Page Application (SPA) em React 19 + Vite 6 + Tailwind CSS 4, renderizada via `WebView` de alta performance do sistema.
  - **Framework de Integração Móvel:** **Capacitor 6** (`@capacitor/android`), mapeando a comunicação bidirecional entre o JS do React e o NDK do Android.
  - **Plugin Nativo Customizado:** **YtDlpPlugin.kt** (Kotlin), estendendo `com.getcapacitor.Plugin`.
- **Ponto de Entrada:** `MainActivity.java` estendendo `BridgeActivity` do Capacitor, inicializando o ambiente do WebView e os plugins nativos.
- **Mecanismo de Invocação de Binários Nativos (`yt-dlp` / `ffmpeg`):**
  - O aplicativo utiliza as bibliotecas nativas Gradle `io.github.junkfood02.youtubedl-android:library:0.18.1` e `:ffmpeg:0.18.1`.
  - A biblioteca embarca um interpretador Python 3 modular compilado via NDK. As chamadas `YoutubeDL.getInstance().execute(request, id)` acionam o runtime Python via JNI e invocam o script `yt-dlp` e os binários dinâmicos do `ffmpeg` com o `LD_LIBRARY_PATH` configurado.

---

## 2. Análise Comparativa de Estrutura

### Vantagens (Prós):
- **Paridade Visual e de Código:** Compartilhamento total das regras de UI, seletores de formato e lógica de estado React entre Desktop e Mobile.
- **Execução Local:** 100% da extração e download é realizada no dispositivo do usuário sem dependência de servidores web pagos ou APIs externas.
- **Desempenho Nativo:** O interpretador Python embarcado roda nativamente na CPU do celular (`arm64-v8a`), fornecendo velocidade comparável à versão Desktop.

### Desafios e Contras Mitigados:
- **Restrição de Alinhamento ELF 16KB (Android 15+):** Os binários `.so` compilados no pacote FFmpeg original usavam alinhamento de 4KB. *Mitigado:* O `YtDlpPlugin.kt` implementa fallback assíncrono para `-f b/best` quando o sistema operacional 16KB rejeita a vinculação dinâmica.
- **Execução em Segundo Plano:** O Android encerra processos sem atividade na tela se o app for minimizado. *Mitigado:* O app solicita permissão `WAKE_LOCK` e ativa o `PowerManager.WakeLock` (`PARTIAL_WAKE_LOCK`) durante transferências ativas.

---

## 3. Estratégia para o Agente Testar e "Enxergar" o App

### 3.1 Comandos ADB para Inspeção de UI (`UiAutomator Dump`):
O agente pode inspecionar os elementos visuais da tela do emulador gerando a árvore XML do layout:
```powershell
# 1. Gerar o dump XML do layout da tela atual
adb shell uiautomator dump /sdcard/window_dump.xml

# 2. Baixar a árvore de UI para o ambiente do agente
adb pull /sdcard/window_dump.xml ./window_dump.xml
```

### 3.2 Captura de Logs do Sistema (`adb logcat`):
Para auditar em tempo real a passagem de parâmetros para o `yt-dlp` e mensagens do `ffmpeg`:
```powershell
# Limpar buffer de logs anteriores
adb logcat -c

# Filtrar apenas as mensagens do Plugin Nativo e YoutubeDL
adb logcat -d | findstr /i "YtDlpPlugin YoutubeDL FFmpeg"
```

### 3.3 Simulação de Interações e Testes Automatizados:
O agente pode executar a bateria de testes interativos no emulador sem necessidade de intervenção humana:

```powershell
# A. Inicializar o aplicativo no emulador
adb shell am start -n com.linkfetcher.app/.MainActivity

# B. Simular digitação de um link de vídeo no campo de input
adb shell input tap 300 250
adb shell input text "https://www.youtube.com/watch?v=jEWFSv3ivTg"

# C. Simular toque no botão "Analisar" (coordenadas da tela)
adb shell input tap 900 250

# D. Testar comportamento em segundo plano (minimizar app com download ativo)
adb shell input keyevent 3

# E. Validar se o arquivo baixado foi gravado na galeria pública do Android
adb shell ls -la /sdcard/Download
```
