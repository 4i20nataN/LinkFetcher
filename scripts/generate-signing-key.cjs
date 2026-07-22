#!/usr/bin/env node
/**
 * generate-signing-key.cjs — Gera par de chaves Ed25519 para assinatura de manifest.json
 *
 * Uso:
 *   npm run generate:signing-key
 *
 * Saída:
 *   - private-key.pem  → guarda no GitHub Actions secret: UPDATE_SIGNING_PRIVATE_KEY
 *   - public-key.pem   → copia para electron/updater/verifyRelease.cjs (TRUSTED_PUBLIC_KEYS.v2)
 *
 * Segurança:
 *   - Chave privada NUNCA commita no repo
 *   - Chave pública vai no código (pode ser pública)
 *   - Para rotação: gera v2, mantém v1 por 1 release (dual-sign), depois remove v1
 */

'use strict';

const { generateKeyPairSync, createSign, createVerify, generateKeyPair } = require('node:crypto');
const { writeFileSync, existsSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const KEYS_DIR = join(__dirname, '..', 'signing-keys');

function generateEd25519KeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
  };
}

function testSignVerify(privateKeyPem, publicKeyPem) {
  const testData = Buffer.from('linkfetcher-test-manifest');
  
  const { createPrivateKey, createPublicKey, sign, verify } = require('node:crypto');
  const privateKey = createPrivateKey({ key: privateKeyPem, format: 'pem' });
  const publicKey = createPublicKey({ key: publicKeyPem, format: 'pem' });
  
  const signature = sign(null, testData, privateKey);
  return verify(null, testData, publicKey, signature);
}

function main() {
  console.log('🔐 Gerando par de chaves Ed25519 para assinatura de manifest...\n');
  
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
    console.log(`📁 Diretório criado: ${KEYS_DIR}`);
  }
  
  const { privateKeyPem, publicKeyPem } = generateEd25519KeyPair();
  
  // Testa se funciona
  if (!testSignVerify(privateKeyPem, publicKeyPem)) {
    console.error('❌ Falha no teste de assinatura/verificação');
    process.exit(1);
  }
  
  const privatePath = join(KEYS_DIR, 'private-key.pem');
  const publicPath = join(KEYS_DIR, 'public-key.pem');
  
  writeFileSync(privatePath, privateKeyPem, { mode: 0o600 });
  writeFileSync(publicPath, publicKeyPem, { mode: 0o644 });
  
  console.log('✅ Chaves geradas com sucesso:\n');
  console.log(`   🔒 Private: ${privatePath}  (mode 600)`);
  console.log(`   🔓 Public:  ${publicPath}  (mode 644)\n`);
  
  console.log('--- PRIVATE KEY (copie para GitHub Actions secret: UPDATE_SIGNING_PRIVATE_KEY) ---');
  console.log(privateKeyPem);
  console.log('--- END PRIVATE KEY ---\n');
  
  console.log('--- PUBLIC KEY (copie para verifyRelease.cjs → TRUSTED_PUBLIC_KEYS.v2) ---');
  console.log(publicKeyPem);
  console.log('--- END PUBLIC KEY ---\n');
  
  console.log('⚠️  IMPORTANTE:');
  console.log('   1. Adicione UPDATE_SIGNING_PRIVATE_KEY no GitHub Actions Secrets');
  console.log('   2. Atualize TRUSTED_PUBLIC_KEYS no verifyRelease.cjs com a chave v2');
  console.log('   3. Para rotação: mantenha v1 + v2 por 1 release (dual-sign), depois remova v1');
  console.log('   4. NUNCA commite a chave privada no repositório');
}

main();