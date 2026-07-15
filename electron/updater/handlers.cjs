/**
 * handlers.js — IPC handlers for the secure auto-update system.
 *
 * Exposes two channels to the renderer via preload:
 *   - update:check   — checks GitHub for a new release (verify manifest signature)
 *   - update:apply   — downloads verified installer, launches it, quits app
 *
 * Progress is sent one-way from main → renderer via 'update:progress'.
 */

'use strict';

const { ipcMain } = require('electron');
const { checkForUpdate, applyUpdate, launchInstaller } = require('./updateManager.cjs');

function sendToRenderer(mainWindow, channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function registerUpdateHandlers(mainWindow) {
  // ── update:check ─────────────────────────────────────────────────────────
  ipcMain.handle('update:check', async () => {
    try {
      const result = await checkForUpdate();
      return {
        updateAvailable: result.updateAvailable,
        version: result.manifest ? result.manifest.version : undefined,
        currentVersion: require('electron').app.getVersion(),
      };
    } catch (err) {
      // Security errors abort silently — user just sees "up to date"
      const isSecurity = err.name === 'SecurityError';
      console.error('[updater] check failed:', err.code || err.message);
      return {
        updateAvailable: false,
        error: isSecurity ? err.code : 'check_failed',
      };
    }
  });

  // ── update:apply ─────────────────────────────────────────────────────────
  ipcMain.handle('update:apply', async (_event, { version } = {}) => {
    try {
      sendToRenderer(mainWindow, 'update:progress', { stage: 'verifying' });

      const result = await checkForUpdate();
      if (!result.updateAvailable || !result.manifest || !result.release) {
        return { ok: false, error: 'no_update_available' };
      }

      if (version && result.manifest.version !== version) {
        return { ok: false, error: 'version_mismatch' };
      }

      sendToRenderer(mainWindow, 'update:progress', { stage: 'downloading', percent: 0 });

      const { installerPath, version: installedVersion } = await applyUpdate(
        result.manifest,
        result.release,
        (received, total) => {
          const percent = total > 0 ? Math.round((received / total) * 100) : 0;
          sendToRenderer(mainWindow, 'update:progress', {
            stage: 'downloading',
            percent,
            received,
            total,
          });
        },
      );

      sendToRenderer(mainWindow, 'update:progress', { stage: 'ready', percent: 100 });

      return { ok: true, installerPath, version: installedVersion };
    } catch (err) {
      const isSecurity = err.name === 'SecurityError';
      console.error('[updater] apply failed:', err.code || err.message);
      sendToRenderer(mainWindow, 'update:progress', {
        stage: 'error',
        error: isSecurity ? err.code : 'apply_failed',
      });
      return { ok: false, error: isSecurity ? err.code : 'apply_failed' };
    }
  });

  // ── update:install (launch installer + quit) ────────────────────────────
  ipcMain.handle('update:install', async (_event, { installerPath } = {}) => {
    if (!installerPath) return { ok: false, error: 'no_installer_path' };
    await launchInstaller(installerPath);
    return { ok: true };
  });
}

module.exports = { registerUpdateHandlers };
