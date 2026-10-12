/** Knob de toggle com spring. */

import React from 'react';
import { m } from 'motion/react';
import { transitions } from './variants';

interface AnimatedToggleProps {
  active: boolean;
  className?: string;
}

export function AnimatedToggle({ active, className }: AnimatedToggleProps) {
  return (
    <m.div
      className={className}
      animate={{ x: active ? 14 : 0 }}
      transition={transitions.toggle}
    />
  );
}
