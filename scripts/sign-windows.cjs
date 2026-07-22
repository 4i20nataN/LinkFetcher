#!/usr/bin/env node
/**
 * sign-windows.cjs — Authenticode code signing for Windows installer/portable
 *
 * Runs AFTER electron-builder produces artifacts in release/
 * Signs: .exe (NSIS installer), .zip (portable), and internal .exe files
 *
 * Requires:
 *   - Code Signing Certificate (EV or OV) from trusted CA (DigiCert, Sectigo, etc.)
 *   - Certificate as PFX file or in Windows Certificate Store
 *   - Windows SDK (signtool.exe) or AzureSignTool for Azure Key Vault
 *
 * Usage:
 *   npm run sign:win
 *
 * Env vars (set in CI/CD):
 *   CSC_LINK          → Base64-encoded PFX (or path to PFX file)
 *   CSC_KEY_PASSWORD  → PFX password
 *   CSC_SHA256        → SHA-256 thumbprint of cert (for electron-builder)
 */

'use strict';

const { execSync } = require('node:child_process');
const { readdirSync, statSync, existsSync } = require('node:fs');
const { join, extname, basename } = require('node:path');

const RELEASE_DIR = join(__dirname, '..', 'release');

function findFiles(dir, extensions) {
  const results = [];
  function walk(d) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (extensions.includes(extname(entry).toLowerCase())) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function getSignToolPath() {
  // Try common Windows SDK locations
  const candidates = [
    process.env.SIGNTOOL_PATH,
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22000.0\\x64\\signtool.exe',
    'C:\\Program Files\\Microsoft SDKs\\Windows\\v10.0A\\bin\\NETFX 4.8 Tools\\signtool.exe',
  ].filter(Boolean);

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  // Fallback to PATH
  return 'signtool.exe';
}

function signFile(signTool, file, certOptions) {
  const args = [
    'sign',
    '/fd', 'sha256',
    '/tr', 'http://timestamp.digicert.com',
    '/td', 'sha256',
    '/v',
  ];

  if (certOptions.pfxPath) {
    args.push('/f', certOptions.pfxPath);
    if (certOptions.password) args.push('/p', certOptions.password);
  } else if (certOptions.sha256) {
    args.push('/sha1', certOptions.sha256); // signtool uses /sha1 for thumbprint even for SHA-256
  } else {
    throw new Error('No certificate source specified');
  }

  args.push(file);

  try {
    execSync(`"${signTool}" ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`, {
      stdio: 'inherit',
      timeout: 60_000,
    });
    console.log(`✅ Signed: ${file}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to sign ${file}:`, err.message);
    return false;
  }
}

function main() {
  console.log('🔐 Windows Authenticode Code Signing\n');

  // Certificate config from env
  const pfxBase64 = process.env.CSC_LINK;
  const pfxPassword = process.env.CSC_KEY_PASSWORD;
  const certThumbprint = process.env.CSC_SHA256;

  if (!pfxBase64 && !certThumbprint) {
    console.error('❌ No certificate source: set CSC_LINK (PFX base64) or CSC_SHA256 (thumbprint)');
    process.exit(1);
  }

  let pfxPath = null;
  if (pfxBase64) {
    const { writeFileSync, mkdtempSync } = require('node:fs');
    const { tmpdir } = require('node:os');
    const { join } = require('node:path');
    const tmpDir = mkdtempSync(join(tmpdir(), 'linkfetcher-sign-'));
    pfxPath = join(tmpDir, 'cert.pfx');
    writeFileSync(pfxPath, Buffer.from(pfxBase64, 'base64'));
    console.log(`📜 Using PFX from CSC_LINK (temp: ${pfxPath})`);
  } else {
    console.log(`📜 Using cert from Windows Store (thumbprint: ${certThumbprint})`);
  }

  const signTool = getSignToolPath();
  console.log(`🔧 signtool: ${signTool}\n`);

  if (!existsSync(RELEASE_DIR)) {
    console.error(`❌ Release dir not found: ${RELEASE_DIR}`);
    console.error('Run `npm run package:win` first.');
    process.exit(1);
  }

  // Files to sign
  const files = [
    ...findFiles(RELEASE_DIR, ['.exe']),
    ...findFiles(RELEASE_DIR, ['.zip']),
  ].filter(f => !f.includes('unins') && !f.includes('crashpad')); // Skip uninstaller, crashpad

  if (files.length === 0) {
    console.log('⚠️  No files to sign');
    return;
  }

  console.log(`📦 Found ${files.length} file(s) to sign:\n`);
  files.forEach(f => console.log(`   ${f}`));
  console.log('');

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const ok = signFile(signTool, file, {
      pfxPath,
      password: pfxPassword,
      sha256: certThumbprint,
    });
    if (ok) success++;
    else failed++;
  }

  console.log(`\n📊 Result: ${success} signed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('🎉 All files signed successfully!');
}

main();