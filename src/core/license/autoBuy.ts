// Compra automática PRO (Mercado Pago via license server).
// DORMENTE até LICENSE_SERVER_URL ser preenchida (ver server/README.md).
// Com vazio, o modal usa só o fluxo manual (QR próprio + chave digitada).

/** HTTPS do license server. '' = recurso oculto. */
export const LICENSE_SERVER_URL = '';

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
  if (!res.ok) throw new Error(`server-${res.status}`);
  return res.json();
}

export function createAutoCheckout(email: string, contact: string): Promise<AutoCheckout> {
  return api('/api/checkout', { method: 'POST', body: JSON.stringify({ email, contact }) });
}

export function fetchAutoKey(checkoutId: string, contact: string): Promise<{ status: string; key?: string }> {
  return api(`/api/key/${encodeURIComponent(checkoutId)}?contact=${encodeURIComponent(contact)}`);
}
