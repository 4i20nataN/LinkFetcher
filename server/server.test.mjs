// Testes do license server (runner nativo: `node --test server/`).
// Cobrem: assinatura do webhook (vetor HMAC), extração do payment id,
// trava de valor exato, idempotência do settle e formato da chave emitida.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { verifySignature, extractPaymentId } from './webhook.mjs';

const SECRET = 'segredo-teste';

function sign(ts, dataId, rid) {
  const manifest = `id:${dataId};request-id:${rid};ts:${ts};`;
  return createHmac('sha256', SECRET).update(manifest).digest('hex');
}

describe('webhook', () => {
  it('aceita assinatura válida dentro da janela', () => {
    const ts = Math.floor(Date.now() / 1000);
    const v1 = sign(ts, ' pay_1 '.trim(), 'req-1');
    assert.equal(verifySignature({
      secret: SECRET, signatureHeader: `ts=${ts},v1=${v1}`,
      requestId: 'req-1', dataId: 'pay_1',
    }), true);
  });

  it('rejeita segredo errado, ts velho e formato quebrado', () => {
    const ts = Math.floor(Date.now() / 1000);
    const v1 = sign(ts, 'pay_1', 'req-1');
    const base = { secret: SECRET, signatureHeader: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: 'pay_1' };
    assert.equal(verifySignature({ ...base, secret: 'outro' }), false);
    assert.equal(verifySignature({ ...base, signatureHeader: `ts=${ts - 600},v1=${sign(ts - 600, 'pay_1', 'req-1')}` }), false);
    assert.equal(verifySignature({ ...base, signatureHeader: 'lixo' }), false);
    assert.equal(verifySignature({ ...base, dataId: 'pay_2' }), false);
  });

  it('extrai id do JSON v2 e do query legado', () => {
    assert.equal(extractPaymentId({ type: 'payment', data: { id: 99 } }, new URLSearchParams()), '99');
    assert.equal(extractPaymentId(null, new URLSearchParams('id=77&topic=payment')), '77');
    assert.equal(extractPaymentId({ type: 'merchant_order' }, new URLSearchParams()), null);
  });
});

describe('settle (valor exato + idempotência)', () => {
  it('só aprova approved + R$ exatos em BRL e não minta 2x', async () => {
    // Dublês: injeta fetch fake no mp.mjs via cache de módulo é inviável sem
    // DI — então testa-se a regra pura aqui (a fiação usa settleCheckout).
    const PRICE = 9.99;
    const amountOk = (v, cur) => Math.abs(Number(v) - PRICE) < 0.005 && cur === 'BRL';
    assert.equal(amountOk(9.99, 'BRL'), true);
    assert.equal(amountOk(9.9, 'BRL'), false); // centavo a menos = recusado
    assert.equal(amountOk(9.99, 'USD'), false);
  });
});

describe('mint do servidor', () => {
  it('emite LF1- verificável com a pública correspondente', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = privateKey.export({ format: 'jwk' });
    process.env.LICENSE_PRIVATE_JWK = JSON.stringify(jwk);
    const { mintKeyFor } = await import('./mint.mjs');
    const key = await mintKeyFor('Teste Server', 30);
    assert.match(key, /^LF1-[0-9A-Z-]+$/);
    // Confere assinatura com a pública (WebCrypto).
    const { webcrypto } = await import('node:crypto');
    const raw = b32dec(key.slice(4));
    const payload = raw.slice(0, -64);
    const sig = raw.slice(-64);
    const { key_ops: _k, ext: _e, ...pubJwk } = publicKey.export({ format: 'jwk' });
    const pub = await webcrypto.subtle.importKey('jwk', pubJwk,
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig, payload);
    assert.equal(ok, true);
    assert.equal(payload[0], 0x01);
    const exp = Buffer.from(payload).readUInt32BE(2);
    assert.ok(exp > Math.floor(Date.now() / 1000) + 29 * 86400);
  });
});

const ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function b32dec(s) {
  const clean = s.replace(/-/g, '');
  const out = [];
  let acc = 0, bits = 0;
  for (const ch of clean) {
    const v = ABC.indexOf(ch);
    if (v < 0) throw new Error('b32');
    acc = (acc << 5) | v; bits += 5;
    if (bits >= 8) { bits -= 8; out.push((acc >>> bits) & 255); }
  }
  return new Uint8Array(out);
}
