/** Transição de página via CSS (sem leituras de layout JS). */

import React from 'react';

interface Props {
  activeKey: string;
  children: React.ReactNode;
  className?: string;
}

export function CSSPageTransition({ activeKey, children, className }: Props) {
  return (
    <div className={className}>
      <div
        key={activeKey}
        className="lf-css-enter"
      >
        {children}
      </div>
    </div>
  );
}
