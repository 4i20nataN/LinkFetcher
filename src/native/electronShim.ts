/** Ponte de compatibilidade Electron → Tauri (filesystem/shell). */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function setupElectronShim() {
  if (typeof window === 'undefined') return;
  if (window.electron) return;

  const eventListeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const tauriUnlistens = new Map<string, () => void>();

  window.electron = {
    invoke: async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
      switch (channel) {
        case 'shell:getDownloadsPath': {
          const path = await invoke<string>('fs_get_downloads_path');
          return path as unknown as T;
        }
        case 'shell:openPath': {
          // Tauri converte snake_case↔camelCase sozinho: aqui vai camelCase.
          const targetPath = (args[0] as string) || '';
          await invoke('fs_open_path', { targetPath });
          return undefined as unknown as T;
        }
        case 'shell:selectFolder': {
          const defaultPath = (args[0] as string) || undefined;
          const selected = await invoke<string | null>('fs_select_folder', { defaultPath });
          return selected as unknown as T;
        }
        case 'save-description': {
          const payload = (args[0] as { filename: string; content: string }) || { filename: '', content: '' };
          const res = await invoke<T>('fs_save_description', {
            filename: payload.filename,
            content: payload.content,
          });
          return res;
        }
        case 'yt-dlp-probe': {
          return invoke<T>('ytdlp_probe', { options: args[0] });
        }
        case 'yt-dlp-probe-playlist': {
          return invoke<T>('ytdlp_probe_playlist', { options: args[0] });
        }
        case 'yt-dlp-search': {
          return invoke<T>('ytdlp_search', { options: args[0] });
        }
        case 'yt-dlp-download': {
          return invoke<T>('ytdlp_download', { options: args[0] });
        }
        case 'yt-dlp-cancel': {
          const id = typeof args[0] === 'string' ? args[0] : (args[0] as any)?.id;
          return invoke<T>('ytdlp_cancel', { id });
        }
        case 'yt-dlp-status': {
          return invoke<T>('ytdlp_status');
        }
        default: {
          // Canal desktop-only no mobile: debug p/ não poluir o console.
          console.debug(`[electronShim] Unhandled invoke channel: ${channel}`);
          return Promise.resolve(undefined as unknown as T);
        }
      }
    },

    on: (channel: string, listener: (...args: unknown[]) => void) => {
      if (!eventListeners.has(channel)) {
        eventListeners.set(channel, new Set());
        listen(channel, (event) => {
          const set = eventListeners.get(channel);
          set?.forEach(cb => cb(event.payload));
        }).then((unlistenFn) => {
          tauriUnlistens.set(channel, unlistenFn);
        }).catch(() => {});
      }
      eventListeners.get(channel)!.add(listener);

      return () => {
        const set = eventListeners.get(channel);
        set?.delete(listener);
        if (set?.size === 0) {
          eventListeners.delete(channel);
          const un = tauriUnlistens.get(channel);
          if (un) {
            un();
            tauriUnlistens.delete(channel);
          }
        }
      };
    },

    off: (channel: string, listener: (...args: unknown[]) => void) => {
      const set = eventListeners.get(channel);
      set?.delete(listener);
    },

    checkForUpdate: async () => ({ updateAvailable: false }),
    applyUpdate: async () => ({ ok: false, error: 'Auto-update managed by OS package manager' }),
    installUpdate: async () => ({ ok: false, error: 'Auto-update managed by OS package manager' }),
    onUpdateProgress: () => () => {},
    onUpdateAvailable: () => () => {},
    setAutoCheck: () => {},
    getAutoCheck: async () => false,

    clipboardStartMonitoring: () => {},
    clipboardStopMonitoring: () => {},
    clipboardGetText: async () => {
      try {
        const { readClipboardText } = await import('./clipboard');
        return await readClipboardText();
      } catch {
        return '';
      }
    },
    onClipboardUrlDetected: () => () => {},

    isExtensionConnected: async () => false,
    onExtensionStatus: () => () => {},
  };
}
