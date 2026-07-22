/**
 * handlers.cjs — wires the renderer-facing IPC channels declared in
 * electron/preload.cjs to updateManager.cjs / verifyRelease.cjs. Was required
 * by electron/main.cjs (`require('./updater/handlers.cjs')`) but did not exist.
 *
 * IPC contract (see preload.cjs):
 *   update:check           → { updateAvailable, version?, portable? }
 *   update:apply  (opts?)  → { ok, installerPath?, error?, portable? }
 *   update:install(opts)   → { ok, error? }   (opts.installerPath)
 *   → push 'update:progress' { stage: 'downloading'|'verifying'|'ready'|'error', ... }
 *   → push 'update:available' { version, portable? }
 */

const { ipcMain, app, shell } = require('electron');
const { checkForUpdate, downloadAndVerifyUpdate, downloadAndExtractPortable, setLogger } = require('./updateManager.cjs');

let cachedManifest = null;
let cachedRelease = null;

function registerUpdateHandlers(mainWindow, isPortable = false) {
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
      return { updateAvailable: !!result.updateAvailable, version: result.manifest?.version, portable: isPortable };
    } catch (err) {
      return { updateAvailable: false, error: err.code || err.message, portable: isPortable };
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
        return { ok: false, error: 'Nenhuma atualização disponível', portable: isPortable };
      }

      let installerPath;
      if (isPortable) {
        installerPath = await downloadAndExtractPortable(cachedManifest, cachedRelease, (received, total) => {
          send('update:progress', {
            stage: 'downloading',
            received,
            total,
            percent: total > 0 ? Math.round((received / total) * 100) : undefined,
          });
        });
      } else {
        installerPath = await downloadAndVerifyUpdate(cachedManifest, cachedRelease, (received, total) => {
          send('update:progress', {
            stage: 'downloading',
            received,
            total,
            percent: total > 0 ? Math.round((received / total) * 100) : undefined,
          });
        });
      }
      send('update:progress', { stage: 'ready' });
      return { ok: true, installerPath, portable: isPortable };
    } catch (err) {
      send('update:progress', { stage: 'error', error: err.code || err.message });
      return { ok: false, error: err.code || err.message, portable: isPortable };
    }
  });

  ipcMain.handle('update:install', async (_event, opts) => {
    const installerPath = opts?.installerPath;
    if (!installerPath) return { ok: false, error: 'installerPath ausente' };

    if (isPortable) {
      // Portable: files already extracted over current app folder.
      // Just restart the app to load new version.
      infoLog('Portable update ready, restarting app...');
      app.relaunch();
      app.exit(0);
      return { ok: true };
    }

    try {
      // Desktop: shell.openPath launches the NSIS installer via the OS;
      // it takes over (can replace the running app's files once we quit).
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