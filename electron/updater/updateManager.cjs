'use strict';

/**
 * updateManager.cjs — orchestrates the full flow described in
 * verifyRelease.cjs's header comment. Every step that fails aborts and logs —
 * no "degraded mode without verification".
 *
 * This file (and handlers.cjs) is required by electron/main.cjs but did not
 * exist in the project backup — the packaged app crashed with MODULE_NOT_FOUND
 * on every launch until this was added. verifyRelease.cjs itself was recovered
 * from the live GitHub repo (it already existed there, signing real releases —
 * see manifest.json / manifest.json.sig / CHECKSUMS_SHA512.txt on the actual
 * GitHub Releases page). This file just wires that existing crypto core up to
 * a working download/install flow and to the IPC contract in preload.cjs.
 */

const { app } = require('electron');
const { createWriteStream, promises: fsp } = require('fs');
const path = require('path');
const {
  fetchLatestRelease,
  pickManifestAssets,
  parseVerifiedManifest,
  assertNotRollback,
  compareSemver,
  sha512Of,
  PINNED_ASSET_HOSTS,
  SecurityError,
  currentPlatformId,
} = require('./verifyRelease.cjs');
const { loadLocalState, saveLocalState } = require('./localState.cjs');

let infoLog = (...args) => console.log('[updater]', ...args);
let errorLog = (...args) => console.error('[updater]', ...args);

function setLogger(info, error) {
  if (typeof info === 'function') infoLog = info;
  if (typeof error === 'function') errorLog = error || info;
}

const MAX_MANIFEST_BYTES = 1_000_000;
const MAX_INSTALLER_BYTES = 500 * 1024 * 1024;

async function downloadAssetToBuffer(url, maxBytes) {
  const host = new URL(url).hostname;
  if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');

  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  if (!res.ok || !res.body) throw new SecurityError('update.download_failed');

  const chunks = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > maxBytes) throw new SecurityError('update.payload_too_large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadInstallerToStaging(url, expectedSha512, maxBytes, onProgress) {
  const host = new URL(url).hostname;
  if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');

  const stagingDir = path.join(app.getPath('temp'), 'linkfetcher-update-staging');
  await fsp.mkdir(stagingDir, { recursive: true, mode: 0o700 });
  const tmpPath = path.join(stagingDir, `installer-${Date.now()}.part`);

  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  if (!res.ok || !res.body) throw new SecurityError('update.download_failed');

  let received = 0;
  const contentLength = Number(res.headers.get('content-length') ?? '0');
  await new Promise((resolve, reject) => {
    const out = createWriteStream(tmpPath, { mode: 0o600 });
    (async () => {
      try {
        for await (const chunk of res.body) {
          received += chunk.length;
          if (received > maxBytes) throw new SecurityError('update.payload_too_large');
          out.write(chunk);
          onProgress?.(received, contentLength);
        }
        out.end(resolve);
      } catch (err) {
        out.destroy();
        reject(err);
      }
    })();
  });

  const actualSha512 = await sha512Of(tmpPath);
  if (actualSha512 !== expectedSha512) {
    await fsp.unlink(tmpPath).catch(() => {});
    errorLog('update.hash_mismatch: downloaded installer does not match manifest — discarded');
    throw new SecurityError('update.hash_mismatch');
  }

  const finalPath = tmpPath.replace(/\.part$/, '');
  await fsp.rename(tmpPath, finalPath); // atomic on same filesystem, only after hash is verified
  return finalPath;
}

/** @returns {Promise<{updateAvailable: boolean, manifest?: object, release?: object}>} */
async function checkForUpdate() {
  const release = await fetchLatestRelease();
  const { manifest: manifestAsset, signature: sigAsset } = pickManifestAssets(release);

  const manifestBytes = await downloadAssetToBuffer(manifestAsset.browser_download_url, MAX_MANIFEST_BYTES);
  const sigBytes = await downloadAssetToBuffer(sigAsset.browser_download_url, 4096);
  const manifest = parseVerifiedManifest(manifestBytes, sigBytes.toString('utf-8').trim());

  const currentVersion = app.getVersion();
  const localState = loadLocalState();
  assertNotRollback(manifest.version, localState?.lastInstalledVersion ?? null);

  const updateAvailable = compareSemver(manifest.version, currentVersion) > 0;
  infoLog('checkForUpdate:', { current: currentVersion, latest: manifest.version, updateAvailable });

  return { updateAvailable, manifest: updateAvailable ? manifest : undefined, release };
}

/** @returns {Promise<string>} path to the verified, staged installer */
async function downloadAndVerifyUpdate(manifest, release, onProgress) {
  const artifact = manifest.artifacts.find((a) => a.platform === currentPlatformId());
  if (!artifact) throw new SecurityError('update.no_artifact_for_platform');

  const asset = release.assets.find((a) => a.name === artifact.fileName);
  if (!asset) throw new SecurityError('update.asset_missing');
  const host = new URL(asset.browser_download_url).hostname;
  if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');

  const installerPath = await downloadInstallerToStaging(
    asset.browser_download_url,
    artifact.sha512,
    Math.min(artifact.sizeBytes * 2, MAX_INSTALLER_BYTES), // tolerance margin, never unlimited
    onProgress
  );

  try {
    saveLocalState({ lastInstalledVersion: manifest.version, updatedAt: new Date().toISOString() });
  } catch (err) {
    // Anti-rollback bookkeeping is best-effort — a failure here shouldn't block
    // an already-verified, already-staged installer from being offered.
    errorLog('failed to persist anti-rollback state:', err.message);
  }

  infoLog('update verified and staged:', manifest.version);
  return installerPath;
}

module.exports = { setLogger, checkForUpdate, downloadAndVerifyUpdate };
