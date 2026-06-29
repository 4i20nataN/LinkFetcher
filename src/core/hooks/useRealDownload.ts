/**
 * useRealDownload - React hook that triggers a real yt-dlp download
 * via Server-Sent Events and streams progress back to the UI.
 * 
 * The server does all the heavy lifting (yt-dlp + ffmpeg muxing)
 * using the USER's own hardware. Zero paid APIs.
 */

import { useCallback, useRef } from 'react';

export type DownloadProgressEvent = {
  type: 'setup' | 'started' | 'progress' | 'complete' | 'error';
  message?: string;
  percent?: number;
  speed?: string;
  eta?: string;
  downloadUrl?: string;
  filename?: string;
};

export type RealDownloadParams = {
  id: string;
  url: string;
  quality?: string;    // e.g. '1080', '720', '480', '360', '240'
  isAudio?: boolean;
  title?: string;
  onEvent: (event: DownloadProgressEvent) => void;
};

export function useRealDownload() {
  const eventSources = useRef<Map<string, EventSource>>(new Map());

  const startDownload = useCallback((params: RealDownloadParams) => {
    const { id, url, quality, isAudio, title, onEvent } = params;

    // Cancel any existing download with same id
    const existing = eventSources.current.get(id);
    if (existing) {
      existing.close();
      eventSources.current.delete(id);
    }

    const query = new URLSearchParams({
      id,
      url: encodeURIComponent(url),
      quality: quality || '1080',
      isAudio: String(isAudio || false),
      title: title || 'video'
    });

    const es = new EventSource(`/api/download/start?${query.toString()}`);
    eventSources.current.set(id, es);

    es.onmessage = (event) => {
      try {
        const data: DownloadProgressEvent = JSON.parse(event.data);
        onEvent(data);

        // Auto-trigger browser download when file is ready
        if (data.type === 'complete' && data.downloadUrl) {
          const a = document.createElement('a');
          a.href = data.downloadUrl;
          a.download = data.filename || 'download';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          es.close();
          eventSources.current.delete(id);
        }

        if (data.type === 'error') {
          es.close();
          eventSources.current.delete(id);
        }
      } catch (e) {
        console.error('[useRealDownload] Failed to parse SSE event:', e);
      }
    };

    es.onerror = () => {
      onEvent({ type: 'error', message: 'Conexão SSE perdida com o servidor' });
      es.close();
      eventSources.current.delete(id);
    };

    return () => {
      es.close();
      eventSources.current.delete(id);
    };
  }, []);

  const cancelDownload = useCallback(async (id: string) => {
    const es = eventSources.current.get(id);
    if (es) {
      es.close();
      eventSources.current.delete(id);
    }
    try {
      await fetch('/api/download/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch { /* ignore */ }
  }, []);

  return { startDownload, cancelDownload };
}
