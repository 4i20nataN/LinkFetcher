// LinkFetcher License Server — Cloudflare Workers + D1 (100% gratuito).
// Mesma API do server.mjs em Node: checkout Pix via Mercado Pago,
// poll da chave e webhook. Persistência em D1 (sem disco/VPS).
//
// Rotas:
//   GET  /api/health
//   POST /api/checkout               { email, contact } -> { checkoutId, qrText, qrImage, expiresAt }
//   GET  /api/key/:id?contact=...    -> { status, key? }
//   POST /api/webhook/mercadopago    (Mercado Pago)

const MP_API = 'https://api.mercadopago.com';
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const enc = new TextEncoder();

function b32enc(bytes) {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(acc >>> bits) & 31];
    }
  }
  if (bits > 0) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Trunca UTF-8 em N bytes sem partir caractere multibyte no meio.
function utf8Truncate(s, max) {
  const full = enc.encode(s);
  if (full.length <= max) return full.slice(0, max);
  let n = max;
  while (n > 0) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(full.slice(0, n));
      break;
    } catch {
      n--;
    }
  }
  return full.slice(0, n);
}

// Normaliza contato p/ comparação (case, espaços, unicode).
function normContact(s) {
  return String(s || '').trim().normalize('NFKC').toLowerCase();
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

const priceOf = (env, row) => Number(row?.price ?? env.PRICE ?? '9.99');
const daysOf = (env, row) => Number(row?.days ?? env.PLAN_DAYS ?? '30');

// Catálogo de planos (fonte da verdade no servidor; o app espelha p/ exibir).
// `PLANS_JSON` (secret/var) sobrescreve sem redeploy: {"mensal":{"price":9.99,"days":30,"label":"Mensal"}}.
const BUILTIN_PLANS = {
  semanal: { price: 5, days: 7, label: '7 dias' },
  mensal: { price: 9.99, days: 30, label: '1 mês' },
  trimestral: { price: 24.99, days: 90, label: '3 meses' },
  semestral: { price: 44.99, days: 180, label: '6 meses' },
  anual: { price: 79.99, days: 365, label: '1 ano' },
};

function plansOf(env) {
  try {
    const raw = env.PLANS_JSON ? JSON.parse(env.PLANS_JSON) : null;
    if (raw && typeof raw === 'object') {
      const out = {};
      for (const [id, p] of Object.entries(raw)) {
        const price = Number(p?.price);
        const days = Math.floor(Number(p?.days));
        const label = String(p?.label || id).slice(0, 20);
        if (Number.isFinite(price) && price > 0 && Number.isFinite(days) && days > 0) {
          out[id] = { price, days, label };
        }
      }
      if (out.mensal) return out;
    }
  } catch { /* override inválido: catálogo embutido */ }
  return BUILTIN_PLANS;
}

function planLabelOf(env, row) {
  return String(row?.plan && plansOf(env)[row.plan]?.label || '') || 'PRO';
}

// --- rate limit em memória (best-effort por isolate): 20 checkouts/min por IP ---
const hits = new Map();
function rateOk(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length <= 20;
}

// --- webhook: extração do payment id (igual ao server/webhook.mjs) ---
export function extractPaymentId(jsonBody, searchParams) {
  if (jsonBody && jsonBody.type === 'payment' && jsonBody?.data?.id) {
    return String(jsonBody.data.id);
  }
  const topic = searchParams.get('topic') || searchParams.get('type');
  const id = searchParams.get('id') || searchParams.get('data.id');
  if (id && (!topic || topic === 'payment')) return String(id);
  return null;
}

// --- webhook: HMAC-SHA256 via WebCrypto (ts ±5min) ---
export async function verifySignature({ secret, signatureHeader, requestId, dataId, nowMs = Date.now() }) {
  if (!secret || !signatureHeader || !requestId || !dataId) return false;
  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(',')
      .map((p) => {
        const i = p.indexOf('=');
        return i < 0 ? [] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
      })
      .filter((a) => a.length === 2),
  );
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;
  if (!/^\d+$/.test(ts)) return false;
  if (Math.abs(nowMs - Number(ts) * 1000) > 5 * 60_000) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(manifest));
  const expected = hex(sig).toLowerCase();
  const got = String(v1).toLowerCase();
  if (expected.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

// --- Mercado Pago (fetch nativo; mesma conta do server/mp.mjs) ---
async function createPixPayment(env, { amount, email, externalReference, notificationUrl, idempotencyKey }) {
  if (!env.MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN ausente');
  const exp = new Date(Date.now() + 35 * 60_000);
  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
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
      date_of_expiration: exp.toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`mp-create ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function getPayment(env, mpId) {
  const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(mpId)}`, {
    headers: { authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// --- emissão LF1 (mesmo formato do server/mint.mjs; WebCrypto puro, sem Buffer) ---
let cachedJwkStr = '';
let cachedKey = null;
async function privateKey(env) {
  const raw = env.LICENSE_PRIVATE_JWK || '';
  if (!raw) throw new Error('LICENSE_PRIVATE_JWK ausente');
  if (cachedKey && cachedJwkStr === raw) return cachedKey;
  const jwk = JSON.parse(raw);
  cachedKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  cachedJwkStr = raw;
  return cachedKey;
}

export async function mintKeyFor(env, name, days) {
  const exp = Math.floor(Date.now() / 1000) + Math.floor(Number(days)) * 86400;
  const nb = utf8Truncate(String(name || '').trim(), 24);
  const payload = new Uint8Array(7 + nb.length);
  payload[0] = 0x01;
  payload[1] = 0x01;
  new DataView(payload.buffer).setUint32(2, exp);
  payload[6] = nb.length;
  payload.set(nb, 7);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await privateKey(env), payload));
  const raw = new Uint8Array(payload.length + sig.length);
  raw.set(payload, 0);
  raw.set(sig, payload.length);
  const b32 = b32enc(raw);
  const g = [];
  for (let i = 0; i < b32.length; i += 4) g.push(b32.slice(i, i + 4));
  return `LF1-${g.join('-')}`;
}

// --- e-mail genérico via Brevo (chave usa este; broadcast também) ---
function b64encodeUtf8(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function sendEmail(env, { to, subject, text, html, attachments }) {
  if (!env.BREVO_API_KEY || !env.SMTP_FROM) {
    console.error('email NOT configured (BREVO_API_KEY/SMTP_FROM ausentes)');
    return { sent: false, reason: 'email-not-configured' };
  }
  try {
    const payload = {
      sender: { email: env.SMTP_FROM, name: 'LinkFetcher' },
      to: [{ email: to }],
      subject,
      textContent: text,
    };
    if (html) payload.htmlContent = html;
    if (attachments && attachments.length > 0) {
      payload.attachment = attachments.map((a) => ({
        content: a.base64,
        name: a.name,
      }));
    }
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('email brevo:', res.status);
      return { sent: false, reason: 'send-failed' };
    }
    return { sent: true };
  } catch (err) {
    console.error('email error:', err?.message || err);
    return { sent: false, reason: 'send-failed' };
  }
}

const LOGO_URL = 'https://raw.githubusercontent.com/4i20nataN/LinkFetcher/v1.5.0/public/linkfetcher-banner.png';

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function richText(s) {
  // Escapa e quebra linhas; URLs viram links (parte-se antes de escapar
  // p/ não quebrar `&` do href).
  return String(s ?? '').split(/(https?:\/\/[^\s]+)/g).map((p, i) => {
    if (i % 2 === 1) {
      const url = escHtml(p);
      return `<a href="${url}" style="color:#059669;font-weight:bold;word-break:break-all;">${url}</a>`;
    }
    return escHtml(p).replace(/\n/g, '<br/>');
  }).join('');
}

function firstUrl(s) {
  const m = String(s ?? '').match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

// E-mail de novidade (broadcast): mesmo terno do e-mail da chave, com
// botão de download quando a mensagem traz link.
function broadcastEmailHtml({ tag, subject, message }) {
  const paras = String(message ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<tr><td style="padding-top:10px;font-size:14px;line-height:21px;color:#475569;">${richText(p)}</td></tr>`)
    .join('');
  const url = firstUrl(message);
  const cta = url
    ? `<tr><td align="center" style="padding-top:22px;">
<a href="${escHtml(url)}" style="display:inline-block;padding:13px 34px;border-radius:12px;background:#059669;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">Baixar a nova versão</a>
</td></tr>`
    : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escHtml(subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="background:#0b1220;padding:26px 28px 20px;text-align:center;">
<img src="${LOGO_URL}" alt="LinkFetcher" width="440" style="display:block;margin:0 auto;max-width:100%;height:auto;border:0;"/>
<div style="margin-top:12px;"><span style="display:inline-block;padding:2px 10px;border-radius:9999px;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.4);color:#34d399;font-size:11px;font-weight:bold;letter-spacing:2px;">${escHtml(tag)}</span></div>
</td></tr>
<tr><td style="padding:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:bold;color:#0f172a;">${escHtml(subject)}</td></tr>
${paras}
${cta}
<tr><td style="padding-top:18px;font-size:12px;line-height:18px;color:#94a3b8;">Você recebe porque comprou o LinkFetcher PRO. Sua chave continua válida — nada muda na ativação.</td></tr>
</table>
</td></tr>
<tr><td style="background:#f8fafc;padding:14px 28px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
E-mail automático de novidade — responda se precisar de ajuda.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// Molde HTML do e-mail (tabelas + inline: compatível com Gmail/Outlook).
// `rows` = blocos de conteúdo já escapados; texto puro segue em `text`.
function keyEmailHtml({ preheader, title, lead, key, validity, steps, foot }) {
  const stepRows = steps.map(
    (s, i) => `<tr><td style="padding:7px 0;font-size:14px;line-height:20px;color:#334155;">
      <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:9999px;background:#ecfdf5;color:#059669;font-size:12px;font-weight:bold;margin-right:8px;">${i + 1}</span>${s}</td></tr>`,
  ).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="background:#0b1220;padding:26px 28px 20px;text-align:center;">
<img src="${LOGO_URL}" alt="LinkFetcher" width="440" style="display:block;margin:0 auto;max-width:100%;height:auto;border:0;"/>
<div style="margin-top:12px;"><span style="display:inline-block;padding:2px 10px;border-radius:9999px;background:rgba(52,211,153,.15);border:1px solid rgba(52,211,153,.4);color:#34d399;font-size:11px;font-weight:bold;letter-spacing:2px;">PRO</span></div>
</td></tr>
<tr><td style="padding:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:20px;font-weight:bold;color:#0f172a;">${title}</td></tr>
<tr><td style="padding-top:8px;font-size:14px;line-height:21px;color:#475569;">${lead}</td></tr>
<tr><td style="padding-top:18px;">
<div style="background:#0b1220;border:1px solid #1e293b;border-radius:12px;padding:16px;text-align:center;">
<div style="font-size:11px;letter-spacing:2px;color:#94a3b8;font-weight:bold;margin-bottom:8px;">SUA CHAVE PRO</div>
<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:22px;color:#34d399;word-break:break-all;">${key}</div>
</div>
</td></tr>
<tr><td style="padding-top:14px;font-size:13px;color:#059669;font-weight:bold;">${validity}</td></tr>
<tr><td style="padding-top:14px;font-size:15px;font-weight:bold;color:#0f172a;">Como ativar</td></tr>
${stepRows}
<tr><td style="padding-top:18px;font-size:12px;line-height:18px;color:#94a3b8;">${foot}</td></tr>
</table>
</td></tr>
<tr><td style="background:#f8fafc;padding:14px 28px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
E-mail automático da sua compra — responda se precisar de ajuda.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

async function sendKeyEmail(env, { to, key, days, plan }) {
  const label = plan || 'PRO';
  const text = [
    'Bem-vindo ao PRO! Obrigado por apoiar o LinkFetcher.',
    '',
    'Sua chave PRO:',
    '',
    key,
    '',
    `Plano ${label} — validade: ${days} dias. Como ativar:`,
    '1. Abra o LinkFetcher → Download Personalizado → Ativar PRO',
    '2. Já tenho uma chave (cole a chave acima)',
    '',
    'Guarde este e-mail. Qualquer dúvida, responda por aqui.',
    'Anexo: sua chave também vai em .txt para baixar e guardar.',
  ].join('\n');
  const keyFile = [
    'LinkFetcher PRO — sua chave',
    '',
    key,
    '',
    'Ative em: Download Personalizado → Ativar PRO → Já tenho uma chave.',
    `Validade: ${days} dias.`,
  ].join('\n');
  const html = keyEmailHtml({
    preheader: 'Obrigado por assinar o PRO — sua chave chegou.',
    title: 'Bem-vindo ao PRO! 🎉',
    lead: 'Obrigado por apoiar o LinkFetcher! Sua assinatura já está ativa — copie a chave abaixo e ative no app em menos de 1 minuto. Qualquer dúvida, é só responder este e-mail.',
    key: escHtml(key),
    validity: `Plano ${label} — válido por ${days} dias. Bom proveito!`,
    steps: [
      'Abra o LinkFetcher → <b>Download Personalizado</b> → <b>Ativar PRO</b>',
      'Toque em <b>Já tenho uma chave</b> e cole a chave acima',
    ],
    foot: 'Anexamos sua chave em <b>.txt</b> — baixe e guarde. Perdeu tudo? No app: Download Personalizado → Ativar PRO → <b>Perdi minha chave</b>.',
  });
  return sendEmail(env, {
    to,
    subject: 'Sua chave LinkFetcher PRO',
    text,
    html,
    attachments: [{ name: 'linkfetcher-chave-pro.txt', base64: b64encodeUtf8(keyFile) }],
  });
}

// --- D1 ---
async function getCheckout(env, id) {
  return env.DB.prepare('SELECT * FROM checkouts WHERE checkout_id = ?').bind(id).first();
}

async function findByMpId(env, mpId) {
  return env.DB.prepare('SELECT * FROM checkouts WHERE mp_id = ?').bind(String(mpId)).first();
}

async function saveCheckout(env, c) {
  await env.DB.prepare(
    `INSERT INTO checkouts
     (checkout_id, mp_id, email, contact, plan, price, days, status, license_key, created_at, updated_at, last_check, paid_at, email_sent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(checkout_id) DO UPDATE SET
       status=CASE WHEN checkouts.status = 'paid' THEN 'paid' ELSE excluded.status END,
       license_key=COALESCE(checkouts.license_key, excluded.license_key),
       updated_at=excluded.updated_at, last_check=excluded.last_check,
       paid_at=COALESCE(checkouts.paid_at, excluded.paid_at), email_sent=excluded.email_sent`,
  )
    .bind(
      c.checkout_id,
      String(c.mp_id),
      c.email,
      c.contact,
      String(c.plan || 'mensal').slice(0, 20),
      Number(c.price),
      Number(c.days),
      c.status,
      c.license_key || null,
      c.created_at,
      c.updated_at,
      Number(c.last_check || 0),
      c.paid_at || null,
      c.email_sent ? 1 : 0,
    )
    .run();
}

// Transição pending→paid (webhook ou poll); idempotente. Igual a server/settle.mjs.
async function settleCheckout(env, c) {
  if (c.status === 'paid' && c.license_key) return c;
  const pay = await getPayment(env, c.mp_id);
  if (!pay || pay.status !== 'approved') {
    c.status = pay?.status === 'rejected' || pay?.status === 'cancelled' ? pay.status : 'pending';
    c.updated_at = new Date().toISOString();
    return c;
  }
  const price = priceOf(env, c);
  const amountOk = Math.abs(Number(pay.transaction_amount) - price) < 0.005 && pay.currency_id === 'BRL';
  if (!amountOk) {
    c.status = 'amount_mismatch';
    c.updated_at = new Date().toISOString();
    return c;
  }
  // Amarração pagamento↔checkout: o pagamento tem que citar este checkout.
  if (pay.external_reference && pay.external_reference !== `lf-${c.checkout_id}`) {
    c.status = 'amount_mismatch';
    c.updated_at = new Date().toISOString();
    return c;
  }
  const days = daysOf(env, c);
  c.license_key = await mintKeyFor(env, c.contact || c.email, days);
  c.status = 'paid';
  c.paid_at = new Date().toISOString();
  c.updated_at = c.paid_at;
  if (/@/.test(c.email || '')) {
    const r = await sendKeyEmail(env, { to: c.email, key: c.license_key, days, plan: planLabelOf(env, c) });
    c.email_sent = r.sent ? 1 : 0;
  }
  return c;
}

function timingSafeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function adminOk(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  return timingSafeEq(String(request.headers.get('x-admin-key') || ''), String(env.ADMIN_PASSWORD));
}

const ADMIN_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LinkFetcher PRO — vendas</title>
<style>
body{font-family:system-ui,sans-serif;background:#0A0C12;color:#e2e8f0;margin:0;padding:1.2rem}
h1{font-size:1.1rem}.cards{display:flex;gap:.6rem;flex-wrap:wrap;margin:1rem 0}
.card{background:#15161c;border:1px solid #2a2d38;border-radius:.8rem;padding:.8rem 1rem;min-width:8rem}
.card b{font-size:1.3rem;color:#10b981;display:block}
table{width:100%;border-collapse:collapse;font-size:.8rem;margin-top:.5rem}
th,td{text-align:left;padding:.45rem;border-bottom:1px solid #2a2d38}
input,button{padding:.6rem .8rem;border-radius:.6rem;border:1px solid #2a2d38;font-size:.9rem}
input{background:#15161c;color:#fff;width:100%;box-sizing:border-box}
button{background:#059669;color:#fff;border:none;font-weight:bold;cursor:pointer;width:100%;margin-top:.5rem}
.muted{color:#94a3b8;font-size:.8rem}
</style></head><body>
<h1>LinkFetcher PRO — vendas</h1>
<div id="login">
<input id="pw" type="password" placeholder="Senha do painel" autocomplete="off"/>
<button onclick="enter()">Entrar</button>
</div>
<div id="panel" style="display:none">
<div class="cards" id="cards"></div>
<table><thead><tr><th>Data</th><th>E-mail</th><th>Plano</th><th>Valor</th><th>Status</th><th>E-mail chave</th></tr></thead>
<tbody id="rows"></tbody></table>
<p class="muted">Sem chaves aqui — só totais e status. Comprovante oficial: extrato do Mercado Pago.</p>
</div>
<script>
const key = sessionStorage.getItem('lf-admin');
if (key) load(key);
function enter(){ const v = document.getElementById('pw').value; sessionStorage.setItem('lf-admin', v); load(v); }
async function load(k){
  const r = await fetch('/api/admin/sales', { headers: { 'x-admin-key': k } });
  if (r.status === 401) { sessionStorage.removeItem('lf-admin'); alert('Senha errada'); return; }
  if (!r.ok) { alert('Erro ' + r.status); return; }
  const d = await r.json();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  document.getElementById('login').style.display = 'none';
  document.getElementById('panel').style.display = 'block';
  document.getElementById('cards').innerHTML =
    '<div class="card">Pagas<b>' + d.paid.count + '</b></div>' +
    '<div class="card">Receita<b>' + esc(d.paid.revenue) + '</b></div>' +
    '<div class="card">Pendentes<b>' + d.pending + '</b></div>';
  document.getElementById('rows').innerHTML = d.rows.map(x =>
    '<tr><td>' + esc(x.when) + '</td><td>' + esc(x.email) + '</td><td>' + esc(x.plan) + '</td><td>' + esc(x.price) + '</td><td>' + esc(x.status) + '</td><td>' + (x.emailSent ? 'sim' : 'não') + '</td></tr>'
  ).join('');
}
</script></body></html>`;

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const ip = request.headers.get('cf-connecting-ip') || 'unknown';

      // Preflight CORS (app Tauri/Android chama de http://tauri.localhost).
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { ...CORS } });
      }

      if (request.method === 'GET' && url.pathname === '/api/health') {
        return json({ ok: true });
      }

      // Checkout: cria o Pix no MP.
      if (request.method === 'POST' && url.pathname === '/api/checkout') {
        if (!rateOk(ip)) return json({ error: 'rate-limited' }, 429);
        if (Number(request.headers.get('content-length') || 0) > 64 * 1024) {
          return json({ error: 'body-too-large' }, 413);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'bad-json' }, 400);
        }
        const email = String(body.email || '').trim().normalize('NFKC').toLowerCase();
        const contact = String(body.contact || email).trim().normalize('NFKC').slice(0, 60);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !contact) {
          return json({ error: 'bad-contact' }, 400);
        }
        // A chave só carrega 24 bytes de nome: contato maior mintaria chave
        // que nunca ativa manualmente. Recusa antes de gerar Pix.
        if (enc.encode(contact).length > 24) {
          return json({ error: 'contact-too-long' }, 400);
        }
        // Plano escolhido (default = mensal, p/ app antigo). Validado aqui,
        // antes de qualquer chamada ao MP — plano inválido nunca gera Pix.
        const plans = plansOf(env);
        const planId = String(body.plan || 'mensal').trim().toLowerCase().slice(0, 20);
        const plan = plans[planId];
        if (!plan) {
          return json({ error: 'bad-plan', plans: Object.keys(plans) }, 400);
        }
        const price = plan.price;
        const days = plan.days;
        // Anti-cobrança-dupla: e-mail com PRO ainda válido não gera Pix novo —
        // reenvia a chave e avisa (409). Expirado segue como renovação.
        const prev = await env.DB.prepare(
          `SELECT * FROM checkouts
           WHERE lower(email) = ? AND status = 'paid' AND license_key IS NOT NULL
           ORDER BY paid_at DESC LIMIT 1`,
        ).bind(email).first();
        if (prev) {
          const validUntil = Date.parse(prev.paid_at || prev.created_at) + Number(prev.days || 30) * 86400_000;
          if (validUntil > Date.now()) {
            if (/@/.test(prev.email || '')) {
              const r = await sendKeyEmail(env, { to: prev.email, key: prev.license_key, days: daysOf(env, prev), plan: planLabelOf(env, prev) });
              prev.email_sent = r.sent ? 1 : 0;
              prev.updated_at = new Date().toISOString();
              await saveCheckout(env, prev);
            }
            return json({ error: 'already-paid', validUntil: new Date(validUntil).toISOString() }, 409);
          }
        }
        const checkoutId = crypto.randomUUID();
        const base = (env.BASE_URL || url.origin).replace(/\/$/, '');
        // Teto anti-abuso/anti-duplo-clique: sem Pix novo com 3 pendentes frescos (<35min).
        const fresh = await env.DB.prepare(
          `SELECT COUNT(*) AS n FROM checkouts
           WHERE lower(email) = ? AND status = 'pending'
           AND created_at > datetime('now', '-35 minutes')`,
        ).bind(email).first();
        if (Number(fresh?.n || 0) >= 3) {
          return json({ error: 'too-many-pending' }, 429);
        }
        let mp;
        try {
          mp = await createPixPayment(env, {
            amount: price,
            email,
            externalReference: `lf-${checkoutId}`,
            notificationUrl: `${base}/api/webhook/mercadopago`,
            idempotencyKey: checkoutId,
          });
        } catch (err) {
          console.error('mp-create:', err?.message || err);
          return json({ error: 'mp-failed' }, 502);
        }
        const now = new Date().toISOString();
        await saveCheckout(env, {
          checkout_id: checkoutId,
          mp_id: String(mp.id),
          email,
          contact,
          plan: planId,
          price,
          days,
          status: 'pending',
          license_key: null,
          created_at: now,
          updated_at: now,
          last_check: Date.now(),
          paid_at: null,
          email_sent: 0,
        });
        const tx = mp.point_of_interaction?.transaction_data || {};
        return json(
          {
            checkoutId,
            plan: planId,
            price,
            days,
            qrText: tx.qr_code || null,
            qrImage: tx.qr_code_base64 ? `data:image/png;base64,${tx.qr_code_base64}` : null,
            expiresAt: Date.now() + 35 * 60_000,
          },
          201,
        );
      }

      // Poll da chave (só entrega ao contato da compra).
      const keyMatch = url.pathname.match(/^\/api\/key\/([A-Za-z0-9-]+)$/);
      if (request.method === 'GET' && keyMatch) {
        if (!rateOk(ip)) return json({ error: 'rate-limited' }, 429);
        const c = await getCheckout(env, keyMatch[1]);
        if (!c) return json({ error: 'not-found' }, 404);
        const who = normContact(url.searchParams.get('contact'));
        const same = who && (who === normContact(c.email) || who === normContact(c.contact));
        // Fallback anti-webhook-perdido: revalida no MP a cada 45s.
        if (c.status === 'pending' && Date.now() - Number(c.last_check || 0) > 45_000) {
          c.last_check = Date.now();
          await settleCheckout(env, c);
          await saveCheckout(env, c);
        }
        // Retentativa de e-mail: pago mas ainda não entregue → tenta a cada poll.
        if (c.status === 'paid' && c.license_key && !c.email_sent && /@/.test(c.email || '')) {
          const r = await sendKeyEmail(env, { to: c.email, key: c.license_key, days: daysOf(env, c), plan: planLabelOf(env, c) });
          c.email_sent = r.sent ? 1 : 0;
          c.updated_at = new Date().toISOString();
          await saveCheckout(env, c);
        }
        if (c.status !== 'paid') return json({ status: c.status });
        if (!same) return json({ error: 'contact-mismatch' }, 403);
        return json({ status: 'paid', key: c.license_key, emailSent: !!c.email_sent });
      }

      // Recuperação de chave (trocou de aparelho, formatou, perdeu e-mail).
      // Só REENVIA para o próprio e-mail da compra — a chave nunca volta
      // no corpo da resposta (e-mail não é segredo; a chave, sim).
      const recMatch = url.pathname === '/api/recover';
      if (request.method === 'GET' && recMatch) {
        if (!rateOk(ip)) return json({ error: 'rate-limited' }, 429);
        const who = normContact(url.searchParams.get('contact'));
        if (!who) return json({ error: 'bad-contact' }, 400);
        const c = await env.DB.prepare(
          `SELECT * FROM checkouts
           WHERE (lower(email) = ? OR lower(contact) = ?) AND status = 'paid' AND license_key IS NOT NULL
           ORDER BY paid_at DESC LIMIT 1`,
        ).bind(who, who).first();
        // Resposta única (exista ou não): sem oráculo de quem pagou.
        if (!c || !/@/.test(c.email || '')) return json({ status: 'sent' });
        const r = await sendKeyEmail(env, { to: c.email, key: c.license_key, days: daysOf(env, c) });
        c.email_sent = r.sent ? 1 : 0;
        c.updated_at = new Date().toISOString();
        await saveCheckout(env, c);
        return json({ status: 'sent' });
      }

      // Painel de vendas (dono): HTML + JSON com senha (ADMIN_PASSWORD).
      if (request.method === 'GET' && url.pathname === '/admin') {
        return new Response(ADMIN_HTML, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'content-security-policy': "default-src 'self'",
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY',
            'referrer-policy': 'no-referrer',
          },
        });
      }
      if (request.method === 'GET' && url.pathname === '/api/admin/sales') {
        if (!env.ADMIN_PASSWORD) {
          console.error('ADMIN_PASSWORD ausente');
          return json({ error: 'not-configured' }, 500);
        }
        if (!adminOk(request, env)) return json({ error: 'unauthorized' }, 401);
        if (!rateOk(ip)) return json({ error: 'rate-limited' }, 429);
        const totals = await env.DB.prepare(
          `SELECT status, COUNT(*) AS n,
            ROUND(COALESCE(SUM(CASE WHEN status='paid' THEN price ELSE 0 END),0),2) AS revenue
           FROM checkouts GROUP BY status`,
        ).all();
        const rows = await env.DB.prepare(
          `SELECT email, plan, price, status, paid_at, created_at, email_sent
           FROM checkouts ORDER BY created_at DESC LIMIT 100`,
        ).all();
        const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
        const when = (r) => {
          try {
            return new Date(r.paid_at || r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          } catch { return '—'; }
        };
        const byStatus = (s) => (totals.results || []).find((t) => t.status === s);
        return json({
          paid: { count: byStatus('paid')?.n ?? 0, revenue: brl(byStatus('paid')?.revenue) },
          pending: byStatus('pending')?.n ?? 0,
          rows: (rows.results || []).map((r) => ({
            when: when(r), email: r.email, plan: r.plan || 'mensal', price: brl(r.price),
            status: r.status, emailSent: !!r.email_sent,
          })),
        });
      }

      // Broadcast do dono: novidade de update p/ todos os compradores.
      // POST {"tag":"v1.5.0","subject":"...","message":"..."} + x-admin-key.
      // Tag idempotente: repetir só envia a quem faltou (anti-duplo-CI).
      // Teto 300/call = cota diária do Brevo grátis.
      if (request.method === 'POST' && url.pathname === '/api/admin/broadcast') {
        if (!env.ADMIN_PASSWORD) {
          console.error('ADMIN_PASSWORD ausente');
          return json({ error: 'not-configured' }, 500);
        }
        if (!adminOk(request, env)) return json({ error: 'unauthorized' }, 401);
        if (!rateOk(ip)) return json({ error: 'rate-limited' }, 429);
        if (Number(request.headers.get('content-length') || 0) > 64 * 1024) {
          return json({ error: 'body-too-large' }, 413);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'bad-json' }, 400);
        }
        const tag = String(body.tag || '').trim().slice(0, 40);
        const subject = String(body.subject || '').trim().slice(0, 120);
        const message = String(body.message || '').trim().slice(0, 2000);
        if (!/^[A-Za-z0-9._-]{1,40}$/.test(tag) || !subject || !message) {
          return json({ error: 'bad-broadcast' }, 400);
        }
        const now = new Date().toISOString();
        await env.DB.prepare(
          'INSERT OR IGNORE INTO broadcasts (tag, subject, created_at) VALUES (?, ?, ?)',
        ).bind(tag, subject, now).run();
        const buyers = await env.DB.prepare(
          `SELECT DISTINCT lower(email) AS email FROM checkouts
           WHERE status = 'paid' AND email LIKE '%@%' LIMIT 300`,
        ).all();
        let sent = 0, failed = 0;
        for (const row of buyers.results || []) {
          const to = String(row.email || '').trim().toLowerCase();
          if (!to) continue;
          const already = await env.DB.prepare(
            'SELECT 1 AS x FROM broadcast_sends WHERE tag = ? AND email = ?',
          ).bind(tag, to).first();
          if (already) continue;
          const r = await sendEmail(env, {
            to,
            subject,
            text: message,
            html: broadcastEmailHtml({ tag, subject, message }),
          });
          if (r.sent) {
            sent++;
            await env.DB.prepare(
              'INSERT OR IGNORE INTO broadcast_sends (tag, email, sent_at) VALUES (?, ?, ?)',
            ).bind(tag, to, new Date().toISOString()).run();
          } else {
            failed++;
          }
        }
        return json({ status: 'done', tag, sent, failed, total: (buyers.results || []).length });
      }

      // Webhook do Mercado Pago.
      // Padrão do MP: responde 200 IMEDIATO (<22s) e processa depois
      // (waitUntil) — evita reentrega duplicada por timeout.
      if (request.method === 'POST' && url.pathname === '/api/webhook/mercadopago') {
        const raw = await request.text();
        let body = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          body = null;
        }
        const paymentId = extractPaymentId(body, url.searchParams);
        if (!env.MP_WEBHOOK_SECRET) {
          console.error('MP_WEBHOOK_SECRET ausente');
          return json({ error: 'not-configured' }, 500);
        }
        const ok = await verifySignature({
          secret: env.MP_WEBHOOK_SECRET,
          signatureHeader: request.headers.get('x-signature'),
          requestId: request.headers.get('x-request-id'),
          dataId: paymentId,
        });
        if (!paymentId || !ok) return json({ error: 'bad-signature' }, 401);
        ctx.waitUntil((async () => {
          try {
            const c = await findByMpId(env, paymentId);
            if (!c) return; // desconhecido: nada a liquidar
            c.last_check = Date.now();
            await settleCheckout(env, c);
            await saveCheckout(env, c);
          } catch (err) {
            // Poll do app (45s) cobre a falha — nunca quebra a venda.
            console.error('webhook settle:', err?.message || err);
          }
        })());
        return json({ ok: true, received: true });
      }

      return json({ error: 'not-found' }, 404);
    } catch (err) {
      console.error('worker error:', err?.message || err);
      return json({ error: 'internal' }, 500);
    }
  },
};
