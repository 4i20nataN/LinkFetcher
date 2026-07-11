/**
 * YtDlpManager - Manages the yt-dlp binary lifecycle on the server side.
 * Auto-downloads the correct binary for the current OS/arch on first use.
 * Runs entirely on local hardware - zero paid APIs required.
 */

import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import https from 'https';
import type { ProbeOptions, SearchOptions, SearchResult, DownloadOptions } from '../../types';

const execFileAsync = promisify(execFile);

// Store binary in project's .cache directory
const CACHE_DIR = path.join(process.cwd(), '.cache');
const BINARY_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const BINARY_PATH = path.join(CACHE_DIR, BINARY_NAME);

// Latest stable release URL from GitHub
const GITHUB_API_URL = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';

function getAssetName(): string {
  const { platform, arch } = process;
  if (platform === 'win32') {
    return 'yt-dlp.exe';
  } else if (platform === 'darwin') {
    return arch === 'arm64' ? 'yt-dlp_macos' : 'yt-dlp_macos_legacy';
  } else {
    // Linux
    if (arch === 'arm64') return 'yt-dlp_linux_aarch64';
    if (arch === 'arm') return 'yt-dlp_linux_armv7l';
    return 'yt-dlp_linux'; // x64
  }
}

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'LinkFetcher-App/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function downloadFile(url: string, destPath: string, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const followRedirects = (currentUrl: string) => {
      https.get(currentUrl, { headers: { 'User-Agent': 'LinkFetcher-App/1.0' } }, (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return followRedirects(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with status ${res.statusCode}`));
        }

        const totalLength = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;

        const fileStream = fs.createWriteStream(destPath);
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalLength > 0 && onProgress) {
            onProgress(Math.floor((downloaded / totalLength) * 100));
          }
        });
        res.pipe(fileStream);
        fileStream.on('finish', () => fileStream.close(() => resolve()));
        fileStream.on('error', reject);
      }).on('error', reject);
    };
    followRedirects(url);
  });
}

let binaryReady = false;
let downloadPromise: Promise<void> | null = null;

export async function ensureYtDlp(onProgress?: (msg: string) => void): Promise<string> {
  // Already verified
  if (binaryReady && fs.existsSync(BINARY_PATH)) return BINARY_PATH;

  // Deduplicate concurrent calls
  if (downloadPromise) {
    await downloadPromise;
    return BINARY_PATH;
  }

  // Check if already exists and works
  if (fs.existsSync(BINARY_PATH)) {
    try {
      await execFileAsync(BINARY_PATH, ['--version']);
      binaryReady = true;
      return BINARY_PATH;
    } catch {
      // Corrupted binary, re-download
      fs.unlinkSync(BINARY_PATH);
    }
  }

  // Need to download
  downloadPromise = (async () => {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    onProgress?.('[yt-dlp] Verificando última versão no GitHub...');
    const release = await fetchJson(GITHUB_API_URL);
    const assetName = getAssetName();
    const asset = release.assets?.find((a: any) => a.name === assetName);

    if (!asset) {
      throw new Error(`yt-dlp: Asset "${assetName}" não encontrado na release.`);
    }

    onProgress?.(`[yt-dlp] Baixando ${assetName} v${release.tag_name}...`);
    await downloadFile(asset.browser_download_url, BINARY_PATH, (pct) => {
      onProgress?.(`[yt-dlp] Download... ${pct}%`);
    });

    // Make executable on Unix
    if (process.platform !== 'win32') {
      fs.chmodSync(BINARY_PATH, 0o755);
    }

    // Verify
    await execFileAsync(BINARY_PATH, ['--version']);
    binaryReady = true;
    onProgress?.('[yt-dlp] Pronto! Binário instalado e verificado.');
  })();

  try {
    await downloadPromise;
  } finally {
    downloadPromise = null;
  }

  return BINARY_PATH;
}

export function getBinaryPath(): string {
  return BINARY_PATH;
}

export function isBinaryReady(): boolean {
  return binaryReady && fs.existsSync(BINARY_PATH);
}

/**
 * Get real video/audio formats from yt-dlp for a given URL.
 * Returns parsed JSON from --dump-json
 */
export async function getVideoInfo(url: string): Promise<any> {
  const binary = await ensureYtDlp();
  const { stdout } = await execFileAsync(binary, [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    url
  ], { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
  return JSON.parse(stdout);
}

/**
 * Download a video/audio to a temp directory.
 * Streams progress events via callback.
 * @returns Path to downloaded file
 */
export function spawnDownload(params: {
  url: string;
  format: string; // yt-dlp format string e.g. 'bestvideo[height<=1080]+bestaudio/best'
  outputTemplate: string; // e.g. '/tmp/downloads/%(title)s.%(ext)s'
  onProgress: (data: { percent: number; speed: string; eta: string; filename?: string }) => void;
  onComplete: (filePath: string) => void;
  onError: (err: string) => void;
}): () => void /* returns cancel fn */ {
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--newline',           // Force newline on progress
    '--progress',
    '--format', params.format,
    '--merge-output-format', 'mp4',
    '-o', params.outputTemplate,
    '--embed-metadata',
    '--no-mtime',
    params.url
  ];

  let proc: ReturnType<typeof spawn> | null = null;

  (async () => {
    const binary = await ensureYtDlp(msg => console.log(msg));
    proc = spawn(binary, args);

    let lastFile = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        // Parse progress lines: [download]  45.2% of   48.50MiB at    3.20MiB/s ETA 00:12
        const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+[\d.]+\S+\s+at\s+([\d.]+\S+)\/s\s+ETA\s+(\S+)/);
        if (progressMatch) {
          params.onProgress({
            percent: parseFloat(progressMatch[1]),
            speed: progressMatch[2],
            eta: progressMatch[3],
          });
        }
        // Detect destination file
        const destMatch = line.match(/\[(?:download|Merger)\] Destination:\s*(.+)/) ||
                          line.match(/\[download\] (.+\.(?:mp4|webm|mp3|m4a|opus|ogg|wav)) has already been downloaded/);
        if (destMatch) {
          lastFile = destMatch[1].trim();
        }
        // Merged file
        const mergeMatch = line.match(/Merging formats into "(.+)"/);
        if (mergeMatch) lastFile = mergeMatch[1].trim();
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      console.warn('[yt-dlp stderr]', chunk.toString());
    });

    proc.on('close', (code) => {
      if (code === 0 && lastFile) {
        params.onComplete(lastFile);
      } else if (code !== null && code !== 0) {
        params.onError(`yt-dlp exited with code ${code}`);
      }
    });

    proc.on('error', (err) => {
      params.onError(err.message);
    });
  })();

  // Return cancel function
  return () => {
    proc?.kill('SIGTERM');
  };
}

/**
 * Execute yt-dlp with given arguments and return structured result.
 */
async function executeYtDlp(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const binary = await ensureYtDlp();
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, {
      maxBuffer: 50 * 1024 * 1024,
      encoding: 'utf-8',
    });
    return { exitCode: 0, stdout, stderr };
  } catch (err: any) {
    return {
      exitCode: err.code ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message ?? String(err),
    };
  }
}

/**
 * Probe a URL with yt-dlp --dump-json --no-download.
 * Returns the parsed JSON metadata for the URL.
 */
export async function probeUrl(options: ProbeOptions): Promise<any> {
  const args = ['--dump-json', '--no-download'];

  if (options.cookies) args.push('--cookies', options.cookies);
  if (options.cookiesFromBrowser) args.push('--cookies-from-browser', options.cookiesFromBrowser);
  if (options.proxy) args.push('--proxy', options.proxy);

  args.push(options.url);

  const result = await executeYtDlp(args);

  if (result.exitCode !== 0) {
    throw new Error(`Probe failed: ${result.stderr}`);
  }

  return JSON.parse(result.stdout);
}

/**
 * Search videos on a platform using yt-dlp flat-playlist mode.
 */
export async function searchVideos(options: SearchOptions): Promise<SearchResult[]> {
  const maxResults = options.maxResults || 10;
  const query = options.query;

  let searchQuery: string;
  switch (options.platform) {
    case 'youtube':
      searchQuery = `ytsearch${maxResults}:${query}`;
      break;
    case 'vimeo':
      searchQuery = `https://vimeo.com/search?q=${encodeURIComponent(query)}`;
      break;
    case 'dailymotion':
      searchQuery = `https://www.dailymotion.com/search/${encodeURIComponent(query)}/videos`;
      break;
    case 'bilibili':
      searchQuery = `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`;
      break;
    case 'soundcloud':
      searchQuery = `scsearch${maxResults}:${query}`;
      break;
    default:
      searchQuery = `ytsearch${maxResults}:${query}`;
  }

  const args = ['--flat-playlist', '--dump-json', '--no-download'];

  if (options.cookies) args.push('--cookies', options.cookies);
  if (options.proxy) args.push('--proxy', options.proxy);

  args.push(searchQuery);

  const result = await executeYtDlp(args);

  if (result.exitCode !== 0) {
    throw new Error(`Search failed: ${result.stderr}`);
  }

  const lines = result.stdout.trim().split('\n');
  const results: SearchResult[] = [];

  for (const line of lines) {
    if (!line) continue;
    try {
      const item = JSON.parse(line);
      results.push({
        id: item.id || '',
        title: item.title || 'Unknown',
        url: item.url || item.webpage_url || '',
        thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || '',
        duration: item.duration || 0,
        duration_string: item.duration_string || '0:00',
        view_count: item.view_count || 0,
        uploader: item.uploader || item.channel || '',
        description: item.description || ''
      });
    } catch {
      // Skip invalid JSON lines
    }
  }

  return results;
}

const DEFAULT_FORMAT = 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b';

/**
 * Build a complete yt-dlp argument array from DownloadOptions.
 */
export function buildArgs(options: DownloadOptions): string[] {
  const args: string[] = [];

  // Format selection
  args.push('--format', options.format || DEFAULT_FORMAT);

  // Audio extraction
  if (options.audioOnly) {
    args.push('--extract-audio');
    if (options.audioFormat) args.push('--audio-format', options.audioFormat);
    if (options.audioQuality) args.push('--audio-quality', options.audioQuality);
  }

  // Merge output format
  if (options.mergeOutputFormat) {
    args.push('--merge-output-format', options.mergeOutputFormat);
  }

  // Subtitles
  if (options.writeSubs) args.push('--write-subs');
  if (options.writeAutoSubs) args.push('--write-auto-subs');
  if (options.subLangs) args.push('--sub-langs', options.subLangs);
  if (options.subFormat) args.push('--sub-format', options.subFormat);
  if (options.embedSubs) args.push('--embed-subs');

  // Thumbnails
  if (options.writeThumbnail) args.push('--write-thumbnail');
  if (options.embedThumbnail) args.push('--embed-thumbnail');

  // Metadata
  if (options.embedMetadata) args.push('--embed-metadata');

  // Output template
  if (options.outputTemplate) {
    args.push('-o', options.outputTemplate);
  }

  // Behavior flags
  if (options.restrictFilenames) args.push('--restrict-filenames');
  if (options.noOverwrites) args.push('--no-overwrites');
  if (options.keepVideo) args.push('--keep-video');

  // Auth options
  if (options.cookies) args.push('--cookies', options.cookies);
  if (options.cookiesFromBrowser) args.push('--cookies-from-browser', options.cookiesFromBrowser);
  if (options.proxy) args.push('--proxy', options.proxy);

  // FFmpeg location
  if (options.ffmpegLocation) args.push('--ffmpeg-location', options.ffmpegLocation);

  // URL last
  args.push(options.url);

  return args;
}
