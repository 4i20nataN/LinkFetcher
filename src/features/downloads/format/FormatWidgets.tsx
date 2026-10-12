// Widgets das seções do seletor (leem settings via contexto).
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../core/i18n';
import { BlockIcon, BlockTitle, type BlockId } from '../../../components/BlockIcon';
import { Toggle } from '../../../components/Toggle';
import { AnimatedAccordion } from '../../../animation/AnimatedAccordion';
import { AnimatedButton } from '../../../animation/AnimatedButton';
import { AnimatedList } from '../../../animation/AnimatedList';
import { AnimatedCard } from '../../../animation/AnimatedCard';
import { scaleIn, transitions } from '../../../animation/variants';
import { ChevronDown, X } from 'lucide-react';
import { SUB_LANGS } from './formatData';
import { formatTime, parseTimeInput } from './formatUtils';

// Modal de idiomas em escopo de arquivo (preserva a busca entre renders).
export function SubsPickerModal({ manual, auto, selected, onPick, onClose }: {
  manual: string[];
  auto: string[];
  selected: string;
  onPick: (lang: string) => void;
  onClose: () => void;
}) {
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  const [q, setQ] = useState('');
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const norm = q.trim().toLowerCase();
  const filt = (ls: string[]) => (norm ? ls.filter((l) => l.includes(norm)) : ls);
  const m = filt(manual);
  const a = filt(auto);
  const section = (title: string, langs: string[]) => (
    langs.length > 0 && (
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 fs-sm lf-text-faint font-semibold uppercase tracking-wide text-[10px]">
          {title}
          <span className="px-1.5 py-px rounded-full bg-white/10 text-white/70 font-mono">
            {langs.length}
          </span>
        </span>
        <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
          {langs.map((l) => (
            <button
              key={l}
              onClick={() => onPick(l)}
              className={`px-2.5 py-1.5 rounded-lg font-mono uppercase text-[11px] font-bold border transition-all ${
                selected === l
                  ? 'text-white border-white/30 bg-white/10 shadow-md'
                  : 'lf-text-secondary lf-border bg-white/[0.02] hover:text-white hover:bg-white/5'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    )
  );
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[70vh] flex flex-col rounded-2xl lf-surface border lf-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b lf-border shrink-0">
          <span className="text-xs font-bold text-white">{t('fmtSubsAvail')}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg lf-text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-4 pt-3 shrink-0 space-y-2.5">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('fmtSubsSearchPh')}
            className="w-full px-3 py-2 rounded-xl lf-surface-raised border lf-border fs-sm lf-text-secondary placeholder-zinc-600 focus:outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {SUB_LANGS.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  selected === p.id
                    ? 'text-white border-white/30 bg-white/10 shadow-md'
                    : 'lf-text-secondary lf-border bg-white/[0.02] hover:text-white hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          {section(t('fmtSubsManual'), m)}
          {section(t('fmtSubsAuto'), a)}
          {m.length === 0 && a.length === 0 && (
            <p className="fs-sm lf-text-faint">{t('fmtSubsEmpty')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export interface TimeRangeSliderProps {
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
  accentBg: string;
  onChange: (start: number, end: number) => void;
}

export function TimeRangeSlider({ durationSeconds, startSeconds, endSeconds, accentBg, onChange }: TimeRangeSliderProps) {
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  const maxVal = durationSeconds || 1;
  const effectiveEnd = endSeconds || durationSeconds;

  const startPct = (startSeconds / maxVal) * 100;
  const endPct = (effectiveEnd / maxVal) * 100;

  const [inputStart, setInputStart] = useState(formatTime(startSeconds));
  const [inputEnd, setInputEnd] = useState(endSeconds > 0 ? formatTime(endSeconds) : '');
  const [inputFocused, setInputFocused] = useState<'start' | 'end' | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (inputFocused !== 'start') setInputStart(formatTime(startSeconds));
  }, [startSeconds, inputFocused]);

  useEffect(() => {
    if (inputFocused !== 'end') setInputEnd(endSeconds > 0 ? formatTime(endSeconds) : '');
  }, [endSeconds, inputFocused]);

  const commitInput = (which: 'start' | 'end', raw: string) => {
    const parsed = parseTimeInput(raw);
    if (parsed !== null) {
      if (which === 'start') {
        const clamped = Math.min(parsed, effectiveEnd > 0 ? effectiveEnd - 1 : durationSeconds);
        onChange(Math.max(0, clamped), endSeconds);
      } else {
        const clamped = Math.min(Math.max(parsed, startSeconds + 1), durationSeconds);
        onChange(startSeconds, clamped >= durationSeconds ? 0 : clamped);
      }
    }
    setInputFocused(null);
  };

  const updateFromClientX = useCallback((which: 'start' | 'end', clientX: number) => {
    const track = document.querySelector('[data-time-range-track]') as HTMLElement;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const val = Math.round(pct * maxVal);
    if (which === 'start') {
      const maxAllowed = effectiveEnd > 0 ? effectiveEnd - 1 : maxVal;
      if (val <= maxAllowed) onChange(val, endSeconds);
    } else {
      const minAllowed = startSeconds + 1;
      if (val >= minAllowed) onChange(startSeconds, val >= durationSeconds ? 0 : val);
    }
  }, [maxVal, effectiveEnd, durationSeconds, endSeconds, startSeconds, onChange]);

  useEffect(() => {
    if (!dragging) return;
    const mouseMove = (e: MouseEvent) => { e.preventDefault(); updateFromClientX(dragging, e.clientX); };
    const mouseUp = () => setDragging(null);
    const touchMove = (e: TouchEvent) => { e.preventDefault(); updateFromClientX(dragging, e.touches[0].clientX); };
    const touchEnd = () => setDragging(null);
    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('mouseup', mouseUp);
    window.addEventListener('touchmove', touchMove, { passive: false });
    window.addEventListener('touchend', touchEnd);
    return () => {
      window.removeEventListener('mousemove', mouseMove);
      window.removeEventListener('mouseup', mouseUp);
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('touchend', touchEnd);
    };
  }, [dragging, updateFromClientX]);

  const cutDuration = effectiveEnd > startSeconds ? effectiveEnd - startSeconds : 0;

  return (
    <div className="space-y-3">
      <div className="relative h-6 flex items-center select-none" data-time-range-track>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full lf-surface-raised" />
        <div
          className={`absolute top-1/2 -translate-y-1/2 h-1 rounded-full ${accentBg}`}
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />
        <input
          type="range"
          min={0}
          max={maxVal}
          step={1}
          value={startSeconds}
          onChange={e => {
            const val = parseInt(e.target.value);
            const maxAllowed = effectiveEnd > 0 ? effectiveEnd - 1 : maxVal;
            if (val <= maxAllowed) onChange(val, endSeconds);
          }}
          className="absolute inset-0 opacity-0 pointer-events-none"
          tabIndex={-1}
          aria-label={t('fmtTrimStartAria')}
        />
        <input
          type="range"
          min={0}
          max={maxVal}
          step={1}
          value={effectiveEnd}
          onChange={e => {
            const val = parseInt(e.target.value);
            const minAllowed = startSeconds + 1;
            if (val >= minAllowed) onChange(startSeconds, val >= durationSeconds ? 0 : val);
          }}
          className="absolute inset-0 opacity-0 pointer-events-none"
          tabIndex={-1}
          aria-label={t('fmtTrimEndAria')}
        />
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); setDragging('start'); }}
          onTouchStart={e => { setDragging('start'); }}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(0, startSeconds - 1), endSeconds); }
            if (e.key === 'ArrowRight') { e.preventDefault(); const maxAllowed = effectiveEnd > 0 ? effectiveEnd - 1 : maxVal; if (startSeconds + 1 <= maxAllowed) onChange(startSeconds + 1, endSeconds); }
          }}
          className="absolute top-1/2 w-4 h-4 rounded-full bg-white border-2 border-zinc-300 shadow-lg transition-transform hover:scale-125 active:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
          style={{ left: `${startPct}%`, transform: 'translate(-50%, -50%)', zIndex: 4 }}
          aria-label={t('fmtTrimStartAria')}
          aria-valuemin={0}
          aria-valuemax={maxVal}
          aria-valuenow={startSeconds}
          tabIndex={0}
        />
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); setDragging('end'); }}
          onTouchStart={e => { setDragging('end'); }}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); const minAllowed = startSeconds + 1; if (effectiveEnd - 1 >= minAllowed) onChange(startSeconds, effectiveEnd - 1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); if (effectiveEnd < maxVal) onChange(startSeconds, effectiveEnd + 1 >= durationSeconds ? 0 : effectiveEnd + 1); }
          }}
          className="absolute top-1/2 w-4 h-4 rounded-full bg-white border-2 border-zinc-300 shadow-lg transition-transform hover:scale-125 active:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
          style={{ left: `${endPct}%`, transform: 'translate(-50%, -50%)', zIndex: 4 }}
          aria-label={t('fmtTrimEndAria')}
          aria-valuemin={0}
          aria-valuemax={maxVal}
          aria-valuenow={effectiveEnd}
          tabIndex={0}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputStart}
          onFocus={() => setInputFocused('start')}
          onBlur={e => commitInput('start', e.target.value)}
          onChange={e => setInputStart(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="w-16 px-2 py-1.5 rounded-lg lf-surface lf-border fs-sm font-mono text-white text-center placeholder-zinc-600 focus:outline-none focus:border-white/15"
          placeholder="00:00"
        />
        <span className="lf-text-faint text-xs">-</span>
        <input
          type="text"
          value={inputEnd}
          onFocus={() => setInputFocused('end')}
          onBlur={e => commitInput('end', e.target.value)}
          onChange={e => setInputEnd(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="w-16 px-2 py-1.5 rounded-lg lf-surface lf-border fs-sm font-mono text-white text-center placeholder-zinc-600 focus:outline-none focus:border-white/15"
          placeholder={t('fmtEndWord')}
        />
        {cutDuration > 0 && (
          <span className="ml-auto fs-sm lf-text-muted font-mono">
            {formatTime(cutDuration)}
          </span>
        )}
      </div>
    </div>
  );
}

export interface AccordionSectionProps {
  title: string;
  blockId: BlockId;
  isOpen: boolean;
  onToggle: () => void;
  accentBg: string;
  children: React.ReactNode;
}

export const AccordionSection = React.memo<AccordionSectionProps>(({ title, blockId, isOpen, onToggle, accentBg, children }) => (
  <div className="rounded-xl lf-surface-50 border-[0.5px] lf-border-strong glass-section">
    <button
      onClick={onToggle}
      className="acc-head w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex items-center gap-3">
        <BlockIcon blockId={blockId} />
        <BlockTitle>{title}</BlockTitle>
      </div>
      <div
        style={{ transform: `rotate(${isOpen ? 180 : 0}deg)`, transition: 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)' }}
      >
        <ChevronDown size={14} className="lf-text-muted" />
      </div>
    </button>
    <AnimatedAccordion isOpen={isOpen}>
      {children}
    </AnimatedAccordion>
  </div>
));
AccordionSection.displayName = 'AccordionSection';

export const Btn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }> = ({ active, onClick, children, className = '', disabled = false }) => {
  const baseClasses = 'lf-opt relative !overflow-visible rounded-xl px-3 py-1.5 fs-sm font-bold transition-all text-center cursor-pointer';
  const stateClasses = active ? 'z-10 active' : 'z-0';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '';

  return (
    <AnimatedButton
      onClick={onClick}
      disabled={disabled}
      tapScale={0.97}
      className={[baseClasses, stateClasses, disabledClasses, className].filter(Boolean).join(' ')}
    >
    {active && (
      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      </span>
    )}
    {children}
  </AnimatedButton>
  );
};
Btn.displayName = 'Btn';

export const ToggleRow: React.FC<{ value: boolean; onChange: () => void; label: string; desc?: string; icon?: React.ReactNode }> = ({ value, onChange, label, desc, icon }) => {
  const { settings } = useApp();
  return (
    <div className="flex items-center justify-between p-3 rounded-xl lf-surface-40 lf-border">
      <div className="flex items-center gap-2">
        {icon && <span className="lf-text-secondary">{icon}</span>}
        <div>
          <p className="fs-sm font-semibold text-white">{label}</p>
          {desc && <p className="fs-sm lf-text-muted mt-0.5">{desc}</p>}
        </div>
      </div>
      <Toggle value={value} onChange={onChange} settings={settings} />
    </div>
  );
};
ToggleRow.displayName = 'ToggleRow';

export const SmallToggle: React.FC<{ value: boolean; onChange: () => void; label: string }> = ({ value, onChange, label }) => {
  const { settings } = useApp();
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg lf-surface-30 lf-border">
      <label className="fs-sm lf-text-secondary">{label}</label>
      <Toggle value={value} onChange={onChange} settings={settings} />
    </div>
  );
};
SmallToggle.displayName = 'SmallToggle';

export const TooltipWrapper: React.FC<{ tip: string; children: React.ReactNode }> = ({ tip, children }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <AnimatedList>
        {isHovered && (
          <AnimatedCard
            variant={scaleIn}
            transition={transitions.tooltip}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg lf-surface-raised lf-border-strong fs-sm lf-text-secondary whitespace-nowrap z-[100] shadow-2xl pointer-events-none"
          >
            {tip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
          </AnimatedCard>
        )}
      </AnimatedList>
    </div>
  );
};
TooltipWrapper.displayName = 'TooltipWrapper';
