// Formatação e classificação dos cards (funções puras).
import type { DownloadItem } from '../../../types';
import { isPlaylistUrl } from '../../../core/ytdlp/playlistUtils';

export const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const formatSpeed = (bytesPerSec: number) => {
  if (bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec)}/s`;
};

// ETA fracionado do backend: arredonda antes de exibir.
export const formatEta = (seconds: number) => {  if (!Number.isFinite(seconds) || isNaN(seconds) || seconds <= 0) return '--';
  const total = Math.round(seconds);
  if (total >= 3600) {
    const hrs = Math.floor(total / 3600);
    const mins = Math.ceil((total % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }
  if (total >= 60) {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}m ${secs}s`;
  }
  return `${total}s`;
};

// Playlist via parse real de parâmetro, não substring.
// Origem em lote vence: item de playlist aparece na aba Playlists.
export const getMediaType = (item: DownloadItem): string => {
  if (item.playlistName) return 'playlist';
  if (item.audioOnly) return 'audio';
  if (item.format.type === 'audio') return 'audio';
  if (item.format.type === 'image') return 'image';
  if (isPlaylistUrl(item.url)) return 'playlist';
  return 'video';
};
