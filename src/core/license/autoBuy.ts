// Compra automática PRO (Mercado Pago via license server em Cloudflare Workers).
// Ativo: LICENSE_SERVER_URL aponta para o Worker de produção.

/** HTTPS do license server. '' = recurso oculto. */
export const LICENSE_SERVER_URL = 'https://linkfetcher-licenses.linkfetcher.workers.dev';

export interface AutoCheckout {
  checkoutId: string;
  qrText: string;
  qrImage: string | null;
  expiresAt: number;
}

export function autoBuyEnabled(): boolean {
  return LICENSE_SERVER_URL.length > 0;
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${LICENSE_SERVER_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const err = new Error(`server-${res.status}`) as Error & { body?: unknown };
    try {
      err.body = await res.json();
    } catch { /* sem corpo */ }
    throw err;
  }
  return res.json();
}

export function createAutoCheckout(email: string, contact: string): Promise<AutoCheckout> {
  return api('/api/checkout', { method: 'POST', body: JSON.stringify({ email, contact }) });
}

export function fetchAutoKey(checkoutId: string, contact: string): Promise<{ status: string; key?: string; emailSent?: boolean }> {
  return api(`/api/key/${encodeURIComponent(checkoutId)}?contact=${encodeURIComponent(contact)}`);
}

export function recoverKey(contact: string): Promise<{ status: string; days?: number; emailSent?: boolean }> {
  return api(`/api/recover?contact=${encodeURIComponent(contact)}`);
}

const LAST_CHECKOUT_KEY = 'lf-last-checkout';

export function saveLastCheckout(email: string, co: AutoCheckout): void {
  try {
    localStorage.setItem(LAST_CHECKOUT_KEY, JSON.stringify({ email, co }));
  } catch { /* sem storage: sem resume */ }
}

export function loadLastCheckout(): { email: string; co: AutoCheckout } | null {
  try {
    const raw = localStorage.getItem(LAST_CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email: string; co: AutoCheckout };
    if (!parsed?.co?.checkoutId || !parsed.email || Date.now() > (parsed.co.expiresAt || 0)) {
      localStorage.removeItem(LAST_CHECKOUT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearLastCheckout(): void {
  try {
    localStorage.removeItem(LAST_CHECKOUT_KEY);
  } catch { /* nada */ }
}
