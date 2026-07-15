export const YtDlpAdapter = {
  async probe(url: string, options?: any) {
    if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
      return (window as any).electron.invoke('yt-dlp-probe', { url, ...options });
    }
    // Fallback to HTTP API
    const res = await fetch('/api/probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, ...options }) });
    if (!res.ok) throw new Error('Probe failed');
    return res.json();
  },

  async search(query: string, platform = 'youtube', maxResults = 10, options?: any) {
    if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
      return (window as any).electron.invoke('yt-dlp-search', { query, platform, maxResults, ...options });
    }
    const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, platform, maxResults, ...options }) });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async download(params: any) {
    if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
      return (window as any).electron.invoke('yt-dlp-download', params);
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
    if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
      return (window as any).electron.invoke('yt-dlp-cancel', id);
    }
    return fetch('/api/download/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  }
};

import type { ProbeOptions, SearchOptions, SearchResult } from '../../types';

async function callElectron<T>(channel: string, payload?: unknown): Promise<T> {
  if (typeof window !== 'undefined' && window.electron?.invoke) {
    return window.electron.invoke(channel, payload) as Promise<T>;
  }
  throw new Error('Electron bridge unavailable');
}

export async function probeUrlWithAdapter(options: ProbeOptions): Promise<any> {
  try {
    return await callElectron<any>('yt-dlp-probe', options);
  } catch (error) {
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
    throw error;
  }
}

export async function searchVideosWithAdapter(options: SearchOptions): Promise<SearchResult[]> {
  try {
    return await callElectron<SearchResult[]>('yt-dlp-search', options);
  } catch (error) {
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
    throw error;
  }
}

export async function getYtDlpStatusWithAdapter(): Promise<{ ready: boolean; binaryPath?: string }> {
  try {
    return await callElectron<{ ready: boolean; binaryPath?: string }>('yt-dlp-status');
  } catch {
    return { ready: false };
  }
}
