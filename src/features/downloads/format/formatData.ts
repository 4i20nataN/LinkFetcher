// Constantes do seletor de formato (só dados).
import type { TranslationKey } from '../../../core/i18n';

export const VIDEO_PRESETS = [
  { id: 'best', label: '★ Melhor', height: Infinity, format: 'bestvideo+bestaudio/best', starYellow: true },
  { id: '2160p', label: '4K Ultra', height: 2160, format: 'bv*[height<=2160]+ba/b[height<=2160]' },
  { id: '1440p', label: '1440 QHD', height: 1440, format: 'bv*[height<=1440]+ba/b[height<=1440]' },
  { id: '1080p', label: '1080 Full HD', height: 1080, format: 'bv*[height<=1080]+ba/b[height<=1080]' },
  { id: '720p', label: '720 HD', height: 720, format: 'bv*[height<=720]+ba/b[height<=720]' },
  { id: '480p', label: '480 SD', height: 480, format: 'bv*[height<=480]+ba/b[height<=480]' },
  { id: '360p', label: '360 Baixa', height: 360, format: 'bv*[height<=360]+ba/b[height<=360]' },
] as const;

export const VIDEO_FORMATS = ['mp4', 'mkv', 'webm', 'flv'] as const;
export const VIDEO_CODECS = [
  { id: '', label: 'Auto', tip: 'Escolher automaticamente o melhor codec' },
  { id: 'h264', label: 'H.264', tip: 'Mais compativel. Funciona em todos os dispositivos' },
  { id: 'h265', label: 'H.265', tip: 'Melhor compressao. Pode nao funcionar em TVs antigas' },
  { id: 'vp9', label: 'VP9', tip: 'Codec Google. Bom para YouTube, compressao eficiente' },
  { id: 'av01', label: 'AV1', tip: 'Codec moderno. Maior compressao. Suporte crescente' },
] as const;
// [vcodec~=] é regex: h264/h265 exigem alternância (puro não casa).
export const CODEC_FILTER: Record<string, string> = {
  h264: '"^(avc|h264)"',
  h265: '"^(hev|hvc|h265)"',
  vp9: 'vp9',
  av01: 'av01',
};
// Merge (-c copy): Auto é imprevisível; container restrito exige codec explícito.
export const CODECS_FOR_CONTAINER: Record<string, string[]> = {
  webm: ['', 'vp9', 'av01'],
  flv: ['', 'h264'],
};
export const CONTAINERS_FOR_CODEC: Record<string, string[]> = {
  h264: ['mp4', 'mkv', 'flv'],
  h265: ['mp4', 'mkv'],
  vp9: ['mp4', 'mkv', 'webm'],
  av01: ['mp4', 'mkv', 'webm'],
};
export const AUDIO_FORMATS = [
  { id: 'mp3', label: 'MP3' },
  { id: 'aac', label: 'AAC' },
  { id: 'm4a', label: 'M4A' },
  { id: 'flac', label: 'FLAC' },
  { id: 'opus', label: 'OPUS' },
  { id: 'wav', label: 'WAV' },
] as const;
export const SUB_FORMATS = ['srt', 'ass', 'vtt'] as const;
export const SUB_LANGS = [
  { id: 'pt', label: 'PT' },
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
  { id: 'pt,en', label: 'PT+EN' },
  { id: 'all', label: 'ALL' },
] as const;

export const CODEC_TIPS: Record<string, TranslationKey> = {
  '': 'fmtTipAuto',
  h264: 'fmtTipH264',
  h265: 'fmtTipH265',
  vp9: 'fmtTipVp9',
  av01: 'fmtTipAv1',
};
