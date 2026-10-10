/** Accordion expand/collapse com spring de altura. */

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
  // No perfil efficient abre instantâneo (animar height trava o raster).
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
          className={className ? `overflow-hidden ${className}` : 'overflow-hidden'}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
