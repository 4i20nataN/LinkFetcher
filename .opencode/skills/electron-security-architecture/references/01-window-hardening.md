# 01 — Window & Session Hardening

## `BrowserWindow` — configuração mínima obrigatória

```ts
import { BrowserWindow, session, shell } from 'electron';
import path from 'node:path';

export function createSecureWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false, // só mostrar após 'ready-to-show' (evita flash + race conditions)
    webPreferences: {
      contextIsolation: true,          // obrigatório
      sandbox: true,                   // obrigatório
      nodeIntegration: false,          // obrigatório
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,               // nunca desabilitar, nem em dev
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      navigateOnDragDrop: false,
      spellcheck: false,               // reduz superfície (spellcheck faz upload de texto)
      enableWebSQL: false,
      webviewTag: false,               // <webview> desabilitada — usar BrowserView/child window controlado se necessário
      preload: path.join(__dirname, 'preload.js'),
      devTools: process.env.NODE_ENV !== 'production',
    },
  });

  win.once('ready-to-show', () => win.show());
  win.removeMenu(); // remove menu padrão (evita DevTools via atalho/menu em produção)

  hardenNavigation(win);
  hardenWindowCreation(win);
  hardenPermissions(win.webContents.session);

  return win;
}
```

## Navigation guard

Bloqueia navegação para qualquer origem fora da allowlist — essencial em apps
que renderizam conteúdo de terceiros (players, preview de link etc.).

```ts
const ALLOWED_NAVIGATION_ORIGINS = new Set<string>([
  // origem do próprio app (file:// ou dev server local), nada além disso
]);

function hardenNavigation(win: BrowserWindow) {
  win.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    if (!ALLOWED_NAVIGATION_ORIGINS.has(target.origin)) {
      event.preventDefault();
      logSecurityEvent('navigation.blocked', { url });
    }
  });

  // qualquer link externo abre no browser do SO, nunca dentro do app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    } else {
      logSecurityEvent('external_open.blocked', { url });
    }
    return { action: 'deny' }; // nunca deixar o Electron criar a janela
  });
}
```

`isSafeExternalUrl` deve, no mínimo: exigir protocolo `https:` (nunca `http:`,
`file:`, `javascript:`, `data:`), validar contra allowlist de hosts se o
contexto permitir, e rejeitar userinfo embutido na URL (`user:pass@host`,
vetor clássico de phishing de URL).

## Window creation guard

Nunca permitir `window.open` criar uma nova `BrowserWindow` com privilégios
próprios. Combinado com `setWindowOpenHandler` acima retornando sempre
`{ action: 'deny' }` para qualquer janela nova — se o app realmente precisa
de uma segunda janela (ex.: player em tela cheia), crie-a explicitamente pelo
processo main com a mesma função `createSecureWindow`, nunca a partir de um
`window.open` do renderer.

## Permission handlers

Electron nega por padrão, mas sem handler explícito alguns pedidos (media,
geolocation, notifications) podem cair em prompts default do Chromium.
Negue tudo explicitamente e libere só o estritamente necessário:

```ts
function hardenPermissions(ses: Electron.Session) {
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = new Set(['clipboard-read']); // ajuste à necessidade real do app
    callback(allowed.has(permission));
  });

  ses.setPermissionCheckHandler(() => false); // fail-secure: nega checagens síncronas por padrão

  ses.setDevicePermissionHandler(() => false); // USB/HID/Serial — quase nunca necessário
}
```

## Certificate validation

Nunca sobrescrever `certificate-error` para aceitar certificados inválidos,
nem em dev. Se o app precisa de pinning adicional para um domínio
específico (ex.: o próprio endpoint de update — ver `05-update-security.md`),
valide o fingerprint manualmente:

```ts
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // NUNCA aceitar (callback(true)) — sempre negar e logar
  callback(false);
  logSecurityEvent('tls.certificate_error', { url, error });
});
```

## Deep link validation

Se o app registra um protocolo customizado (`myapp://`), trate o payload como
entrada não confiável vinda da internet (pode chegar via link em navegador,
email, chat):

- Parse com `new URL()`, nunca `split('://')`/regex manual.
- Whitelist de `pathname`/ação — comandos não reconhecidos são ignorados,
  não "melhor-esforço interpretados".
- Nunca repassar parâmetros do deep link diretamente para `shell.openPath`,
  `child_process`, ou concatenação de path — ver `03-input-validation.md`.

## Session isolation

- Um `partition` de sessão dedicado por tipo de conteúdo não confiável
  (ex.: preview de página externa isolado da sessão principal autenticada).
- `session.defaultSession.setSpellCheckerEnabled(false)`.
- Desabilitar cache de sessão para conteúdo sensível quando aplicável
  (`{ partition: 'persist:...' }` vs sessão em memória).

## Protocolo seguro para assets locais

Evitar `file://` diretamente (permite path traversal para o filesystem
inteiro). Registrar um protocolo customizado com `protocol.handle` que
resolve apenas dentro do diretório de assets, canonicalizando o path antes
(ver `03-input-validation.md#path-traversal`).
