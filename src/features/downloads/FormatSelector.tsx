import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MediaInfo, MediaFormat } from '../../types';
import { getAccentBgClass, getAccentTextClass, getAccentBorderClass, getAccentTextOnBgClass } from '../../components/ThemeWrapper';
import { BlockIcon, BlockTitle, BlockId } from '../../components/BlockIcon';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const isWebMode = typeof window !== 'undefined' && !window.electron;

const DesktopOnlyTag: React.FC = () => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-800 text-zinc-500 border border-zinc-700">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    Desktop
  </span>
);

interface FormatSelectorProps {
  mediaInfo: MediaInfo;
  onFormatSelect: (options: FormatOptions) => void;
  onFormatChange?: (format: MediaFormat) => void;
  formatOptions?: FormatOptions;
}

export interface FormatOptions {
  format?: string;
  audioOnly: boolean;
  audioFormat: string;
  audioQuality: string;
  writeSubs: boolean;
  writeAutoSubs: boolean;
  subLangs: string;
  subFormat: string;
  embedSubs: boolean;
  writeThumbnail: boolean;
  embedThumbnail: boolean;
  embedMetadata: boolean;
  concurrentFragments?: number;
  retries?: number;
  restrictFilenames?: boolean;
  noOverwrites?: boolean;
  keepVideo?: boolean;
  videoOnly?: boolean;
  downloadSections?: string;
  sponsorblockRemove?: string;
  fpsMax?: number;
  bandLimit?: number; // KB/s, 0 = unlimited
  videoCodec?: string; // '', 'h264', 'h265', 'vp9', 'av01'
  customFilename?: string;
}

const VIDEO_PRESETS = [
  { id: 'best', label: 'Melhor', height: Infinity, format: 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b' },
  { id: '2160p', label: '4K', height: 2160, format: 'bv*[height<=2160][ext=mp4]+ba[ext=m4a]/b[height<=2160]' },
  { id: '1440p', label: '1440p', height: 1440, format: 'bv*[height<=1440][ext=mp4]+ba[ext=m4a]/b[height<=1440]' },
  { id: '1080p', label: '1080p', height: 1080, format: 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]' },
  { id: '720p', label: '720p', height: 720, format: 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]' },
  { id: '480p', label: '480p', height: 480, format: 'bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480]' },
  { id: '360p', label: '360p', height: 360, format: 'bv*[height<=360][ext=mp4]+ba[ext=m4a]/b[height<=360]' },
] as const;

const VIDEO_FORMATS = ['mp4', 'mkv', 'webm', 'avi', 'flv', 'mov', 'ts'] as const;
const VIDEO_CODECS = [
  { id: '', label: 'Auto' },
  { id: 'h264', label: 'H.264' },
  { id: 'h265', label: 'H.265' },
  { id: 'vp9', label: 'VP9' },
  { id: 'av01', label: 'AV1' },
] as const;
const AUDIO_FORMATS = [
  { id: 'mp3', label: 'MP3' },
  { id: 'aac', label: 'AAC' },
  { id: 'm4a', label: 'M4A' },
  { id: 'flac', label: 'FLAC' },
  { id: 'opus', label: 'OPUS' },
  { id: 'wav', label: 'WAV' },
] as const;
const AUDIO_QUALITY_PRESETS = [
  { value: '0', label: 'Melhor', desc: 'Qualidade maxima' },
  { value: '3', label: '320', desc: 'kbps' },
  { value: '4', label: '256', desc: 'kbps' },
  { value: '5', label: '192', desc: 'kbps' },
  { value: '7', label: '128', desc: 'kbps' },
  { value: '9', label: '64', desc: 'kbps' },
] as const;
const SUB_FORMATS = ['srt', 'ass', 'vtt'] as const;
const SUB_LANGS = [
  { id: 'pt', label: 'PT' },
  { id: 'en', label: 'EN' },
  { id: 'es', label: 'ES' },
  { id: 'pt,en', label: 'PT+EN' },
  { id: 'all', label: 'Todos' },
] as const;

type TabId = 'media' | 'advanced';

function getMaxVideoHeight(formats: MediaInfo['formats']): number {
  let maxH = 0;
  for (const f of formats) {
    if (f.type === 'video' || f.type === 'image') {
      const m = f.quality.match(/(\d+)/);
      if (m) {
        const h = parseInt(m[1], 10);
        if (h > maxH) maxH = h;
      }
    }
  }
  return maxH;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function parseTimeInput(text: string): number | null {
  const cleaned = text.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2 && parts[0] >= 0 && parts[1] >= 0 && parts[1] < 60) return parts[0] * 60 + parts[1];
  return null;
}

interface TimeRangeSliderProps {
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
  accentBg: string;
  onChange: (start: number, end: number) => void;
}

function TimeRangeSlider({ durationSeconds, startSeconds, endSeconds, accentBg, onChange }: TimeRangeSliderProps) {
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
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-zinc-800" />
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
          aria-label="Início do recorte"
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
          aria-label="Fim do recorte"
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
          aria-label="Início do recorte"
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
          aria-label="Fim do recorte"
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
          className="w-16 px-2 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-[11px] font-mono text-white text-center placeholder-zinc-600 focus:outline-none focus:border-white/15"
          placeholder="00:00"
        />
        <span className="text-zinc-600 text-xs">-</span>
        <input
          type="text"
          value={inputEnd}
          onFocus={() => setInputFocused('end')}
          onBlur={e => commitInput('end', e.target.value)}
          onChange={e => setInputEnd(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="w-16 px-2 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-[11px] font-mono text-white text-center placeholder-zinc-600 focus:outline-none focus:border-white/15"
          placeholder="fim"
        />
        {cutDuration > 0 && (
          <span className="ml-auto text-[10px] text-zinc-500 font-mono">
            {formatTime(cutDuration)}
          </span>
        )}
      </div>
    </div>
  );
}

export function FormatSelector({ mediaInfo, onFormatSelect, onFormatChange }: FormatSelectorProps) {
  const { settings, updateSettings } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('media');
  const [showSubs, setShowSubs] = useState(false);
  const [showCustomFormat, setShowCustomFormat] = useState(false);

  const maxRes = useMemo(() => getMaxVideoHeight(mediaInfo.formats), [mediaInfo.formats]);

  const [options, setOptions] = useState<FormatOptions>({
    format: VIDEO_PRESETS[0].format,
    audioOnly: false,
    audioFormat: 'mp3',
    audioQuality: '0',
    writeSubs: false,
    writeAutoSubs: false,
    subLangs: 'en',
    subFormat: 'srt',
    embedSubs: false,
    writeThumbnail: false,
    embedThumbnail: false,
    embedMetadata: true,
    concurrentFragments: 1,
    retries: 3,
    restrictFilenames: false,
    noOverwrites: false,
    keepVideo: false,
    videoOnly: false,
    sponsorblockRemove: '',
    fpsMax: 0,
    bandLimit: 0,
    videoCodec: '',
    customFilename: '',
  });

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const findMatchingFormat = useCallback((): MediaFormat | null => {
    const formats = mediaInfo.formats;
    if (!formats.length) return null;

    if (options.audioOnly) {
      const audioFormats = formats.filter(f => f.type === 'audio');
      if (audioFormats.length) {
        const preferred = audioFormats.find(f => f.ext === options.audioFormat);
        return preferred || audioFormats.reduce((best, f) => (f.sizeBytes > best.sizeBytes ? f : best), audioFormats[0]);
      }
      return formats[0];
    }

    const targetHeight = VIDEO_PRESETS.find(p => p.format === options.format)?.height;
    if (targetHeight && targetHeight !== Infinity) {
      const videoFormats = formats.filter(f => f.type === 'video');
      const matching = videoFormats
        .filter(f => {
          const m = f.quality.match(/(\d+)/);
          return m && parseInt(m[1], 10) <= targetHeight;
        })
        .sort((a, b) => {
          const ha = a.quality.match(/(\d+)/)?.[1] || '0';
          const hb = b.quality.match(/(\d+)/)?.[1] || '0';
          return parseInt(hb, 10) - parseInt(ha, 10);
        });
      if (matching.length) return matching[0];
      if (videoFormats.length) return videoFormats.sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
    }

    const videoFormats = formats.filter(f => f.type === 'video');
    if (videoFormats.length) return videoFormats.sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
    return formats[0];
  }, [mediaInfo.formats, options.format, options.audioOnly, options.audioFormat]);

  useEffect(() => {
    if (onFormatChange) {
      const fmt = findMatchingFormat();
      if (fmt) onFormatChange(fmt);
    }
  }, [onFormatChange, findMatchingFormat]);

  const update = useCallback((partial: Partial<FormatOptions>) => {
    setOptions(prev => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    onFormatSelect(options);
  }, [options, onFormatSelect]);

  useEffect(() => {
    if (trimStart === 0 && trimEnd === 0) {
      update({ downloadSections: '' });
    } else {
      const start = formatTime(trimStart);
      const end = trimEnd > 0 ? formatTime(trimEnd) : '';
      update({ downloadSections: `*${start}-${end}` });
    }
  }, [trimStart, trimEnd, update]);

  const accentBg = getAccentBgClass(settings).split(' ')[0];
  const accentText = getAccentTextClass(settings);
  const accentBorder = getAccentBorderClass(settings).split(' ')[0];
  const accentTextOnBg = getAccentTextOnBgClass(settings);

  const isImage = mediaInfo.type === 'image';

  if (isImage) {
    const imageFormats = mediaInfo.formats.filter(f => f.type === 'image');
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/40 border border-white/5">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 bg-zinc-950 shrink-0">
            <img src={mediaInfo.thumbnailUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-white truncate">{mediaInfo.title}</p>
            <p className="text-[10px] text-zinc-500 font-mono">{mediaInfo.resolution || 'Imagem'}{mediaInfo.sizeEst !== 'N/A' ? ` • ${mediaInfo.sizeEst}` : ''}</p>
          </div>
        </div>

        {imageFormats.length > 0 && (
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
            <div className="flex items-center gap-2">
              <BlockIcon blockId="resolution" />
              <BlockTitle>{settings.language === 'en' ? 'Format' : 'Formato'}</BlockTitle>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {imageFormats.map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => {
                    setOptions(prev => ({ ...prev, format: fmt.id }));
                  }}
                  className={`
                    border rounded-lg text-[11px] font-bold transition-all text-center py-2.5
                    ${options.format === fmt.id
                      ? `${accentBg} text-white ${accentBorder}`
                      : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}
                  `}
                >
                  {fmt.quality}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const selectedPreset = VIDEO_PRESETS.find(p => p.format === options.format && !options.audioOnly);
  const isOverMaxRes = selectedPreset && selectedPreset.height !== Infinity && maxRes > 0 && selectedPreset.height > maxRes;

  const Toggle: React.FC<{ value: boolean; onChange: () => void; label: string; desc?: string; icon?: React.ReactNode }> = ({ value, onChange, label, desc, icon }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-white/5">
      <div className="flex items-center gap-2">
        {icon && <span className="text-zinc-400">{icon}</span>}
        <div>
          <p className="text-xs font-semibold text-white">{label}</p>
          {desc && <p className="text-[10px] text-zinc-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      <button onClick={onChange} className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? accentBg : 'bg-zinc-700'}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-md ${value ? 'left-[26px]' : 'left-1'}`} />
      </button>
    </div>
  );

  const SmallToggle: React.FC<{ value: boolean; onChange: () => void; label: string }> = ({ value, onChange, label }) => (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/30 border border-white/5">
      <label className="text-[11px] text-zinc-400">{label}</label>
      <button onClick={onChange} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${value ? accentBg : 'bg-zinc-800'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );

  const Btn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean }> = ({ active, onClick, children, className = '', disabled = false }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        border rounded-lg text-[11px] font-bold transition-all text-center
        ${disabled ? 'bg-zinc-900/20 border-white/5 text-zinc-600 cursor-not-allowed' :
          active ? `${accentBg} text-white ${accentBorder}` : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}
        ${className}
      `}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 rounded-xl bg-zinc-900/60 border border-white/5">
        {([
          { id: 'media' as TabId, blockId: 'video-format' as BlockId, label: 'Mídia' },
          { id: 'advanced' as TabId, blockId: 'behavior' as BlockId, label: 'Avançado' },
        ]).map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${isActive ? `${accentBg} ${accentTextOnBg} shadow-lg` : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
            >
              <BlockIcon blockId={tab.blockId} size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/40 border border-white/5">
        <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/5 bg-zinc-950 shrink-0">
          <img src={mediaInfo.thumbnailUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-white truncate">{mediaInfo.title}</p>
          <p className="text-[10px] text-zinc-500 font-mono">{mediaInfo.formats.length} formatos{mediaInfo.duration ? ` • ${mediaInfo.duration}` : ''}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'media' && (
          <motion.div key="media" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-3">

            {/* ── Nome do Arquivo + Nome Limpo ── */}
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
              <div className="flex items-center gap-2">
                <BlockIcon blockId="behavior" />
                <BlockTitle>Nome do Arquivo</BlockTitle>
              </div>
              <input
                type="text"
                value={options.customFilename || ''}
                onChange={e => update({ customFilename: e.target.value })}
                placeholder="Se vazio, usa o titulo original do video"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800/60 border border-white/5 text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-white/15 transition-colors"
              />
              <div className="flex items-center justify-end gap-2.5 p-2.5 rounded-lg bg-zinc-900/30 border border-white/5">
                <label className="text-[11px] text-zinc-400">Nome limpo (sem caracteres especiais)</label>
                <button onClick={() => update({ restrictFilenames: !options.restrictFilenames })} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${options.restrictFilenames ? accentBg : 'bg-zinc-800'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${options.restrictFilenames ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {/* ── Resolução ── */}
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
              <div className="flex items-center gap-2">
                <BlockIcon blockId="resolution" />
                <BlockTitle>Resolucao</BlockTitle>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {VIDEO_PRESETS.map(preset => {
                  const unavailable = preset.height !== Infinity && maxRes > 0 && preset.height > maxRes;
                  return (
                    <Btn
                      key={preset.id}
                      active={options.format === preset.format && !options.audioOnly}
                      onClick={() => update({ format: preset.format, audioOnly: false })}
                      disabled={unavailable}
                      className="py-2.5"
                    >
                      {preset.label}
                    </Btn>
                  );
                })}
              </div>
              {maxRes > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/30 border border-white/5">
                  <Info size={12} className="text-zinc-500 shrink-0" />
                  <p className="text-[10px] text-zinc-400">
                    {settings.language === 'en'
                      ? `This video is available up to ${maxRes}p. Higher presets will download at the maximum available quality.`
                      : `Este video esta disponivel ate ${maxRes}p. Presets maiores serao baixados na maxima qualidade disponivel.`}
                  </p>
                </div>
              )}
            </div>

            {/* ── Formato Video + Codecs | Legendas + Audio (2 colunas) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Coluna esquerda: Formato do Video + Codecs */}
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2">
                  <BlockIcon blockId="video-format" />
                  <BlockTitle>Formato do Video</BlockTitle>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {VIDEO_FORMATS.map(fmt => (
                    <Btn
                      key={fmt}
                      active={!options.audioOnly && (options.format || '').includes(`[ext=${fmt}]`)}
                      onClick={() => {
                        if (options.audioOnly) return;
                        const current = VIDEO_PRESETS.find(p => p.format === options.format);
                        const base = current ? current.format : VIDEO_PRESETS[0].format;
                        update({ format: base.replace(/\[ext=\w+\]/g, `[ext=${fmt}]`).replace(/ba\[ext=\w+\]/g, `ba[ext=${fmt}]`) });
                      }}
                      className="py-2"
                    >
                      {fmt.toUpperCase()}
                    </Btn>
                  ))}
                </div>
                <div className="border-t border-white/5 pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <BlockIcon blockId="custom-format" />
                    <BlockTitle>Codec de Video</BlockTitle>
                  </div>
                  <div className="flex gap-1.5">
                    {VIDEO_CODECS.map(codec => (
                      <Btn
                        key={codec.id}
                        active={options.videoCodec === codec.id}
                        onClick={() => {
                          const codecVal = codec.id;
                          update({ videoCodec: codecVal });
                          if (!options.audioOnly && options.format) {
                            let fmt = options.format;
                            fmt = fmt.replace(/\[vcodec~?[^]]*\]/g, '');
                            if (codecVal) {
                              fmt = fmt.replace(/bv\*\[/g, `bv*[vcodec~=${codecVal}][`);
                            }
                            update({ format: fmt });
                          }
                        }}
                        className="py-2 flex-1"
                      >
                        {codec.label}
                      </Btn>
                    ))}
                  </div>
                </div>
              </div>

              {/* Coluna direita: Legendas + Extrair apenas audio */}
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-3">
                <div className="flex items-center gap-2">
                  <BlockIcon blockId="subtitles" />
                  <BlockTitle>Legendas</BlockTitle>
                </div>
                <Toggle
                  value={showSubs}
                  onChange={() => {
                    const next = !showSubs;
                    setShowSubs(next);
                    if (next) update({ writeSubs: true });
                    else update({ writeSubs: false, writeAutoSubs: false, embedSubs: false });
                  }}
                  label="Baixar legendas"
                  desc="Baixar e opcionalmente embutir"
                />
                {showSubs && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-3 pl-2 border-l-2 border-zinc-800">
                    <SmallToggle value={options.writeAutoSubs} onChange={() => update({ writeAutoSubs: !options.writeAutoSubs })} label="Legendas automaticas" />
                    <div className="space-y-1.5">
                      <BlockTitle>Idioma</BlockTitle>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                        {SUB_LANGS.map(lang => (
                          <Btn key={lang.id} active={options.subLangs === lang.id} onClick={() => update({ subLangs: lang.id })} className="py-2">
                            {lang.label}
                          </Btn>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <BlockTitle>Formato</BlockTitle>
                      <div className="flex gap-1.5">
                        {SUB_FORMATS.map(fmt => (
                          <Btn key={fmt} active={options.subFormat === fmt} onClick={() => update({ subFormat: fmt })} className="py-2 flex-1">
                            {fmt.toUpperCase()}
                          </Btn>
                        ))}
                      </div>
                    </div>
                    <div className={`${isWebMode ? 'opacity-40 pointer-events-none' : ''}`}>
                      <SmallToggle value={options.embedSubs} onChange={() => update({ embedSubs: !options.embedSubs })} label="Embutir no video" />
                      {isWebMode && <div className="mt-1"><DesktopOnlyTag /></div>}
                    </div>
                  </motion.div>
                )}
                <div className="border-t border-white/5 pt-2">
                  <Toggle
                    value={options.audioOnly}
                    onChange={() => update({ audioOnly: !options.audioOnly })}
                    label="Extrair apenas audio"
                    desc="Baixar somente a faixa de audio"
                    icon={<BlockIcon blockId="audio-extract" />}
                  />
                </div>
              </div>
            </div>

            {/* ── Formato + Qualidade do Áudio (2 colunas) ── */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${options.audioOnly ? '' : 'opacity-60'}`}>
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <BlockIcon blockId="audio-format" />
                  <BlockTitle>Formato do Audio</BlockTitle>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {AUDIO_FORMATS.map(fmt => (
                    <Btn key={fmt.id} active={options.audioFormat === fmt.id} onClick={() => update({ audioFormat: fmt.id })} className="py-2">
                      {fmt.label}
                    </Btn>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <BlockIcon blockId="audio-quality" />
                  <BlockTitle>Qualidade do Audio</BlockTitle>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {AUDIO_QUALITY_PRESETS.map(q => (
                    <Btn key={q.value} active={options.audioQuality === q.value} onClick={() => update({ audioQuality: q.value })} className="py-2">
                      {q.label}
                    </Btn>
                  ))}
                </div>
                {!options.audioOnly && (
                  <p className="text-[9px] text-zinc-600 italic">* Aplicavel apenas quando "Extrair apenas audio" esta ligado</p>
                )}
              </div>
            </div>

            {/* ── Formato customizado ── */}
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
              <button onClick={() => setShowCustomFormat(!showCustomFormat)} className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
                {showCustomFormat ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Formato customizado (yt-dlp)
              </button>
              {showCustomFormat && (
                <input
                  type="text"
                  value={options.format || ''}
                  onChange={e => update({ format: e.target.value })}
                  placeholder="bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white/15"
                />
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'advanced' && (
          <motion.div key="advanced" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-3">

            {/* ── Recorte de tempo ── */}
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
              <div className="flex items-center gap-2">
                <BlockIcon blockId="trim" />
                <BlockTitle>Recortar video</BlockTitle>
              </div>
              {mediaInfo.durationSeconds > 0 ? (
                <TimeRangeSlider
                  durationSeconds={mediaInfo.durationSeconds}
                  startSeconds={trimStart}
                  endSeconds={trimEnd}
                  accentBg={accentBg}
                  onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); }}
                />
              ) : (
                <>
                  <p className="text-[10px] text-zinc-600">Baixar apenas um trecho. Formato: MM:SS ou HH:MM:SS</p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Inicio (00:00)"
                      onChange={e => {
                        const end = (e.target.closest('.space-y-4')?.querySelector('input[placeholder*="Fim"]') as HTMLInputElement)?.value || '';
                        const val = e.target.value.trim();
                        if (val && end) update({ downloadSections: `*${val}-${end}` });
                        else if (val) update({ downloadSections: `*${val}-` });
                        else update({ downloadSections: end ? `*-${end}` : '' });
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-white/5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white/15"
                    />
                    <span className="text-zinc-600 text-xs">-</span>
                    <input
                      type="text"
                      placeholder="Fim (fim)"
                      onChange={e => {
                        const start = (e.target.closest('.space-y-4')?.querySelector('input[placeholder*="Inicio"]') as HTMLInputElement)?.value || '';
                        const val = e.target.value.trim();
                        if (start && val) update({ downloadSections: `*${start}-${val}` });
                        else if (val) update({ downloadSections: `*-${val}` });
                        else update({ downloadSections: start ? `*${start}-` : '' });
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-white/5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white/15"
                    />
                  </div>
                </>
              )}
            </div>

            {/* ── Modo de Saída + FPS (2 colunas) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <BlockIcon blockId="output-mode" />
                  <BlockTitle>Modo de saida</BlockTitle>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Btn active={!options.videoOnly && !options.audioOnly} onClick={() => update({ videoOnly: false, audioOnly: false })} className="py-2.5">
                    Video + Audio
                  </Btn>
                  <Btn active={!!options.videoOnly} onClick={() => update({ videoOnly: !options.videoOnly, audioOnly: false })} className="py-2.5">
                    So Video
                  </Btn>
                  <Btn active={!!options.audioOnly} onClick={() => update({ audioOnly: !options.audioOnly, videoOnly: false })} className="py-2.5">
                    So Audio
                  </Btn>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <BlockIcon blockId="fps" />
                  <BlockTitle>FPS Maximo</BlockTitle>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[0, 24, 30, 60, 120].map(fps => (
                    <Btn key={fps} active={options.fpsMax === fps} onClick={() => update({ fpsMax: fps })} className="py-2 flex-1">
                      {fps === 0 ? 'Auto' : `${fps}`}
                    </Btn>
                  ))}
                </div>
              </div>
            </div>

            {/* ── SponsorBlock ── */}
            <div className={`p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2 ${isWebMode ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2">
                <BlockIcon blockId="sponsorblock" />
                <BlockTitle>SponsorBlock</BlockTitle>
                {isWebMode && <DesktopOnlyTag />}
              </div>
              <p className="text-[10px] text-zinc-600">Remover automaticamente partes indesejadas do video</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: '', label: 'Desligado' },
                  { id: 'sponsor', label: 'Sponsors' },
                  { id: 'intro,outro,preview', label: 'Intro/Outro' },
                  { id: 'all', label: 'Remover Tudo' },
                ].map(opt => (
                  <Btn key={opt.id} active={options.sponsorblockRemove === opt.id} onClick={() => update({ sponsorblockRemove: opt.id })} className="py-2">
                    {opt.label}
                  </Btn>
                ))}
              </div>
            </div>

            {/* ── Metadados + Thumbnail (2 colunas) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Toggle value={options.embedMetadata} onChange={() => update({ embedMetadata: !options.embedMetadata })} label="Metadados" desc="Incorporar titulo, autor e outros dados" icon={<BlockIcon blockId="metadata" />} />
              <div>
                <Toggle value={!!options.writeThumbnail} onChange={() => update({ writeThumbnail: !options.writeThumbnail })} label="Thumbnail" desc="Salvar imagem da miniatura" icon={<BlockIcon blockId="thumbnail" />} />
                {options.writeThumbnail && (
                  <div className={`mt-2 ${isWebMode ? 'opacity-40 pointer-events-none' : ''}`}>
                    <SmallToggle value={!!options.embedThumbnail} onChange={() => update({ embedThumbnail: !options.embedThumbnail })} label="Incorporar thumbnail" />
                    {isWebMode && <div className="mt-1"><DesktopOnlyTag /></div>}
                  </div>
                )}
              </div>
            </div>

            {/* ── Comportamento + Limite de Velocidade (2 colunas) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <BlockIcon blockId="speed-limit" />
                  <BlockTitle>Limite de Velocidade</BlockTitle>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 512, 1024, 5120, 10240, 25600, 51200].map(kbps => (
                    <Btn
                      key={kbps}
                      active={options.bandLimit === kbps}
                      onClick={() => update({ bandLimit: kbps })}
                      className="py-2 flex-1 text-[10px] min-w-[80px]"
                    >
                    {kbps === 0 ? 'Sem limite' : kbps >= 1024 ? `${kbps / 1024}MB/s` : `${kbps}KB/s`}
                  </Btn>
                ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <BlockIcon blockId="behavior" />
                  <BlockTitle>Comportamento</BlockTitle>
                </div>
                <div className="space-y-1.5">
                  <SmallToggle value={!!options.noOverwrites} onChange={() => update({ noOverwrites: !options.noOverwrites })} label="Nao sobrescrever arquivos existentes" />
                  <SmallToggle value={!!options.keepVideo} onChange={() => update({ keepVideo: !options.keepVideo })} label="Manter video apos extrair audio" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
