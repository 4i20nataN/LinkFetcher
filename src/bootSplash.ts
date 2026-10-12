// Splash de boot: segura na tela até o wallpaper decodificar + tempo mínimo
// de marca (~1s), depois sai com fade. Sem isso o splash morria no primeiro
// paint e o fundo estourava antes da imagem estar pronta.
import { getThemeBackground } from './components/ThemeWrapper';

const MIN_SPLASH_MS = 1000;
const MAX_SPLASH_MS = 2600;

/** Tira o splash de dentro do #root antes do React renderizar (senão some na hora). */
export function relocateSplash(): void {
  try {
    const sp = document.querySelector('.lf-startup-splash');
    if (sp && sp.parentElement && sp.parentElement.id === 'root') {
      document.body.appendChild(sp);
    }
  } catch {
    /* DOM indisponível: o React limpa sozinho */
  }
}

/** Preload do fundo do tema + espera mínima, depois fade-out e remove. */
export function dismissSplash(): void {
  let sp: Element | null = null;
  try {
    sp = document.querySelector('.lf-startup-splash');
  } catch {
    return;
  }
  if (!sp) return;
  const el = sp as HTMLElement;
  const t0 = performance.now();

  let theme = 'dark';
  try {
    theme = JSON.parse(localStorage.getItem('universal_downloader_settings') || '{}').themeMode || 'dark';
  } catch {
    /* padrão dark */
  }

  const imgReady = new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve();
      }
    };
    const timer = setTimeout(finish, MAX_SPLASH_MS);
    try {
      const im = new Image();
      im.onload = finish;
      im.onerror = finish;
      im.src = getThemeBackground(theme);
      if (im.decode) im.decode().then(finish).catch(() => {});
    } catch {
      finish();
    }
  });
  const minWait = new Promise<void>((r) =>
    setTimeout(r, Math.max(0, MIN_SPLASH_MS - (performance.now() - t0))),
  );

  void Promise.all([imgReady, minWait]).then(() => {
    el.classList.add('lf-splash-hide');
    setTimeout(() => el.remove(), 500);
  });
}
