// Utilidades puras do analisador (formato de referência + opções neutras
// do download gratuito, datas, URLs).
import type { MediaFormat, MediaInfo, PlaylistInfo, PlaylistItem } from '../../types';
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

/** Tira um item da lista em tela (lote baixa o que sobrar).
 *  Vazia → null (o card fecha). Pura p/ teste. */
export function removePlaylistItem(info: PlaylistInfo | null, id: string): PlaylistInfo | null {
  if (!info) return info;
  const items = info.items.filter(i => i.id !== id);
  if (items.length === 0) return null;
  return {
    ...info,
    items,
    itemCount: items.length,
    totalDuration: items.reduce((s, i) => s + (i.duration || 0), 0) || undefined,
    thumbnailUrl: items[0]?.thumbnailUrl || info.thumbnailUrl,
    channel: items[0]?.uploader ?? info.channel,
  };
}

/** Segundos → "MM:SS" ou "H:MM:SS". */
export function fmtDuration(sec?: number): { text: string; seconds: number } {
  if (!sec || sec <= 0 || !Number.isFinite(sec)) return { text: '', seconds: 0 };
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return {
    text: h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`,
    seconds: s,
  };
}

// MediaInfo a partir da entry flat: o lote é regido pelo FormatOptions
// global, então probe por item é redundância (N probes = espera + 429).
// O formato aqui é só referência p/ exibição.
export function playlistItemToMedia(
  playlist: PlaylistInfo,
  item: PlaylistItem,
  opts: { audioOnly: boolean; container: string },
): MediaInfo {
  const dur = fmtDuration(item.duration);
  const type = opts.audioOnly ? 'audio' as const : 'video' as const;
  return {
    id: `pl_${item.id}`,
    title: item.title,
    author: '',
    channel: playlist.title,
    duration: dur.text,
    durationSeconds: dur.seconds,
    sizeEst: '',
    formats: [{
      id: 'bulk',
      ext: opts.container,
      quality: opts.container.toUpperCase(),
      sizeEst: '',
      sizeBytes: 0,
      codec: '',
      type,
    }],
    codec: '',
    type,
    platform: playlist.platform,
    originalUrl: item.url,
    thumbnailUrl: item.thumbnailUrl,
    status: 'success' as const,
  };
}

// Opções do lote: config única p/ todos os vídeos.
// custom (PRO): como está no painel, sem nome fixo/corte/descrição.
// audio/video: preset gratuito igual ao download rápido unitário.
export function buildBulkOptions(base: FormatOptions, kind: 'custom' | 'audio' | 'video'): FormatOptions {
  if (kind === 'custom') {
    const opts: FormatOptions = {
      ...base,
      downloadSections: '',
      descFormat: 'none',
    };
    delete opts.customFilename;
    return opts;
  }
  return buildQuickOptions(base, kind);
}
