// Emite chaves LF1 (mesmo formato do app); privada só via env.
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function b32enc(bytes) {
  let out = '', acc = 0, bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b; bits += 8;
    while (bits >= 5) { bits -= 5; out += ALPHABET[(acc >>> bits) & 31]; }
  }
  if (bits > 0) out += ALPHABET[(acc << (5 - bits)) & 31];
  return out;
}

let cachedKey = null;
async function privateKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.LICENSE_PRIVATE_JWK || '';
  if (!raw) throw new Error('LICENSE_PRIVATE_JWK ausente');
  const jwk = JSON.parse(raw);
  cachedKey = await subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return cachedKey;
}

/** Minta `LF1-...` p/ `name` com `days` de validade. */
export async function mintKeyFor(name, days) {
  const exp = Math.floor(Date.now() / 1000) + Math.floor(Number(days)) * 86400;
  const nb = Buffer.from(String(name || '').trim(), 'utf8').slice(0, 24);
  const payload = Buffer.alloc(7 + nb.length);
  payload[0] = 0x01; payload[1] = 0x01;
  payload.writeUInt32BE(exp, 2);
  payload[6] = nb.length; nb.copy(payload, 7);
  const sig = Buffer.from(await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, await privateKey(), payload));
  const raw = Buffer.concat([payload, sig]);
  const b32 = b32enc(raw);
  const g = [];
  for (let i = 0; i < b32.length; i += 4) g.push(b32.slice(i, i + 4));
  return `LF1-${g.join('-')}`;
}
