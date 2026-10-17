// Versão do app (injetada no build via __APP_VERSION__ — ver vite.config).
// O fallback só aparece fora do build (testes/web puro): mantido pelo
// `npm run bump` junto com package.json/tauri.conf/Cargo.
export const APP_VERSION_FALLBACK = '1.5.3';

export function appVersion(): string {
  try {
    return typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
      ? __APP_VERSION__
      : APP_VERSION_FALLBACK;
  } catch {
    return APP_VERSION_FALLBACK;
  }
}
