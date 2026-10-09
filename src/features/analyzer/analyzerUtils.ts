// Utilidades do analisador (extraídas do LinkAnalyzer). Puras e testáveis.
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

// Formato de referência do download rápido (total inicial do card, antes do
// backend corrigir pelo progresso real): áudio = primeira faixa de áudio;
// vídeo = maior faixa de vídeo. null = sem formatos (o handler mostra erro).
export function pickQuickRefFormat(mediaInfo: MediaInfo, kind: 'audio' | 'video'): MediaFormat | null {
  if (!mediaInfo || mediaInfo.formats.length === 0) return null;
  if (kind === 'audio') {
    return mediaInfo.formats.find(f => f.type === 'audio') ?? mediaInfo.formats[0];
  }
  return mediaInfo.formats.filter(f => f.type === 'video').sort((a, b) => b.sizeBytes - a.sizeBytes)[0]
    ?? mediaInfo.formats[0];
}

// Opções do download rápido — doc oficial do yt-dlp, sem chute:
// VÍDEO = base default (`bv*+ba/b`) com teto 1080p60 + merge mp4 copy.
// Combinado-primeiro FOI TESTADO e rejeitado: `b[ext=mp4]` colapsa p/ 360p
// (itag 18) quando só há combinado baixo — e YouTube NÃO tem progressivo
// 1080p, então 1080p sempre funde 2 faixas. Sem --format-sort vcodec nem --ppa.
// Todo o resto NEUTRO: sem legendas, capa, metadados, cortes, sponsorblock,
// re-encode, limite de banda herdado — e 1 fragmento concorrente (o default
// do FormatSelector é 8 e multiplica 429/403 num IP já limitado).
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
    // Vídeo rápido: teto 1080p60 (fps via fpsMax, o backend injeta [fps<=N]
    // nos ramos bv* — testado), merge mp4 copy, codecs originais.
    ...(kind === 'video' ? {
      fpsMax: 60,
      videoFormat: 'mp4',
      videoCodec: '',
      normalizeAudio: false,
      videoSharpen: 'none' as const,
    } : {}),
  };
}
