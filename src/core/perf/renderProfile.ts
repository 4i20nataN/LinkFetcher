/** Sonda o renderer p/ escolher os efeitos: `full` ou `efficient`. */
// Sem GPU (WebKitGTK/Android), canvas+blur fullscreen travam o scroll.

const isTauri =
  typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
// `window.chrome` só existe em motores Chromium.
const isChromium =
  typeof window !== 'undefined' && !!(window as unknown as { chrome?: unknown }).chrome;
// Android força 'efficient' (GPU móvel + bateria).
const isAndroid =
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

export const RENDER_PROFILE: 'full' | 'efficient' = (isTauri && !isChromium) || isAndroid ? 'efficient' : 'full';
