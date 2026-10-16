export interface AppSettings {
  themeMode: 'light' | 'dark' | 'gray' | 'white';
  accentColor: string; // ex.: 'indigo', 'emerald', 'amber', 'rose', 'violet', 'sky', 'teal', 'fuchsia'
  iconStyle: 'emoji' | 'lucide-mono' | 'lucide-color';
  language: 'pt' | 'en';
  defaultDir: string;
  /** Android: subpasta dentro de Downloads públicos (MediaStore). Opcional —
      ausente = "LinkFetcher". Path arbitrário é bloqueado pelo scoped storage. */
  mobilePublicSubdir?: string;
  bandLimit: number; // KB/s, 0 = ilimitado
  maxConcurrent: number;
  autoDownload: boolean;
  notifications: boolean;
  updates: boolean;
  clipboardEnabled: boolean;
}

/** Fonte única de defaults seguros (opt-out, nada destrutivo). */
export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'dark',
  accentColor: 'indigo',
  iconStyle: 'lucide-mono',
  language: 'pt',
  defaultDir: '',
  mobilePublicSubdir: 'LinkFetcher',
  bandLimit: 0,
  maxConcurrent: 3,
  autoDownload: true,
  notifications: true,
  updates: true,
  clipboardEnabled: true,
};

const THEME_MODES: AppSettings['themeMode'][] = ['light', 'dark', 'gray', 'white'];
const ICON_STYLES: AppSettings['iconStyle'][] = ['emoji', 'lucide-mono', 'lucide-color'];

const asBool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const asNum = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
const asStr = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);

/**
 * Sanitiza settings vindos de localStorage/backup: JSON válido com forma ou
 * tipo errado (`null`, parcial, string-em-boolean) cai no default campo a
 * campo em vez de quebrar ou mentir estado. Campos futuros nascem definidos.
 */
export function sanitizeSettings(raw: unknown): AppSettings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...d };
  const s = raw as Record<string, unknown>;
  const themeMode = THEME_MODES.includes(s.themeMode as AppSettings['themeMode'])
    ? (s.themeMode as AppSettings['themeMode']) : d.themeMode;
  const iconStyle = ICON_STYLES.includes(s.iconStyle as AppSettings['iconStyle'])
    ? (s.iconStyle as AppSettings['iconStyle']) : d.iconStyle;
  const language = s.language === 'en' || s.language === 'pt' ? s.language : d.language;
  return {
    themeMode,
    accentColor: asStr(s.accentColor, d.accentColor) || d.accentColor,
    iconStyle,
    language,
    defaultDir: asStr(s.defaultDir, d.defaultDir),
    mobilePublicSubdir: asStr(s.mobilePublicSubdir, d.mobilePublicSubdir),
    bandLimit: asNum(s.bandLimit, d.bandLimit),
    maxConcurrent: Math.min(10, Math.max(1, Math.round(asNum(s.maxConcurrent, d.maxConcurrent)))),
    autoDownload: asBool(s.autoDownload, d.autoDownload),
    notifications: asBool(s.notifications, d.notifications),
    updates: asBool(s.updates, d.updates),
    clipboardEnabled: asBool(s.clipboardEnabled, d.clipboardEnabled),
  };
}
