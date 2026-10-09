// Venda de chaves PRO — uso do DONO, nunca commitar segredos.
// A privada fica em signing-keys/license.key (gitignored, padrão do updater).
//
//   1x:  node scripts/mint-key.mjs --init
//        → gera o par, salva a privada, IMPRIME a pública p/ colar em
//           LICENSE_PUBLIC_SPKI_B64 (src/core/license/license.ts)
//   venda: node scripts/mint-key.mjs "Nome do Cliente" [dias]
//        → sem dias = vitalícia. Imprime a chave + autoverificação.
//
// Espelho de src/core/license/license.ts (payload + base32 Crockford).
import { webcrypto } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const { subtle } = webcrypto;
const KEY_FILE = path.join(process.cwd(), 'signing-keys', 'license.key');
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
const b64e = (bytes) => Buffer.from(bytes).toString('base64');

function buildPayload(name, expSec) {
  const nb = Buffer.from(name.trim(), 'utf8').slice(0, 24);
  const buf = Buffer.alloc(7 + nb.length);
  buf[0] = 0x01; buf[1] = 0x01;
  buf.writeUInt32BE(Math.max(0, Math.floor(expSec)), 2);
  buf[6] = nb.length; nb.copy(buf, 7);
  return new Uint8Array(buf);
}
function encodeKey(payload, sig) {
  const raw = Buffer.concat([Buffer.from(payload), Buffer.from(sig)]);
  const b32 = b32enc(raw);
  const g = [];
  for (let i = 0; i < b32.length; i += 4) g.push(b32.slice(i, i + 4));
  return `LF1-${g.join('-')}`;
}

async function init(force) {
  try {
    await fs.access(KEY_FILE);
    if (!force) { console.error(`Já existe ${KEY_FILE}. Re rode com --force p/ trocar (invalida chaves vendidas!).`); process.exit(1); }
  } catch { /* não existe: segue */ }
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const privJwk = await subtle.exportKey('jwk', pair.privateKey);
  const pubSpki = b64e(await subtle.exportKey('spki', pair.publicKey));
  await fs.mkdir(path.dirname(KEY_FILE), { recursive: true });
  await fs.writeFile(KEY_FILE, JSON.stringify({ kty: 'license-pro-p256', createdAt: new Date().toISOString(), privateJwk: privJwk }, null, 2), { mode: 0o600 });
  console.log(`Privada salva em ${KEY_FILE} (gitignored, NÃO compartilhe).`);
  console.log(`\nCole em LICENSE_PUBLIC_SPKI_B64:\n\n${pubSpki}\n`);
}

async function mint(name, days) {
  if (!name) { console.error('Uso: node scripts/mint-key.mjs "Nome do Cliente" [dias]'); process.exit(1); }
  let file;
  try { file = JSON.parse(await fs.readFile(KEY_FILE, 'utf8')); }
  catch { console.error(`Sem ${KEY_FILE}. Rode --init primeiro.`); process.exit(1); }
  const exp = !days || Number(days) <= 0 ? 0 : Math.floor(Date.now() / 1000) + Math.floor(Number(days)) * 86400;
  const priv = await subtle.importKey('jwk', file.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const payload = buildPayload(name, exp);
  const sig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, payload));
  // Autoverificação antes de entregar (mesma primitiva do app).
  // JWK pública = privada sem `d` e sem `key_ops` (a privada carrega
  // key_ops ['sign']; herdar quebra o import p/ ['verify']).
  const { d: _d, key_ops: _k, ext: _e, ...pubJwk } = file.privateJwk;
  const pub = await subtle.importKey('jwk', pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig, payload);
  if (!ok) { console.error('FALHA interna na assinatura. Não entregue nada.'); process.exit(1); }
  console.log(`Cliente: ${name}\nValidade: ${exp === 0 ? 'VITALÍCIA' : `${days} dias (até ${new Date(exp * 1000).toLocaleDateString()})`}\n\nCHAVE:\n\n${encodeKey(payload, sig)}\n`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === '--init') init(rest.includes('--force'));
else if (cmd && !cmd.startsWith('-')) mint(cmd, rest[0]);
else { console.error('Uso:\n  node scripts/mint-key.mjs --init [--force]\n  node scripts/mint-key.mjs "Nome do Cliente" [dias]'); process.exit(1); }
