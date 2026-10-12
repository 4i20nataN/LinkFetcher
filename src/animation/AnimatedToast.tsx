/** Toast com slide de baixo. */

import React from 'react';
import { AnimatePresence, m } from 'motion/react';
import { slideFromBottom, transitions } from './variants';

interface AnimatedToastProps {
  visible: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AnimatedToast({ visible, children, className }: AnimatedToastProps) {
  return (
    <AnimatePresence>
      {visible && (
        <m.div
          variants={slideFromBottom}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={transitions.card}
          className={className}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
