#!/usr/bin/env node
// Registers the LinkFetcher native messaging host with Chrome/Edge/Brave.
// Run once: node scripts/install-native-host.cjs

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOST_NAME = 'com.linkfetcher.app';
const isWin = process.platform === 'win32';
const ROOT = path.join(__dirname, '..');

// Prefer compiled .exe, fall back to .cjs with Node
const EXE_PATH = path.join(ROOT, 'electron', 'resources', 'nativeHost.exe');
const CJS_PATH = path.join(ROOT, 'electron', 'nativeHost.cjs');

let hostPath;
let hostArgs;

if (fs.existsSync(EXE_PATH)) {
  hostPath = EXE_PATH;
  hostArgs = [];
  console.log('Using compiled nativeHost.exe');
} else if (fs.existsSync(CJS_PATH)) {
  hostPath = 'node';
  hostArgs = [CJS_PATH];
  console.log('Using nativeHost.cjs (Node.js required)');
} else {
  console.error('No native host found. Run: npm run build:native-host');
  process.exit(1);
}

const hostManifest = {
  name: HOST_NAME,
  description: 'LinkFetcher Native Messaging Host',
  path: hostPath,
  type: 'stdio',
  allowed_origins: [
    'chrome-extension://placeholder/',  // Update with real extension ID
  ],
};

// On Windows, args go into the manifest as 'arguments'
if (hostArgs.length > 0) {
  hostManifest.arguments = hostArgs;
}

if (isWin) {
  const regKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
  const manifestDir = path.join(process.env.APPDATA || '', 'LinkFetcher');
  const manifestPath = path.join(manifestDir, 'native-host-manifest.json');

  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(hostManifest, null, 2), 'utf8');

  try {
    execSync(`reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath.replace(/\\/g, '\\\\')}" /f`, {
      stdio: 'pipe',
    });
    console.log('[OK] Chrome registered');
  } catch (err) {
    console.error('[FAIL] Chrome registry:', err.message);
  }

  const edgeKey = `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}`;
  try {
    execSync(`reg add "${edgeKey}" /ve /t REG_SZ /d "${manifestPath.replace(/\\/g, '\\\\')}" /f`, {
      stdio: 'pipe',
    });
    console.log('[OK] Edge registered');
  } catch {}

} else {
  const browsers = ['google-chrome', 'chromium', 'microsoft-edge', 'brave-browser'];
  const configDir = process.env.HOME + '/.config';
  let ok = 0;

  for (const b of browsers) {
    const dir = path.join(configDir, b, 'NativeMessagingHosts');
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${HOST_NAME}.json`), JSON.stringify(hostManifest, null, 2));
      ok++;
    } catch {}
  }

  console.log(ok ? `[OK] Registered with ${browsers.length} browser(s)` : '[FAIL] No browsers registered');
}

console.log('');
console.log('1. Load extension in Chrome: chrome://extensions → Developer mode → Load unpacked');
console.log('2. Copy the extension ID');
console.log('3. Update allowed_origins in: %APPDATA%\\LinkFetcher\\native-host-manifest.json');
console.log('4. Restart browser');
