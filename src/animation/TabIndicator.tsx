/** Indicador de aba ativa com layoutId compartilhado. */

import React from 'react';
import { m, LayoutGroup } from 'motion/react';
import { transitions } from './variants';
import { RENDER_PROFILE } from '../core/perf/renderProfile';

interface TabIndicatorProps {
  /** ID compartilhado p/ animação de layout (omitido no efficient). */
  layoutId?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function TabIndicator({ layoutId, className, style }: TabIndicatorProps) {
  return (
    <m.div
      layoutId={RENDER_PROFILE === 'efficient' ? undefined : layoutId}
      className={className}
      style={style}
      transition={transitions.sidebar}
    />
  );
}

/** Wrapper para agrupar indicadores que compartilham layoutId */
export { LayoutGroup };
