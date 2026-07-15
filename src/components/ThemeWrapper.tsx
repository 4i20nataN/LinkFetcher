import React from 'react';
import { useApp } from '../context/AppContext';
import { ParticleBackground } from './ParticleBackground';

export const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useApp();

  // Map theme modes to root classes
  const themeClass = {
    light: 'bg-[#e6e2d5] text-zinc-900 light',
    dark: 'bg-[#0a0a0c] text-slate-100 dark',
    gray: 'bg-[#3a3f47] text-slate-200 gray-mode'
  }[settings.themeMode];

  // Accent mapping helper to inject inline CSS variables or provide classes
  const accentVars = {
    indigo: { primary: '#6366f1', rgb: '99, 102, 241', hover: '#4f46e5' },
    emerald: { primary: '#10b981', rgb: '16, 185, 129', hover: '#059669' },
    amber: { primary: '#f59e0b', rgb: '245, 158, 11', hover: '#d97706' },
    rose: { primary: '#f43f5e', rgb: '244, 63, 94', hover: '#e11d48' },
    violet: { primary: '#8b5cf6', rgb: '139, 92, 246', hover: '#7c3aed' },
    sky: { primary: '#0ea5e9', rgb: '14, 165, 233', hover: '#0284c7' },
    teal: { primary: '#14b8a6', rgb: '20, 184, 166', hover: '#0d9488' },
    fuchsia: { primary: '#d946ef', rgb: '217, 70, 239', hover: '#c084fc' },
    orange: { primary: '#f97316', rgb: '249, 115, 22', hover: '#ea580c' },
    cyan: { primary: '#06b6d4', rgb: '6, 182, 212', hover: '#0891b2' },
    lime: { primary: '#84cc16', rgb: '132, 204, 22', hover: '#65a30d' },
    crimson: { primary: '#ef4444', rgb: '239, 68, 68', hover: '#dc2626' },
    pink: { primary: '#ec4899', rgb: '236, 72, 153', hover: '#db2777' },
    slate: { primary: '#94a3b8', rgb: '148, 163, 184', hover: '#64748b' }
  }[settings.accentColor as any] || { primary: '#6366f1', rgb: '99, 102, 241', hover: '#4f46e5' };

  // Set inline variables so Tailwind CSS or inline styles can use standard theme values easily
  const style = {
    '--color-primary': accentVars.primary,
    '--color-primary-rgb': accentVars.rgb,
    '--color-primary-hover': accentVars.hover,
  } as React.CSSProperties;

  return (
    <div 
      className={`h-screen transition-colors duration-300 select-none ${themeClass} relative overflow-hidden`} 
      style={style}
    >
      {/* Background Mesh Gradients for Frosted Glass feel */}
      <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none z-0" />
      <div className="absolute top-[30%] right-[-5%] w-[40%] h-[40%] bg-purple-600/8 blur-[110px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-indigo-500/4 blur-[120px] pointer-events-none z-0" />
      <ParticleBackground />

      {/* Content wrapper with higher z-index to stay above meshes */}
      <div className="relative z-10 h-full">
        {children}
      </div>
    </div>
  );
};

// Global Helper to return background class for active accent
export function getAccentBgClass(settings: { accentColor: string }) {
  switch (settings.accentColor) {
    case 'emerald': return 'bg-emerald-500 hover:bg-emerald-600';
    case 'amber': return 'bg-amber-500 hover:bg-amber-600';
    case 'rose': return 'bg-rose-500 hover:bg-rose-600';
    case 'violet': return 'bg-violet-500 hover:bg-violet-600';
    case 'sky': return 'bg-sky-500 hover:bg-sky-600';
    case 'teal': return 'bg-teal-500 hover:bg-teal-600';
    case 'fuchsia': return 'bg-fuchsia-500 hover:bg-fuchsia-600';
    case 'orange': return 'bg-orange-500 hover:bg-orange-600';
    case 'cyan': return 'bg-cyan-500 hover:bg-cyan-600';
    case 'lime': return 'bg-lime-500 hover:bg-lime-600';
    case 'crimson': return 'bg-red-500 hover:bg-red-600';
    case 'pink': return 'bg-pink-500 hover:bg-pink-600';
    case 'slate': return 'bg-slate-400 hover:bg-slate-500';
    case 'indigo':
    default:
      return 'bg-indigo-500 hover:bg-indigo-600';
  }
}

// Global Helper to return text class for active accent
export function getAccentTextClass(settings: { accentColor: string }) {
  switch (settings.accentColor) {
    case 'emerald': return 'text-emerald-500';
    case 'amber': return 'text-amber-500';
    case 'rose': return 'text-rose-500';
    case 'violet': return 'text-violet-500';
    case 'sky': return 'text-sky-500';
    case 'teal': return 'text-teal-500';
    case 'fuchsia': return 'text-fuchsia-500';
    case 'orange': return 'text-orange-500';
    case 'cyan': return 'text-cyan-500';
    case 'lime': return 'text-lime-500';
    case 'crimson': return 'text-red-500';
    case 'pink': return 'text-pink-500';
    case 'slate': return 'text-slate-400';
    case 'indigo':
    default:
      return 'text-indigo-500';
  }
}

// Global Helper to return border class for active accent
export function getAccentBorderClass(settings: { accentColor: string }) {
  switch (settings.accentColor) {
    case 'emerald': return 'border-emerald-500';
    case 'amber': return 'border-amber-500';
    case 'rose': return 'border-rose-500';
    case 'violet': return 'border-violet-500';
    case 'sky': return 'border-sky-500';
    case 'teal': return 'border-teal-500';
    case 'fuchsia': return 'border-fuchsia-500';
    case 'orange': return 'border-orange-500';
    case 'cyan': return 'border-cyan-500';
    case 'lime': return 'border-lime-500';
    case 'crimson': return 'border-red-500';
    case 'pink': return 'border-pink-500';
    case 'slate': return 'border-slate-400';
    case 'indigo':
    default:
      return 'border-indigo-500';
  }
}

// Global Helper to return ring class for active accent
export function getAccentRingClass(settings: { accentColor: string }) {
  switch (settings.accentColor) {
    case 'emerald': return 'focus:ring-emerald-500/30';
    case 'amber': return 'focus:ring-amber-500/30';
    case 'rose': return 'focus:ring-rose-500/30';
    case 'violet': return 'focus:ring-violet-500/30';
    case 'sky': return 'focus:ring-sky-500/30';
    case 'teal': return 'focus:ring-teal-500/30';
    case 'fuchsia': return 'focus:ring-fuchsia-500/30';
    case 'orange': return 'focus:ring-orange-500/30';
    case 'cyan': return 'focus:ring-cyan-500/30';
    case 'lime': return 'focus:ring-lime-500/30';
    case 'crimson': return 'focus:ring-red-500/30';
    case 'pink': return 'focus:ring-pink-500/30';
    case 'slate': return 'focus:ring-slate-400/30';
    case 'indigo':
    default:
      return 'focus:ring-indigo-500/30';
  }
}

// Global Helper to return text color class for active accent background (white or dark)
export function getAccentTextOnBgClass(settings: { accentColor: string }) {
  // Colors where 500 shade is too light for white text
  const darkTextColors = ['amber', 'lime', 'slate'];
  return darkTextColors.includes(settings.accentColor) ? 'text-zinc-900' : 'text-white';
}
