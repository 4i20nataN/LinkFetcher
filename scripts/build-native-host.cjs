#!/usr/bin/env node
// Compiles nativeHost.cjs into a standalone .exe using pkg.
// Output: electron/resources/nativeHost.exe

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOST_SRC = path.join(ROOT, 'electron', 'nativeHost.cjs');
const OUTPUT_DIR = path.join(ROOT, 'electron', 'resources');
const OUTPUT_EXE = path.join(OUTPUT_DIR, 'nativeHost.exe');

if (!fs.existsSync(HOST_SRC)) {
  console.error('nativeHost.cjs not found');
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

console.log('Compiling nativeHost.cjs → nativeHost.exe ...');

try {
  execSync(
    `npx pkg "${HOST_SRC}" --target node18-win-x64 --output "${OUTPUT_EXE}"`,
    { cwd: ROOT, stdio: 'inherit' }
  );

  const stat = fs.statSync(OUTPUT_EXE);
  console.log(`[OK] nativeHost.exe created (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
} catch (err) {
  console.error('[FAIL]', err.message);
  process.exit(1);
}
