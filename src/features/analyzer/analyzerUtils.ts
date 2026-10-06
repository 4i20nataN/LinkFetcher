// Utilidades do analisador (extraídas do LinkAnalyzer). Puras e testáveis.
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
