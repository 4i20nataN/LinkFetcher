import type { ProbeOptions, SearchOptions, SearchResult } from '../../types';

function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
}

function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electron?.invoke;
}

async function callDesktop<T>(channel: string, payload?: unknown): Promise<T> {
  if (isDesktop()) {
    return window.electron.invoke(channel, payload) as Promise<T>;
  }
  throw new Error('Desktop bridge unavailable');
}

async function callTauri<T>(command: string, payload?: unknown): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  // Tauri resolve o parâmetro pela chave: tudo vai aninhado em `options`.
  const args = payload === undefined ? undefined : { options: payload };
  return invoke<T>(command, args as Record<string, unknown>);
}

/** Tauri rejeita com string crua (sem Error): extrai a mensagem p/ a UI. */
export function adapterErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err) return err;
  if (err instanceof Error && err.message) return err.message;
  const m = (err as { message?: unknown })?.message;
  if (typeof m === 'string' && m) return m;
  return fallback;
}

function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

export { isAndroid };

// Cache do dump-json por URL com TTL curto (probe custa segundos no Android).
const PROBE_CACHE_TTL_MS = 10 * 60 * 1000;
// Teto de 10 entradas (~10MB).
const PROBE_CACHE_MAX = 10;
const probeCache = new Map<string, { at: number; data: any }>();

function probeCacheKey(options: ProbeOptions): string {
  return `${options.url}::${options.proxy ?? ''}`;
}

export async function probeUrlWithAdapter(options: ProbeOptions): Promise<any> {
  const key = probeCacheKey(options);
  const hit = probeCache.get(key);
  if (hit && Date.now() - hit.at < PROBE_CACHE_TTL_MS) {
    return hit.data;
  }
  probeCache.delete(key);
  let data: any;
  if (isTauri()) {
    data = await callTauri<any>('ytdlp_probe', options);
  } else if (isDesktop()) {
    data = await callDesktop<any>('yt-dlp-probe', options);
  } else {
    throw new Error('No transport available (requires app)');
  }
  probeCache.set(key, { at: Date.now(), data });
  if (probeCache.size > PROBE_CACHE_MAX) {
    const oldest = probeCache.keys().next().value;
    if (oldest !== undefined) probeCache.delete(oldest);
  }
  return data;
}

export async function probePlaylistWithAdapter(options: { url: string; proxy?: string }): Promise<any> {
  if (isTauri()) {
    return callTauri<any>('ytdlp_probe_playlist', options);
  }
  if (isDesktop()) {
    return callDesktop<any>('yt-dlp-probe-playlist', options);
  }
  throw new Error('No transport available (requires app)');
}

export async function searchVideosWithAdapter(options: SearchOptions): Promise<SearchResult[]> {
  if (isTauri()) {
    return callTauri<SearchResult[]>('ytdlp_search', options);
  }
  if (isDesktop()) {
    return callDesktop<SearchResult[]>('yt-dlp-search', options);
  }
  throw new Error('No transport available (requires app)');
}

export async function getYtDlpStatusWithAdapter(): Promise<{ ready: boolean; binaryPath?: string; version?: string; missing?: string[] }> {
  if (isTauri()) {
    return callTauri<{ ready: boolean; binaryPath?: string; version?: string; missing?: string[] }>('ytdlp_status');
  }
  if (isDesktop()) {
    return callDesktop<{ ready: boolean; binaryPath?: string }>('yt-dlp-status');
  }
  return { ready: false };
}
