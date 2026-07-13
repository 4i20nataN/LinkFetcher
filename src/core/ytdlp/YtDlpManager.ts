/**
 * YtDlpManager - Manages the yt-dlp binary lifecycle on the server side.
 * Uses a bundled yt-dlp binary or explicit environment paths.
 * Does not download yt-dlp at runtime in production.
 * Runs entirely on local hardware - zero paid APIs required.
 */

import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import type { ProbeOptions, SearchOptions, SearchResult, DownloadOptions } from '../../types';

const execFileAsync = promisify(execFile);

const BINARY_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const FFMPEG_NAME = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

function getBundledBinaryPath(): string {
  const candidates = [
    // Allow explicit override via env
    process.env.YTDLP_PATH || '',
    // When packaged with electron-builder extraResources -> resources/
    path.join(process.resourcesPath || process.cwd(), 'resources', BINARY_NAME),
    path.join(process.resourcesPath || process.cwd(), BINARY_NAME),
    // Electron dev (binaries in electron/resources/)
    path.join(process.cwd(), 'electron', 'resources', BINARY_NAME),
    // Common repo locations during development
    path.join(process.cwd(), 'yt-dlp', BINARY_NAME),
    path.join(process.cwd(), BINARY_NAME),
  ];

  const found = candidates.find(candidate => candidate && fs.existsSync(candidate));
  return found || (process.env.YTDLP_PATH || path.join(process.cwd(), 'yt-dlp', BINARY_NAME));
}

function getBundledFfmpegPath(): string {
  const candidates = [
    // Allow explicit override via env
    process.env.FFMPEG_PATH || '',
    // Packaged resources
    path.join(process.resourcesPath || process.cwd(), 'resources', FFMPEG_NAME),
    path.join(process.resourcesPath || process.cwd(), FFMPEG_NAME),
    // Electron dev (binaries in electron/resources/)
    path.join(process.cwd(), 'electron', 'resources', FFMPEG_NAME),
    // Common repo locations during development
    path.join(process.cwd(), 'yt-dlp', FFMPEG_NAME),
    path.join(process.cwd(), FFMPEG_NAME),
  ];

  const found = candidates.find(candidate => candidate && fs.existsSync(candidate));
  return found || (process.env.FFMPEG_PATH || '');
}

let binaryReady = false;

export async function ensureYtDlp(onProgress?: (msg: string) => void): Promise<string> {
  const binaryPath = getBinaryPath();
  if (binaryReady && fs.existsSync(binaryPath)) return binaryPath;

  if (!fs.existsSync(binaryPath)) {
    throw new Error(`yt-dlp não encontrado. Coloque o binário em ${path.dirname(binaryPath)} ou defina YTDLP_PATH.`);
  }

  try {
    await execFileAsync(binaryPath, ['--version']);
    binaryReady = true;
    onProgress?.('[yt-dlp] Binário local encontrado e verificado.');
    return binaryPath;
  } catch (error) {
    throw new Error(`yt-dlp encontrado em ${binaryPath}, mas falhou na validação: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function getBinaryPath(): string {
  return process.env.YTDLP_PATH || getBundledBinaryPath();
}

export function getFfmpegPath(): string {
  return process.env.FFMPEG_PATH || getBundledFfmpegPath();
}

export function isBinaryReady(): boolean {
  return binaryReady && fs.existsSync(getBinaryPath());
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
  outputDir: string;
  format?: string;
  audioOnly?: boolean;
  audioFormat?: string;
  audioQuality?: string;
  writeSubs?: boolean;
  writeAutoSubs?: boolean;
  subLangs?: string;
  subFormat?: string;
  embedSubs?: boolean;
  writeThumbnail?: boolean;
  embedThumbnail?: boolean;
  embedMetadata?: boolean;
  mergeOutputFormat?: string;
  restrictFilenames?: boolean;
  noOverwrites?: boolean;
  bandLimit?: number;
  concurrentFragments?: number;
  retries?: number;
  keepVideo?: boolean;
  videoOnly?: boolean;
  downloadSections?: string;
  sponsorblockRemove?: string;
  fpsMax?: number;
  onProgress: (data: { percent: number; speed: string; eta: string; filename?: string }) => void;
  onComplete: (filePath: string) => void;
  onError: (err: string) => void;
}): () => void {
  const ffmpegPath = getFfmpegPath();
  const cleanTitle = (params.url.match(/(?:v=|\/)([\w-]{11})/)?.[1]) || 'download';

  const args = [
    '--no-playlist',
    '--no-warnings',
    '--newline',
    '--progress',
    '--no-mtime',
  ];

  // Build final format string by applying transformations
  let finalFormat = params.format || DEFAULT_FORMAT;

  if (params.videoOnly) {
    finalFormat = finalFormat
      .replace(/\+ba\[ext=\w+\]/g, '')
      .replace(/\+ba/g, '')
      .replace(/\/ba/g, '')
      .replace(/\/b/g, '') || 'bv*';
  }

  if (params.fpsMax && params.fpsMax > 0) {
    finalFormat = finalFormat.replace(/\[ext=\w+\]/g, `[ext=mp4][fps<=${params.fpsMax}]`);
  }

  args.push('--format', finalFormat);

  if (params.audioOnly) {
    args.push('--extract-audio');
    if (params.audioFormat) args.push('--audio-format', params.audioFormat);
    if (params.audioQuality) args.push('--audio-quality', params.audioQuality);
  }

  if (params.mergeOutputFormat) args.push('--merge-output-format', params.mergeOutputFormat);

  if (params.writeSubs) args.push('--write-subs');
  if (params.writeAutoSubs) args.push('--write-auto-subs');
  if (params.subLangs) args.push('--sub-langs', params.subLangs);
  if (params.subFormat) args.push('--sub-format', params.subFormat);
  if (params.embedSubs) args.push('--embed-subs');

  if (params.writeThumbnail) args.push('--write-thumbnail');
  if (params.embedThumbnail) args.push('--embed-thumbnail');
  if (params.embedMetadata) args.push('--embed-metadata');

  if (params.restrictFilenames) args.push('--restrict-filenames');
  if (params.noOverwrites) args.push('--no-overwrites');
  if (params.keepVideo) args.push('--keep-video');

  if (params.downloadSections) {
    args.push('--download-sections', params.downloadSections);
  }

  if (params.sponsorblockRemove) {
    args.push('--sponsorblock-remove', params.sponsorblockRemove);
  }

  if (params.bandLimit && params.bandLimit > 0) {
    args.push('--limit-rate', `${params.bandLimit}K`);
  }

  if (params.concurrentFragments && params.concurrentFragments > 1) {
    args.push('--concurrent-fragments', String(params.concurrentFragments));
  }

  if (params.retries && params.retries > 0) {
    args.push('--retries', String(params.retries));
  }

  const outputTemplate = path.join(params.outputDir, '%(title)s.%(ext)s');
  args.push('-o', outputTemplate);

  if (ffmpegPath) args.push('--ffmpeg-location', ffmpegPath);

  args.push(params.url);

  let proc: ReturnType<typeof spawn> | null = null;
  let killed = false;

  (async () => {
    try {
      const binary = await ensureYtDlp(msg => console.log(msg));
      proc = spawn(binary, args);

      let lastFile = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+[\d.]+\S+\s+at\s+([\d.]+\S+)\/s\s+ETA\s+(\S+)/);
          if (progressMatch) {
            params.onProgress({
              percent: parseFloat(progressMatch[1]),
              speed: progressMatch[2],
              eta: progressMatch[3],
            });
          }
          const destMatch = line.match(/\[(?:download|Merger)\] Destination:\s*(.+)/) ||
                            line.match(/\[download\] (.+\.\S+) has already been downloaded/);
          if (destMatch) {
            lastFile = destMatch[1].trim();
            params.onProgress({ percent: 100, speed: '', eta: '', filename: lastFile });
          }
          const mergeMatch = line.match(/Merging formats into "(.+)"/);
          if (mergeMatch) {
            lastFile = mergeMatch[1].trim();
            params.onProgress({ percent: 100, speed: '', eta: '', filename: lastFile });
          }
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        if (text.includes('ERROR') || text.includes('error')) {
          console.warn('[yt-dlp stderr]', text.trim());
        }
      });

      proc.on('close', (code) => {
        if (killed) return;
        if (code === 0) {
          params.onComplete(lastFile);
        } else {
          params.onError(`yt-dlp exited with code ${code}`);
        }
      });

      proc.on('error', (err) => {
        if (!killed) params.onError(err.message);
      });
    } catch (err: any) {
      params.onError(err.message || String(err));
    }
  })();

  return () => {
    killed = true;
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

  // Build final format string by applying transformations
  let finalFormat = options.format || DEFAULT_FORMAT;

  if (options.videoOnly) {
    finalFormat = finalFormat
      .replace(/\+ba\[ext=\w+\]/g, '')
      .replace(/\+ba/g, '')
      .replace(/\/ba/g, '')
      .replace(/\/b/g, '') || 'bv*';
  }

  if (options.fpsMax && options.fpsMax > 0) {
    finalFormat = finalFormat.replace(/\[ext=\w+\]/g, `[ext=mp4][fps<=${options.fpsMax}]`);
  }

  args.push('--format', finalFormat);

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

  // Download sections (trim/cut)
  if (options.downloadSections) {
    args.push('--download-sections', options.downloadSections);
  }

  // SponsorBlock
  if (options.sponsorblockRemove) {
    args.push('--sponsorblock-remove', options.sponsorblockRemove);
  }

  // Auth options
  if (options.cookies) args.push('--cookies', options.cookies);
  if (options.cookiesFromBrowser) args.push('--cookies-from-browser', options.cookiesFromBrowser);
  if (options.proxy) args.push('--proxy', options.proxy);

  // FFmpeg location
  if (options.ffmpegLocation) args.push('--ffmpeg-location', options.ffmpegLocation);

  // Rate limiting
  if (options.bandLimit && options.bandLimit > 0) {
    args.push('--limit-rate', `${options.bandLimit}K`);
  }

  // URL last
  args.push(options.url);

  return args;
}
