/**
 * localState.js — Anti-rollback version ratchet.
 *
 * Persists the highest version successfully installed using Electron's
 * safeStorage (DPAPI on Windows, Keychain on macOS, libsecret on Linux).
 * If decryption fails (file tampered), treats as "no state" = fresh install.
 * Never trusts a plaintext or unprotected state file.
 *
 * References: electron-security-architecture/05-update-security.md
 */

'use strict';

const { app, safeStorage } = require('electron');
const { promises: fs } = require('node:fs');
const path = require('node:path');

function statePath() {
  return path.join(app.getPath('userData'), 'update-state.bin');
}

async function loadLocalState() {
  try {
    const encrypted = await fs.readFile(statePath());
    if (!safeStorage.isEncryptionAvailable()) {
      return null; // fail secure: no encryption = no trusted state
    }
    const decrypted = safeStorage.decryptString(encrypted);
    return JSON.parse(decrypted);
  } catch {
    return null; // file missing, corrupted, or tampered — never throws, never assumes valid
  }
}

async function saveLocalState(state) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('cannot persist update state securely: safeStorage unavailable');
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(state));
  await fs.writeFile(statePath(), encrypted, { mode: 0o600 });
}

module.exports = { loadLocalState, saveLocalState };
