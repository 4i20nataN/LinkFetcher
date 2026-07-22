// main/updater/verifyRelease.ts
// Núcleo de verificação criptográfica do canal de update. Só usa
// `node:crypto` nativo de propósito — ver references/05-update-security.md
// ("Por que Ed25519 via node:crypto nativo").

import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { ManifestSchema, type Manifest } from './types';

// --- trust anchors: revisados em PR, nunca configuráveis em runtime ---------

export const PINNED_OWNER_REPO = 'seu-usuario/linkfatcher';
export const PINNED_API_HOST = 'api.github.com';
export const PINNED_ASSET_HOSTS = new Set(['github.com', 'objects.githubusercontent.com']);

// Chave(s) pública(s) de confiança. Gerada por:
//   node -e "const {generateKeyPairSync}=require('crypto');
//   const {publicKey,privateKey}=generateKeyPairSync('ed25519');
//   console.log(publicKey.export({type:'spki',format:'pem'}).toString());
//   console.log(privateKey.export({type:'pkcs8',format:'pem'}).toString());"
// A privada NUNCA entra no repositório — só em secret do CI (ver assets/workflows/release.yml).
const TRUSTED_PUBLIC_KEYS: Record<string, string> = {
  'v1': `-----BEGIN PUBLIC KEY-----
REPLACE_WITH_REAL_ED25519_PUBLIC_KEY_PEM
-----END PUBLIC KEY-----`,
};

export class SecurityError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'SecurityError';
  }
}

declare function logSecurityEvent(event: string, context: Record<string, unknown>): void;

// --- fetch de release pinado -------------------------------------------------

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}
interface GithubRelease {
  full_name?: string; // presente quando incluído explicitamente na resposta consultada
  tag_name: string;
  assets: GithubReleaseAsset[];
}

export async function fetchLatestRelease(): Promise<GithubRelease> {
  const url = `https://${PINNED_API_HOST}/repos/${PINNED_OWNER_REPO}/releases/latest`;
  const res = await fetch(url, {
    redirect: 'manual', // nunca seguir redirect automaticamente
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'LinkFatcher-Updater' },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status >= 300 && res.status < 400) {
    throw new SecurityError('update.unexpected_redirect');
  }
  if (!res.ok) throw new SecurityError('update.api_error');

  const body = (await res.json()) as GithubRelease;
  // A API pública não retorna full_name no endpoint /releases/latest;
  // se o app usa um endpoint que o inclua, valide-o aqui. Caso contrário,
  // o pinning de owner/repo já está garantido pela própria URL requisitada
  // acima (PINNED_OWNER_REPO), que é constante de código.
  return body;
}

function findAsset(release: GithubRelease, name: string): GithubReleaseAsset {
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) throw new SecurityError('update.asset_missing');
  const host = new URL(asset.browser_download_url).hostname;
  if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');
  return asset;
}

export function pickManifestAssets(release: GithubRelease) {
  return {
    manifest: findAsset(release, 'manifest.json'),
    signature: findAsset(release, 'manifest.json.sig'),
  };
}

// --- verificação de assinatura -----------------------------------------------

export function verifyManifestSignature(
  manifestBytes: Buffer,
  signatureBase64: string,
  keyId = 'v1',
): boolean {
  const pem = TRUSTED_PUBLIC_KEYS[keyId];
  if (!pem) {
    logSecurityEvent('update.unknown_signing_key', { keyId });
    return false;
  }
  const publicKey = createPublicKey({ key: pem, format: 'pem' });
  const signature = Buffer.from(signatureBase64, 'base64');
  // Ed25519: algoritmo de hash é `null` — a assinatura já opera sobre a mensagem inteira.
  return cryptoVerify(null, manifestBytes, publicKey, signature);
}

export function parseVerifiedManifest(manifestBytes: Buffer, signatureBase64: string): Manifest {
  if (!verifyManifestSignature(manifestBytes, signatureBase64)) {
    logSecurityEvent('update.signature_invalid', {});
    throw new SecurityError('update.signature_invalid');
  }
  const parsed = ManifestSchema.safeParse(JSON.parse(manifestBytes.toString('utf-8')));
  if (!parsed.success) {
    logSecurityEvent('update.manifest_schema_invalid', {});
    throw new SecurityError('update.manifest_schema_invalid');
  }
  if (parsed.data.repository !== PINNED_OWNER_REPO) {
    logSecurityEvent('update.repository_mismatch', { got: parsed.data.repository });
    throw new SecurityError('update.repository_mismatch');
  }
  return parsed.data;
}

// --- versão: comparação semver mínima, sem dependência externa --------------

export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

export function assertNotRollback(manifestVersion: string, lastInstalledVersion: string | null): void {
  if (lastInstalledVersion && compareSemver(manifestVersion, lastInstalledVersion) < 0) {
    logSecurityEvent('update.rollback_blocked', { attempted: manifestVersion, floor: lastInstalledVersion });
    throw new SecurityError('update.rollback_blocked');
  }
}

// --- hash do artefato final --------------------------------------------------

export async function sha512Of(filePath: string): Promise<string> {
  const { createReadStream } = await import('node:fs');
  const hash = createHash('sha512');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (c) => hash.update(c));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  return hash.digest('hex');
}
