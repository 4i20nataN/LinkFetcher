/**
 * generate-signing-key.cjs — Generate Ed25519 key pair for update manifest signing.
 *
 * Usage:
 *   node scripts/generate-signing-key.cjs
 *
 * Outputs:
 *   - Public key (embed in electron/updater/verifyRelease.cjs → TRUSTED_PUBLIC_KEYS)
 *   - Base64-encoded private key (add to GitHub repo secret: UPDATE_SIGNING_PRIVATE_KEY)
 *
 * ONLY RUN ONCE. The private key must NEVER be committed to the repo.
 */

'use strict';

const { generateKeyPairSync } = require('crypto');

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const privBase64 = Buffer.from(privPem).toString('base64');

console.log('='.repeat(60));
console.log('Ed25519 Key Pair Generated for LinkFetcher Update Signing');
console.log('='.repeat(60));
console.log('');
console.log('PUBLIC KEY (embed in electron/updater/verifyRelease.cjs):');
console.log(pubPem);
console.log('');
console.log('PRIVATE KEY — Base64-encoded (paste into GitHub secret UPDATE_SIGNING_PRIVATE_KEY):');
console.log('');
console.log(privBase64);
console.log('');
console.log('IMPORTANT:');
console.log('1. Copy the PUBLIC KEY into TRUSTED_PUBLIC_KEYS.v1 in verifyRelease.cjs');
console.log('2. Copy the BASE64 LINE (above) into GitHub repo secret UPDATE_SIGNING_PRIVATE_KEY');
console.log('3. NEVER commit the private key to the repository');
console.log('4. Run this script only once — reuse the same key pair for all releases');
console.log('');
console.log('The secret must be a SINGLE LINE of base64 text — no newlines, no PEM headers.');
