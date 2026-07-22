/**
 * generate-manifest.mjs
 *
 * Runs inside GitHub Actions on Windows (node -e via shell: node).
 * Reads exe files from release/, generates manifest.json + CHECKSUMS + signs with Ed25519.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, createPrivateKey, sign } from 'node:crypto';

const VERSION = process.env.RELEASE_VERSION;
const releaseDir = 'release';

const files = readdirSync(releaseDir).filter(f => f.endsWith('.exe'));
console.log('Found executables:', files);

const setupFile = files.find(f => f.includes('Setup'));
const portableFile = files.find(f => f.includes('Portable'));

function hashFile(filePath, algo) {
  return createHash(algo).update(readFileSync(filePath)).digest('hex');
}

function fileSize(filePath) {
  return statSync(filePath).size;
}

const artifacts = [];

if (setupFile) {
  const p = join(releaseDir, setupFile);
  artifacts.push({
    platform: 'win32-x64',
    fileName: setupFile,
    sha256: hashFile(p, 'sha256'),
    sha512: hashFile(p, 'sha512'),
    sizeBytes: fileSize(p),
  });
}

if (portableFile) {
  const p = join(releaseDir, portableFile);
  artifacts.push({
    platform: 'win32-x64-portable',
    fileName: portableFile,
    sha256: hashFile(p, 'sha256'),
    sha512: hashFile(p, 'sha512'),
    sizeBytes: fileSize(p),
  });
}

if (artifacts.length === 0) {
  console.error('No exe files found in release/');
  process.exit(1);
}

// manifest.json
const manifest = {
  schemaVersion: 1,
  repository: '4i20nataN/LinkFetcher',
  version: VERSION,
  minimumSupportedVersion: '1.0.0',
  publishedAt: new Date().toISOString(),
  signingKeyId: 'v1',
  artifacts,
};
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
console.log('manifest.json written');

// CHECKSUMS
let checksums = '';
for (const art of artifacts) {
  checksums += art.sha512 + '  ' + art.fileName + '\n';
}
writeFileSync('CHECKSUMS_SHA512.txt', checksums);
console.log('CHECKSUMS_SHA512.txt written');

// Sign manifest with Ed25519
let privKeyPem;
const keyPath = process.env.SIGNING_KEY_PATH;
if (keyPath) {
  privKeyPem = readFileSync(keyPath, 'utf-8');
  console.log('Read key from file:', keyPath);
} else {
  const envKey = process.env.UPDATE_SIGNING_PRIVATE_KEY;
  if (!envKey) {
    console.error('No signing key found');
    process.exit(1);
  }
  privKeyPem = envKey.replace(/\\n/g, '\n');
  console.log('Read key from env var');
}
// Normalize: fix escaped newlines, strip BOM, trim whitespace
privKeyPem = privKeyPem.replace(/\\n/g, '\n').replace(/^\uFEFF/, '').trim();

// If key is base64-encoded (no PEM header), decode it
if (!privKeyPem.includes('-----BEGIN')) {
  console.log('Key is base64-encoded, decoding...');
  privKeyPem = Buffer.from(privKeyPem, 'base64').toString('utf-8');
}

console.log('Key length after normalize:', privKeyPem.length);
console.log('Key header:', privKeyPem.split('\n')[0]);
console.log('Key footer:', privKeyPem.split('\n').pop());

// Validate PEM structure
if (!privKeyPem.includes('-----BEGIN PRIVATE KEY-----')) {
  console.error('ERROR: PEM does not contain BEGIN PRIVATE KEY header');
  console.error('First 100 chars:', privKeyPem.slice(0, 100));
  process.exit(1);
}
if (!privKeyPem.includes('-----END PRIVATE KEY-----')) {
  console.error('ERROR: PEM does not contain END PRIVATE KEY footer');
  process.exit(1);
}

const keyObject = createPrivateKey(privKeyPem);
const manifestBytes = readFileSync('manifest.json');
const signature = sign(null, manifestBytes, keyObject);
// Write as base64 (verifyRelease.cjs expects base64-encoded signature)
writeFileSync('manifest.json.sig', signature.toString('base64'));
console.log('manifest.json.sig written (' + signature.length + ' bytes base64)');

// Summary
console.log('\nRelease ' + VERSION + ':');
for (const art of artifacts) {
  console.log('  ' + art.fileName + ': ' + art.sizeBytes + ' bytes, sha256=' + art.sha256.slice(0, 16) + '...');
}
