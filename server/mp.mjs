// Cliente mínimo do Mercado Pago (fetch nativo; Pix via POST /v1/payments).
// MP_API_BASE só p/ stub local.
const API = process.env.MP_API_BASE || 'https://api.mercadopago.com';

function token() {
  const t = process.env.MP_ACCESS_TOKEN || '';
  if (!t) throw new Error('MP_ACCESS_TOKEN ausente');
  return t;
}

export async function createPixPayment({ amount, email, externalReference, notificationUrl, idempotencyKey }) {
  const exp = new Date(Date.now() + 35 * 60_000);
  const res = await fetch(`${API}/v1/payments`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${token()}`,
      'content-type': 'application/json',
      'x-idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: Number(amount),
      description: 'LinkFetcher PRO mensal',
      payment_method_id: 'pix',
      payer: { email },
      external_reference: externalReference,
      notification_url: notificationUrl,
      date_of_expiration: exp.toISOString().replace(/\.\d+Z$/, '-03:00'),
    }),
  });
  if (!res.ok) throw new Error(`mp-create ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Fonte da verdade: busca o pagamento direto no MP (nunca confia no webhook). */
export async function getPayment(mpId) {
  const res = await fetch(`${API}/v1/payments/${encodeURIComponent(mpId)}`, {
    headers: { 'authorization': `Bearer ${token()}` },
  });
  if (!res.ok) return null;
  return res.json();
}
