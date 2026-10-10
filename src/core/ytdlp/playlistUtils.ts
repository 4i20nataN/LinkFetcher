/** Utilidades puras de playlist (sem Node; seguro no renderer). */

/** Detecta playlist (parâmetro `list=` ou path conhecido). */
export function isPlaylistUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('list')) return true;
    const playlistPatterns = [
      /youtube\.com\/playlist/,
      /youtube\.com\/.*&list=/,
      /soundcloud\.com\/.*\/sets\//,
      /vimeo\.com\/channels\/.*\/sets/,
      /dailymotion\.com\/playlist\//,
    ];
    return playlistPatterns.some(p => p.test(url));
  } catch {
    return false;
  }
}

/** Melhor thumb da entry flat: `thumbnail` ou a maior de `thumbnails[]`. */
export function pickEntryThumbnail(entry: {
  thumbnail?: unknown;
  thumbnails?: unknown;
}): string {
  if (typeof entry.thumbnail === 'string' && entry.thumbnail) return entry.thumbnail;
  if (!Array.isArray(entry.thumbnails)) return '';
  let best = '';
  let bestW = -1;
  for (const t of entry.thumbnails) {
    if (typeof t !== 'object' || t === null) continue;
    const url = (t as { url?: unknown }).url;
    if (typeof url !== 'string' || !url) continue;
    const w = (t as { width?: unknown }).width;
    const width = typeof w === 'number' && Number.isFinite(w) ? w : 0;
    if (width >= bestW) {
      bestW = width;
      best = url;
    }
  }
  return best;
}

/** views compacto: 1500 → "1,5 mil". */
export function formatCompactViews(views?: number, lang: 'pt' | 'en' = 'pt'): string {
  if (views === undefined || views === null || !Number.isFinite(views) || views < 0) return '';
  if (views >= 1_000_000) {
    const v = (views / 1_000_000).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en', { maximumFractionDigits: 1 });
    return lang === 'pt' ? `${v} mi` : `${v}M`;
  }
  if (views >= 1_000) {
    const v = (views / 1_000).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en', { maximumFractionDigits: 1 });
    return lang === 'pt' ? `${v} mil` : `${v}K`;
  }
  return String(Math.round(views));
}
