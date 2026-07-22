'use strict';

/**
 * handlers.cjs — wires the renderer-facing IPC channels declared in
 * electron/preload.cjs to updateManager.cjs / verifyRelease.cjs. Was required
 * by electron/main.cjs (`require('./updater/handlers.cjs')`) but did not exist.
 *
 * IPC contract (see preload.cjs):
 *   update:check           → { updateAvailable, version? }
 *   update:apply  (opts?)  → { ok, installerPath?, error? }
 *   update:install(opts)   → { ok, error? }   (opts.installerPath)
 *   → push 'update:progress' { stage: 'downloading'|'verifying'|'ready'|'error', ... }
 *   → push 'update:available' { version }
 */

const { ipcMain, app, shell } = require('electron');
const { checkForUpdate, downloadAndVerifyUpdate, setLogger } = require('./updateManager.cjs');

let cachedManifest = null;
let cachedRelease = null;

function registerUpdateHandlers(mainWindow) {
  const send = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  setLogger(
    (...args) => console.log('[updater]', ...args),
    (...args) => console.error('[updater]', ...args)
  );

  ipcMain.handle('update:check', async () => {
    try {
      const result = await checkForUpdate();
      if (result.updateAvailable) {
        cachedManifest = result.manifest;
        cachedRelease = result.release;
      }
      return { updateAvailable: !!result.updateAvailable, version: result.manifest?.version };
    } catch (err) {
      return { updateAvailable: false, error: err.code || err.message };
    }
  });

  ipcMain.handle('update:apply', async (_event, opts) => {
    try {
      if (!cachedManifest || (opts?.version && cachedManifest.version !== opts.version)) {
        const result = await checkForUpdate();
        cachedManifest = result.manifest || null;
        cachedRelease = result.release || null;
      }
      if (!cachedManifest || !cachedRelease) {
        return { ok: false, error: 'Nenhuma atualização disponível' };
      }

      const installerPath = await downloadAndVerifyUpdate(cachedManifest, cachedRelease, (received, total) => {
        send('update:progress', {
          stage: 'downloading',
          received,
          total,
          percent: total > 0 ? Math.round((received / total) * 100) : undefined,
        });
      });
      send('update:progress', { stage: 'ready' });
      return { ok: true, installerPath };
    } catch (err) {
      send('update:progress', { stage: 'error', error: err.code || err.message });
      return { ok: false, error: err.code || err.message };
    }
  });

  ipcMain.handle('update:install', async (_event, opts) => {
    const installerPath = opts?.installerPath;
    if (!installerPath) return { ok: false, error: 'installerPath ausente' };
    try {
      // shell.openPath launches the NSIS installer via the OS; it takes over
      // from there (it can replace the running app's files once we quit).
      const openError = await shell.openPath(installerPath);
      if (openError) return { ok: false, error: openError };
      setTimeout(() => app.quit(), 500);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerUpdateHandlers };

