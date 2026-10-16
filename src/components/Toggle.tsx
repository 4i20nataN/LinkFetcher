import React from 'react';
import { AnimatedToggle } from '../animation/AnimatedToggle';
import { getAccentBgClass } from './ThemeWrapper';

interface ToggleProps {
  value: boolean;
  onChange: () => void;
  settings: { accentColor: string; themeMode?: string };
  /** Desabilitado de verdade: sem clique, fora da ordem de Tab, com motivo via `label`. */
  disabled?: boolean;
  /** Nome acessível (leitor de tela anuncia "label, switch, ligado/desligado"). */
  label?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ value, onChange, settings, disabled = false, label }) => {
  // Em temas claros a bolinha branca some no trilho claro — usa cinza quando OFF
  const isLightTheme = settings.themeMode === 'light' || settings.themeMode === 'white';
  const knobColor = value || !isLightTheme ? 'bg-white' : 'bg-zinc-400';
  return (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    aria-label={label}
    aria-disabled={disabled || undefined}
    disabled={disabled}
    onClick={disabled ? undefined : onChange}
    className={`relative w-[36px] h-[20px] rounded-full border-2 transition-colors duration-300 shrink-0 ${
      value ? getAccentBgClass(settings) : 'lf-surface-40'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    style={{ borderColor: value ? 'transparent' : 'var(--color-primary)' }}
  >
    <AnimatedToggle
      active={value}
      className={`absolute top-[1px] left-[2px] w-[14px] h-[14px] rounded-full shadow-sm ${knobColor}`}
    />
  </button>
  );
};
