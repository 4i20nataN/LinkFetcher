# Relatório de Auditoria de Auto-Update e Parâmetros (Android)

Este relatório compila a validação de parâmetros da interface móvel e a auditoria do pipeline de **Atualização Automática (Auto-Update via GitHub Releases)** no Android.

---

## 1. Auditoria do Pipeline de Auto-Update (GitHub Releases)

### 📡 A. Consulta à API do GitHub
- **Endpoint:** `GET https://api.github.com/repos/4i20nataN/LinkFetcher/releases/latest`
- **Validação:** A requisição é disparada de forma assíncrona ao iniciar o app (`UpdateBanner.tsx`), extraindo a tag remota (`tag_name`) e a lista de ativos (`assets`).

### 📦 B. Convenção de Assets e Leitura de APK
- O método `checkUpdate()` varre o array de assets da release procurando por:
  1. Arquivos com extensão `.apk` (ex: `linkfetcher-v1.0.2.apk`).
  2. Arquivos de verificação de integridade hash SHA-512 (`checksums.txt` ou `checksums-sha512.txt`).

### 🔒 C. Download Seguro e Validação SHA-512
- **Host Pinning:** O download aceita exclusivamente os domínios seguros da infraestrutura do GitHub (`github.com`, `objects.githubusercontent.com`, `release-assets.githubusercontent.com`), rejeitando redirecionamentos para hosts não autorizados.
- **Verificação Hash:** Caso um arquivo de checksums esteja presente na release, o `downloadUpdate()` calcula o hash SHA-512 em tempo real durante a gravação em disco. Se houver divergência de bytes, o APK é excluído por segurança.

### 📱 D. Invocação do Instalador Nativo do Android (`FileProvider` + `ACTION_VIEW`)
- **Gestão de Permissões (Android 8+ / API 26+):** O método `installUpdate()` em `YtDlpPlugin.kt` verifica se o aplicativo possui a permissão de instalar apps de fontes desconhecidas (`packageManager.canRequestPackageInstalls()`).
  - Se a permissão não tiver sido concedida, o app redireciona o usuário para a tela de configurações do sistema (`Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES`) solicitando o aceite.
- **Disparo da Intent:** O APK baixado em `cacheDir/updates/update.apk` é encapsulado via `FileProvider` gerando uma URI segura (`content://com.linkfetcher.app.fileprovider/...`). A intent `Intent.ACTION_VIEW` é disparada com o mime-type `application/vnd.android.package-archive` e a flag `FLAG_GRANT_READ_URI_PERMISSION`, abrindo o instalador oficial do sistema operacional.

---

## 2. Matriz de Auditoria de Parâmetros da UI

| Parâmetro / Funcionalidade | Suporte no Android | Ação Aplicada na UI / Código | Comando CLI ou API Nativa |
|---|---|---|---|
| **Resolução de Vídeo** | **Suportado (com Fallback 16KB)** | Exibição de seletores (1080p, 720p, etc.) | `-f "bv*[height<=N]+ba/b"` |
| **Codecs de Vídeo (H264, H265, VP9, AV1)** | **Suportado** | Seleção fluida com tooltips explicativos | `-f "bv*[vcodec~=...]+ba"` |
| **Formato de Contêiner (MP4, MKV, WebM)** | **Suportado** | Botões de seleção | `--merge-output-format <ext>` |
| **Extrair Áudio (-x)** | **Suportado** | Toggle dedicado na seção de Áudio | `-x` |
| **Formato de Áudio (MP3, AAC, M4A, OPUS)** | **Suportado** | Botões selecionáveis | `--audio-format <ext>` |
| **SponsorBlock** | **Suportado** | Chips multi-selecionáveis | `--sponsorblock-remove <cat>` |
| **Download de Legendas** | **Suportado** | Switches e seletores de idiomas | `--write-subs --sub-langs` |
| **Limite de Banda (Bandwidth Limit)** | **Suportado** | Campo numérico | `--limit-rate <n>K` |
| **Fragmentos Concorrentes** | **Suportado** | Campo numérico | `--concurrent-fragments <n>` |
| **Auto-Update via GitHub** | **Suportado** | Banner animado e instalador APK nativo | API GitHub + FileProvider Intent |
