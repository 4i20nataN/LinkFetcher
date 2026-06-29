import { DownloadItem, MediaInfo, MediaFormat, AppSettings } from '../../types';

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
  private intervalId: ReturnType<typeof setInterval> | null = null;

  // Map download id → SSE EventSource (for real downloads)
  private eventSources = new Map<string, EventSource>();
  // Map download id → cancel function
  private cancelFns = new Map<string, () => void>();

  private settings: AppSettings = {
    themeMode: 'dark',
    accentColor: 'emerald',
    language: 'pt',
    defaultDir: 'Downloads',
    bandLimit: 0,
    maxConcurrent: 3,
    wifiOnly: false,
    autoDownload: true,
    notifications: true,
    updates: false,
  };

  constructor() {
    this.loadState();
    this.startSimulationLoop(); // Still used for generic/image downloads
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

  private saveState() {
    try {
      localStorage.setItem('universal_downloader_items', JSON.stringify(this.items));
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

  addDownload(media: MediaInfo, format: MediaFormat) {
    const exists = this.items.find(
      item => item.url === media.originalUrl &&
               item.format.id === format.id &&
               ['queued', 'downloading'].includes(item.status)
    );
    if (exists) return;

    // Ensure sizeTotal is never 0 (prevents instant-complete on simulation)
    const defaultSizeByType: Record<string, number> = {
      video: 25 * 1024 * 1024,  // 25 MB
      audio: 6 * 1024 * 1024,   // 6 MB
      image: 2 * 1024 * 1024,   // 2 MB
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
    if (cancelFn) { cancelFn(); this.cancelFns.delete(id); }

    // Tell the server to kill the yt-dlp process
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
    const quality = extractQualityHeight(item.format.quality);
    const isAudio = item.format.type === 'audio';

    const params = new URLSearchParams({
      id: item.id,
      url: encodeURIComponent(item.url),
      quality,
      isAudio: String(isAudio),
      title: item.title,
    });

    console.log(`[Engine] Starting yt-dlp download: ${item.title} @ ${quality}p | audio=${isAudio}`);

    const es = new EventSource(`/api/download/start?${params.toString()}`);
    this.eventSources.set(item.id, es);

    es.onmessage = (event) => {
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }

      const target = this.items.find(i => i.id === item.id);
      if (!target) { es.close(); return; }

      switch (data.type) {
        case 'setup':
        case 'started':
          console.log(`[yt-dlp] ${data.message}`);
          break;

        case 'progress': {
          const pct = Math.min(Math.round(data.percent || 0), 99);
          target.progress = pct;
          target.sizeDownloaded = Math.floor((pct / 100) * target.sizeTotal);

          // Parse speed from yt-dlp string (e.g. "3.2MiB" → bytes/s)
          target.speed = this.parseSpeedString(data.speed || '');

          // Parse ETA string (e.g. "00:45" → 45 seconds)
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

          // Auto-trigger browser download
          if (data.downloadUrl) {
            this.triggerFileSave(data.downloadUrl, data.filename || `${item.title}.${item.format.ext}`);
          }

          this.notifyCompletion(item);
          this.notify();
          this.processQueue();
          break;
        }

        case 'error': {
          console.error(`[yt-dlp] Download error for ${item.title}:`, data.message);
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

    // Proxy through server to handle CORS and force download header
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
  private async convertAndDownloadImageBlob(blob: Blob, targetExt: string, filename: string) {
    try {
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
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

      await new Promise<void>((resolve, reject) => {
        canvas.toBlob((convertedBlob) => {
          if (!convertedBlob) return reject(new Error('Conversion failed'));
          this.downloadBlob(convertedBlob, filename);
          resolve();
        }, mime, 0.92);
      });
    } catch {
      this.downloadBlob(blob, filename);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Simulation loop (only runs for items that don't use real SSE downloads)
  // Now only simulates UI smoothness for items that ARE actively in SSE mode
  // ─────────────────────────────────────────────────────────────────────────
  private startSimulationLoop() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      // Nothing to simulate — real downloads are driven by SSE events.
      // We just save state periodically.
      this.saveState();
    }, 5000);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers: parse yt-dlp speed/eta strings
  // ─────────────────────────────────────────────────────────────────────────
  private parseSpeedString(s: string): number {
    if (!s) return 0;
    // e.g. "3.20MiB" or "512.00KiB"
    const m = s.match(/([\d.]+)\s*(GiB|MiB|KiB|B)/i);
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
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.eventSources.forEach(es => es.close());
    this.eventSources.clear();
    this.cancelFns.forEach(fn => fn());
    this.cancelFns.clear();
  }
}

export const DownloadEngine = new DownloadEngineClass();
export default DownloadEngine;
