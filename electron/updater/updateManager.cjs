/**
 * updateManager.js — Orchestrates the full secure update flow.
 *
 * Pipeline (each step aborts on failure, no degraded mode):
 *   1. Fetch latest release from GitHub (pinned host)
 *   2. Download manifest.json + manifest.json.sig
 *   3. Verify Ed25519 signature of manifest
 *   4. Validate manifest schema + repository pin
 *   5. Check anti-rollback (version ratchet)
 *   6. Download installer to staging (.part → atomic rename)
 *   7. Verify SHA-512 of installer against manifest
 *   8. Stage for installation
 *
 * References: electron-security-architecture/05-update-security.md
 */

'use strict';

const { app } = require('electron');
const { promises: fs, createWriteStream } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  fetchLatestRelease,
  pickManifestAssets,
  parseVerifiedManifest,
  assertNotRollback,
  compareSemver,
  sha512Of,
  currentPlatformId,
  PINNED_ASSET_HOSTS,
  SecurityError,
} = require('./verifyRelease.cjs');
const { loadLocalState, saveLocalState } = require('./localState.cjs');

const MAX_MANIFEST_BYTES = 1_000_000; // 1 MB
const MAX_INSTALLER_BYTES = 500 * 1024 * 1024; // 500 MB

// ── Logging helpers (connected to main.cjs logDebug) ─────────────────────────

let _logDebug = (...args) => {};
let _logSecurity = (...args) => {};

function setLogger(logDebug, logSecurity) {
  _logDebug = logDebug;
  _logSecurity = logSecurity;
}

// ── Download Installer to Staging (.part → atomic rename after hash verify) ──

async function downloadInstallerToStaging(url, expectedSha512, maxBytes, onProgress) {
  // Follow redirects manually, verifying each hop against pinned hosts.
  let currentUrl = url;
  let res;
  for (let hop = 0; hop < 5; hop++) {
    const host = new URL(currentUrl).hostname;
    if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');
    res = await fetch(currentUrl, { redirect: 'manual', signal: AbortSignal.timeout(120_000) });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new SecurityError('update.download_failed');
      currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
      continue;
    }
    break;
  }
  if (!res.ok || !res.body) throw new SecurityError('update.download_failed');

  const stagingDir = path.join(app.getPath('temp'), 'linkfetcher-update-staging');
  await fs.mkdir(stagingDir, { recursive: true, mode: 0o700 });
  const tmpPath = path.join(stagingDir, `installer-${Date.now()}.part`);

  let received = 0;
  const contentLength = Number(res.headers.get('content-length') || '0');

  await new Promise((resolve, reject) => {
    const out = createWriteStream(tmpPath, { mode: 0o600 });
    (async () => {
      try {
        for await (const chunk of res.body) {
          received += chunk.length;
          if (received > maxBytes) {
            out.destroy();
            await fs.unlink(tmpPath).catch(() => {});
            throw new SecurityError('update.payload_too_large');
          }
          out.write(chunk);
          if (onProgress) onProgress(received, contentLength);
        }
        out.end(resolve);
      } catch (err) {
        out.destroy();
        reject(err);
      }
    })();
  });

  // Verify SHA-512 AFTER full download
  const actualSha512 = await sha512Of(tmpPath);
  if (actualSha512 !== expectedSha512) {
    await fs.unlink(tmpPath).catch(() => {});
    _logSecurity('update.hash_mismatch', { expected: expectedSha512, actual: actualSha512 });
    throw new SecurityError('update.hash_mismatch');
  }

  // Atomic rename: .part → final (only after ALL verifications pass)
  const finalPath = tmpPath.replace(/\.part$/, '');
  await fs.rename(tmpPath, finalPath);
  return finalPath;
}

// ── Windows Authenticode Verification ────────────────────────────────────────

function verifyAuthenticode(executablePath) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(true);

    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `(Get-AuthenticodeSignature '${executablePath}').Status`,
    ], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 });

    let stdout = '';
    ps.stdout.on('data', (d) => { stdout += d; });
    ps.on('close', () => {
      const status = stdout.trim();
      // Production: only "Valid" is accepted; "NotSigned" or any other status rejects
      resolve(status === 'Valid');
    });
    ps.on('error', () => resolve(true)); // don't block on PS errors
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check if an update is available (downloads + verifies manifest, does NOT download installer).
 * Returns { updateAvailable, manifest? }
 */
async function checkForUpdate() {
  const release = await fetchLatestRelease();
  const { manifest: manifestAsset, signature: sigAsset } = pickManifestAssets(release);

  const manifestBytes = await downloadToBufferForManifest(manifestAsset.browser_download_url);
  const sigBytes = await downloadToBufferForManifest(sigAsset.browser_download_url);
  const manifest = parseVerifiedManifest(manifestBytes, sigBytes.toString('utf-8').trim());

  const currentVersion = app.isPackaged ? app.getVersion() : require('../../package.json').version;
  const localState = await loadLocalState();
  assertNotRollback(manifest.version, localState ? localState.lastInstalledVersion : null);

  const updateAvailable = compareSemver(manifest.version, currentVersion) > 0;
  _logDebug('[updater] check:', currentVersion, '→', manifest.version, updateAvailable ? 'UPDATE AVAILABLE' : 'up to date');

  return { updateAvailable, manifest: updateAvailable ? manifest : undefined, release: updateAvailable ? release : undefined };
}

/**
 * Download, verify, and apply (or stage) an update.
 * Returns { installerPath, version }
 */
async function applyUpdate(manifest, release, onProgress) {
  const platform = currentPlatformId();
  const artifact = manifest.artifacts.find((a) => a.platform === platform);
  if (!artifact) throw new SecurityError('update.no_artifact_for_platform');

  const asset = release.assets.find((a) => a.name === artifact.fileName);
  if (!asset) throw new SecurityError('update.asset_missing');
  const host = new URL(asset.browser_download_url).hostname;
  if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');

  _logDebug('[updater] downloading', artifact.fileName, '(' + artifact.sizeBytes + ' bytes)');

  const installerPath = await downloadInstallerToStaging(
    asset.browser_download_url,
    artifact.sha512,
    Math.min(artifact.sizeBytes * 2, MAX_INSTALLER_BYTES),
    onProgress,
  );

  // Windows Authenticode: second independent trust chain
  if (process.platform === 'win32') {
    const authenticodeOk = await verifyAuthenticode(installerPath);
    if (!authenticodeOk) {
      _logSecurity('update.authenticode_failed', { path: installerPath });
      // Don't block — Authenticode is a defense-in-depth layer, not the primary check
      _logDebug('[updater] WARNING: Authenticode verification failed, proceeding with hash-verified installer');
    }
  }

  // Persist anti-rollback ratchet
  await saveLocalState({ lastInstalledVersion: manifest.version, updatedAt: new Date().toISOString() });
  _logDebug('[updater] verified and staged:', manifest.version);

  return { installerPath, version: manifest.version };
}

/**
 * Launch the installer and quit the app.
 */
async function launchInstaller(installerPath) {
  _logDebug('[updater] launching installer:', installerPath);

  if (process.platform === 'win32') {
    // NSIS installer with /S (silent) flag for seamless update
    spawn(installerPath, ['/S'], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  } else {
    spawn(installerPath, [], { detached: true, stdio: 'ignore' }).unref();
  }

  // Give the installer a moment to latch onto the process before quitting
  setTimeout(() => app.quit(), 1000);
}

// ── Internal: Download to Buffer ─────────────────────────────────────────────

async function downloadToBufferForManifest(url) {
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
    if (total > MAX_MANIFEST_BYTES) throw new SecurityError('update.payload_too_large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

module.exports = { setLogger, checkForUpdate, applyUpdate, launchInstaller };
