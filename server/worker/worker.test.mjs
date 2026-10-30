// Testes do Worker de produção (server/worker/worker.mjs) — o que está no ar
// e nunca foi coberto: HMAC do webhook, emissão LF1 e as rotas de entrada.
// O round-trip da chave usa o MESMO verificador do app
// (src/core/license/license.ts): se Worker e cliente divergirem no formato,
// este teste falha. Roda junto com `npm test` (vitest).

import { describe, it, expect } from 'vitest';
import { atob, btoa } from 'node:buffer';

import worker, { extractPaymentId, mintKeyFor, verifySignature } from './worker.mjs';
import { verifyLicenseKey } from '../../src/core/license/license.ts';

globalThis.atob = atob;
globalThis.btoa = btoa;
// licenseStore toca localStorage na importação; o teste não persiste nada.
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const EC_PARAMS = { name: 'ECDSA', namedCurve: 'P-256' };
const enc = new TextEncoder();

async function genPair() {
  const pair = await crypto.subtle.generateKey(EC_PARAMS, true, ['sign', 'verify']);
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const spkiB64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
  return { env: { LICENSE_PRIVATE_JWK: JSON.stringify(jwk) }, spkiB64 };
}

async function call(path, init) {
  return worker.fetch(new Request(`https://lic.example${path}`, init), {}, { waitUntil() {} });
}

describe('emissão de chave LF1 (round-trip com o verificador do app)', () => {
  it('chave mintada no Worker valida no cliente e carrega nome/duração', async () => {
    const { env, spkiB64 } = await genPair();
    const key = await mintKeyFor(env, 'Maria Souza', 30);
    expect(key).toMatch(/^LF1(-[0-9A-Z]{4})+$/);
    const chk = await verifyLicenseKey(key, spkiB64);
    expect(chk.valid).toBe(true);
    expect(chk.name).toBe('Maria Souza');
    expect(chk.plan).toBe('PRO');
    const days = (chk.expiresAt * 1000 - Date.now()) / 86400_000;
    expect(days).toBeGreaterThan(29.5);
    expect(days).toBeLessThan(30.5);
  });

  it('chave mintada com outra privada não valida na pública do comprador', async () => {
    const a = await genPair();
    const b = await genPair();
    const key = await mintKeyFor(a.env, 'Falsificador', 30);
    const chk = await verifyLicenseKey(key, b.spkiB64);
    expect(chk.valid).toBe(false);
    expect(chk.error).toBe('signature');
  });

  it('adulterar um caractere da chave derruba a assinatura', async () => {
    const { env, spkiB64 } = await genPair();
    const key = await mintKeyFor(env, 'João', 7);
    const i = key.length - 3;
    const tampered = key.slice(0, i) + (key[i] === 'A' ? 'B' : 'A') + key.slice(i + 1);
    const chk = await verifyLicenseKey(tampered, spkiB64);
    expect(chk.valid).toBe(false);
    expect(['signature', 'format']).toContain(chk.error);
  });

  it('dias negativos gera chave já expirada (recusada como expired)', async () => {
    const { env, spkiB64 } = await genPair();
    const key = await mintKeyFor(env, 'Expirada', -2);
    const chk = await verifyLicenseKey(key, spkiB64);
    expect(chk.valid).toBe(false);
    expect(chk.error).toBe('expired');
  });

  it('nome UTF-8 é truncado em 24 bytes sem quebrar caractere', async () => {
    const { env, spkiB64 } = await genPair();
    const key = await mintKeyFor(env, 'aéü😀'.repeat(10), 1);
    const chk = await verifyLicenseKey(key, spkiB64);
    expect(chk.valid).toBe(true);
    expect(enc.encode(chk.name).length).toBeLessThanOrEqual(24);
  });

  it('sem LICENSE_PRIVATE_JWK o mint falha em vez de emitir chave quebrada', async () => {
    await expect(mintKeyFor({}, 'Sem chave', 30)).rejects.toThrow(/LICENSE_PRIVATE_JWK/);
  });
});

describe('webhook: verifySignature (HMAC-SHA256, ts ±5min)', () => {
  const secret = 'wh-secret';
  const sign = async (dataId, requestId, tsSec, sk = secret) => {
    const manifest = `id:${dataId};request-id:${requestId};ts:${tsSec};`;
    const key = await crypto.subtle.importKey('raw', enc.encode(sk), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
    ]);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(manifest));
    const hexStr = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `ts=${tsSec},v1=${hexStr}`;
  };

  it('aceita assinatura fresca e rejeita adulterações', async () => {
    const nowMs = Date.now();
    const ts = Math.floor(nowMs / 1000);
    const good = await sign('12345', 'req-1', ts);
    const base = { secret, signatureHeader: good, requestId: 'req-1', dataId: '12345', nowMs };
    expect(await verifySignature(base)).toBe(true);
    expect(await verifySignature({ ...base, dataId: '99999' })).toBe(false);
    expect(await verifySignature({ ...base, secret: 'outra' })).toBe(false);
    expect(await verifySignature({ ...base, signatureHeader: good.replace('v1=', 'v1=0') })).toBe(false);
    expect(await verifySignature({ ...base, signatureHeader: '' })).toBe(false);
    expect(await verifySignature({ ...base, signatureHeader: 'ts=abc,v1=deadbeef' })).toBe(false);
    expect(await verifySignature({ ...base, signatureHeader: `ts=${ts}` })).toBe(false);
  });

  it('rejeita ts fora da janela de ±5 minutos', async () => {
    const stale = await sign('7', 'r', Math.floor(Date.now() / 1000) - 360);
    expect(await verifySignature({ secret, signatureHeader: stale, requestId: 'r', dataId: '7' })).toBe(false);
    const future = await sign('7', 'r', Math.floor(Date.now() / 1000) + 360);
    expect(await verifySignature({ secret, signatureHeader: future, requestId: 'r', dataId: '7' })).toBe(false);
  });
});

describe('webhook: extractPaymentId', () => {
  it('lê corpo JSON v2 e querystring legada', () => {
    expect(extractPaymentId({ type: 'payment', data: { id: 42 } }, new URLSearchParams())).toBe('42');
    expect(extractPaymentId(null, new URLSearchParams('topic=payment&id=99'))).toBe('99');
    expect(extractPaymentId(null, new URLSearchParams('type=payment&data.id=77'))).toBe('77');
    expect(extractPaymentId(null, new URLSearchParams('id=5'))).toBe('5');
    expect(extractPaymentId({ type: 'merchant_order', data: { id: 1 } }, new URLSearchParams())).toBe(null);
    expect(extractPaymentId(null, new URLSearchParams('topic=order&id=5'))).toBe(null);
  });
});

describe('rotas de entrada', () => {
  it('GET /api/health responde ok com CORS', async () => {
    const res = await call('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('OPTIONS preflight devolve 204', async () => {
    const res = await call('/api/health', { method: 'OPTIONS' });
    expect(res.status).toBe(204);
  });

  it('rota desconhecida devolve 404', async () => {
    const res = await call('/api/nada');
    expect(res.status).toBe(404);
  });

  it('POST /api/checkout valida entrada antes de chamar MP ou D1', async () => {
    const post = (body, raw) =>
      call('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: raw ?? JSON.stringify(body),
      });

    let res = await post(null, '{');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad-json');

    res = await post({ email: 'sem-arroba', contact: 'x' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad-contact');

    res = await post({ email: 'a@b.co', contact: 'x'.repeat(60) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('contact-too-long');

    res = await post({ email: 'a@b.co', contact: 'ok', plan: 'inexistente' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad-plan');
  });

  it('checkout recusa contato que não cabe nos 24 bytes do nome da chave', async () => {
    const res = await call('/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'x@y.zw', contact: '😀'.repeat(10) }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('contact-too-long');
  });
});
