/** Lista animada (enter/exit; cada filho precisa de `key` única). */

import React from 'react';
import { AnimatePresence } from 'motion/react';

interface AnimatedListProps {
  children: React.ReactNode;
  /** Modo do AnimatePresence: "wait" aguarda saída antes de entrada */
  mode?: 'wait' | 'sync' | 'popLayout';
  /** Desabilitar animação inicial (útil para listas já renderizadas) */
  initial?: boolean;
  className?: string;
}

export function AnimatedList({
  children,
  mode = 'sync',
  initial = true,
  className,
}: AnimatedListProps) {
  return (
    <AnimatePresence mode={mode} initial={initial}>
      {className ? <div className={className}>{children}</div> : children}
    </AnimatePresence>
  );
}
