/**
 * generate-manifest.mjs
 *
 * Runs inside GitHub Actions on Windows (node -e via shell: node).
 * Reads exe files from release/, generates manifest.json + CHECKSUMS + signs with Ed25519.
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, sign } from 'node:crypto';

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
const privKeyPem = process.env.UPDATE_SIGNING_PRIVATE_KEY;
if (!privKeyPem) {
  console.error('UPDATE_SIGNING_PRIVATE_KEY not set');
  process.exit(1);
}
const manifestBytes = readFileSync('manifest.json');
const signature = sign(null, manifestBytes, privKeyPem);
writeFileSync('manifest.json.sig', signature);
console.log('manifest.json.sig written');

// Summary
console.log('\nRelease ' + VERSION + ':');
for (const art of artifacts) {
  console.log('  ' + art.fileName + ': ' + art.sizeBytes + ' bytes, sha256=' + art.sha256.slice(0, 16) + '...');
}
