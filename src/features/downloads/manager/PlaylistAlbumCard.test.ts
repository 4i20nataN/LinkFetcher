// Aba Playlists: mesma origem = um álbum; avulso = álbum de 1 faixa.
import { describe, expect, it } from 'vitest';
import { groupPlaylistItems } from './PlaylistAlbumCard';
import type { DownloadItem } from '../../../types';

function fakeItem(partial: Partial<DownloadItem> & { id: string; status: DownloadItem['status'] }): DownloadItem {
  return {
    title: 'Faixa',
    thumbnailUrl: '',
    platform: 'youtube',
    format: { id: 'f', ext: 'mp3', quality: '', sizeEst: '', sizeBytes: 0, codec: '', type: 'audio' },
    sizeTotal: 0,
    sizeDownloaded: 0,
    progress: 0,
    speed: 0,
    eta: 0,
    addedAt: new Date().toISOString(),
    url: 'https://x',
    ...partial,
  } as DownloadItem;
}

describe('groupPlaylistItems', () => {
  it('agrupa por playlistName preservando a ordem', () => {
    const items = [
      fakeItem({ id: 'a1', status: 'completed', playlistName: 'Ruas Vazias', url: 'u1' }),
      fakeItem({ id: 'b1', status: 'completed', playlistName: 'Outro', url: 'u2' }),
      fakeItem({ id: 'a2', status: 'paused', playlistName: 'Ruas Vazias', url: 'u3' }),
    ];
    const groups = groupPlaylistItems(items);
    expect(groups.map((g) => g.title)).toEqual(['Ruas Vazias', 'Outro']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['b1']);
  });

  it('sem playlistName usa a URL (álbum de 1 faixa, não some)', () => {
    const items = [fakeItem({ id: 'x', status: 'queued', url: 'https://yt/watch?v=1' })];
    const groups = groupPlaylistItems(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
  });

  it('lista vazia retorna vazio', () => {
    expect(groupPlaylistItems([])).toEqual([]);
  });
});
