// Guarda local da licença PRO (localStorage): a assinatura é verificada UMA
// vez na ativação; aqui vale presença + expiração.
import { useSyncExternalStore } from 'react';

export interface LicenseRecord {
  key: string;
  name: string;
  plan: string;
  /** unix seconds; 0 = vitalícia */
  expiresAt: number;
  activatedAt: string;
  /** contato informado na compra (e-mail ou WhatsApp); '' = não informado */
  contact: string;
}

const LS_KEY = 'linkfetcher_license';

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: LicenseRecord | null | undefined;

function read(): LicenseRecord | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as LicenseRecord;
    if (typeof p.key !== 'string' || typeof p.expiresAt !== 'number') return null;
    return p;
  } catch {
    return null;
  }
}

export function getLicense(): LicenseRecord | null {
  if (cache === undefined) cache = read();
  return cache;
}

function emit() {
  listeners.forEach(l => l());
}

export function saveLicense(rec: LicenseRecord): void {
  cache = rec;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rec));
  } catch { /* quota cheia: vale na sessão */ }
  emit();
}

export function clearLicense(): void {
  cache = null;
  try {
    localStorage.removeItem(LS_KEY);
  } catch { /* ignore */ }
  emit();
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useLicense(): LicenseRecord | null {
  return useSyncExternalStore(subscribe, getLicense, getLicense);
}
