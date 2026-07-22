'use strict';

/**
 * localState.cjs — anti-rollback version floor, persisted encrypted via
 * Electron's safeStorage (OS keychain-backed). Any decrypt failure is treated
 * as "no local state" (fail secure), never as "accept any version".
 */

const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

function statePath() {
  return path.join(app.getPath('userData'), 'update-state.bin');
}

function loadLocalState() {
  try {
    const encrypted = fs.readFileSync(statePath());
    if (!safeStorage.isEncryptionAvailable()) {
      return null; // fail secure: no trusted state available
    }
    const decrypted = safeStorage.decryptString(encrypted);
    return JSON.parse(decrypted);
  } catch {
    return null; // missing, corrupted, or tampered — never throws, never assumes valid
  }
}

function saveLocalState(state) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('cannot persist update state securely');
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(state));
  fs.writeFileSync(statePath(), encrypted, { mode: 0o600 });
}

module.exports = { loadLocalState, saveLocalState };
