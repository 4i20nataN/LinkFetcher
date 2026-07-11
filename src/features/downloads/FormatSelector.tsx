import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../core/i18n';
import { MediaInfo } from '../../types';
import { getAccentBgClass, getAccentTextClass, getAccentBorderClass } from '../../components/ThemeWrapper';
import { motion, AnimatePresence } from 'motion/react';
import { Settings2, ChevronDown, Check } from 'lucide-react';

interface FormatSelectorProps {
  mediaInfo: MediaInfo;
  onFormatSelect: (options: FormatOptions) => void;
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
}

const AUDIO_FORMATS = ['mp3', 'aac', 'flac', 'm4a', 'opus', 'wav'] as const;
const SUB_FORMATS = ['srt', 'ass', 'vtt'] as const;

const PRESETS = {
  best: 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b',
  '720p': 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]',
  '480p': 'bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480]',
} as const;

export function FormatSelector({ mediaInfo, onFormatSelect }: FormatSelectorProps) {
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('best');
  const [options, setOptions] = useState<FormatOptions>({
    format: PRESETS.best,
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
  });

  const handlePreset = (preset: string) => {
    setActivePreset(preset);
    if (preset === 'audio') {
      setOptions({ ...options, format: undefined, audioOnly: true });
    } else {
      setOptions({ ...options, format: PRESETS[preset as keyof typeof PRESETS], audioOnly: false });
    }
  };

  const handleApply = () => {
    onFormatSelect(options);
  };

  const update = (partial: Partial<FormatOptions>) => {
    setOptions({ ...options, ...partial });
    setActivePreset('');
  };

  const accentBg = getAccentBgClass(settings).split(' ')[0];
  const accentText = getAccentTextClass(settings);
  const accentBorder = getAccentBorderClass(settings).split(' ')[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className={`p-1.5 rounded-lg ${accentBg}`}>
          <Settings2 size={14} className={accentText} />
        </div>
        <h4 className="font-display font-bold text-sm text-white">{t('selectFormat')}</h4>
      </div>

      {/* Quality Presets */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'best', label: t('presetBest') },
          { id: '720p', label: '720p' },
          { id: '480p', label: '480p' },
          { id: 'audio', label: t('presetAudio') },
        ].map((preset) => {
          const isActive = activePreset === preset.id || (!activePreset && preset.id === 'best' && options.format === PRESETS.best);
          return (
            <button
              key={preset.id}
              onClick={() => handlePreset(preset.id)}
              className={`
                px-4 py-2 rounded-lg text-xs font-semibold transition-all border
                ${isActive
                  ? `${accentBg} ${accentText} ${accentBorder}`
                  : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800'
                }
              `}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Media Info Summary */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/40 border border-white/5">
        <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/5 bg-zinc-950 shrink-0">
          <img
            src={mediaInfo.thumbnailUrl}
            alt={mediaInfo.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">{mediaInfo.title}</p>
          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
            {mediaInfo.formats.length} {mediaInfo.formats.length === 1 ? 'format' : 'formats'} • {mediaInfo.duration}
          </p>
        </div>
      </div>

      {/* Advanced Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
      >
        <motion.div
          animate={{ rotate: showAdvanced ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={14} />
        </motion.div>
        {showAdvanced ? t('hideAdvanced') : t('showAdvanced')}
      </button>

      {/* Advanced Options */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-2">
              {/* Format String */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                  {t('formatString')}
                </label>
                <input
                  type="text"
                  value={options.format || ''}
                  onChange={(e) => update({ format: e.target.value })}
                  placeholder={t('formatStringPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white/15 transition-colors"
                />
              </div>

              {/* Audio Options */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                    {t('audioFormat')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {AUDIO_FORMATS.map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => update({ audioFormat: fmt })}
                        className={`
                          px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all border
                          ${options.audioFormat === fmt
                            ? `${accentBg} ${accentText} ${accentBorder}`
                            : 'bg-zinc-900/60 border-white/5 text-zinc-500 hover:text-zinc-300'
                          }
                        `}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide flex items-center justify-between">
                    <span>{t('audioQuality')}</span>
                    <span className="font-mono text-zinc-500">{options.audioQuality}/10</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={options.audioQuality}
                    onChange={(e) => update({ audioQuality: e.target.value })}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-zinc-400"
                  />
                </div>
              </div>

              {/* Subtitle Options */}
              <div className="space-y-3 p-3 rounded-xl bg-zinc-900/30 border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                    {t('downloadSubtitles')}
                  </label>
                  <button
                    onClick={() => update({ writeSubs: !options.writeSubs })}
                    className={`
                      relative w-9 h-5 rounded-full transition-colors
                      ${options.writeSubs ? accentBg : 'bg-zinc-800'}
                    `}
                  >
                    <div className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                      ${options.writeSubs ? 'left-[18px]' : 'left-0.5'}
                    `} />
                  </button>
                </div>

                <AnimatePresence>
                  {options.writeSubs && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-zinc-500">{t('autoGenerated')}</label>
                        <button
                          onClick={() => update({ writeAutoSubs: !options.writeAutoSubs })}
                          className={`
                            relative w-9 h-5 rounded-full transition-colors
                            ${options.writeAutoSubs ? accentBg : 'bg-zinc-800'}
                          `}
                        >
                          <div className={`
                            absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                            ${options.writeAutoSubs ? 'left-[18px]' : 'left-0.5'}
                          `} />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-zinc-500">{t('subtitleLanguages')}</label>
                        <input
                          type="text"
                          value={options.subLangs}
                          onChange={(e) => update({ subLangs: e.target.value })}
                          placeholder={t('subtitleLanguagesPlaceholder')}
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-white/15 transition-colors"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-zinc-500">{t('subtitleFormat')}</label>
                        <div className="flex gap-1.5">
                          {SUB_FORMATS.map((fmt) => (
                            <button
                              key={fmt}
                              onClick={() => update({ subFormat: fmt })}
                              className={`
                                px-3 py-1 rounded-md text-[11px] font-semibold transition-all border
                                ${options.subFormat === fmt
                                  ? `${accentBg} ${accentText} ${accentBorder}`
                                  : 'bg-zinc-900/60 border-white/5 text-zinc-500 hover:text-zinc-300'
                                }
                              `}
                            >
                              {fmt.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-zinc-500">{t('embedSubs')}</label>
                        <button
                          onClick={() => update({ embedSubs: !options.embedSubs })}
                          className={`
                            relative w-9 h-5 rounded-full transition-colors
                            ${options.embedSubs ? accentBg : 'bg-zinc-800'}
                          `}
                        >
                          <div className={`
                            absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                            ${options.embedSubs ? 'left-[18px]' : 'left-0.5'}
                          `} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Thumbnail Options */}
              <div className="space-y-3 p-3 rounded-xl bg-zinc-900/30 border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                    {t('downloadThumbnail')}
                  </label>
                  <button
                    onClick={() => update({ writeThumbnail: !options.writeThumbnail })}
                    className={`
                      relative w-9 h-5 rounded-full transition-colors
                      ${options.writeThumbnail ? accentBg : 'bg-zinc-800'}
                    `}
                  >
                    <div className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                      ${options.writeThumbnail ? 'left-[18px]' : 'left-0.5'}
                    `} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-zinc-500">{t('embedThumbnail')}</label>
                  <button
                    onClick={() => update({ embedThumbnail: !options.embedThumbnail })}
                    className={`
                      relative w-9 h-5 rounded-full transition-colors
                      ${options.embedThumbnail ? accentBg : 'bg-zinc-800'}
                    `}
                  >
                    <div className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                      ${options.embedThumbnail ? 'left-[18px]' : 'left-0.5'}
                    `} />
                  </button>
                </div>
              </div>

              {/* Metadata */}
              <div className="p-3 rounded-xl bg-zinc-900/30 border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
                    {t('embedMetadata')}
                  </label>
                  <button
                    onClick={() => update({ embedMetadata: !options.embedMetadata })}
                    className={`
                      relative w-9 h-5 rounded-full transition-colors
                      ${options.embedMetadata ? accentBg : 'bg-zinc-800'}
                    `}
                  >
                    <div className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                      ${options.embedMetadata ? 'left-[18px]' : 'left-0.5'}
                    `} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Apply Button */}
      <button
        onClick={handleApply}
        className={`
          w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all
          ${accentBg} hover:opacity-90 border ${accentBorder}
        `}
      >
        <span className="flex items-center justify-center gap-2">
          <Check size={14} />
          {t('applyFormat')}
        </span>
      </button>
    </div>
  );
}
