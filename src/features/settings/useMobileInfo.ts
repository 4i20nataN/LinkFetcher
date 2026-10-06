// Info da plataforma mobile (extraído do SettingsView): pasta do app e
// versão do yt-dlp embarcado (diagnóstico de bitrot A1). Fora do Android,
// retorna flags vazias — os painéis nem chamam.
import { useState, useEffect } from 'react';

export function useMobileInfo() {
  const isElectron = typeof window !== 'undefined' && !!window.electron;
  // Tauri mobile (Android): sem diálogo de pasta nem path custom — o app
  // usa a pasta própria no armazenamento externo (via `fs_get_downloads_path`).
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const [mobileDir, setMobileDir] = useState('');
  // Versão do yt-dlp embarcado (diagnóstico de bitrot A1).
  const [engineVersion, setEngineVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isAndroid) return;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const dir = await invoke<string>('fs_get_downloads_path');
        setMobileDir(dir);
      } catch { /* mantém fallback */ }
      try {
        const { getYtDlpStatusWithAdapter } = await import('../../core/ytdlp/YtDlpAdapter');
        const s = await getYtDlpStatusWithAdapter();
        if (s.version) setEngineVersion(s.version);
      } catch { /* versão desconhecida: omite a linha */ }
    })();
  }, [isAndroid]);

  return { isElectron, isAndroid, mobileDir, engineVersion };
}
