/**
 * AnimatedAccordion — accordion expand/collapse com spring height.
 *
 * Uso:
 *   <AnimatedAccordion isOpen={expanded}>
 *     <div>conteúdo expansível</div>
 *   </AnimatedAccordion>
 */

import React from 'react';
import { AnimatePresence, m } from 'motion/react';
import { accordionExpand, transitions, tween } from './variants';
import { RENDER_PROFILE } from '../core/perf/renderProfile';

interface AnimatedAccordionProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AnimatedAccordion({ isOpen, children, className }: AnimatedAccordionProps) {
  // Perfil efficient (raster por software): animar `height` recalcula o
  // layout a cada frame do spring — abre instantâneo, sem tranco.
  const instant = RENDER_PROFILE === 'efficient';
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <m.div
          variants={accordionExpand}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={
            instant
              ? { height: { duration: 0 }, opacity: { duration: 0 } }
              : {
                  height: transitions.accordionHeight,
                  opacity: transitions.accordionOpacity,
                }
          }
          className={className}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
