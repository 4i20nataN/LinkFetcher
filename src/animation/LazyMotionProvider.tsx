/** Lazy-load do motor de animação (só domAnimation). */

import React, { Suspense } from 'react';
import { LazyMotion } from 'motion/react';

const loadFeatures = () => import('./features').then((m) => m.default);

export function LazyMotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
