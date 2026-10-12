// Info mobile: pasta do app + versão do yt-dlp.
import { useState, useEffect } from 'react';

export function useMobileInfo() {
  const isDesktop = typeof window !== 'undefined' && !!window.electron;
  // No Android usa a pasta própria (scoped storage; sem path custom).
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const [mobileDir, setMobileDir] = useState('');
  const [engineVersion, setEngineVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isAndroid) return;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const dir = await invoke<string>('fs_get_downloads_path');
        setMobileDir(dir);
      } catch {}
      try {
        const { getYtDlpStatusWithAdapter } = await import('../../core/ytdlp/YtDlpAdapter');
        const s = await getYtDlpStatusWithAdapter();
        if (s.version) setEngineVersion(s.version);
      } catch {}
    })();
  }, [isAndroid]);

  return { isDesktop, isAndroid, mobileDir, engineVersion };
}
