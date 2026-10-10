/** Leitura da área de transferência (plugin Tauri + fallback Web). */

export async function readClipboardText(): Promise<string> {
  try {
    const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
    return (await readText()) || '';
  } catch {
  }
  try {
    if (navigator.clipboard?.readText) {
      return (await navigator.clipboard.readText()) || '';
    }
  } catch {
  }
  return '';
}

/** Heurística simples: texto parece um link http(s) colável. */
export function looksLikeUrl(text: string): boolean {
  const t = (text || '').trim();
  if (!/^https?:\/\/\S+$/i.test(t)) return false;
  try {
    const u = new URL(t);
    return !!u.hostname && u.hostname.includes('.');
  } catch {
    return false;
  }
}
