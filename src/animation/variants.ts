/** Presets centralizados de animação (timing/easing mudam só aqui). */

import type { Variants, Transition } from 'motion/react';


export const spring = (stiffness = 400, damping = 30): Transition => ({
  type: 'spring' as const,
  stiffness,
  damping,
});

export const tween = (duration = 0.25, ease: Transition['ease'] = 'easeInOut'): Transition => ({
  type: 'tween' as const,
  duration,
  ease,
});


/** Fade simples (opacidade 0→1) */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Fade + slide up (y: 15→0) — cards, banners */
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
};

/** Fade + slide up leve (y: 10→0) — list items */
export const slideUpLight: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

/** Fade + slide up forte (y: 20→0) — content cards */
export const slideUpStrong: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

/** Fade + scale (0.95→1) — toasts, popups */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

/** Fade + scale forte (0.9→1) — modais */
export const modalScale: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: 20 },
};

/** Slide de baixo (y: 80→0) — popup do clipboard */
export const slideFromBottom: Variants = {
  hidden: { y: 80, opacity: 0, scale: 0.95 },
  visible: { y: 0, opacity: 1, scale: 1 },
  exit: { y: 80, opacity: 0, scale: 0.95 },
};

/** Saída p/ esquerda (x: -15→0) — item de download */
export const slideExitLeft: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -15 },
};

/** Expande/colapsa (height: 0→auto) */
export const accordionExpand: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto' as const, opacity: 1 },
  exit: { height: 0, opacity: 0 },
};

/** Entrada do banner (y: -12→0, scale sutil) */
export const bannerEntry: Variants = {
  hidden: { opacity: 0, y: -12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.98 },
};


export const transitions = {
  /** Spring padrão para cards/modais */
  card: spring(400, 30),
  /** Spring para sidebar pill */
  sidebar: spring(350, 30),
  /** Spring rápido para tooltips */
  tooltip: spring(450, 25),
  /** Spring suave para modais */
  modal: spring(300, 25),
  /** Tween p/ transições de página */
  page: tween(0.25, 'easeInOut'),
  /** Tween p/ indicadores de aba */
  tab: tween(0.2),
  /** Tween p/ opacidade do accordion */
  accordionOpacity: tween(0.2),
  /** Spring p/ altura do accordion */
  accordionHeight: spring(400, 30),
  /** Tween p/ shimmer */
  shimmer: { duration: 1.5, repeat: Infinity, ease: 'linear' as const },
  /** Spring p/ toggle */
  toggle: spring(500, 30),
  /** Curva do chevron do accordion */
  chevron: tween(0.3, [0.25, 0.1, 0.25, 1]),
  /** Curva do banner de update */
  banner: tween(0.3, [0.23, 1, 0.32, 1]),
} as const;
