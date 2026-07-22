# Análise & Planejamento — Itens Não-Urgentes

Este documento reúne tudo que foi identificado durante a correção do port Android
mas que **não é bloqueante** para o app funcionar hoje nas 3 versões (Desktop,
Web, Android). São melhorias, débitos técnicos e decisões arquiteturais para
revisar quando fizer sentido — nada aqui impede o uso normal do app agora.

---

## 1. Paridade de parâmetros yt-dlp/ffmpeg (cookies, proxy, etc.)

**Status atual:** já é 100% igual entre Desktop e Android para **tudo que existe
na interface hoje** — confirmei campo a campo que todo `FormatOptions` exposto em
`FormatSelector.tsx` (legendas, sponsorblock, sections, restrict-filenames,
no-overwrites, keep-video, concurrent-fragments, retries, rate-limit, fps-max,
codec, formato) chega até o `plugin.download()` no Android exatamente como chega
no `YtDlpManager.ts` do Electron/servidor.

**O que falta:** `cookies`, `proxy`, `cookies-from-browser`, `ffmpeg-location`,
`wait-for-video`, `trim-filenames`, `windows-filenames` existem como *tipos*
em `types.ts` (usados internamente pelo backend Electron/server.ts) mas **não
têm nenhum controle na UI em nenhuma plataforma** — não é um problema específico
do Android, é uma função que nunca foi finalizada.

**O que já se sabe sobre viabilidade no Android** (o `youtubedl-android` só
executa yt-dlp real via linha de comando, então qualquer flag de CLI válida
funciona — não há limitação da lib em si):

| Opção | Funciona no Android? | Observação |
|---|---|---|
| `--cookies <arquivo>` | ✅ Sim | precisa de UI para colar/importar texto de cookies e salvar num arquivo interno |
| `--proxy` | ✅ Sim | só precisa de um campo de texto |
| `--wait-for-video` | ✅ Sim | flag simples |
| `--trim-filenames` | ✅ Sim | flag simples |
| `--windows-filenames` | ✅ Sim | flag simples (útil pra quem depois transfere pro PC) |
| `--cookies-from-browser` | ❌ Não | precisa de um navegador desktop instalado com perfil local — não existe equivalente em sandbox Android |
| `--ffmpeg-location` | ❌ Não faz sentido | o `youtubedl-android` já gerencia o path do ffmpeg internamente (extraído do próprio AAR); um path customizado não tem onde apontar no sandbox do app |

**Recomendação:** quando for implementar, adicionar um card "Avançado" no
`FormatSelector.tsx` com os campos que funcionam nas duas plataformas
(cookies/proxy/wait-for-video/trim-filenames/windows-filenames), e usar a tag
"Exclusivo Desktop" **apenas** em `cookies-from-browser` e `ffmpeg-location`
(desabilitados/ocultos quando `Capacitor.isNativePlatform()`).

---

## 2. Verificação Ed25519 do updater no Android

O Desktop agora verifica a assinatura Ed25519 do `manifest.json` antes de
instalar qualquer atualização (via `electron/updater/verifyRelease.cjs`, que já
existia em produção no repositório real). O Android, por enquanto, verifica
**apenas SHA-512** do APK contra um arquivo de checksums do release (proteção
real contra corrupção/adulteração do arquivo, mas não contra uma release
inteira forjada com uma nova assinatura).

**Por que não implementei Ed25519 completo no Android agora:** a verificação
nativa de Ed25519 só existe no Android a partir da API 33 (`minSdkVersion` deste
projeto é 24); fazer funcionar em todas as versões exigiria adicionar
BouncyCastle (biblioteca pesada) só para isso. Preferi manter leve, como você
pediu, em vez de inflar o APK por uma camada extra de segurança quando já existe
HTTPS + host pinado (só aceita `github.com`/`objects.githubusercontent.com`) +
SHA-512.

**Pré-requisito que falta no lado do release, não do app:** o `manifest.json`
publicado pela pipeline de release atual só lista artefatos `win32-x64` — não
existe uma entrada para Android. Se quiser paridade completa de assinatura no
Android no futuro, o primeiro passo é a pipeline de CI passar a publicar um
artefato `android-arm64` (ou `android-universal`) dentro do mesmo `manifest.json`
assinado.

---

## 3. `ExtractorEngine` — abstração unificada do yt-dlp

Você mandou um brief muito bom sobre isso. Concordo com a direção, mas é um
refactor arquitetural (não um bugfix) e reescrever `DownloadEngine.ts` +
`YtDlpAdapter.ts` + `YtDlpPlugin.kt` por trás de uma interface única
`ExtractorEngine` é trabalho de dias, não de um patch — por isso não mexi nisso
agora, pra não arriscar quebrar o que acabou de ser corrigido. Fica registrado
como próximo passo natural quando o app estiver estável em produção.

Esboço de API pra quando for fazer:

```ts
interface ExtractorEngine {
  probe(url: string, opts?: ProbeOptions): Promise<MediaInfo>;
  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
  download(item: DownloadItem, opts: FormatOptions): AsyncIterable<ProgressEvent>;
  cancel(id: string): Promise<void>;
}
```
Cada plataforma (Electron/Capacitor/HTTP-SSE) implementaria essa interface, e
`DownloadEngine.ts` pararia de ter três `if (hasElectronBridge) {...} else if
(isCapacitor) {...} else {...}` espalhados pelo arquivo — passaria a escolher
UMA implementação de `ExtractorEngine` na inicialização e nunca mais checar a
plataforma de novo.

---

## 4. Sistema de update em tempo real (WebSocket/SSE/FCM/webhooks)

Como conversamos: isso é arquitetura de nível Discord/Steam/VS Code, pensada pra
centenas de milhares de usuários. O que existe hoje (polling do GitHub Releases
ao abrir o app + verificação criptográfica real) é adequado pro estágio atual
do projeto. Não implementei nada disso agora — fica só registrado que, se um dia
a base de usuários justificar, o caminho é um backend leve (Cloudflare
Worker/Vercel Function) recebendo GitHub Webhooks e retransmitindo via SSE.

---

## 5. Achados de performance/storage no Android (não bloqueantes)

- **Cópia dupla de arquivo grande:** `copyToMediaStore()` no `YtDlpPlugin.kt`
  baixa o vídeo pro storage interno do app e depois copia byte-a-byte pro
  storage público (`MediaStore.Downloads`). Isso é o jeito **correto** de
  respeitar o scoped storage do Android 10+ (não dá pra evitar sem usar SAF,
  que é mais complexo pro usuário escolher pasta manualmente) — mas em vídeos
  de 4K grandes (2-4GB) isso significa ocupar o dobro de espaço
  temporariamente e um passo extra de I/O. Não é bug, é o preço da conformidade
  com o Android moderno. Se espaço em disco virar problema real, o próximo
  passo seria abrir um `OutputStream` direto pro MediaStore e teoricamente
  redirecionar a saída do yt-dlp pra lá — mas o `youtubedl-android` exige um
  path de arquivo real pro `-o`, então não dá pra fazer isso sem patchear a lib.
- **`wifiOnly` não é aplicado em lugar nenhum:** existe como campo em
  `AppSettings` mas nenhum código do app checa o tipo de conexão antes de
  iniciar um download. Se for uma feature que importa pro usuário final, vale
  implementar checando `ConnectivityManager` no Android (e o equivalente do
  Electron/browser) antes de `processQueue()` liberar a fila.
- **Concorrência padrão (`maxConcurrent: 3`):** rodar 3 processos yt-dlp/ffmpeg
  simultâneos consome bastante CPU/RAM num aparelho móvel comparado a um
  desktop. Não vi indicação de que isso está causando problema, só registro
  como algo pra observar em aparelhos mais fracos.

---

## 6. Suspeita a confirmar: falha de merge do ffmpeg em emuladores x86_64

Durante a sessão de debug do "download não inicia", uma hipótese que não deu
pra confirmar sem acesso a um emulador real: se o formato selecionado exigir
merge de vídeo+áudio separados (comum em qualidade alta do YouTube), o yt-dlp
chama o ffmpeg bundled pela lib pra juntar os dois arquivos. Se esse binário
específico não rodar corretamente no emulador que você está usando (AVD
x86_64 vs. dispositivo real arm64), o download falharia especificamente nesse
passo — e agora que a mensagem de erro aparece na UI (era o bug #1 da sessão de
debug), o texto do erro vai deixar isso óbvio se for o caso. Teste um formato
"progressivo" (áudio+vídeo já juntos, geralmente qualidades mais baixas) como
comparação: se esse funcionar e um formato que precisa de merge falhar, é essa
a causa.
