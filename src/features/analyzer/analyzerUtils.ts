// Utilidades puras do analisador (formato de referência + opções neutras
// do download gratuito, datas, URLs).
import type { MediaFormat, MediaInfo } from '../../types';
import type { FormatOptions } from '../downloads/FormatOptions';

export function formatUploadDate(d: string): string {
  return /^\d{8}$/.test(d) ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : d;
}

export const sanitizeUrl = (rawUrl: string): string => {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.delete('t');
    parsed.searchParams.delete('time_continue');
    parsed.searchParams.delete('start');
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

// Referência do gratuito (total inicial do card): áudio = 1ª faixa;
// vídeo = maior faixa. null = sem formatos (o handler mostra erro).
export function pickQuickRefFormat(mediaInfo: MediaInfo, kind: 'audio' | 'video'): MediaFormat | null {
  if (!mediaInfo || mediaInfo.formats.length === 0) return null;
  if (kind === 'audio') {
    return mediaInfo.formats.find(f => f.type === 'audio') ?? mediaInfo.formats[0];
  }
  return mediaInfo.formats.filter(f => f.type === 'video').sort((a, b) => b.sizeBytes - a.sizeBytes)[0]
    ?? mediaInfo.formats[0];
}

// Gratuito = base default 1080p60 + merge mp4 (vídeo) ou MP3 máxima (áudio).
// Resto neutro + 1 fragmento (8 paralelos multiplica 429 em IP limitado).
export function buildQuickOptions(base: FormatOptions, kind: 'audio' | 'video'): FormatOptions {
  return {
    ...base,
    format: kind === 'audio'
      ? 'bestaudio/best'
      : 'bv*[height<=1080]+ba/b[height<=1080]',
    audioOnly: kind === 'audio',
    audioFormat: kind === 'audio' ? 'mp3' : base.audioFormat,
    audioQuality: kind === 'audio' ? '0' : base.audioQuality,
    videoOnly: false,
    keepVideo: false,
    writeSubs: false,
    writeAutoSubs: false,
    subLangs: '',
    subFormat: '',
    embedSubs: false,
    writeThumbnail: false,
    embedThumbnail: false,
    embedMetadata: false,
    downloadSections: '',
    sponsorblockRemove: '',
    concurrentFragments: 1,
    bandLimit: 0,
    // Teto 1080p60 via fpsMax + merge mp4 copy.
    ...(kind === 'video' ? {
      fpsMax: 60,
      videoFormat: 'mp4',
      videoCodec: '',
      normalizeAudio: false,
      videoSharpen: 'none' as const,
    } : {}),
  };
}
