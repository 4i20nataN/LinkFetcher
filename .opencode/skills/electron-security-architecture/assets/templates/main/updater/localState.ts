// main/updater/localState.ts
// Piso de versão anti-rollback, persistido de forma cifrada (integridade via
// GCM auth tag do próprio `safeStorage` do Electron — falha de decrypt =
// arquivo adulterado = tratado como "nenhum estado local", nunca como
// "aceitar qualquer versão").

import { app, safeStorage } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { LocalUpdateState } from './types';

function statePath(): string {
  return path.join(app.getPath('userData'), 'update-state.bin');
}

export async function loadLocalState(): Promise<LocalUpdateState | null> {
  try {
    const encrypted = await fs.readFile(statePath());
    if (!safeStorage.isEncryptionAvailable()) {
      logSecurityEvent('update.state_encryption_unavailable', {});
      return null; // fail secure: sem estado confiável, trata como instalação nova
    }
    const decrypted = safeStorage.decryptString(encrypted);
    return JSON.parse(decrypted) as LocalUpdateState;
  } catch {
    return null; // arquivo ausente, corrompido ou adulterado — nunca lança, nunca assume válido
  }
}

export async function saveLocalState(state: LocalUpdateState): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    logSecurityEvent('update.state_encryption_unavailable', {});
    throw new Error('cannot persist update state securely');
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(state));
  await fs.writeFile(statePath(), encrypted, { mode: 0o600 });
}

declare function logSecurityEvent(event: string, context: Record<string, unknown>): void;
