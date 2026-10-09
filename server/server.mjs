// LinkFetcher License Server — verificação automática de Pix (Mercado Pago)
// + emissão de chaves PRO. Zero dependências (só Node 22+: fetch, crypto,
// JSON). Roda em qualquer VPS/PaaS: `node server/server.mjs`.
//
// Fluxo:
//   app → POST /api/checkout {email, contact} → cria Pix no MP (R$ 9,99,
//     external_reference=lf-<id>) → devolve QR/copia-e-cola + checkoutId
//   app → GET /api/key/:id?contact=... (poll 5s) → {status} → {key} pago
//   MP  → POST /api/webhook/mercadopago (x-signature) → confere valor exato,
//     aprova, minta a chave (30 dias) e guarda (idempotente).
// A fonte da verdade é SEMPRE o GET no MP — nunca o corpo do webhook.
// Sem webhook (perdido), o próprio poll revalida no MP após 45s.
//
// Segredos SÓ via env (nunca no repo): ver .env.example.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createPixPayment, getPayment } from './mp.mjs';
import { verifySignature, extractPaymentId } from './webhook.mjs';
import { mintKeyFor } from './mint.mjs';
import { loadAll, saveAll } from './store.mjs';

const PORT = Number(process.env.PORT || 8787);
const PRICE = Number(process.env.PRICE || '9.99');
const PLAN_DAYS = Number(process.env.PLAN_DAYS || '30');
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const json = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
};
const readBody = (req, limit = 64 * 1024) => new Promise((resolve, reject) => {
  let n = 0;
  const chunks = [];
  req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('body-too-large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});
// Freio simples: 20 checkouts/min por IP (sem estado externo).
const hits = new Map();
function rateOk(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length <= 20;
}

// Transição pending→paid centralizada (webhook OU refresh do poll).
// Idempotente: 2º processamento do mesmo pagamento não minta de novo.
async function settleCheckout(db, checkout) {
  if (checkout.status === 'paid' && checkout.key) return checkout;
  const pay = await getPayment(checkout.mpId);
  if (!pay || pay.status !== 'approved') {
    checkout.status = pay?.status === 'rejected' || pay?.status === 'cancelled' ? pay.status : 'pending';
    checkout.updatedAt = new Date().toISOString();
    return checkout;
  }
  // Valor exato exigido: transação tem que ser R$ PRICE em BRL.
  const amountOk = Math.abs(Number(pay.transaction_amount) - PRICE) < 0.005 && pay.currency_id === 'BRL';
  if (!amountOk) {
    checkout.status = 'amount_mismatch';
    checkout.updatedAt = new Date().toISOString();
    return checkout;
  }
  checkout.key = await mintKeyFor(checkout.contactName || checkout.email, PLAN_DAYS);
  checkout.status = 'paid';
  checkout.paidAt = new Date().toISOString();
  checkout.updatedAt = checkout.paidAt;
  return checkout;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://x');
    const ip = req.socket.remoteAddress || '?';

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, { ok: true });
    }

    // ---- Checkout: cria o Pix no MP ----
    if (req.method === 'POST' && url.pathname === '/api/checkout') {
      if (!rateOk(ip)) return json(res, 429, { error: 'rate-limited' });
      let body;
      try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'bad-json' }); }
      const email = String(body.email || '').trim().toLowerCase();
      const contact = String(body.contact || email).trim().slice(0, 60);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !contact) {
        return json(res, 400, { error: 'bad-contact' });
      }
      const checkoutId = randomUUID();
      const mp = await createPixPayment({
        amount: PRICE,
        email,
        externalReference: `lf-${checkoutId}`,
        notificationUrl: `${BASE_URL}/api/webhook/mercadopago`,
        idempotencyKey: checkoutId,
      });
      const db = loadAll();
      db.checkouts[checkoutId] = {
        mpId: String(mp.id), email, contactName: contact,
        price: PRICE, days: PLAN_DAYS, status: 'pending',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        lastMpCheck: Date.now(),
      };
      saveAll(db);
      const tx = mp.point_of_interaction?.transaction_data || {};
      return json(res, 201, {
        checkoutId,
        qrText: tx.qr_code || null,
        qrImage: tx.qr_code_base64 ? `data:image/png;base64,${tx.qr_code_base64}` : null,
        expiresAt: Date.now() + 35 * 60_000,
      });
    }

    // ---- Poll da chave (só entrega p/ o contato da compra) ----
    const keyMatch = url.pathname.match(/^\/api\/key\/([A-Za-z0-9-]+)$/);
    if (req.method === 'GET' && keyMatch) {
      const db = loadAll();
      const checkout = db.checkouts[keyMatch[1]];
      if (!checkout) return json(res, 404, { error: 'not-found' });
      const who = String(url.searchParams.get('contact') || '').trim().toLowerCase();
      const same = who && (who === String(checkout.email).toLowerCase()
        || who === String(checkout.contactName).toLowerCase());
      // Fallback anti-webhook-perdido: revalida no MP a cada 45s.
      if (checkout.status === 'pending' && Date.now() - (checkout.lastMpCheck || 0) > 45_000) {
        checkout.lastMpCheck = Date.now();
        await settleCheckout(db, checkout);
        saveAll(db);
      }
      if (checkout.status !== 'paid') return json(res, 200, { status: checkout.status });
      if (!same) return json(res, 403, { error: 'contact-mismatch' });
      return json(res, 200, { status: 'paid', key: checkout.key });
    }

    // ---- Webhook do Mercado Pago ----
    if (req.method === 'POST' && url.pathname === '/api/webhook/mercadopago') {
      const raw = await readBody(req);
      let body = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
      const paymentId = extractPaymentId(body, url.searchParams);
      const secret = process.env.MP_WEBHOOK_SECRET || '';
      if (!secret) { console.error('MP_WEBHOOK_SECRET ausente'); return json(res, 500, { error: 'not-configured' }); }
      if (!paymentId || !verifySignature({
        secret,
        signatureHeader: req.headers['x-signature'],
        requestId: req.headers['x-request-id'],
        dataId: paymentId,
      })) {
        return json(res, 401, { error: 'bad-signature' });
      }
      const db = loadAll();
      const checkout = Object.values(db.checkouts).find(c => String(c.mpId) === String(paymentId));
      if (!checkout) return json(res, 200, { ok: true, unknown: true }); // ack p/ não reter fila
      checkout.lastMpCheck = Date.now();
      await settleCheckout(db, checkout);
      saveAll(db);
      return json(res, 200, { ok: true, status: checkout.status });
    }

    return json(res, 404, { error: 'not-found' });
  } catch (err) {
    console.error('server error:', err?.message || err);
    return json(res, 500, { error: 'internal' });
  }
});

server.listen(PORT, () => console.log(`license server :${PORT} (R$ ${PRICE.toFixed(2)} / ${PLAN_DAYS}d)`));
