#!/usr/bin/env node
/**
 * generate-release-artifacts.cjs — Gera manifest.json, assinatura Ed25519 e CHECKSUMS_SHA512.txt
 * 
 * Uso:
 *   node scripts/generate-release-artifacts.cjs --version 1.1.0 --private-key path/to/private-key.pem
 * 
 * Se --private-key não for passado, apenas gera manifest.json e CHECKSUMS_SHA512.txt (sem assinatura)
 */

'use strict';

const { createHash, createSign } = require('node:crypto');
const { readFileSync, writeFileSync, statSync, existsSync } = require('node:fs');
const { join, basename, resolve } = require('node:path');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { version: null, privateKey: null, outputDir: 'release' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version') opts.version = args[++i];
    else if (args[i] === '--private-key') opts.privateKey = args[++i];
    else if (args[i] === '--output-dir') opts.outputDir = args[++i];
  }
  if (!opts.version) {
    console.error('❌ --version é obrigatório');
    process.exit(1);
  }
  return opts;
}

function sha512File(filepath) {
  const content = readFileSync(filepath);
  return createHash('sha512').update(content).digest('hex');
}

function sha256File(filepath) {
  const content = readFileSync(filepath);
  return createHash('sha256').update(content).digest('hex');
}

function main() {
  const opts = parseArgs();
  const version = opts.version;
  const outputDir = resolve(opts.outputDir);
  
  console.log(`📦 Gerando artifacts de release para v${version}\n`);
  
  // Arquivos esperados
  const artifacts = [
    { 
      platform: 'win32-x64', 
      fileName: `LinkFetcher-Setup-${version}-x64.exe`,
      filepath: join(outputDir, `LinkFetcher-Setup-${version}-x64.exe`),
    },
    { 
      platform: 'win32-x64', 
      fileName: `LinkFetcher-Portable-${version}-x64.exe`,
      filepath: join(outputDir, `LinkFetcher-Portable-${version}-x64.exe`),
    },
    { 
      platform: 'android', 
      fileName: `LinkFetcher-${version}.apk`,
      filepath: join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
    },
  ];
  
  // Verifica quais existem
  const existingArtifacts = [];
  for (const art of artifacts) {
    const fullPath = resolve(art.filepath);
    if (existsSync(fullPath)) {
      const stats = statSync(fullPath);
      const sha512 = sha512File(fullPath);
      const sha256 = sha256File(fullPath);
      existingArtifacts.push({
        platform: art.platform,
        fileName: art.fileName,
        sha512,
        sha256,
        sizeBytes: stats.size,
      });
      console.log(`  ✅ ${art.fileName} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    } else {
      console.log(`  ⚠️  ${art.fileName} NÃO ENCONTRADO (${art.filepath})`);
    }
  }
  
  if (existingArtifacts.length === 0) {
    console.error('\n❌ Nenhum artifact encontrado!');
    process.exit(1);
  }
  
  // Gera manifest.json
  const manifest = {
    schemaVersion: 1,
    repository: '4i20nataN/LinkFetcher',
    version,
    minimumSupportedVersion: '1.0.0',
    publishedAt: new Date().toISOString(),
    signingKeyId: 'v1',
    artifacts: existingArtifacts,
  };
  
  const manifestPath = join(outputDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n📝 manifest.json → ${manifestPath}`);
  
  // Assina manifest.json se tiver chave privada
  if (opts.privateKey) {
    const { sign } = require('node:crypto');
    const privateKeyPem = readFileSync(opts.privateKey, 'utf-8');
    const manifestBytes = readFileSync(manifestPath);
    const signature = sign(null, manifestBytes, { key: privateKeyPem, format: 'pem' }).toString('base64');
    
    const sigPath = join(outputDir, 'manifest.json.sig');
    writeFileSync(sigPath, signature);
    console.log(`🔐 manifest.json.sig → ${sigPath}`);
  } else {
    console.log('\n⚠️  Chave privada não fornecida — manifest.json NÃO assinado');
    console.log('   Para assinar: --private-key path/to/private-key.pem');
  }
  
  // Gera CHECKSUMS_SHA512.txt
  const checksumsPath = join(outputDir, 'CHECKSUMS_SHA512.txt');
  let checksumsContent = '';
  for (const art of existingArtifacts) {
    checksumsContent += `${art.sha512}  ${art.fileName}\n`;
  }
  writeFileSync(checksumsPath, checksumsContent);
  console.log(`📋 CHECKSUMS_SHA512.txt → ${checksumsPath}`);
  
  console.log('\n✅ Artifacts de release prontos para upload no GitHub Releases!');
  console.log(`   Tag: v${version}`);
  console.log('   Arquivos para upar:');
  for (const art of existingArtifacts) {
    console.log(`   - ${art.fileName}`);
  }
  console.log('   - manifest.json');
  console.log('   - manifest.json.sig (se assinado)');
  console.log('   - CHECKSUMS_SHA512.txt');
}

main();