/**
 * generate-signing-key.cjs — Generate Ed25519 key pair for update manifest signing.
 *
 * Usage:
 *   node scripts/generate-signing-key.cjs
 *
 * Outputs:
 *   - Public key (embed in electron/updater/verifyRelease.js → TRUSTED_PUBLIC_KEYS)
 *   - Private key (add to GitHub repo secret: UPDATE_SIGNING_PRIVATE_KEY)
 *
 * ONLY RUN ONCE. The private key must NEVER be committed to the repo.
 */

'use strict';

const { generateKeyPairSync } = require('crypto');

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

console.log('='.repeat(60));
console.log('Ed25519 Key Pair Generated for LinkFetcher Update Signing');
console.log('='.repeat(60));
console.log('');
console.log('PUBLIC KEY (embed in electron/updater/verifyRelease.js):');
console.log(pubPem);
console.log('');
console.log('PRIVATE KEY (add to GitHub repo secret UPDATE_SIGNING_PRIVATE_KEY):');
console.log(privPem);
console.log('');
console.log('IMPORTANT:');
console.log('1. Copy the PUBLIC KEY into TRUSTED_PUBLIC_KEYS.v1 in verifyRelease.js');
console.log('2. Copy the PRIVATE KEY into a GitHub repo secret named UPDATE_SIGNING_PRIVATE_KEY');
console.log('3. NEVER commit the private key to the repository');
console.log('4. Run this script only once — reuse the same key pair for all releases');
