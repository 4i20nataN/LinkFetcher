// Validação do webhook v2 do Mercado Pago (documentação oficial):
// header `x-signature: ts=<ts>,v1=<hmac>` + header `x-request-id`.
// Manifesto: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
// HMAC-SHA256 com o segredo do dashboard (hex minúsculo), ts ±5min.
// Suporta também o formato legado (?id=..&topic=payment).
import { createHmac, timingSafeEqual } from 'node:crypto';

export function extractPaymentId(jsonBody, searchParams) {
  if (jsonBody && jsonBody.type === 'payment' && jsonBody?.data?.id) {
    return String(jsonBody.data.id);
  }
  const topic = searchParams.get('topic') || searchParams.get('type');
  const id = searchParams.get('id') || searchParams.get('data.id');
  if (id && (!topic || topic === 'payment')) return String(id);
  return null;
}

export function verifySignature({ secret, signatureHeader, requestId, dataId, nowMs = Date.now() }) {
  if (!secret || !signatureHeader || !requestId || !dataId) return false;
  const parts = Object.fromEntries(
    String(signatureHeader).split(',').map(p => {
      const i = p.indexOf('=');
      return i < 0 ? [] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }).filter(a => a.length === 2),
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;
  if (Math.abs(nowMs - Number(ts) * 1000) > 5 * 60_000) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(v1).toLowerCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
