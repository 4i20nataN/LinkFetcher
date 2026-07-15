# Auto-Update via GitHub Releases

Documentação técnica do sistema de atualizações automáticas silenciosas usando `electron-updater` + GitHub Releases como servidor de distribuição de binários.

---

## Visão Geral

O aplicativo verifica em segundo plano se há uma nova Release no GitHub. Se houver, baixa silenciosamente e, ao concluir, exibe um toast elegante perguntando ao usuário se deseja reiniciar agora ou depois. **Nunca força a atualização.**

---

## Arquitetura

```
GitHub Releases (hospeda .exe/.nsis)
        │
        ▼
electron-updater (autoUpdater)
        │
        ├── checkForUpdatesAndNotify() → ao iniciar o app
        ├── setInterval(2h)            → polling periódico
        │
        ├── on('update-available')     → log + status discreto na UI
        ├── on('update-downloaded')    → IPC → show-update-banner
        │
        └── ipcMain('aplicar-atualizacao') → quitAndInstall()
```

---

## Configuração Necessária

### 1. Dependência

```bash
npm install electron-updater
```

### 2. Bloco `publish` no `package.json` → chave `build`

```json
"publish": {
  "provider": "github",
  "owner": "SEU_USUARIO_GITHUB",
  "repo": "NOME_DO_REPOSITORIO"
}
```

---

## Arquivos Envolvidos

| Arquivo | Modificação |
|---------|-------------|
| `package.json` | Adicionar `electron-updater` + bloco `publish` |
| `electron/main.cjs` | Importar `autoUpdater`, criar função de gerenciamento, listeners IPC |
| `electron/preload.cjs` | Expor `onUpdateAvailable`, `onShowUpdateBanner`, `applyUpdate` |
| `src/global.d.ts` | Tipar os novos métodos na interface `Window.electronAPI` |
| `src/components/UpdateBanner.tsx` | **[NOVO]** Toast flutuante com framer-motion |
| `src/App.tsx` | Renderizar `<UpdateBanner />` no nível raiz |

---

## Código do Main Process

```javascript
const { autoUpdater } = require("electron-updater");

autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;

function iniciarGerenciadorDeAtualizacoes(mainWindow) {
  autoUpdater.checkForUpdatesAndNotify();

  // Polling a cada 2 horas
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 2 * 60 * 60 * 1000);

  autoUpdater.on('update-available', (info) => {
    console.log('Nova atualização encontrada:', info.version);
    mainWindow.webContents.send('update-available-status', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Atualização baixada com sucesso.');
    mainWindow.webContents.send('show-update-banner', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('Erro no auto-updater:', err);
  });
}
```

### IPC de Confirmação

```javascript
const { ipcMain } = require('electron');

ipcMain.on('aplicar-atualizacao', () => {
  autoUpdater.quitAndInstall();
});
```

---

## UI: Toast de Atualização

- Componente isolado `UpdateBanner.tsx`
- Aparece no canto inferior direito com animação suave (framer-motion)
- Estilo Glassmorphism integrado ao tema escuro
- Dois botões: **"Atualizar Agora"** (dispara IPC) e **"Depois"** (fecha o toast)
- Se o usuário clicar "Depois", a atualização é aplicada automaticamente na próxima vez que fechar o app

---

## Fluxo do Usuário

1. App inicia → checa atualizações silenciosamente
2. Se nova versão existe → download automático em background
3. Download concluído → toast aparece: *"Nova versão v1.x.x disponível!"*
4. Usuário clica **"Atualizar Agora"** → app reinicia com a versão nova
5. Usuário clica **"Depois"** → toast fecha, atualização aplica no próximo restart

---

## Status: ⏳ Pendente de Implementação

> Aguardando o **Owner** e **Repo** do GitHub para preencher o bloco `publish` e iniciar a implementação.
