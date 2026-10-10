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
