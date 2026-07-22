import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface EnsureBinariesResult {
  ready: boolean;
  ytdlpPath: string;
  ffmpegPath: string;
}

export interface ProbeResult {
  id?: string;
  title?: string;
  author?: string;
  channel?: string;
  duration?: number;
  duration_string?: string;
  resolution?: string;
  formats?: any[];
  thumbnail?: string;
  description?: string;
  webpage_url?: string;
  [key: string]: any;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: number;
  duration_string: string;
  view_count: number;
  uploader: string;
  description: string;
}

export interface DownloadParams {
  url: string;
  id?: string;
  outputPath?: string;
  outputDir?: string;
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
  concurrentFragments?: number;
  retries?: number;
  bandLimit?: number;
  noOverwrites?: boolean;
  keepVideo?: boolean;
  videoOnly?: boolean;
  downloadSections?: string;
  sponsorblockRemove?: string;
  fpsMax?: number;
  customFilename?: string;
  videoFormat?: string;
  videoCodec?: string;
  customFormat?: string;
}

export interface DownloadResult {
  success: boolean;
  exitCode: number;
}

/** Evento nativo emitido via notifyListeners — mesmo formato do payload IPC do Electron. */
export interface YtDlpProgressEvent {
  id: string;
  type: 'progress' | 'complete' | 'error';
  percent?: number;
  speed?: string;
  eta?: string;
  filePath?: string;
  message?: string;
}

export interface CheckUpdateResult {
  version: string;
  apkUrl: string;
  checksumsUrl?: string;
  available: boolean;
}

export interface DownloadUpdateResult {
  ok: boolean;
  apkPath: string;
  verified?: boolean;
}

export interface UpdateProgressEvent {
  stage: 'downloading';
  received: number;
  total: number;
  percent?: number;
}

export interface YtDlpPlugin {
  ensureBinaries(): Promise<EnsureBinariesResult>;
  probe(options: { url: string }): Promise<ProbeResult>;
  search(options: { query: string; platform?: string; maxResults?: number }): Promise<SearchResult[]>;
  download(params: DownloadParams): Promise<DownloadResult>;
  cancel(options: { id: string }): Promise<void>;
  openFile(options: { filePath: string }): Promise<{ success: boolean }>;
  getStatus(): Promise<{ ready: boolean; platform: string }>;
  /** Auto-update: checa a última release no GitHub (mesmo repo pinado do Electron). */
  checkUpdate(): Promise<CheckUpdateResult>;
  /** Auto-update: baixa o APK da release para o cache do app e verifica SHA-256 (se checksumsUrl for fornecido). */
  downloadUpdate(options: { apkUrl: string; checksumsUrl?: string }): Promise<DownloadUpdateResult>;
  /** Auto-update: dispara a Intent nativa de instalação do APK baixado. */
  installUpdate(options: { apkPath: string }): Promise<{ success: boolean }>;
  addListener(
    eventName: 'yt-dlp-progress',
    listener: (event: YtDlpProgressEvent) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(
    eventName: 'update-progress',
    listener: (event: UpdateProgressEvent) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
  addListener(
    eventName: 'update:available',
    listener: (event: { version: string; apkUrl: string; checksumsUrl: string }) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

const _rawPlugin = registerPlugin<YtDlpPlugin>('YtDlp');

/**
 * Wrap the Proxy returned by registerPlugin to prevent JavaScript's
 * Promise resolution mechanism from treating it as a "thenable".
 *
 * Without this wrapper, `await plugin` (or any implicit thenable check)
 * triggers the Proxy's .then trap → Capacitor calls the native bridge →
 * throws "YtDlp.then() is not implemented on android".
 *
 * By returning `undefined` for `.then`, JS treats the object as a plain
 * non-thenable and resolves `await` normally.
 */
const CapacitorYtDlp = new Proxy(_rawPlugin as unknown as object, {
  get(target: object, prop: string | symbol) {
    if (prop === 'then') return undefined;
    return Reflect.get(target, prop);
  },
}) as YtDlpPlugin;

export default CapacitorYtDlp;
