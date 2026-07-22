import { DownloadItem, MediaInfo, MediaFormat, AppSettings } from '../../types';
import type { FormatOptions } from '../../features/downloads/FormatSelector';
import { Filesystem, Directory } from '@capacitor/filesystem';

type EngineListener = (items: DownloadItem[]) => void;

// Quality label → height string for yt-dlp
function extractQualityHeight(qualityLabel: string): string {
  if (qualityLabel.includes('2160') || qualityLabel.includes('4K')) return '2160';
  if (qualityLabel.includes('1440')) return '1440';
  if (qualityLabel.includes('1080')) return '1080';
  if (qualityLabel.includes('720')) return '720';
  if (qualityLabel.includes('480')) return '480';
  if (qualityLabel.includes('360')) return '360';
  if (qualityLabel.includes('240')) return '240';
  return '1080'; // safe default
}

// Platforms that support real yt-dlp extraction
const YT_DLP_PLATFORMS = new Set([
  'youtube', 'tiktok', 'instagram', 'facebook', 'x', 'reddit', 'soundcloud', 'twitch', 'vimeo'
]);

class DownloadEngineClass {
  private items: DownloadItem[] = [];
  private listeners: Set<EngineListener> = new Set();

  // Map download id → SSE EventSource (for real downloads)
  private eventSources = new Map<string, EventSource>();
  // Map download id → cancel function
  private cancelFns = new Map<string, () => void>();

  private settings: AppSettings = {
    themeMode: 'dark',
    accentColor: 'emerald',
    iconStyle: 'lucide-mono',
    language: 'pt',
    defaultDir: '',
    bandLimit: 0,
    maxConcurrent: 3,
    wifiOnly: false,
    autoDownload: true,
    notifications: true,
    updates: false,
    colorfulIcons: false,
  };

  constructor() {
    this.loadState();
    this.registerAppStateSaveGuard();
  }

  private registerAppStateSaveGuard() {
    const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
    if (!isCapacitor) return;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) this.saveState();
      });
    }).catch((err) => console.warn('Failed to register appStateChange guard:', err));
  }

  setSettings(newSettings: AppSettings) {
    this.settings = newSettings;
    this.processQueue();
  }

  private loadState() {
    try {
      const stored = localStorage.getItem('universal_downloader_items');
      if (stored) {
        const parsed: DownloadItem[] = JSON.parse(stored);
        this.items = parsed.map(item => {
          // Reset in-progress downloads to queued on reload
          if (item.status === 'downloading') {
            return { ...item, status: 'paused', speed: 0, eta: 0 };
          }
          return item;
        });
      }
    } catch (e) {
      console.error('Error loading engine state', e);
      this.items = [];
    }
  }

  // Android WebView localStorage is capped at ~5MB — keep only the most recent
  // finished entries so a long history doesn't blow the quota. Active items
  // (queued/downloading/paused) are never trimmed.
  private static readonly MAX_PERSISTED_FINISHED = 300;

  private saveState() {
    try {
      const active = this.items.filter(i => ['queued', 'downloading', 'paused'].includes(i.status));
      const finished = this.items.filter(i => !['queued', 'downloading', 'paused'].includes(i.status));
      const trimmedFinished = finished.slice(0, DownloadEngineClass.MAX_PERSISTED_FINISHED);
      const toPersist = [...active, ...trimmedFinished];
      localStorage.setItem('universal_downloader_items', JSON.stringify(toPersist));
    } catch (e) {
      console.error('Error saving engine state', e);
    }
  }

  getItems(): DownloadItem[] {
    return [...this.items];
  }

  addListener(listener: EngineListener) {
    this.listeners.add(listener);
    listener(this.getItems());
  }

  removeListener(listener: EngineListener) {
    this.listeners.delete(listener);
  }

  private notify() {
    const current = this.getItems();
    this.listeners.forEach(l => l(current));
    this.saveState();
  }

  addDownload(media: MediaInfo, format: MediaFormat, formatOptions?: FormatOptions | null) {
    const exists = this.items.find(
      item => item.url === media.originalUrl &&
               item.format.id === format.id &&
               ['queued', 'downloading'].includes(item.status)
    );
    if (exists) return;

    const defaultSizeByType: Record<string, number> = {
      video: 25 * 1024 * 1024,
      audio: 6 * 1024 * 1024,
      image: 2 * 1024 * 1024,
    };
    const sizeTotal = format.sizeBytes > 0
      ? format.sizeBytes
      : (defaultSizeByType[format.type] || 15 * 1024 * 1024);

    const newItem: DownloadItem = {
      id: `dl_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      title: media.title,
      thumbnailUrl: media.thumbnailUrl,
      platform: media.platform,
      format,
      formatString: formatOptions?.format,
      audioOnly: formatOptions?.audioOnly,
      audioFormat: formatOptions?.audioFormat,
      audioQuality: formatOptions?.audioQuality,
      writeSubs: formatOptions?.writeSubs,
      writeAutoSubs: formatOptions?.writeAutoSubs,
      subLangs: formatOptions?.subLangs,
      subFormat: formatOptions?.subFormat,
      embedSubs: formatOptions?.embedSubs,
      writeThumbnail: formatOptions?.writeThumbnail,
      embedThumbnail: formatOptions?.embedThumbnail,
      embedMetadata: formatOptions?.embedMetadata,
      mergeOutputFormat: formatOptions?.videoFormat || undefined,
      concurrentFragments: formatOptions?.concurrentFragments,
      retries: formatOptions?.retries,
      restrictFilenames: formatOptions?.restrictFilenames,
      noOverwrites: formatOptions?.noOverwrites,
      keepVideo: formatOptions?.keepVideo,
      videoOnly: formatOptions?.videoOnly,
      downloadSections: formatOptions?.downloadSections,
      sponsorblockRemove: formatOptions?.sponsorblockRemove,
      fpsMax: formatOptions?.fpsMax,
      bandLimit: formatOptions?.bandLimit,
      customFilename: formatOptions?.customFilename,
      sizeTotal,
      sizeDownloaded: 0,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'queued',
      addedAt: new Date().toISOString(),
      url: media.originalUrl,
    };

    this.items.unshift(newItem);
    this.notify();
    this.processQueue();
  }

  pauseDownload(id: string) {
    const item = this.items.find(i => i.id === id);
    if (!item || item.status !== 'downloading') return;

    // Cancel real SSE download if active
    this.cancelRealDownload(id);

    item.status = 'paused';
    item.speed = 0;
    item.eta = 0;
    this.notify();
    this.processQueue();
  }

  resumeDownload(id: string) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    if (!['paused', 'failed', 'cancelled'].includes(item.status)) return;

    item.status = 'queued';
    if (item.progress >= 100) {
      item.progress = 0;
      item.sizeDownloaded = 0;
    }
    this.notify();
    this.processQueue();
  }

  cancelDownload(id: string) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    if (!['queued', 'downloading', 'paused'].includes(item.status)) return;

    this.cancelRealDownload(id);

    item.status = 'cancelled';
    item.speed = 0;
    item.eta = 0;
    this.notify();
    this.processQueue();
  }

  retryDownload(id: string) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    item.status = 'queued';
    item.progress = 0;
    item.sizeDownloaded = 0;
    item.speed = 0;
    item.eta = 0;
    this.notify();
    this.processQueue();
  }

  removeDownload(id: string) {
    this.cancelRealDownload(id);
    this.items = this.items.filter(i => i.id !== id);
    this.notify();
    this.processQueue();
  }

  clearHistory() {
    const active = new Set(['queued', 'downloading', 'paused']);
    const toRemove = this.items.filter(i => !active.has(i.status));
    toRemove.forEach(i => this.cancelRealDownload(i.id));
    this.items = this.items.filter(i => active.has(i.status));
    this.notify();
  }

  reorderQueue(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= this.items.length) return;
    if (toIndex < 0 || toIndex >= this.items.length) return;
    const moved = this.items.splice(fromIndex, 1)[0];
    this.items.splice(toIndex, 0, moved);
    this.notify();
    this.processQueue();
  }

  private cancelRealDownload(id: string) {
    const es = this.eventSources.get(id);
    if (es) { es.close(); this.eventSources.delete(id); }
    const cancelFn = this.cancelFns.get(id);
    if (cancelFn) { cancelFn(); this.cancelFns.delete(id); return; }

    // Fallback for server-mode downloads (Electron/Web only — Capacitor always
    // registers a cancelFn above, so this path never fires on Android)
    const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
    if (isCapacitor) return;
    fetch('/api/download/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  private processQueue() {
    const downloadingCount = this.items.filter(i => i.status === 'downloading').length;
    const max = this.settings.maxConcurrent || 3;

    if (downloadingCount < max) {
      const next = this.items.find(i => i.status === 'queued');
      if (next) {
        next.status = 'downloading';
        this.notify();
        this.startRealDownload(next);
        this.processQueue(); // Fill remaining slots
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Real Download via yt-dlp SSE
  // ─────────────────────────────────────────────────────────────────────────
  private startRealDownload(item: DownloadItem) {
    const isYtDlpPlatform = YT_DLP_PLATFORMS.has(item.platform);
    const isDirectFile = item.platform === 'generic' ||
      /\.(mp4|webm|mkv|mp3|m4a|wav|ogg|jpg|jpeg|png|gif|webp)([?#]|$)/i.test(item.url);

    if (isYtDlpPlatform && !isDirectFile) {
      this.startYtDlpDownload(item);
    } else {
      // For generic/direct URLs: use server proxy (images, direct media links)
      this.startProxyDownload(item);
    }
  }

  private startYtDlpDownload(item: DownloadItem) {
    const isAudio = item.audioOnly ?? (item.format.type === 'audio');

    console.log(`[Engine] Starting download: ${item.title} | audio=${isAudio} | format=${item.formatString || 'default'}`);

    const hasElectronBridge = typeof window !== 'undefined' && !!(window as any).electron?.invoke;
    const hasCapacitorBridge = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

    if (hasElectronBridge) {
      const onProgress = (payload: any) => {
        if (!payload || payload.id !== item.id) return;
        const target = this.items.find(i => i.id === item.id);
        if (!target) return;

        if (payload.type === 'progress') {
          const pct = Math.min(Math.round(payload.percent || 0), 99);
          target.progress = pct;
          target.sizeDownloaded = Math.floor((pct / 100) * target.sizeTotal);
          target.speed = this.parseSpeedString(payload.speed || '');
          target.eta = this.parseEtaString(payload.eta || '');
          this.notify();
        }

        if (payload.type === 'complete') {
          target.progress = 100;
          target.sizeDownloaded = target.sizeTotal;
          target.status = 'completed';
          target.speed = 0;
          target.eta = 0;
          target.finishedAt = new Date().toISOString();
          if (payload.filePath) {
            target.filePath = payload.filePath;
            this.openFileLocation(payload.filePath);
          }
          cleanup();
          this.notifyCompletion(item);
          this.notify();
          this.processQueue();
        }

        if (payload.type === 'error') {
          target.status = 'failed';
          target.error = payload.message || 'Download falhou';
          target.speed = 0;
          target.eta = 0;
          cleanup();
          this.notify();
          this.processQueue();
        }
      };

      const unsubscribe = (window as any).electron.on('yt-dlp-progress', onProgress);
      const cleanup = () => {
        unsubscribe();
        this.eventSources.delete(item.id);
        this.cancelFns.delete(item.id);
      };
      this.eventSources.set(item.id, { close: cleanup } as unknown as EventSource);

      (window as any).electron.invoke('yt-dlp-download', {
        id: item.id,
        url: item.url,
        title: item.title,
        // Same fix as Capacitor: item.format.id is a raw DASH format ID (e.g. "137")
        // that selects video-only; always fall back to a complete format selector.
        format: item.formatString || 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b',
        outputDir: this.settings.defaultDir || undefined,
        audioOnly: isAudio,
        audioFormat: item.audioFormat || (isAudio ? 'mp3' : undefined),
        audioQuality: item.audioQuality,
        writeSubs: item.writeSubs,
        writeAutoSubs: item.writeAutoSubs,
        subLangs: item.subLangs,
        subFormat: item.subFormat,
        embedSubs: item.embedSubs,
        writeThumbnail: item.writeThumbnail,
        embedThumbnail: item.embedThumbnail,
        embedMetadata: item.embedMetadata,
        mergeOutputFormat: item.mergeOutputFormat,
        restrictFilenames: item.restrictFilenames,
        concurrentFragments: item.concurrentFragments,
        retries: item.retries,
        bandLimit: item.bandLimit || 0,
        noOverwrites: item.noOverwrites,
        keepVideo: item.keepVideo,
        videoOnly: item.videoOnly,
        downloadSections: item.downloadSections,
        sponsorblockRemove: item.sponsorblockRemove,
        fpsMax: item.fpsMax,
        customFilename: item.customFilename,
      }).catch((err: any) => {
        const target = this.items.find(i => i.id === item.id);
        if (target) {
          target.status = 'failed';
          target.error = err?.message || String(err);
          this.notify();
          this.processQueue();
        }
      });

      const cancelFn = () => {
        try { (window as any).electron.invoke('yt-dlp-cancel', item.id); } catch {};
      };
      this.cancelFns.set(item.id, cancelFn);
      return;
    }

    if (hasCapacitorBridge) {
      // Bridge nativo: eventos estruturados via notifyListeners (mesmo formato do IPC do Electron).
      // Obs: a lib nativa (youtubedl-android) só expõe percent/eta no callback de progresso, não speed.
      let listenerHandle: { remove: () => void } | null = null;

      const onCapacitorProgress = (payload: any) => {
        if (!payload || payload.id !== item.id) return;
        const target = this.items.find(i => i.id === item.id);
        if (!target) return;

        if (payload.type === 'progress') {
          const pct = Math.min(Math.round(payload.percent || 0), 99);
          target.progress = pct;
          target.sizeDownloaded = Math.floor((pct / 100) * target.sizeTotal);
          target.speed = this.parseSpeedString(payload.speed || '');
          target.eta = this.parseEtaString(payload.eta || '');
          this.notify();
        }

        if (payload.type === 'complete') {
          target.progress = 100;
          target.sizeDownloaded = target.sizeTotal;
          target.status = 'completed';
          target.speed = 0;
          target.eta = 0;
          target.finishedAt = new Date().toISOString();
          if (payload.filePath) {
            target.filePath = payload.filePath;
            this.openFileLocation(payload.filePath);
          }
          cleanup();
          this.notifyCompletion(item);
          this.notify();
          this.processQueue();
        }

        if (payload.type === 'error') {
          target.status = 'failed';
          target.error = payload.message || 'Download falhou';
          target.speed = 0;
          target.eta = 0;
          cleanup();
          this.notify();
          this.processQueue();
        }
      };

      const cleanup = () => {
        listenerHandle?.remove();
        this.eventSources.delete(item.id);
        this.cancelFns.delete(item.id);
      };
      this.eventSources.set(item.id, { close: cleanup } as unknown as EventSource);

      import('../ytdlp/CapacitorYtDlp').then(async ({ default: plugin }) => {
        // Await so the native listener handle is fully resolved before download
        // starts — guarantees cleanup().remove() works and prevents listener leaks.
        listenerHandle = await plugin.addListener('yt-dlp-progress', onCapacitorProgress) as any;
        await plugin.download({
          id: item.id,
          url: item.url,
          // item.format.id is a raw yt-dlp format ID (e.g. "137") from the probe,
          // which selects a video-only DASH stream and produces silent downloads.
          // Always fall back to a complete format selector when formatString is absent.
          // NOTE: youtubedl-android's bundled yt-dlp may not support `bv*`/`ba*` (the `*`
          // modifier for multi-format merging was added in yt-dlp 2023.01+). Convert to the
          // older `bestvideo`/`bestaudio` equivalents which work on all yt-dlp versions.
          format: item.formatString || 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b',
          outputDir: this.settings.defaultDir || undefined,
          audioOnly: isAudio,
          audioFormat: item.audioFormat || (isAudio ? 'mp3' : undefined),
          audioQuality: item.audioQuality || undefined,
          writeSubs: item.writeSubs,
          writeAutoSubs: item.writeAutoSubs,
          subLangs: item.subLangs || undefined,
          subFormat: item.subFormat || undefined,
          embedSubs: item.embedSubs,
          writeThumbnail: item.writeThumbnail,
          embedThumbnail: item.embedThumbnail,
          embedMetadata: item.embedMetadata,
          mergeOutputFormat: item.mergeOutputFormat || undefined,
          restrictFilenames: item.restrictFilenames,
          concurrentFragments: item.concurrentFragments,
          retries: item.retries,
          bandLimit: item.bandLimit || 0,
          noOverwrites: item.noOverwrites,
          keepVideo: item.keepVideo,
          videoOnly: item.videoOnly,
          // Confirmed root cause of "download completes with 0 bytes / no file":
          // Capacitor's bridge was turning a JS `undefined` here into an empty
          // string `""` on the Kotlin side. youtubedl-android's own
          // YoutubeDLOptions.buildOptions() drops the value token for an empty
          // string but still emits the bare flag — so `--download-sections`
          // would swallow the next flag (`--sponsorblock-remove`) as its own
          // value, producing an invalid (zero-range) section spec. yt-dlp then
          // "successfully" downloads nothing and exits 0. Guarded here (and on
          // the Kotlin side too, in case any other future caller sends '') so
          // the key is only ever sent when it has a real value.
          downloadSections: item.downloadSections || undefined,
          sponsorblockRemove: item.sponsorblockRemove || undefined,
          fpsMax: item.fpsMax,
          customFilename: item.customFilename,
          videoFormat: item.videoFormat || undefined,
          videoCodec: item.videoCodec || undefined,
          customFormat: item.customFormat || undefined,
        });
      }).catch((err: any) => {
        const target = this.items.find(i => i.id === item.id);
        if (target) {
          target.status = 'failed';
          target.error = err?.message || 'Capacitor download failed';
          this.notify();
          this.processQueue();
        }
      });

      const cancelFn = () => {
        import('../ytdlp/CapacitorYtDlp').then(({ default: plugin }) => plugin.cancel({ id: item.id })).catch(() => {});
      };
      this.cancelFns.set(item.id, cancelFn);
      return;
    }

    // Fallback: server mode via SSE
    const params = new URLSearchParams({
      id: item.id,
      url: encodeURIComponent(item.url),
      title: item.title,
      bandLimit: String(item.bandLimit || 0),
    });
    if (item.formatString) params.set('formatStr', item.formatString);
    if (isAudio) params.set('isAudio', '1');
    if (item.audioFormat) params.set('audioFormat', item.audioFormat);
    if (item.audioQuality) params.set('audioQuality', item.audioQuality);
    if (item.writeSubs) params.set('writeSubs', '1');
    if (item.writeAutoSubs) params.set('writeAutoSubs', '1');
    if (item.subLangs) params.set('subLangs', item.subLangs);
    if (item.subFormat) params.set('subFormat', item.subFormat);
    if (item.embedSubs) params.set('embedSubs', '1');
    if (item.writeThumbnail) params.set('writeThumbnail', '1');
    if (item.embedThumbnail) params.set('embedThumbnail', '1');
    if (item.embedMetadata) params.set('embedMetadata', '1');
    if (item.mergeOutputFormat) params.set('mergeOutputFormat', item.mergeOutputFormat);
    if (item.restrictFilenames) params.set('restrictFilenames', '1');
    if (item.noOverwrites) params.set('noOverwrites', '1');
    if (item.keepVideo) params.set('keepVideo', '1');
    if (item.videoOnly) params.set('videoOnly', '1');
    if (item.downloadSections) params.set('downloadSections', item.downloadSections);
    if (item.sponsorblockRemove) params.set('sponsorblockRemove', item.sponsorblockRemove);
    if (item.fpsMax) params.set('fpsMax', String(item.fpsMax));
    if (item.concurrentFragments) params.set('concurrentFragments', String(item.concurrentFragments));
    if (item.retries) params.set('retries', String(item.retries));
    if (item.customFilename) params.set('customFilename', item.customFilename);

    const es = new EventSource(`/api/download/start?${params.toString()}`);
    this.eventSources.set(item.id, es);

    es.onmessage = (event) => {
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }

      const target = this.items.find(i => i.id === item.id);
      if (!target) { es.close(); return; }

      switch (data.type) {
        case 'progress': {
          const pct = Math.min(Math.round(data.percent || 0), 99);
          target.progress = pct;
          target.sizeDownloaded = Math.floor((pct / 100) * target.sizeTotal);
          target.speed = this.parseSpeedString(data.speed || '');
          target.eta = this.parseEtaString(data.eta || '');
          this.notify();
          break;
        }
        case 'complete': {
          target.progress = 100;
          target.sizeDownloaded = target.sizeTotal;
          target.status = 'completed';
          target.speed = 0;
          target.eta = 0;
          target.finishedAt = new Date().toISOString();
          this.eventSources.delete(item.id);
          es.close();
          if (data.downloadUrl) this.triggerFileSave(data.downloadUrl, data.filename || `${item.title}.${item.format.ext}`);
          this.notifyCompletion(item);
          this.notify();
          this.processQueue();
          break;
        }
        case 'error': {
          target.status = 'failed';
          target.error = data.message || 'Download falhou';
          target.speed = 0;
          target.eta = 0;
          this.eventSources.delete(item.id);
          es.close();
          this.notify();
          this.processQueue();
          break;
        }
      }
    };

    es.onerror = () => {
      const target = this.items.find(i => i.id === item.id);
      if (target && target.status === 'downloading') {
        target.status = 'failed';
        target.error = 'Conexão com o servidor perdida';
        target.speed = 0;
        target.eta = 0;
        this.notify();
        this.processQueue();
      }
      this.eventSources.delete(item.id);
      es.close();
    };
  }

  private openFileLocation(filePath: string) {
    if (!filePath) return;
    const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
    const hasElectronBridge = typeof window !== 'undefined' && !!(window as any).electron?.invoke;
    if (isCapacitor) {
      import('../ytdlp/CapacitorYtDlp').then(({ default: plugin }) => {
        (plugin as any).openFile({ filePath }).catch((err: any) => console.warn('Failed to open file on Android:', err));
      }).catch((err) => console.warn('Failed to import CapacitorYtDlp:', err));
    } else if (hasElectronBridge) {
      (window as any).electron.invoke('shell:openPath', filePath).catch((err: any) => console.warn('Failed to open file location:', err));
    }
  }

  private async startProxyDownload(item: DownloadItem) {
    // For direct files / images: use the proxy-download endpoint
    const cleanTitle = item.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').substring(0, 80);
    const ext = item.format.ext;

    let sourceUrl = item.url;

    // Handle base64 data URIs (images from canvas etc.)
    if (sourceUrl.startsWith('data:')) {
      try {
        const response = await fetch(sourceUrl);
        const blob = await response.blob();
        if (item.format.type === 'image') {
          await this.convertAndDownloadImageBlob(blob, ext, `${cleanTitle}.${ext}`);
        } else {
          this.downloadBlob(blob, `${cleanTitle}.${ext}`);
        }
        this.markCompleted(item);
      } catch (e) {
        this.markFailed(item, 'Falha ao processar data URI');
      }
      return;
    }

    // For images: try Electron IPC proxy first (bypasses CORS, saves to default folder)
    // Only use proxy when formats match (no conversion needed) — otherwise skip to Canvas
    if (item.format.type === 'image') {
      const originalExt = sourceUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
      const needsConversion = ext.toLowerCase() !== originalExt && originalExt !== '';
      const hasElectronBridge = typeof window !== 'undefined' && !!(window as any).electron?.invoke;

      if (!needsConversion && hasElectronBridge) {
        // Same format — direct save via IPC (fast path, no conversion)
        try {
          const result = await (window as any).electron.invoke('download-file-proxy', {
            url: sourceUrl,
            filename: `${cleanTitle}.${ext}`,
            dir: this.settings.defaultDir || undefined,
          });
          if (result?.filePath) {
            this.markCompleted(item);
            return;
          }
        } catch (err: any) {
          console.warn('[Engine] Electron proxy download failed, falling back:', err);
        }
      }

      if (needsConversion && hasElectronBridge) {
        // Different format — fetch via Electron main (no CORS), convert Canvas, save via IPC
        try {
          const imgData = await (window as any).electron.invoke('fetch-image-base64', { url: sourceUrl });
          if (imgData?.base64) {
            await this.convertAndSaveImageBase64(imgData.base64, imgData.mime || 'image/webp', ext, `${cleanTitle}.${ext}`);
            this.markCompleted(item);
            return;
          }
        } catch (err: any) {
          console.warn('[Engine] Electron fetch+convert failed, falling back:', err);
        }
      }

      // Fallback: proxy fetch + Canvas + browser download
      try {
        let blob: Blob;
        const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
        if (isCapacitor) {
          // Gap #21: /api/proxy-download doesn't exist in the standalone Capacitor
          // build. Use CapacitorHttp (native networking) which bypasses CORS instead.
          const { CapacitorHttp } = await import('@capacitor/core');
          const response = await CapacitorHttp.request({ url: sourceUrl, method: 'GET', responseType: 'blob' });
          const byteChars = atob(response.data);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
          blob = new Blob([new Uint8Array(byteNumbers)]);
        } else {
          try {
            const proxyFetchUrl = `/api/proxy-download?url=${encodeURIComponent(sourceUrl)}&filename=tmp`;
            const resp = await fetch(proxyFetchUrl);
            if (!resp.ok) throw new Error(`Proxy HTTP ${resp.status}`);
            blob = await resp.blob();
          } catch {
            const resp = await fetch(sourceUrl);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            blob = await resp.blob();
          }
        }
        await this.convertAndDownloadImageBlob(blob, ext, `${cleanTitle}.${ext}`);
        this.markCompleted(item);
      } catch (e: any) {
        this.markFailed(item, 'Falha ao baixar imagem');
      }
      return;
    }

    // Proxy through server to handle CORS and force download header
    const isCapacitorGeneric = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
    if (isCapacitorGeneric) {
      // Gap #21: no Express server / /api/* routes in the standalone Capacitor build.
      // Fetch natively (CapacitorHttp bypasses CORS) and write straight to disk.
      try {
        const { CapacitorHttp } = await import('@capacitor/core');
        const response = await CapacitorHttp.request({ url: sourceUrl, method: 'GET', responseType: 'blob' });
        // Directory.External = app-scoped external dir, no permission needed on any API level.
        // Directory.ExternalStorage (root /sdcard) is blocked on API 29+ without legacy permission.
        await Filesystem.writeFile({
          path: `Download/${cleanTitle}.${ext}`,
          data: response.data,
          directory: Directory.External,
          recursive: true,
        });
        this.markCompleted(item);
      } catch (e: any) {
        this.markFailed(item, 'Falha ao baixar arquivo');
      }
      return;
    }

    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(sourceUrl)}&filename=${encodeURIComponent(`${cleanTitle}.${ext}`)}`;
    this.triggerFileSave(proxyUrl, `${cleanTitle}.${ext}`);
    this.markCompleted(item);
  }

  private triggerFileSave(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    this.triggerFileSave(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  private markCompleted(item: DownloadItem) {
    const target = this.items.find(i => i.id === item.id);
    if (!target) return;
    target.progress = 100;
    target.sizeDownloaded = target.sizeTotal;
    target.status = 'completed';
    target.speed = 0;
    target.eta = 0;
    target.finishedAt = new Date().toISOString();
    this.notifyCompletion(item);
    this.notify();
    this.processQueue();
  }

  private markFailed(item: DownloadItem, reason: string) {
    const target = this.items.find(i => i.id === item.id);
    if (!target) return;
    target.status = 'failed';
    target.error = reason;
    target.speed = 0;
    target.eta = 0;
    this.notify();
    this.processQueue();
  }

  private notifyCompletion(item: DownloadItem) {
    if (this.settings.notifications && 'Notification' in window) {
      const fire = () => new Notification('✅ Download Concluído!', {
        body: `${item.title} foi salvo com sucesso.`,
        icon: item.thumbnailUrl,
      });
      if (Notification.permission === 'granted') {
        fire();
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { if (p === 'granted') fire(); });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Image conversion (canvas-based, runs on user hardware)
  // ─────────────────────────────────────────────────────────────────────────
  private async convertAndSaveImageBase64(base64: string, mime: string, targetExt: string, filename: string) {
    const dataUrl = `data:${mime};base64,${base64}`;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    ctx.drawImage(img, 0, 0);

    const outMimeMap: Record<string, string> = {
      webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png'
    };
    const outMime = outMimeMap[targetExt] || 'image/png';

    const convertedDataUrl = canvas.toDataURL(outMime, 0.92);

    const result = await (window as any).electron.invoke('save-image-dataurl', {
      dataUrl: convertedDataUrl,
      filename,
      dir: this.settings.defaultDir || undefined,
    });
    if (!result?.filePath) throw new Error('Save failed');
  }

  private async convertAndDownloadImageBlob(blob: Blob, targetExt: string, filename: string) {
    try {
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2D context');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);

      const mimeMap: Record<string, string> = {
        webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png'
      };
      const mime = mimeMap[targetExt] || 'image/png';

      const convertedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), mime, 0.92);
      });
      if (!convertedBlob) throw new Error('Canvas conversion failed');

      // Try Electron IPC proxy to save directly to Downloads folder
      const hasElectronBridge = typeof window !== 'undefined' && !!(window as any).electron?.invoke;
      const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
      if (hasElectronBridge) {
        try {
          const arrayBuf = await convertedBlob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
          const dataUrl = `data:${mime};base64,${base64}`;
          const result = await (window as any).electron.invoke('download-file-proxy', {
            url: dataUrl,
            filename,
            dir: this.settings.defaultDir || undefined,
          });
          if (result?.filePath) return;
        } catch (err) {
          console.warn('[Engine] Electron IPC save failed, falling back to browser:', err);
        }
      } else if (isCapacitor) {
        try {
          const arrayBuf = await convertedBlob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
          // Directory.External: app-scoped, no permission needed
          await Filesystem.writeFile({
            path: `Download/${filename}`,
            data: base64,
            directory: Directory.External,
            recursive: true,
          });
          return;
        } catch (err) {
          console.warn('[Engine] Capacitor Filesystem save failed, falling back:', err);
        }
      }

      // Fallback: browser download
      this.downloadBlob(convertedBlob, filename);
    } catch (err) {
      console.warn('[Engine] Canvas conversion failed, downloading original:', err);
      this.downloadBlob(blob, filename);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers: parse yt-dlp speed/eta strings
  // ─────────────────────────────────────────────────────────────────────────
  private parseSpeedString(s: string): number {
    if (!s) return 0;
    // e.g. "3.20MiB/s" (from Android/Kotlin regex) or "3.20MiB" (Electron/SSE)
    const m = s.match(/([\d.]+)\s*(GiB|MiB|KiB|B)(?:\/s)?/i);
    if (!m) return 0;
    const val = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 'gib') return val * 1024 * 1024 * 1024;
    if (unit === 'mib') return val * 1024 * 1024;
    if (unit === 'kib') return val * 1024;
    return val;
  }

  private parseEtaString(s: string): number {
    if (!s || s === 'Unknown') return 0;
    // e.g. "00:45" or "01:23:45"
    const parts = s.split(':').map(Number);
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    return parseInt(s) || 0;
  }

  destroy() {
    this.eventSources.forEach(es => es.close());
    this.eventSources.clear();
    this.cancelFns.forEach(fn => fn());
    this.cancelFns.clear();
  }
}

export const DownloadEngine = new DownloadEngineClass();
export default DownloadEngine;
