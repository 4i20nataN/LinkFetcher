// Round-trip do licenciamento PRO com par gerado em tempo de teste.
import { describe, it, expect } from 'vitest';
import {
  buildLicensePayload, encodeLicenseKey, base32Decode,
  verifyLicenseKey, LICENSE_KEY_PREFIX,
} from './license';

async function freshPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = Buffer.from(await crypto.subtle.exportKey('spki', pair.publicKey)).toString('base64');
  return { pair, spki };
}

async function mint(pair: CryptoKeyPair, name: string, exp: number): Promise<string> {
  const payload = buildLicensePayload(name, exp);
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, payload as ArrayBuffer));
  return encodeLicenseKey(payload, sig);
}

describe('license PRO', () => {
  it('aceita chave legítima vitalícia com nome', async () => {
    const { pair, spki } = await freshPair();
    const chk = await verifyLicenseKey(await mint(pair, 'Cliente Teste', 0), spki);
    expect(chk.valid).toBe(true);
    expect(chk.name).toBe('Cliente Teste');
    expect(chk.plan).toBe('PRO');
    expect(chk.expiresAt).toBe(0);
  });

  it('rejeita byte adulterado (assinatura)', async () => {
    const { pair, spki } = await freshPair();
    const key = await mint(pair, 'X', 0);
    const raw = base32Decode(key.slice(LICENSE_KEY_PREFIX.length + 1))!;
    raw[10] ^= 0xff;
    const { base32Encode } = await import('./license');
    const g: string[] = [];
    const b32 = base32Encode(raw);
    for (let i = 0; i < b32.length; i += 4) g.push(b32.slice(i, i + 4));
    const chk = await verifyLicenseKey(`${LICENSE_KEY_PREFIX}-${g.join('-')}`, spki);
    expect(chk.valid).toBe(false);
    expect(chk.error).toBe('signature');
  });

  it('rejeita chave de outro par', async () => {
    const a = await freshPair();
    const b = await freshPair();
    const chk = await verifyLicenseKey(await mint(a.pair, 'Y', 0), b.spki);
    expect(chk.valid).toBe(false);
    expect(chk.error).toBe('signature');
  });

  it('rejeita expirada e aceita futura', async () => {
    const { pair, spki } = await freshPair();
    const now = Math.floor(Date.now() / 1000);
    expect((await verifyLicenseKey(await mint(pair, 'Z', now - 60), spki)).error).toBe('expired');
    expect((await verifyLicenseKey(await mint(pair, 'Z', now + 86400), spki)).valid).toBe(true);
  });

  it('rejeita formato inválido e sem pública configurada', async () => {
    const { pair } = await freshPair();
    expect((await verifyLicenseKey('lixo', 'AAAA')).error).toBe('format');
    expect((await verifyLicenseKey(await mint(pair, 'W', 0), '')).error).toBe('unconfigured');
  });
});
