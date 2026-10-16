/** Sonda o renderer p/ escolher os efeitos: `full` ou `efficient`. */
// Sem GPU (WebKitGTK/Android), canvas+blur fullscreen travam o scroll.

// `window.chrome` só existe em motores Chromium.
const isChromium =
  typeof window !== 'undefined' && !!(window as unknown as { chrome?: unknown }).chrome;
// Android força 'efficient' (GPU móvel + bateria).
const isAndroid =
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

// Perfil de render: só Chromium (WebView2/Chrome) aguenta blur+spring a 60fps.
// WebKitGTK (Tauri Linux, sem window.chrome) e Android caem em 'efficient':
// sem blur por card, sem springs JS por item — usa CSS transform/opacity.
// Override manual p/ teste A/B (devtools): localStorage 'lf-render-profile'.
export const RENDER_PROFILE: 'full' | 'efficient' = forcedProfile() ?? (!isChromium || isAndroid ? 'efficient' : 'full');

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
