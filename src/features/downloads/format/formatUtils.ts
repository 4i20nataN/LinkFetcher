// Funções puras do seletor de formato (extraídas do FormatSelector).
// Sem React, sem estado — candidatas naturais a teste unitário.
import type { MediaInfo } from '../../../types';
import type { FormatOptions } from '../FormatOptions';

export function parseFormatHeight(quality: string): number {
  if (!quality) return 0;
  const xy = quality.match(/(\d+)\s*x\s*(\d+)/);
  if (xy) return parseInt(xy[2], 10);
  const m = quality.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 0;
}

export function getMaxVideoHeight(formats: MediaInfo['formats']): number {
  let maxH = 0;
  for (const f of formats) {
    if (f.type === 'video' || f.type === 'image') {
      const h = parseFormatHeight(f.quality);
      if (h > maxH) maxH = h;
    }
  }
  return maxH;
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function parseTimeInput(text: string): number | null {
  const cleaned = text.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2 && parts[0] >= 0 && parts[1] >= 0 && parts[1] < 60) return parts[0] * 60 + parts[1];
  return null;
}

export function fmtDate(d: string, forFilename = false): string {
  if (/^\d{8}$/.test(d)) {
    const sep = forFilename ? '-' : '/';
    return `${d.slice(6,8)}${sep}${d.slice(4,6)}${sep}${d.slice(0,4)}`;
  }
  return forFilename ? d.replace(/\//g, '-') : d;
}

export function fmtDuration(dur: string): string {
  const parts = dur.split(':');
  if (parts.length === 3) return `${parts[0]}h${parts[1]}m${parts[2]}s`;
  if (parts.length === 2) return `${parts[0]}m${parts[1]}s`;
  return dur;
}

// Incorporar thumbnail: yt-dlp só aceita mp3, mkv/mka, ogg/opus/flac, m4a/mp4/m4v/mov
export function canEmbedThumbnail(o: FormatOptions): boolean {
  if (o.audioOnly) {
    return o.audioFormat === 'mp3' || o.audioFormat === 'flac' || o.audioFormat === 'opus' || o.audioFormat === 'm4a' || o.audioFormat === 'aac';
  }
  return !o.videoFormat || o.videoFormat === 'mp4' || o.videoFormat === 'mkv';
}
