// main/updater/updateManager.ts
// Orquestra o fluxo completo descrito em references/05-update-security.md.
// Cada etapa que falha aborta e loga — nenhum fallback "sem verificação".

import { app } from 'electron';
import { promises as fs, createWriteStream } from 'node:fs';
import path from 'node:path';
import {
  fetchLatestRelease,
  pickManifestAssets,
  parseVerifiedManifest,
  assertNotRollback,
  compareSemver,
  sha512Of,
  PINNED_ASSET_HOSTS,
  SecurityError,
} from './verifyRelease';
import { loadLocalState, saveLocalState } from './localState';
import type { Manifest } from './types';

declare function logSecurityEvent(event: string, context: Record<string, unknown>): void;
declare function logAudit(event: string, context: Record<string, unknown>): void;
declare function currentPlatformId(): string; // ex.: 'win32-x64'

const MAX_MANIFEST_BYTES = 1_000_000;
const MAX_INSTALLER_BYTES = 500 * 1024 * 1024;

async function downloadAssetToBuffer(url: string, maxBytes: number): Promise<Buffer> {
  const host = new URL(url).hostname;
  if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');

  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  if (!res.ok || !res.body) throw new SecurityError('update.download_failed');

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.length;
    if (total > maxBytes) throw new SecurityError('update.payload_too_large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadInstallerToStaging(
  url: string,
  expectedSha512: string,
  maxBytes: number,
  onProgress?: (received: number, total: number) => void,
): Promise<string> {
  const host = new URL(url).hostname;
  if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');

  const stagingDir = path.join(app.getPath('temp'), 'linkfatcher-update-staging');
  await fs.mkdir(stagingDir, { recursive: true, mode: 0o700 });
  const tmpPath = path.join(stagingDir, `installer-${Date.now()}.part`);

  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  if (!res.ok || !res.body) throw new SecurityError('update.download_failed');

  let received = 0;
  const contentLength = Number(res.headers.get('content-length') ?? '0');
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(tmpPath, { mode: 0o600 });
    (async () => {
      try {
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
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
    await fs.unlink(tmpPath).catch(() => {});
    logSecurityEvent('update.hash_mismatch', {});
    throw new SecurityError('update.hash_mismatch');
  }

  const finalPath = tmpPath.replace(/\.part$/, '');
  await fs.rename(tmpPath, finalPath); // atômico no mesmo filesystem, só após hash verificado
  return finalPath;
}

export interface UpdateCheckOutcome {
  updateAvailable: boolean;
  manifest?: Manifest;
}

export async function checkForUpdate(): Promise<UpdateCheckOutcome> {
  const release = await fetchLatestRelease();
  const { manifest: manifestAsset, signature: sigAsset } = pickManifestAssets(release);

  const manifestBytes = await downloadAssetToBuffer(manifestAsset.browser_download_url, MAX_MANIFEST_BYTES);
  const sigBytes = await downloadAssetToBuffer(sigAsset.browser_download_url, 4096);
  const manifest = parseVerifiedManifest(manifestBytes, sigBytes.toString('utf-8').trim());

  const currentVersion = app.getVersion();
  const localState = await loadLocalState();
  assertNotRollback(manifest.version, localState?.lastInstalledVersion ?? null);

  const updateAvailable = compareSemver(manifest.version, currentVersion) > 0;
  logAudit('update.checked', { current: currentVersion, latest: manifest.version, updateAvailable });

  return { updateAvailable, manifest: updateAvailable ? manifest : undefined };
}

export async function downloadAndVerifyUpdate(
  manifest: Manifest,
  release: Awaited<ReturnType<typeof fetchLatestRelease>>,
  onProgress?: (received: number, total: number) => void,
): Promise<string> {
  const artifact = manifest.artifacts.find((a) => a.platform === currentPlatformId());
  if (!artifact) throw new SecurityError('update.no_artifact_for_platform');

  const asset = release.assets.find((a) => a.name === artifact.fileName);
  if (!asset) throw new SecurityError('update.asset_missing');
  const host = new URL(asset.browser_download_url).hostname;
  if (!PINNED_ASSET_HOSTS.has(host)) throw new SecurityError('update.asset_host_not_allowed');

  const installerPath = await downloadInstallerToStaging(
    asset.browser_download_url,
    artifact.sha512,
    Math.min(artifact.sizeBytes * 2, MAX_INSTALLER_BYTES), // margem de tolerância, nunca ilimitado
    onProgress,
  );

  // Windows: segunda cadeia de confiança independente do manifest — ver
  // references/05-update-security.md. Implementação real chamaria
  // `powershell Get-AuthenticodeSignature` via execFile (nunca exec/shell)
  // e compararia o thumbprint contra artifact.authenticodeThumbprint.

  await saveLocalState({ lastInstalledVersion: manifest.version, updatedAt: new Date().toISOString() });
  logAudit('update.verified_and_staged', { version: manifest.version });
  return installerPath;
}
