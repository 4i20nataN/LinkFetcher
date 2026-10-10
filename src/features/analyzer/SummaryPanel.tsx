// Resumo do formato escolhido (settings via contexto).
import React from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../core/i18n';
import { MediaInfo, MediaFormat } from '../../types';
import type { FormatOptions } from '../downloads/FormatOptions';
import { AUDIO_QUALITY_PRESETS } from '../downloads/constants';

export const SummaryPanel: React.FC<{ formatOptions: FormatOptions; selectedFormat: MediaFormat | null; mediaInfo: MediaInfo }> = ({ formatOptions, selectedFormat, mediaInfo }) => {
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  const items: { icon: string; label: string }[] = [];

  if (formatOptions.audioOnly) {
    items.push({ icon: '🎵', label: formatOptions.audioFormat.toUpperCase() });
    if (formatOptions.audioQuality) {
      const qLabel = AUDIO_QUALITY_PRESETS.find(p => p.value === formatOptions.audioQuality)?.label
        ?? formatOptions.audioQuality;
      items.push({ icon: '🔊', label: formatOptions.audioQuality === '0' ? t('sumBestQuality') : qLabel });
    }
  } else {
    if (formatOptions.videoFormat) items.push({ icon: '🎬', label: formatOptions.videoFormat.toUpperCase() });
    // Extrai a resolução do padrão height<=XXXX.
    const fmt = formatOptions.format || '';
    const heightMatch = fmt.match(/height[<=>]+(\d+)/);
    if (heightMatch) {
      const h = Number(heightMatch[1]);
      const resMap: Record<number, string> = { 2160: '4K', 1440: '1440p', 1080: '1080p', 720: '720p', 480: '480p', 360: '360p' };
      items.push({ icon: '📺', label: resMap[h] || `${h}p` });
    } else if (fmt.includes('best') || fmt === '') {
      items.push({ icon: '📺', label: t('sumBest') });
    } else if (selectedFormat?.quality) {
      items.push({ icon: '📺', label: selectedFormat.quality });
    }
    if (formatOptions.videoCodec) {
      const codecMap: Record<string, string> = { h264: 'H.264', h265: 'H.265', vp9: 'VP9', av01: 'AV1' };
      items.push({ icon: '🎞', label: codecMap[formatOptions.videoCodec] || formatOptions.videoCodec });
    }
  }

  if (formatOptions.sponsorblockRemove && formatOptions.sponsorblockRemove !== '') {
    const sb = formatOptions.sponsorblockRemove === 'all' ? t('sumAll') : formatOptions.sponsorblockRemove.replace(/,/g, ' + ');
    items.push({ icon: '⚡', label: `SponsorBlock: ${sb}` });
  }
  if (formatOptions.downloadSections) items.push({ icon: '✂', label: `${t('sumCut')} ${formatOptions.downloadSections.replace(/\*/g, '')}` });
  if (!formatOptions.audioOnly && formatOptions.fpsMax && formatOptions.fpsMax > 0) items.push({ icon: '🎞', label: `${formatOptions.fpsMax} FPS` });
  if (formatOptions.writeSubs || formatOptions.writeAutoSubs) {
    const lang = formatOptions.subLangs || 'en';
    items.push({ icon: '📋', label: lang.toUpperCase() });
  }
  if (formatOptions.customFilename) items.push({ icon: '📁', label: formatOptions.customFilename });
  if (formatOptions.descFormat && formatOptions.descFormat !== 'none' && mediaInfo.description) items.push({ icon: '📄', label: `${t('sumDesc')}${formatOptions.descFormat}` });

  // Mostra só escolhas do usuário (nada derivado/estático).

  if (items.length === 0) return null;

  return (
    <div className="p-3 rounded-xl lf-surface-40 border lf-border glass-result">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] lf-text-muted font-medium uppercase tracking-wider">{t('sumResult')}</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[11px] lf-text-secondary">
            <span className="text-[10px]">{item.icon}</span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};
