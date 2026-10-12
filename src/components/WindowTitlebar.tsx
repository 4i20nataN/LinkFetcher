import React, { useEffect, useState, useCallback } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { isAndroid } from '../core/ytdlp/YtDlpAdapter';
import { useApp } from '../context/AppContext';

export const WindowTitlebar: React.FC = () => {
  const { settings } = useApp();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || isAndroid()) return;
    const tauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
    setIsTauri(tauri);
    if (!tauri) return;

    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        setIsMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          try {
            setIsMaximized(await win.isMaximized());
          } catch {}
        });
      } catch {}
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch {}
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().toggleMaximize();
      setIsMaximized(await getCurrentWindow().isMaximized());
    } catch {}
  }, []);

  const handleClose = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch {}
  }, []);

  if (isAndroid() || !isTauri) return null;

  const isLight = settings.themeMode === 'light' || settings.themeMode === 'white';

  return (
    <header
      data-tauri-drag-region
      onDoubleClick={handleToggleMaximize}
      className="h-9 w-full flex items-center justify-between px-4 select-none shrink-0 z-50 bg-transparent border-0"
    >
      {/* Lado esquerdo: título do aplicativo com suporte a drag */}
      <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none pl-1">
        <span className={`text-[11px] font-semibold tracking-wider uppercase opacity-60 ${
          isLight ? 'text-zinc-800' : 'text-zinc-300'
        }`}>
          LinkFetcher
        </span>
      </div>

      {/* Centro: área vazia de arrasto */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* Lado direito: botões fechar, minimizar, maximizar */}
      <div className="flex items-center h-full mr-1.5">
        <button
          type="button"
          onClick={handleMinimize}
          className={`h-7 w-9 flex items-center justify-center rounded transition-colors ${
            isLight
              ? 'text-zinc-600 hover:text-zinc-900 hover:bg-black/10 active:bg-black/15'
              : 'text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/15'
          }`}
          title="Minimizar"
          aria-label="Minimizar"
        >
          <Minus size={13} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          className={`h-7 w-9 flex items-center justify-center rounded transition-colors ${
            isLight
              ? 'text-zinc-600 hover:text-zinc-900 hover:bg-black/10 active:bg-black/15'
              : 'text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/15'
          }`}
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          aria-label={isMaximized ? 'Restaurar' : 'Maximizar'}
        >
          {isMaximized ? (
            <Copy size={11} strokeWidth={2} className="rotate-90" />
          ) : (
            <Square size={11} strokeWidth={2} />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className={`h-7 w-9 flex items-center justify-center rounded transition-colors ${
            isLight
              ? 'text-zinc-600 hover:text-white hover:bg-red-500 active:bg-red-600'
              : 'text-zinc-400 hover:text-white hover:bg-red-500 active:bg-red-600'
          }`}
          title="Fechar"
          aria-label="Fechar"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
};
