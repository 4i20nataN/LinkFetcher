/**
 * verifyRelease.js — Crypto verification core for the update channel.
 *
 * Zero external dependencies: uses only node:crypto (Ed25519 native support).
 * Trust anchors (public keys, pinned hosts, owner/repo) are CONSTANTS in code,
 * reviewed in PR, never configurable at runtime.
 *
 * Security model (electron-security-architecture references/05-update-security.md):
 * - Ed25519 signature on manifest.json (detached .sig file)
 * - SHA-512 hash of installer verified against manifest
 * - Repository and API host pinned to prevent typosquatting
 * - Anti-rollback via local version ratchet
 * - Redirects manually rejected (never followed automatically)
 * - All failures abort — no "degraded mode without verification"
 *
 * NOTE: recovered verbatim from the live release pipeline (raw.githubusercontent.com)
 * — this file existed on GitHub but was absent from the project backup zip, which is
 * why electron/main.cjs crashed on boot (`require('./updater/updateManager.cjs')`
 * and `require('./updater/handlers.cjs')`, which depend on this module, were also
 * missing and have been rebuilt around this file — see updateManager.cjs).
 */

'use strict';

const { createHash, createPublicKey, verify: cryptoVerify } = require('node:crypto');

// ── Trust Anchors ────────────────────────────────────────────────────────────
// Reviewed in PR. NEVER configurable at runtime.

const PINNED_OWNER_REPO = '4i20nataN/LinkFetcher';
const PINNED_API_HOST = 'api.github.com';
const PINNED_ASSET_HOSTS = new Set(['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com']);

// Ed25519 public keys for manifest signature verification.
// Generate with: node -e "const{generateKeyPairSync}=require('crypto');const{publicKey,privateKey}=generateKeyPairSync('ed25519');console.log(publicKey.export({type:'spki',format:'pem'}));"
// Private key goes to GitHub Actions secret: UPDATE_SIGNING_PRIVATE_KEY
const TRUSTED_PUBLIC_KEYS = {
  v1: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA/b86YtHcdb332WCuUkMzyQ12IdZA5ow760QVTt/DABo=
-----END PUBLIC KEY-----`,
};

// ── Security Error ───────────────────────────────────────────────────────────

class SecurityError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SecurityError';
    this.code = code;
  }
}

// ── Manifest Schema Validation (no zod dependency) ──────────────────────────

function validateManifest(data) {
  if (typeof data !== 'object' || data === null) return { ok: false, error: 'not_object' };
  if (data.schemaVersion !== 1) return { ok: false, error: 'invalid_schema_version' };
  if (typeof data.repository !== 'string' || !data.repository) return { ok: false, error: 'missing_repository' };
  if (typeof data.version !== 'string' || !/^\d+\.\d+\.\d+/.test(data.version)) return { ok: false, error: 'invalid_version' };
  if (typeof data.minimumSupportedVersion !== 'string') return { ok: false, error: 'missing_minimumSupportedVersion' };
  if (typeof data.publishedAt !== 'string') return { ok: false, error: 'missing_publishedAt' };
  if (!Array.isArray(data.artifacts) || data.artifacts.length === 0) return { ok: false, error: 'no_artifacts' };

  for (const [i, art] of data.artifacts.entries()) {
    if (typeof art.platform !== 'string') return { ok: false, error: `artifact[${i}].platform` };
    if (typeof art.fileName !== 'string' || art.fileName.length === 0) return { ok: false, error: `artifact[${i}].fileName` };
    if (typeof art.sha256 !== 'string' || art.sha256.length !== 64) return { ok: false, error: `artifact[${i}].sha256` };
    if (typeof art.sha512 !== 'string' || art.sha512.length !== 128) return { ok: false, error: `artifact[${i}].sha512` };
    if (typeof art.sizeBytes !== 'number' || art.sizeBytes <= 0) return { ok: false, error: `artifact[${i}].sizeBytes` };
  }

  return {
    ok: true,
    data: {
      schemaVersion: data.schemaVersion,
      repository: data.repository,
      version: data.version,
      minimumSupportedVersion: data.minimumSupportedVersion,
      publishedAt: data.publishedAt,
      signingKeyId: data.signingKeyId,
      artifacts: data.artifacts,
    },
  };
}

// ── Fetch from GitHub (pinned host, no auto-redirect) ────────────────────────

async function fetchLatestRelease() {
  const url = `https://${PINNED_API_HOST}/repos/${PINNED_OWNER_REPO}/releases/latest`;
  const res = await fetch(url, {
    redirect: 'manual',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'LinkFetcher-Updater/1.0',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status >= 300 && res.status < 400) {
    throw new SecurityError('update.unexpected_redirect');
  }
  if (!res.ok) {
    throw new SecurityError('update.api_error');
  }

  return res.json();
}

// ── Asset Lookup with Host Pinning ───────────────────────────────────────────

function findAsset(release, name) {
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) throw new SecurityError('update.asset_missing');
  const host = new URL(asset.browser_download_url).hostname;
  if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');
  return asset;
}

function pickManifestAssets(release) {
  return {
    manifest: findAsset(release, 'manifest.json'),
    signature: findAsset(release, 'manifest.json.sig'),
  };
}

// ── Download to Buffer with Size Limit ───────────────────────────────────────

async function downloadToBuffer(url, maxBytes) {
  // Follow redirects manually, verifying each hop against pinned hosts.
  let currentUrl = url;
  let res;
  for (let hop = 0; hop < 5; hop++) {
    const host = new URL(currentUrl).hostname;
    if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');
    res = await fetch(currentUrl, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new SecurityError('update.download_failed');
      currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
      continue;
    }
    break;
  }
  if (!res.ok || !res.body) throw new SecurityError('update.download_failed');

  const chunks = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > maxBytes) throw new SecurityError('update.payload_too_large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ── Ed25519 Signature Verification ───────────────────────────────────────────

function verifyManifestSignature(manifestBytes, signatureBase64, keyId = 'v1') {
  const pem = TRUSTED_PUBLIC_KEYS[keyId];
  if (!pem) return false;

  try {
    const publicKey = createPublicKey({ key: pem, format: 'pem' });
    const signature = Buffer.from(signatureBase64, 'base64');
    // Ed25519: algorithm=null — signature operates on the raw message
    return cryptoVerify(null, manifestBytes, publicKey, signature);
  } catch {
    return false;
  }
}

// ── Parse & Validate Manifest (signature first, then schema) ─────────────────

function parseVerifiedManifest(manifestBytes, signatureBase64) {
  // Step 1: Verify Ed25519 signature BEFORE reading any field
  if (!verifyManifestSignature(manifestBytes, signatureBase64)) {
    throw new SecurityError('update.signature_invalid');
  }

  // Step 2: Parse JSON
  let raw;
  try {
    raw = JSON.parse(manifestBytes.toString('utf-8'));
  } catch {
    throw new SecurityError('update.manifest_parse_error');
  }

  // Step 3: Validate schema
  const result = validateManifest(raw);
  if (!result.ok) {
    throw new SecurityError('update.manifest_schema_invalid');
  }

  // Step 4: Verify repository matches pinned value
  if (result.data.repository !== PINNED_OWNER_REPO) {
    throw new SecurityError('update.repository_mismatch');
  }

  return result.data;
}

// ── Semver Comparison (no external dependency) ────────────────────────────────

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function assertNotRollback(manifestVersion, lastInstalledVersion) {
  if (lastInstalledVersion && compareSemver(manifestVersion, lastInstalledVersion) < 0) {
    throw new SecurityError('update.rollback_blocked');
  }
}

// ── SHA-512 Hash Computation ─────────────────────────────────────────────────

async function sha512Of(filePath) {
  const { createReadStream } = require('node:fs');
  const hash = createHash('sha512');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (c) => hash.update(c));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

// ── Platform Detection ───────────────────────────────────────────────────────

function currentPlatformId() {
  return `${process.platform}-${process.arch}`;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PINNED_OWNER_REPO,
  PINNED_API_HOST,
  PINNED_ASSET_HOSTS,
  TRUSTED_PUBLIC_KEYS,
  SecurityError,
  fetchLatestRelease,
  findAsset,
  pickManifestAssets,
  downloadToBuffer,
  verifyManifestSignature,
  parseVerifiedManifest,
  compareSemver,
  assertNotRollback,
  sha512Of,
  currentPlatformId,
};
