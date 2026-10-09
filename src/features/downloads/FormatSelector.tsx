import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation, type TranslationKey } from '../../core/i18n';
import { MediaInfo, MediaFormat } from '../../types';
import { getAccentBgClass, getAccentTextClass, getAccentBorderClass, getAccentTextOnBgClass } from '../../components/ThemeWrapper';
import { Toggle } from '../../components/Toggle';
import { BlockIcon, BlockTitle, BlockId } from '../../components/BlockIcon';
import { AnimatedCard } from '../../animation/AnimatedCard';
import { AnimatedList } from '../../animation/AnimatedList';
import { AnimatedAccordion } from '../../animation/AnimatedAccordion';
import { AnimatedButton } from '../../animation/AnimatedButton';
import { TabIndicator, LayoutGroup } from '../../animation/TabIndicator';
import { slideUp, scaleIn, transitions } from '../../animation/variants';
import { ChevronDown, ChevronUp, Info, ArrowDownToLine, AlertTriangle, FileText, Download, X, Subtitles, Music, Clapperboard } from 'lucide-react';
import { AUDIO_QUALITY_PRESETS } from './constants';

interface FormatSelectorProps {
  mediaInfo: MediaInfo;
  onFormatSelect: (options: FormatOptions) => void;
  onFormatChange?: (format: MediaFormat) => void;
  formatOptions?: FormatOptions;
  onQuickDownload?: (kind: 'audio' | 'video') => void;
}

import type { FormatOptions } from './FormatOptions';

import {
  VIDEO_PRESETS,
  VIDEO_FORMATS,
  VIDEO_CODECS,
  CODEC_FILTER,
  CODECS_FOR_CONTAINER,
  CONTAINERS_FOR_CODEC,
  AUDIO_FORMATS,
  SUB_FORMATS,
  CODEC_TIPS,
} from './format/formatData';
import {
  parseFormatHeight,
  getMaxVideoHeight,
  formatTime,
  fmtDate,
  fmtDuration,
  canEmbedThumbnail,
} from './format/formatUtils';
import {
  SubsPickerModal,
  TimeRangeSlider,
  AccordionSection,
} from './format/FormatWidgets';
import type { FormatSectionCtx } from './format/sectionCtx';
import {
  ResolutionSection,
  VideoFormatSection,
  AudioSection,
  DescriptionSection,
  SubtitlesSection,
  FilenameSection,
} from './format/MediaSections';
import {
  TrimSection,
  OutputSection,
  SponsorBlockSection,
  MetadataSection,
  BehaviorSection,
} from './format/AdvancedSections';

type TabId = 'media' | 'advanced';

export const FormatSelector = React.memo(function FormatSelector({ mediaInfo, onFormatSelect, onFormatChange, formatOptions, onQuickDownload }: FormatSelectorProps) {
  const { settings, updateSettings } = useApp();
  const { t } = useTranslation(settings);
  const [activeTab, setActiveTab] = useState<TabId>('media');
  // Refs dos inputs manuais de recorte: o pareamento start/end usava
  // querySelector no placeholder (quebrava ao traduzir). Refs são à prova.
  const trimStartRef = useRef<HTMLInputElement>(null);
  const trimEndRef = useRef<HTMLInputElement>(null);
  const [showSubs, setShowSubs] = useState(!!(formatOptions?.writeSubs || formatOptions?.writeAutoSubs));
  const [showSubsPicker, setShowSubsPicker] = useState(false);
  const [useUnderscore, setUseUnderscore] = useState(true);
  const [uiScale, setUiScale] = useState(50);
  const [descExpanded, setDescExpanded] = useState(false);

  const maxRes = useMemo(() => getMaxVideoHeight(mediaInfo.formats), [mediaInfo.formats]);

  const [options, setOptions] = useState<FormatOptions>(() => ({
    format: 'bestvideo+bestaudio/best',
    audioOnly: false,
    audioFormat: 'mp3',
    audioQuality: '0',
    writeSubs: false,
    writeAutoSubs: false,
    subLangs: '',
    subFormat: '',
    embedSubs: false,
    writeThumbnail: false,
    embedThumbnail: false,
    embedMetadata: false,
    // 8 fragmentos paralelos (padrão do yt-dlp é 1): satura melhor links
    // rápidos e dilui o throttle por conexão do YouTube (se 1 trava, as
    // outras 7 seguram o agregado). Moderado p/ não forçar 429 em IP
    // já limitado; limite de banda continua opt-in (bandLimit = 0).
    concurrentFragments: 8,
    retries: 0,
    restrictFilenames: false,
    noOverwrites: false,
    keepVideo: false,
    videoOnly: false,
    sponsorblockRemove: '',
    fpsMax: 0,
    bandLimit: 0,
    videoCodec: '',
    customFilename: '',
    descFormat: 'none',
    ...formatOptions,
  }));

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

    const presetMatch = VIDEO_PRESETS.find(p => p.format === options.format);
    const heightFromFormat = options.format?.match(/height<=(\d+)/)?.[1];
    const targetHeight = presetMatch?.height ?? (heightFromFormat ? parseInt(heightFromFormat, 10) : undefined);
    if (targetHeight && targetHeight !== Infinity) {
      const videoFormats = formats.filter(f => f.type === 'video');
      const matching = videoFormats
        .filter(f => {
          const h = parseFormatHeight(f.quality);
          return h > 0 && h <= targetHeight;
        })
        .sort((a, b) => {
          const ha = parseFormatHeight(a.quality);
          const hb = parseFormatHeight(b.quality);
          if (hb !== ha) return hb - ha;
          return b.sizeBytes - a.sizeBytes;
        });
      if (matching.length) return matching[0];
      if (videoFormats.length) return videoFormats.sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
    }

    const videoFormats = formats.filter(f => f.type === 'video');
    if (videoFormats.length) return videoFormats.sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
    return formats[0];
  }, [mediaInfo.formats, options.format, options.audioOnly, options.audioFormat]);

  useEffect(() => {
    if (onFormatChange && mediaInfo.type !== 'image') {
      const fmt = findMatchingFormat();
      if (fmt) onFormatChange(fmt);
    }
  }, [onFormatChange, findMatchingFormat, mediaInfo.type]);

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

  // Altura-alvo do preset atual (para compatibilidade FPS × resolução)
  const selectedTargetHeight = useMemo(() => {
    const presetMatch = VIDEO_PRESETS.find(p => p.format === options.format);
    const heightFromFormat = options.format?.match(/height<=(\d+)/)?.[1];
    const h = presetMatch?.height ?? (heightFromFormat ? parseInt(heightFromFormat, 10) : undefined);
    return h && h !== Infinity ? h : undefined;
  }, [options.format]);

  // FPS disponível para a resolução selecionada: existe formato no teto da
  // resolução com esse fps (fps desconhecido conta como compatível).
  const isFpsAvailable = useCallback((fps: number): boolean => {
    if (fps === 0) return true;
    if (options.audioOnly) return true;
    if (selectedTargetHeight == null) return true;
    const pool = mediaInfo.formats.filter(f => {
      if (f.type !== 'video') return false;
      const h = parseFormatHeight(f.quality);
      return h > 0 && h <= selectedTargetHeight;
    });
    if (!pool.length) return true;
    const top = Math.max(...pool.map(f => parseFormatHeight(f.quality)));
    return pool.some(f => parseFormatHeight(f.quality) === top && (f.fps == null || f.fps <= fps));
  }, [mediaInfo.formats, options.audioOnly, selectedTargetHeight]);

  // Se a resolução mudou e o FPS atual não existe nela, volta para Original
  useEffect(() => {
    if (options.fpsMax && options.fpsMax > 0 && !isFpsAvailable(options.fpsMax)) {
      update({ fpsMax: 0 });
    }
  }, [options.fpsMax, isFpsAvailable, update]);

  // Compat container × codec de vídeo (null = tudo permitido)
  const allowedCodecs = useMemo(() => {
    if (options.audioOnly) return null;
    return CODECS_FOR_CONTAINER[options.videoFormat || ''] ?? null;
  }, [options.audioOnly, options.videoFormat]);
  const allowedContainers = useMemo(() => {
    if (options.audioOnly) return null;
    return CONTAINERS_FOR_CODEC[options.videoCodec || ''] ?? null;
  }, [options.audioOnly, options.videoCodec]);

  // Ao mudar um lado, o outro volta p/ neutro se ficar incompatível
  useEffect(() => {
    if (options.audioOnly) return;
    if (allowedCodecs && !allowedCodecs.includes(options.videoCodec)) {
      update({ videoCodec: allowedCodecs[0] });
    }
  }, [options.audioOnly, allowedCodecs, options.videoCodec, update]);
  useEffect(() => {
    if (options.audioOnly) return;
    if (allowedContainers && options.videoFormat && !allowedContainers.includes(options.videoFormat)) {
      update({ videoFormat: '' });
    }
  }, [options.audioOnly, allowedContainers, options.videoFormat, update]);
  // Embutir legendas só vale em mp4/webm/mkv com vídeo (yt-dlp rejeita em áudio)
  // e nunca com ALL (GAP3: embutir ~150 faixas incha o mux e pode falhar).
  useEffect(() => {
    if (options.embedSubs && (options.audioOnly || options.subLangs === 'all' || (options.videoFormat && !['mp4', 'webm', 'mkv'].includes(options.videoFormat)))) {
      update({ embedSubs: false });
    }
  }, [options.videoFormat, options.audioOnly, options.subLangs, options.embedSubs, update]);
  // Manter vídeo só vale com extração de áudio
  useEffect(() => {
    if (!options.audioOnly && options.keepVideo) {
      update({ keepVideo: false });
    }
  }, [options.audioOnly, options.keepVideo, update]);
  // Incorporar thumbnail só vale nos formatos aceitos
  useEffect(() => {
    if (options.embedThumbnail && !canEmbedThumbnail(options)) {
      update({ embedThumbnail: false });
    }
  }, [options.embedThumbnail, options.audioOnly, options.audioFormat, options.videoFormat, update]);

  const accentBg = getAccentBgClass(settings).split(' ')[0];
  const accentText = getAccentTextClass(settings);
  const accentBorder = getAccentBorderClass(settings).split(' ')[0];
  const accentTextOnBg = getAccentTextOnBgClass(settings);

  const isImage = mediaInfo.type === 'image';

  if (isImage) {
    const imageFormats = mediaInfo.formats.filter(f => f.type === 'image');
    const origExt = mediaInfo.originalUrl?.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
    return (
      <div className="space-y-3">
        {/* Preview card */}
        <div className="flex items-center gap-3 p-3 rounded-xl lf-surface-40 lf-border">
          <div className="w-16 h-16 rounded-lg overflow-hidden lf-border-strong lf-surface shrink-0">
            <img src={mediaInfo.thumbnailUrl || mediaInfo.originalUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" loading="lazy" decoding="async" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="fs-sm font-semibold text-white truncate">{mediaInfo.title}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="fs-sm lf-text-secondary font-mono">{mediaInfo.resolution || 'Imagem'}</span>
              {origExt && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold lf-surface-raised lf-text-secondary uppercase">{origExt}</span>
              )}
              {mediaInfo.sizeEst !== 'N/A' && (
                <span className="fs-sm lf-text-muted">{mediaInfo.sizeEst}</span>
              )}
            </div>
          </div>
        </div>

        {imageFormats.length > 0 && (
          <div className="p-3 rounded-xl lf-surface-40 lf-border space-y-2">
            <div className="flex items-center gap-2">
              <BlockIcon blockId="resolution" />
              <BlockTitle>{settings.language === 'en' ? 'Convert to' : 'Converter para'}</BlockTitle>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {imageFormats.map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => {
                    setOptions(prev => ({ ...prev, format: fmt.id }));
                    onFormatChange(fmt);
                  }}
                  className={`
                    border rounded-lg fs-sm font-bold transition-all text-center py-2.5
                    ${options.format === fmt.id
                      ? `lf-surface-40 text-white ${accentBorder}`
                      : 'lf-surface-40 lf-border lf-text-secondary hover:text-zinc-200 hover:bg-zinc-800'}
                  `}
                >
                  {fmt.quality}
                </button>
              ))}
            </div>
            <p className="text-[9px] lf-text-faint italic">{t('fmtCanvasNote')}</p>
          </div>
        )}
      </div>
    );
  }

  const selectedPreset = useMemo(
    () => VIDEO_PRESETS.find(p => p.format === options.format && !options.audioOnly),
    [options.format, options.audioOnly]
  );
  const isOverMaxRes = selectedPreset && selectedPreset.height !== Infinity && maxRes > 0 && selectedPreset.height > maxRes;

  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const toggleSection = useCallback((id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Contexto único das seções (format/): evita furar ~20 props em cada uma.
  const ctx: FormatSectionCtx = {
    options, update, mediaInfo, openSections, toggleSection, accentBg, maxRes,
    allowedCodecs, allowedContainers, isFpsAvailable, selectedTargetHeight,
    showSubs, setShowSubs, showSubsPicker, setShowSubsPicker,
    useUnderscore, setUseUnderscore, descExpanded, setDescExpanded,
    trimStart, setTrimStart, trimEnd, setTrimEnd, trimStartRef, trimEndRef,
  };

  return (
    <div className="space-y-3" style={{ '--ui-scale': uiScale } as React.CSSProperties}>
      {/* Download rápido: vídeo 1080p60 mp4 (merge copy) / MP3 máxima */}
      <p className="font-bold text-white text-center text-base pt-4 mb-3">
        {settings.language === 'en' ? '⚡ Quick Download' : '⚡ Download Rápido'}
      </p>
      <div className="grid grid-cols-2 gap-2 pb-3">
        <button
          onClick={() => onQuickDownload?.('video')}
          className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold fs-sm whitespace-nowrap transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99]"
        >
          <Clapperboard size={15} className="text-white shrink-0" />
          {settings.language === 'en' ? 'Default Video' : 'Vídeo Padrão'}
        </button>
        <button
          onClick={() => onQuickDownload?.('audio')}
          className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold fs-sm whitespace-nowrap transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99]"
        >
          <Music size={15} className="text-white shrink-0" />
          {settings.language === 'en' ? 'MP3 Audio' : 'Áudio MP3'}
        </button>
      </div>
      {/* Divisor: download personalizado em bloco próprio abaixo */}
      <div className="border-t lf-border pt-4 mt-1">
      <p className="font-bold text-white text-center text-base mb-3">
        {settings.language === 'en' ? '🎛️ Custom Download' : '🎛️ Download Personalizado'}
      </p>
      <LayoutGroup>
      <div className="flex items-center gap-1 border-b lf-border">
        {([
          { id: 'media' as TabId, blockId: 'video-format' as BlockId, label: t('fmtMediaTab') },
          { id: 'advanced' as TabId, blockId: 'behavior' as BlockId, label: t('fmtAdvancedTab') },
        ]).map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 fs-sm font-semibold transition-all relative ${isActive ? accentText : 'lf-text-muted hover:text-zinc-300'}`}
            >
              <BlockIcon blockId={tab.blockId} size={14} />
              {tab.label}
              {isActive && (
                <TabIndicator
                  layoutId="tab-indicator"
                  className={`absolute bottom-0 left-0 right-0 h-0.5 ${accentBg}`}
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex justify-end -mt-2 mb-1">
        <div className="flex items-center gap-0.5">
          <span className="fs-sm lf-text-faint mr-0.5">🔍</span>
          <button onClick={() => setUiScale(s => Math.max(0, s - 5))} className="w-5 h-5 rounded flex items-center justify-center fs-sm lf-text-faint hover:text-zinc-300 hover:bg-zinc-800 transition-colors">A-</button>
          <span className="fs-xs lf-text-muted w-7 text-center font-mono">{uiScale}%</span>
          <button onClick={() => setUiScale(s => Math.min(100, s + 5))} className="w-5 h-5 rounded flex items-center justify-center fs-sm lf-text-faint hover:text-zinc-300 hover:bg-zinc-800 transition-colors">A+</button>
        </div>
      </div>

      <AnimatedList mode="wait">
        {activeTab === 'media' && (
          <AnimatedCard animateKey="media" variant={slideUp} className="space-y-3">
            <ResolutionSection ctx={ctx} />
            <VideoFormatSection ctx={ctx} />
            <AudioSection ctx={ctx} />
            {mediaInfo.description && <DescriptionSection ctx={ctx} />}
            <SubtitlesSection ctx={ctx} />
            <FilenameSection ctx={ctx} />
          </AnimatedCard>
        )}

        {activeTab === 'advanced' && (
          <AnimatedCard animateKey="advanced" variant={slideUp} className="space-y-3">
            <TrimSection ctx={ctx} />
            <OutputSection ctx={ctx} />
            <SponsorBlockSection ctx={ctx} />
            <MetadataSection ctx={ctx} />
            <BehaviorSection ctx={ctx} />
          </AnimatedCard>
        )}
      </AnimatedList>
      </LayoutGroup>
      </div>
    </div>
  );
});
