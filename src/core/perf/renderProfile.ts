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

// Perfil de render: desktop mostra o wallpaper (bitmap estático + glow
// estático, sem blur animado); Android força 'efficient' (GPU móvel + bateria).
// Override manual p/ teste A/B (devtools): localStorage 'lf-render-profile'.
export const RENDER_PROFILE: 'full' | 'efficient' = forcedProfile() ?? (isAndroid ? 'efficient' : 'full');

// Override manual p/ teste A/B (devtools): 'full' mostra o wallpaper,
// 'efficient' força o modo leve. Ausente = automático.
function forcedProfile(): 'full' | 'efficient' | null {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem('lf-render-profile') : null;
    return v === 'full' || v === 'efficient' ? v : null;
  } catch {
    return null;
  }
}
