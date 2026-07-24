import type { ProbeOptions, SearchOptions, SearchResult } from '../../types';

function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electron?.invoke;
}

async function callElectron<T>(channel: string, payload?: unknown): Promise<T> {
  if (isElectron()) {
    return window.electron.invoke(channel, payload) as Promise<T>;
  }
  throw new Error('Electron bridge unavailable');
}

async function callCapacitor<T>(method: string, payload?: unknown): Promise<T> {
  if (isCapacitor()) {
    const { default: plugin } = await import('./CapacitorYtDlp');
    return (plugin as any)[method](payload) as Promise<T>;
  }
  throw new Error('Capacitor bridge unavailable');
}

export const YtDlpAdapter = {
  async probe(url: string, options?: any) {
    if (isElectron()) {
      return (window as any).electron.invoke('yt-dlp-probe', { url, ...options });
    }
    if (isCapacitor()) {
      const { default: plugin } = await import('./CapacitorYtDlp');
      return plugin.probe({ url });
    }
    // Fallback to HTTP API
    const res = await fetch('/api/probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, ...options }) });
    if (!res.ok) throw new Error('Probe failed');
    return res.json();
  },

  async search(query: string, platform = 'youtube', maxResults = 10, options?: any) {
    if (isElectron()) {
      return (window as any).electron.invoke('yt-dlp-search', { query, platform, maxResults, ...options });
    }
    if (isCapacitor()) {
      const { default: plugin } = await import('./CapacitorYtDlp');
      const res: any = await plugin.search({ query, platform, maxResults });
      return Array.isArray(res) ? res : (res?.results ?? []);
    }
    const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, platform, maxResults, ...options }) });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async download(params: any) {
    if (isElectron()) {
      return (window as any).electron.invoke('yt-dlp-download', params);
    }
    if (isCapacitor()) {
      const { default: plugin } = await import('./CapacitorYtDlp');
      return plugin.download(params);
    }
    // Fallback: open SSE stream via /api/download/start
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        qs.set(key, String(value));
      }
    });
    return fetch(`/api/download/start?${qs.toString()}`);
  },

  async cancel(id: string) {
    if (isElectron()) {
      return (window as any).electron.invoke('yt-dlp-cancel', id);
    }
    if (isCapacitor()) {
      const { default: plugin } = await import('./CapacitorYtDlp');
      return plugin.cancel({ id });
    }
    return fetch('/api/download/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  }
};

export async function probeUrlWithAdapter(options: ProbeOptions): Promise<any> {
  // Capacitor (Android): go directly to native bridge — never fall through to /api/*
  // which does not exist in the standalone APK build.
  if (isCapacitor()) {
    return callCapacitor<any>('probe', options);
  }
  // Electron: use IPC bridge
  if (isElectron()) {
    return callElectron<any>('yt-dlp-probe', options);
  }
  // Web server fallback
  if (typeof window !== 'undefined' && window.fetch) {
    const response = await fetch('/api/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Probe failed');
    }
    return response.json();
  }
  throw new Error('No transport available');
}

export async function probePlaylistWithAdapter(options: { url: string; cookies?: string; cookiesFromBrowser?: string; proxy?: string }): Promise<any> {
  if (isCapacitor()) {
    return callCapacitor<any>('probe-playlist', options);
  }
  if (isElectron()) {
    return callElectron<any>('yt-dlp-probe-playlist', options);
  }
  if (typeof window !== 'undefined' && window.fetch) {
    const response = await fetch('/api/probe-playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Playlist probe failed');
    }
    return response.json();
  }
  throw new Error('No transport available');
}

export async function searchVideosWithAdapter(options: SearchOptions): Promise<SearchResult[]> {
  // Capacitor (Android): go directly to native bridge
  if (isCapacitor()) {
    const res = await callCapacitor<any>('search', options);
    return Array.isArray(res) ? res : (res?.results ?? []);
  }
  // Electron: use IPC bridge
  if (isElectron()) {
    return callElectron<SearchResult[]>('yt-dlp-search', options);
  }
  // Web server fallback
  if (typeof window !== 'undefined' && window.fetch) {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Search failed');
    }
    return response.json();
  }
  throw new Error('No transport available');
}

export async function getYtDlpStatusWithAdapter(): Promise<{ ready: boolean; binaryPath?: string }> {
  // Capacitor (Android): go directly to native bridge
  if (isCapacitor()) {
    return callCapacitor<{ ready: boolean; binaryPath?: string }>('getStatus');
  }
  // Electron: use IPC bridge
  if (isElectron()) {
    return callElectron<{ ready: boolean; binaryPath?: string }>('yt-dlp-status');
  }
  return { ready: false };
}
