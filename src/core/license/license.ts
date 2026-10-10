// Licenças PRO — chaves assinadas offline (ECDSA P-256 + SHA-256).
//
// Formato: `LF1-<base32 Crockford em grupos de 4>`
// Binário: ver(1B) | plan(1B=PRO) | exp(u32 BE, 0=vitalícia) | nameLen(1B)
//          | name(≤24B) | sig(64B r||s sobre tudo antes)
//
// Privada fora do repo (só a pública embarca); sem vínculo de máquina.
// Gerar: `scripts/mint-key.mjs --init` (1x); vender: `mint-key.mjs "Nome" [dias]`.

export const LICENSE_VERSION = 0x01;
export const LICENSE_PLAN_PRO = 0x01;
export const LICENSE_KEY_PREFIX = 'LF1';
const SIG_LEN = 64;
const MAX_NAME_BYTES = 24;

/**
 * SPKI DER (base64) da chave pública PRO. Colar a saída de
 * `node scripts/mint-key.mjs --init`. Vazio = licenciamento desativado
 * (toda chave é recusada com 'unconfigured').
 */
export const LICENSE_PUBLIC_SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAED6j4atytCMPzQFuBR4P4WUW3Yg900jpomLxugBjt4+KuIe3O55uSK9z+BS/8EAJYqqSVJPR8NgxXE5a430j0/g==';

export interface LicenseCheck {
  valid: boolean;
  name?: string;
  plan?: string;
  /** unix seconds; 0 = vitalícia */
  expiresAt?: number;
  /** 'format' | 'signature' | 'version' | 'plan' | 'expired' | 'unconfigured' */
  error?: string;
}

// Base32 Crockford (sem I/L/O/U ambíguos), espelho em scripts/mint-key.mjs.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function base32Encode(bytes: Uint8Array): string {
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

export function base32Decode(s: string): Uint8Array | null {
  const clean = s.toUpperCase().replace(/[\s-]/g, '');
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >>> bits) & 255);
    }
  }
  return Uint8Array.from(out);
}

/** Monta o payload (sem assinatura). Expira em unix seconds; 0 = vitalícia. */
export function buildLicensePayload(name: string, expiresAtSec: number): Uint8Array {
  const nameBytes = new TextEncoder().encode(name.trim()).slice(0, MAX_NAME_BYTES);
  const buf = new Uint8Array(7 + nameBytes.length);
  const view = new DataView(buf.buffer);
  buf[0] = LICENSE_VERSION;
  buf[1] = LICENSE_PLAN_PRO;
  view.setUint32(2, Math.max(0, Math.floor(expiresAtSec)), false);
  buf[6] = nameBytes.length;
  buf.set(nameBytes, 7);
  return buf;
}

/** Serializa payload+assinatura no formato digitável `LF1-XXXX-...`. */
export function encodeLicenseKey(payload: Uint8Array, sig: Uint8Array): string {
  const raw = new Uint8Array(payload.length + sig.length);
  raw.set(payload, 0);
  raw.set(sig, payload.length);
  const b32 = base32Encode(raw);
  const groups: string[] = [];
  for (let i = 0; i < b32.length; i += 4) groups.push(b32.slice(i, i + 4));
  return `${LICENSE_KEY_PREFIX}-${groups.join('-')}`;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifyLicenseKey(
  keyString: string,
  spkiB64: string = LICENSE_PUBLIC_SPKI_B64,
): Promise<LicenseCheck> {
  const clean = keyString.trim().toUpperCase().replace(/[\s]/g, '');
  if (!clean.startsWith(`${LICENSE_KEY_PREFIX}-`)) return { valid: false, error: 'format' };
  const raw = base32Decode(clean.slice(LICENSE_KEY_PREFIX.length + 1));
  if (!raw || raw.length < 7 + SIG_LEN) return { valid: false, error: 'format' };
  if (!spkiB64) return { valid: false, error: 'unconfigured' };

  const payload = raw.slice(0, raw.length - SIG_LEN);
  const sig = raw.slice(raw.length - SIG_LEN);
  let ok = false;
  try {
    const pubKey = await crypto.subtle.importKey(
      'spki',
      b64ToBytes(spkiB64).buffer as ArrayBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pubKey,
      sig.buffer as ArrayBuffer,
      payload.buffer as ArrayBuffer,
    );
  } catch {
    return { valid: false, error: 'signature' };
  }
  if (!ok) return { valid: false, error: 'signature' };

  if (payload[0] !== LICENSE_VERSION) return { valid: false, error: 'version' };
  if (payload[1] !== LICENSE_PLAN_PRO) return { valid: false, error: 'plan' };
  const exp = new DataView(payload.buffer, payload.byteOffset).getUint32(2, false);
  if (exp !== 0 && exp * 1000 < Date.now()) return { valid: false, error: 'expired' };
  const nameLen = Math.min(payload[6], payload.length - 7);
  const name = new TextDecoder().decode(payload.slice(7, 7 + nameLen));
  return { valid: true, name, plan: 'PRO', expiresAt: exp };
}

/** Registro ativo = existe e (vitalício ou não expirado). */
export function isLicenseActive(rec: { expiresAt: number } | null | undefined): boolean {
  if (!rec) return false;
  return rec.expiresAt === 0 || rec.expiresAt * 1000 > Date.now();
}
