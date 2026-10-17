// Rolagem por teclado determinística (desktop).
//
// Sem isto, a rolagem por seta é 100% nativa do WebView: no WebKitGTK cada
// auto-repeat (~30/s) da tecla reinicia a animação suave de scroll, e cada
// frame dessas animações repinta o viewport inteiro no raster por software —
// segurar a seta travava a interface. Aqui acumulamos os deltas e aplicamos
// 1x por requestAnimationFrame (teto físico de 60 atualizações/s), com
// preventDefault no scroll nativo. Funciona igual no WebView2/Chromium.

const STEP_LINE_PX = 72;

/** Delta de rolagem por tecla. `null` = tecla não nossa. ±Infinity = topo/fim. */
export function scrollDeltaForKey(key: string, viewportHeight: number): number | null {
  switch (key) {
    case 'ArrowDown': return STEP_LINE_PX;
    case 'ArrowUp': return -STEP_LINE_PX;
    case 'PageDown': return viewportHeight * 0.85;
    case 'PageUp': return -viewportHeight * 0.85;
    case 'Home': return -Infinity;
    case 'End': return Infinity;
    default: return null;
  }
}

/** Alvo de texto não pode perder as setas (cursor do input, seleção etc.). */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
    || el.isContentEditable === true;
}

/** Primeiro ancestral rolável visível do alvo (lista de modal, main, etc.). */
function scrollOwnerOf(target: EventTarget | null): HTMLElement | null {
  for (let el = target as HTMLElement | null; el; el = el.parentElement) {
    if (!el.style) break;
    if (el.scrollHeight <= el.clientHeight) continue;
    const oy = getComputedStyle(el).overflowY;
    if (oy === 'auto' || oy === 'scroll') return el;
  }
  return null;
}

/**
 * Instala o handler global de setas/Page/Home/End. Retorna o teardown.
 * Bubble phase no window: handlers React (trim slider etc.) rodam antes e,
 * se chamarem preventDefault, nós respeitamos.
 */
export function setupKeyboardScroll(): () => void {
  let pending = 0;
  let owner: HTMLElement | null = null;
  let raf = 0;
  // Cache: durante um auto-repeat o foco não muda, então resolvemos o
  // container rolável 1x por alvo (evita getComputedStyle/scrollHeight por evento).
  let cachedTarget: EventTarget | null = null;
  let cachedOwner: HTMLElement | null = null;

  const resolveOwner = (target: EventTarget | null): HTMLElement | null => {
    if (target === cachedTarget) return cachedOwner;
    const resolved = scrollOwnerOf(target) ?? document.querySelector<HTMLElement>('main');
    cachedTarget = target;
    cachedOwner = resolved;
    return resolved;
  };

  const flush = () => {
    raf = 0;
    const el = owner;
    const delta = pending;
    pending = 0;
    if (!el || delta === 0) return;
    el.scrollBy({ top: delta, behavior: 'auto' });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isEditableTarget(e.target)) return;
    const delta = scrollDeltaForKey(e.key, window.innerHeight);
    if (delta === null || delta === 0) return;

    const el = resolveOwner(e.target);
    if (!el) return;
    e.preventDefault();

    // Topo/fim são salto instantâneo: aplica direto, sem coalescer.
    if (!Number.isFinite(delta)) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      pending = 0;
      el.scrollTop = delta < 0 ? 0 : el.scrollHeight;
      return;
    }

    // Foco mudou de rolagem no meio da tecla segurada: apaga o pendente no
    // dono antigo antes de começar no novo.
    if (owner && owner !== el) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      pending = 0;
    }
    owner = el;
    pending += delta;
    if (raf === 0) raf = requestAnimationFrame(flush);
  };

  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
    if (raf) cancelAnimationFrame(raf);
  };
}
