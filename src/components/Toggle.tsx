import React from 'react';
import { motion } from 'motion/react';
import { getAccentBgClass } from './ThemeWrapper';

interface ToggleProps {
  value: boolean;
  onChange: () => void;
  settings: { accentColor: string };
}

export const Toggle: React.FC<ToggleProps> = ({ value, onChange, settings }) => (
  <button
    onClick={onChange}
    className={`relative w-[36px] h-[20px] rounded-full border-2 transition-colors duration-300 shrink-0 ${
      value ? getAccentBgClass(settings) : 'lf-surface-40'
    }`}
    style={{ borderColor: value ? 'transparent' : 'var(--color-primary)' }}
  >
    <motion.div
      className="absolute top-[1px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm"
      animate={{ x: value ? 14 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    />
  </button>
);
