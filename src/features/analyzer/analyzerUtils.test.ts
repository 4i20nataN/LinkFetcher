// Lote de playlist: MediaInfo da entry flat + opções globais.
import { describe, it, expect } from 'vitest';
import {
  fmtDuration, playlistItemToMedia, buildBulkOptions, removePlaylistItem,
} from './analyzerUtils';
import type { FormatOptions } from '../downloads/FormatOptions';
import type { PlaylistInfo } from '../../types';

const base: FormatOptions = {
  format: 'bestvideo+bestaudio/best',
  audioOnly: false,
  audioFormat: 'mp3',
  audioQuality: '0',
  writeSubs: true,
  writeAutoSubs: false,
  subLangs: 'pt',
  subFormat: '',
  embedSubs: false,
  writeThumbnail: false,
  embedThumbnail: false,
  embedMetadata: true,
  videoOnly: false,
  downloadSections: '*00:10-00:20',
  sponsorblockRemove: 'sponsor',
  fpsMax: 30,
  bandLimit: 0,
  videoFormat: 'mp4',
  customFilename: 'fixo',
  descFormat: 'txt',
};

const playlist: PlaylistInfo = {
  id: 'playlist_1',
  title: 'Minha Playlist',
  thumbnailUrl: 'http://x/t.jpg',
  itemCount: 2,
  platform: 'youtube',
  url: 'https://youtube.com/playlist?list=abc',
  items: [
    { id: 'v1', title: 'Vídeo 1', url: 'https://youtube.com/watch?v=1', thumbnailUrl: 'http://x/1.jpg', duration: 125, index: 1, uploader: 'Canal 1' },
    { id: 'v2', title: 'Vídeo 2', url: 'https://youtube.com/watch?v=2', thumbnailUrl: '', index: 2, uploader: 'Canal 2' },
  ],
};

describe('playlist bulk', () => {
  it('formata duração MM:SS e H:MM:SS', () => {
    expect(fmtDuration(125).text).toBe('02:05');
    expect(fmtDuration(3725).text).toBe('1:02:05');
    expect(fmtDuration(undefined).text).toBe('');
  });

  it('monta MediaInfo da entry flat sem probe', () => {
    const m = playlistItemToMedia(playlist, playlist.items[0], { audioOnly: false, container: 'mp4' });
    expect(m.originalUrl).toBe('https://youtube.com/watch?v=1');
    expect(m.title).toBe('Vídeo 1');
    expect(m.duration).toBe('02:05');
    expect(m.durationSeconds).toBe(125);
    expect(m.formats).toHaveLength(1);
    expect(m.formats[0].ext).toBe('mp4');
    expect(m.status).toBe('success');
  });

  it('remove item da lista e recalcula; vazia vira null', () => {
    const one = removePlaylistItem(playlist, 'v1');
    expect(one?.items.map(i => i.id)).toEqual(['v2']);
    expect(one?.itemCount).toBe(1);
    expect(one?.channel).toBe('Canal 2');
    expect(removePlaylistItem(one, 'v2')).toBeNull();
    expect(removePlaylistItem(null, 'v1')).toBeNull();
    // id inexistente não muda nada
    expect(removePlaylistItem(playlist, 'zzz')?.items).toHaveLength(2);
  });

  it('custom mantém painel mas expurga nome fixo, corte e descrição', () => {
    const o = buildBulkOptions(base, 'custom');
    expect(o.format).toBe('bestvideo+bestaudio/best');
    expect(o.writeSubs).toBe(true);
    expect(o.sponsorblockRemove).toBe('sponsor');
    expect(o.customFilename).toBeUndefined();
    expect(o.downloadSections).toBe('');
    expect(o.descFormat).toBe('none');
  });

  it('presets gratuitos iguais ao download rápido unitário', () => {
    const v = buildBulkOptions(base, 'video');
    expect(v.format).toContain('height<=1080');
    expect(v.videoFormat).toBe('mp4');
    expect(v.writeSubs).toBe(false);
    const a = buildBulkOptions(base, 'audio');
    expect(a.audioOnly).toBe(true);
    expect(a.format).toBe('bestaudio/best');
  });
});
