// Card do resultado da análise (extraído do LinkAnalyzer): header rico,
// FormatSelector, resumo e botão de download.
import React, { Suspense } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../core/i18n';
import { ProviderRegistry } from '../../core/plugins/Providers';
import { MediaInfo, MediaFormat } from '../../types';
import type { FormatOptions } from '../downloads/FormatOptions';
import {
  getAccentBgClass, getAccentTextClass, getAccentBorderClass
} from '../../components/ThemeWrapper';
import { AnimatedCard } from '../../animation/AnimatedCard';
import { AnimatedList } from '../../animation/AnimatedList';
import { slideUpStrong } from '../../animation/variants';
import { PlatformBadge } from '../../components/PlatformBadge';
import {
  Play, FileVideo, Music, Image as ImageIcon, Eye, Calendar, FolderOpen,
  Clock, Star, ExternalLink, Download, RefreshCw, AlertCircle,
} from 'lucide-react';
import { formatUploadDate } from './analyzerUtils';
import { SummaryPanel } from './SummaryPanel';

const FormatSelector = React.lazy(() => import('../downloads/FormatSelector').then(m => ({ default: m.FormatSelector })));

export interface MediaResultCardProps {
  mediaInfo: MediaInfo;
  isFav: boolean;
  isLater: boolean;
  onToggleFav: () => void;
  onToggleLater: () => void;
  onDownloadThumbnail: (targetExt?: 'jpg' | 'png' | 'webp') => void;
  showCoverFormats: boolean;
  probeLoading: boolean;
  probeError: string | null;
  formatOptions: FormatOptions;
  onFormatSelect: (o: FormatOptions) => void;
  onFormatChange: (f: MediaFormat) => void;
  selectedFormat: MediaFormat | null;
  onStartDownload: () => void;
}

export function MediaResultCard({
  mediaInfo, isFav, isLater, onToggleFav, onToggleLater, onDownloadThumbnail,
  showCoverFormats, probeLoading, probeError, formatOptions, onFormatSelect,
  onFormatChange, selectedFormat, onStartDownload,
}: MediaResultCardProps) {
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  const platformConfig = ProviderRegistry.getPlatformConfig(mediaInfo.platform);

  return (
    <AnimatedList>
      <AnimatedCard
        variant={slideUpStrong}
        className="p-4 md:p-6 rounded-3xl glass-card shadow-2xl space-y-6 overflow-hidden"
      >
        {/* Header / Thumbnail Block */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Thumbnail Container */}
          <div className="relative group w-full md:w-64 h-40 rounded-xl shrink-0 overflow-hidden border lf-border lf-surface">
            <img
              src={mediaInfo.thumbnailUrl}
              alt={mediaInfo.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white">
                <Play size={20} fill="currentColor" />
              </div>
            </div>
          </div>

          {/* Rich Metadata Information */}
          <div className="flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <h3 className="font-display font-bold text-lg md:text-xl text-white leading-snug">
                {mediaInfo.title}
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs lf-text-secondary font-medium font-sans">
                <span className="lf-text-secondary font-semibold">{t('authorLabel')} {mediaInfo.author}</span>
                {platformConfig && (
                  <PlatformBadge platformId={mediaInfo.platform} name={platformConfig.name} color={platformConfig.color} variant="inline" />
                )}
                <span className="lf-text-faint">•</span>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border lf-border text-[10px] uppercase font-mono tracking-wider flex items-center gap-1.5 lf-text-secondary">
                  {mediaInfo.type === 'video' && <>{settings.iconStyle === 'emoji' ? <span>🎬</span> : <FileVideo size={10} className="text-violet-400" />} {settings.language === 'en' ? 'Video' : 'Vídeo'}</>}
                  {mediaInfo.type === 'audio' && <>{settings.iconStyle === 'emoji' ? <span>🎵</span> : <Music size={10} className="text-rose-400" />} {settings.language === 'en' ? 'Audio' : 'Áudio'}</>}
                  {mediaInfo.type === 'image' && <>{settings.iconStyle === 'emoji' ? <span>🖼️</span> : <ImageIcon size={10} className="text-cyan-400" />} {settings.language === 'en' ? 'Image' : 'Imagem'}</>}
                </span>
              </div>
              {/* Metadata: views, date, formats, duration */}
              <div className="flex flex-wrap items-center gap-x-1 text-[11px] lf-text-faint font-medium">
                {mediaInfo.views && (
                  <span className="flex items-center gap-1 px-2">
                    {settings.iconStyle === 'emoji' ? <span>👁️</span> : <Eye size={10} className="text-sky-400" />}
                    <span className="lf-text-secondary">{mediaInfo.views}</span>
                  </span>
                )}
                <span className="text-zinc-700">|</span>
                {mediaInfo.publishDate && (
                  <span className="flex items-center gap-1 px-2">
                    {settings.iconStyle === 'emoji' ? <span>📅</span> : <Calendar size={10} className="text-amber-400" />}
                    <span className="lf-text-secondary">{formatUploadDate(mediaInfo.publishDate)}</span>
                  </span>
                )}
                <span className="text-zinc-700">|</span>
                <span className="flex items-center gap-1 px-2">
                  {settings.iconStyle === 'emoji' ? <span>📁</span> : <FolderOpen size={10} className="text-emerald-400" />}
                  <span className="lf-text-secondary">{mediaInfo.formats.length} {settings.language === 'en' ? 'formats' : 'formatos'}</span>
                </span>
                <span className="text-zinc-700">|</span>
                {mediaInfo.duration && (
                  <span className="flex items-center gap-1 px-2">
                    {settings.iconStyle === 'emoji' ? <span>⏱️</span> : <Clock size={10} className="text-violet-400" />}
                    <span className="lf-text-secondary">{mediaInfo.duration}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Actions Toolbelt (items-start: a coluna da capa cresce
                com a linha de formatos sem esticar os vizinhos) */}
            <div className="flex flex-wrap items-start gap-2">
              <button
                onClick={onToggleFav}
                className={`
                  px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all
                  ${isFav
                    ? `${getAccentBorderClass(settings)} bg-current text-white`
                    : 'lf-border lf-surface-40 lf-text-secondary hover:text-white hover:bg-zinc-850'
                  }
                `}
                style={isFav ? { backgroundColor: `rgba(var(--color-primary-rgb), 0.1)`, color: 'var(--color-primary)' } : {}}
              >
                {settings.iconStyle === 'emoji' ? <span>⭐</span> : <Star size={14} fill={isFav ? 'currentColor' : 'none'} className={getAccentTextClass(settings)} />}
                {isFav ? (settings.language === 'en' ? 'Favorited' : 'Favoritado') : t('favorite')}
              </button>

              <button
                onClick={onToggleLater}
                className={`
                  px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all
                  ${isLater
                    ? `${getAccentBorderClass(settings)} bg-current text-white`
                    : 'lf-border lf-surface-40 lf-text-secondary hover:text-white hover:bg-zinc-850'
                  }
                `}
                style={isLater ? { backgroundColor: `rgba(var(--color-primary-rgb), 0.1)`, color: 'var(--color-primary)' } : {}}
              >
                {settings.iconStyle === 'emoji' ? <span>⏰</span> : <Clock size={14} className={getAccentTextClass(settings)} />}
                {t('laterBtn')}
              </button>

              {mediaInfo.type !== 'image' && (
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => onDownloadThumbnail()}
                    className="px-3.5 py-2 rounded-xl border lf-border lf-surface-40 lf-text-secondary hover:text-white hover:bg-zinc-850 text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    {settings.iconStyle === 'emoji' ? <span>🖼️</span> : <ImageIcon size={14} className={getAccentTextClass(settings)} />}
                    {settings.language === 'en' ? 'Download Thumbnail' : 'Baixar Capa'}
                  </button>
                  {showCoverFormats && (
                    <div className="flex gap-1.5">
                      {(['jpg', 'png', 'webp'] as const).map(fmt => (
                        <button
                          key={fmt}
                          onClick={() => onDownloadThumbnail(fmt)}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase lf-surface-40 lf-border lf-text-secondary hover:text-white transition-all"
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <a
                href={mediaInfo.originalUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="px-3.5 py-2 rounded-xl border lf-border lf-surface-40 lf-text-secondary hover:text-white hover:bg-zinc-850 text-xs font-semibold flex items-center gap-2 transition-all"
              >
                {settings.iconStyle === 'emoji' ? <span>🔗</span> : <ExternalLink size={14} className={getAccentTextClass(settings)} />}
                {t('btnOriginal')}
              </a>
            </div>
          </div>
        </div>

        {/* Format Selector with Probe Options */}
        <div className="border-t lf-border pt-6 space-y-5">
          {probeLoading && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-500/10 border lf-border lf-text-secondary text-xs font-medium">
              <RefreshCw size={14} className="animate-spin" />
              {settings.language === 'en' ? 'Probing media info...' : 'Analisando informações da mídia...'}
            </div>
          )}
          {probeError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
              <AlertCircle size={14} />
              {settings.language === 'en' ? 'Probe error' : 'Erro na sonda'}: {probeError}
            </div>
          )}

          <Suspense fallback={<div className="h-40 lf-surface-40 rounded-xl animate-pulse" />}>
            <FormatSelector
              mediaInfo={mediaInfo}
              onFormatSelect={onFormatSelect}
              onFormatChange={onFormatChange}
              formatOptions={formatOptions}
            />
          </Suspense>
        </div>

        {/* Execute Download trigger */}
        <div className="border-t lf-border pt-6 space-y-4">
          <SummaryPanel formatOptions={formatOptions} selectedFormat={selectedFormat} mediaInfo={mediaInfo} />
          <div className="flex justify-end">
            <button
              onClick={onStartDownload}
              disabled={!selectedFormat}
              className={`
                w-full sm:w-auto px-6 py-3 rounded-xl text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all
                ${!selectedFormat ? 'bg-zinc-600 hover:bg-zinc-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500'} hover:scale-[1.02] active:scale-[0.98]
              `}
            >
              <Download size={18} />
              {t('btnDownloadSelected')}
            </button>
          </div>
        </div>
      </AnimatedCard>
    </AnimatedList>
  );
}
