// Thumbs da entry flat + views compacto.
import { describe, it, expect } from 'vitest';
import {
  isPlaylistUrl, pickEntryThumbnail, formatCompactViews,
} from './playlistUtils';

describe('playlistUtils', () => {
  it('detecta playlist por list= e paths', () => {
    expect(isPlaylistUrl('https://www.youtube.com/playlist?list=abc')).toBe(true);
    expect(isPlaylistUrl('https://www.youtube.com/watch?v=x&list=abc')).toBe(true);
    expect(isPlaylistUrl('https://www.youtube.com/watch?v=x')).toBe(false);
  });

  it('prefere thumbnail direto, senão o maior de thumbnails[]', () => {
    expect(pickEntryThumbnail({ thumbnail: 'd.jpg', thumbnails: [{ url: 'a.jpg', width: 999 }] })).toBe('d.jpg');
    expect(
      pickEntryThumbnail({
        thumbnails: [
          { url: 's.jpg', width: 168 },
          { url: 'm.jpg', width: 336 },
          { url: 'x.jpg' },
        ],
      }),
    ).toBe('m.jpg');
    expect(pickEntryThumbnail({})).toBe('');
    expect(pickEntryThumbnail({ thumbnails: 'lixo' })).toBe('');
  });

  it('compacta views pt/en', () => {
    expect(formatCompactViews(999)).toBe('999');
    expect(formatCompactViews(1500)).toContain('mil');
    expect(formatCompactViews(2_500_000)).toContain('mi');
    expect(formatCompactViews(2_500_000, 'en')).toContain('M');
    expect(formatCompactViews(undefined)).toBe('');
    expect(formatCompactViews(NaN)).toBe('');
  });
});
