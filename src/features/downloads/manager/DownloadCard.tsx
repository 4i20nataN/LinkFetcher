// Card memoizado por identidade do item; ticks quentes vão ao DOM direto.
import React from 'react';
import { DownloadItem, type AppSettings } from '../../../types';
import { DownloadEngine } from '../../../core/engine/DownloadEngine';
import {
  Play, Pause, X, Trash2, FolderOpen, Share2, RotateCcw,
  ArrowUp, ArrowDown,
  Subtitles, Scissors, Shield, Tag, Code
} from 'lucide-react';
import { AnimatedCard } from '../../../animation/AnimatedCard';
import { slideExitLeft } from '../../../animation/variants';
import { useTranslation } from '../../../core/i18n';
import {
  getAccentTextClass
} from '../../../components/ThemeWrapper';
import { ProviderRegistry } from '../../../core/plugins/Providers';
import { PlatformBadge } from '../../../components/PlatformBadge';
import { LiveDownloadStats } from './LiveDownloadStats';

// Recorte: baixa o vídeo cheio e corta local (fetch remoto é lento/403, sem resume).
// O total exibido é do vídeo completo; o trecho sai na fase `processing`.

export interface DownloadCardProps {
  item: DownloadItem;
  settings: AppSettings;
  t: ReturnType<typeof useTranslation>['t'];
  queuePos: number;
  queuedTotal: number;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onOpenFolder: (item: DownloadItem) => void;
  onShare: (item: DownloadItem) => void;
  onPreview: (item: DownloadItem) => void;
  onRequestDelete: (item: DownloadItem) => void;
}

export const DownloadCard = React.memo(function DownloadCard({
  item, settings, t, queuePos, queuedTotal,
  onMoveUp, onMoveDown, onOpenFolder, onShare, onPreview, onRequestDelete,
}: DownloadCardProps) {
              const platform = ProviderRegistry.getPlatformConfig(item.platform);
              const isDownloading = item.status === 'downloading';
              const isPaused = item.status === 'paused';
              const isCompleted = item.status === 'completed';
              const isFailed = ['failed', 'cancelled'].includes(item.status);

              return (
                <AnimatedCard
                  animateKey={item.id}
                  variant={slideExitLeft}
                  className="p-4 rounded-xl glass-card flex flex-col md:flex-row gap-4 items-start md:items-center relative overflow-hidden group hover:bg-white/10 transition-colors"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : isPaused ? 'bg-amber-500' : 'bg-indigo-500'
                  }`} />

                  <div className="relative w-full md:w-28 aspect-video rounded-lg overflow-hidden border lf-border lf-surface shrink-0">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[8px] font-mono lf-text-secondary">
                      {item.format.quality}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5 w-full">
                    <div className="flex flex-col sm:flex-row justify-between gap-1">
                      <h4 className="font-semibold text-xs text-white truncate pr-4" title={item.title}>
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {platform && (
                        <PlatformBadge platformId={item.platform} name={platform.name} color={platform.color} variant="inline" />
                      )}
                      {/* Concluído: extensão do arquivo real; pendente: container prometido. */}
                      {(() => {
                        const doneExt = item.status === 'completed' && item.filePath
                          ? (item.filePath.split('.').pop() || '')
                          : '';
                        const outExt = doneExt
                          || (item.audioOnly
                            ? item.audioFormat
                            : (item.mergeOutputFormat || item.format.ext));
                        return outExt ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-white/10 lf-text-secondary border border-white/10">
                            {outExt.toUpperCase()}
                          </span>
                        ) : null;
                      })()}
                      {item.imageSource && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold border ${
                          item.imageSource === 'user-link'
                            ? 'bg-pink-900/60 text-pink-300 border-pink-800/40'
                            : 'bg-zinc-700/60 text-zinc-400 border-zinc-600/40'
                        }`}>
                          {item.imageSource === 'user-link' ? `🔗 ${t('badgeImageUrl')}` : '🖼️ Thumbnail'}
                        </span>
                      )}
                      {(item.writeSubs || item.writeAutoSubs) && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-800/40">
                          <Subtitles size={8} />
                          {item.subLangs || 'EN'}
                        </span>
                      )}
                      {item.sponsorblockRemove && item.sponsorblockRemove !== '' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-purple-900/60 text-purple-300 border border-purple-800/40">
                          <Shield size={8} />
                          Sponsor
                        </span>
                      )}
                      {item.downloadSections && item.downloadSections !== '' && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-amber-900/60 text-amber-300 border border-amber-800/40"
                          title={settings.language === 'en' ? 'Downloads the full video, then extracts this section locally' : 'Baixa o vídeo completo e extrai este trecho localmente'}
                        >
                          <Scissors size={8} />
                          {t('badgeCut')}
                        </span>
                      )}
                      {item.audioOnly && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-800/40">
                          <Tag size={8} />
                          {(item.audioFormat || 'mp3').toUpperCase()}
                          {item.audioQuality && item.audioQuality !== '0' && (
                            <span className="opacity-70">{item.audioQuality}</span>
                          )}
                        </span>
                      )}
                    </div>

                    <LiveDownloadStats item={item} settings={settings} />
                  </div>

                  <div className="flex items-center gap-2 justify-end w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 lf-border flex-wrap">
                    {['queued', 'downloading', 'paused'].includes(item.status) && (
                      <div className="flex flex-col gap-1 mr-2 border-r lf-border pr-2 transition-opacity duration-300 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
                        <button
                          onClick={() => onMoveUp(item.id)}
                          disabled={queuePos <= 0}
                          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-white/5 lf-text-muted hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
                          title={settings.language === 'en' ? 'Move up' : 'Mover para cima'}
                          aria-label={settings.language === 'en' ? 'Move up' : 'Mover para cima'}
                        >
                          {settings.iconStyle === 'emoji' ? <span>⬆️</span> : <ArrowUp size={14} className={getAccentTextClass(settings)} />}
                        </button>
                        <button
                          onClick={() => onMoveDown(item.id)}
                          disabled={queuePos < 0 || queuePos >= queuedTotal - 1}
                          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-white/5 lf-text-muted hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
                          title={settings.language === 'en' ? 'Move down' : 'Mover para baixo'}
                          aria-label={settings.language === 'en' ? 'Move down' : 'Mover para baixo'}
                        >
                          {settings.iconStyle === 'emoji' ? <span>⬇️</span> : <ArrowDown size={14} className={getAccentTextClass(settings)} />}
                        </button>
                      </div>
                    )}

                    {/* Pausar/retomar é imediato; parar/excluir pede confirmação. */}
                    {isDownloading && (
                      <button
                        onClick={() => DownloadEngine.pauseDownload(item.id)}
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg lf-surface-raised hover:bg-zinc-750 lf-text-secondary hover:text-white transition-colors active:scale-95"
                        title={settings.language === 'en' ? 'Pause' : 'Pausar'}
                        aria-label={settings.language === 'en' ? 'Pause' : 'Pausar'}
                      >
                        {settings.iconStyle === 'emoji' ? <span>⏸️</span> : <Pause size={16} className={getAccentTextClass(settings)} />}
                      </button>
                    )}
                    {isPaused && (
                      <button
                        onClick={() => DownloadEngine.resumeDownload(item.id)}
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white transition-colors active:scale-95"
                        title={settings.language === 'en' ? 'Resume' : 'Retomar'}
                        aria-label={settings.language === 'en' ? 'Resume' : 'Retomar'}
                      >
                        {settings.iconStyle === 'emoji' ? <span>▶️</span> : <Play size={16} fill="currentColor" className={getAccentTextClass(settings)} />}
                      </button>
                    )}
                    {(isDownloading || isPaused) && (
                      <button
                        onClick={() => onRequestDelete(item)}
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg lf-surface-raised hover:bg-red-950/40 lf-text-muted hover:text-rose-400 transition-colors active:scale-95"
                        title={settings.language === 'en' ? 'Stop download…' : 'Parar download…'}
                        aria-label={settings.language === 'en' ? 'Stop download' : 'Parar download'}
                      >
                        {settings.iconStyle === 'emoji' ? <span>✖️</span> : <X size={16} className={getAccentTextClass(settings)} />}
                      </button>
                    )}
                    {isFailed && (
                      <button
                        onClick={() => DownloadEngine.retryDownload(item.id)}
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white transition-colors active:scale-95"
                        title={settings.language === 'en' ? 'Retry Download' : 'Repetir Download'}
                        aria-label={settings.language === 'en' ? 'Retry Download' : 'Repetir Download'}
                      >
                        {settings.iconStyle === 'emoji' ? <span>🔄</span> : <RotateCcw size={16} className={getAccentTextClass(settings)} />}
                      </button>
                    )}

                    {isCompleted && (
                      <button
                        onClick={() => onOpenFolder(item)}
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white transition-colors active:scale-95"
                        title={settings.language === 'en' ? 'Open Folder' : 'Abrir Pasta'}
                        aria-label={settings.language === 'en' ? 'Open Folder' : 'Abrir Pasta'}
                      >
                        {settings.iconStyle === 'emoji' ? <span>📁</span> : <FolderOpen size={16} className={getAccentTextClass(settings)} />}
                      </button>
                    )}

                    <button
                      onClick={() => onPreview(item)}
                      className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text-secondary hover:text-zinc-200 transition-colors active:scale-95"
                      title={settings.language === 'en' ? 'View Command' : 'Ver Comando'}
                      aria-label={settings.language === 'en' ? 'View Command' : 'Ver Comando'}
                    >
                      {settings.iconStyle === 'emoji' ? <span>💻</span> : <Code size={16} className={getAccentTextClass(settings)} />}
                    </button>

                    <button
                      onClick={() => onShare(item)}
                      className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text-secondary hover:text-zinc-200 transition-colors active:scale-95"
                      title={settings.language === 'en' ? 'Share Link' : 'Compartilhar Link'}
                      aria-label={settings.language === 'en' ? 'Share Link' : 'Compartilhar Link'}
                    >
                      {settings.iconStyle === 'emoji' ? <span>🔗</span> : <Share2 size={16} className={getAccentTextClass(settings)} />}
                    </button>

                    <button
                      onClick={() => onRequestDelete(item)}
                      className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg lf-surface-raised hover:bg-red-950/40 lf-text-muted hover:text-rose-400 transition-colors active:scale-95"
                      title={settings.language === 'en' ? 'Delete…' : 'Excluir…'}
                      aria-label={settings.language === 'en' ? 'Delete' : 'Excluir'}
                    >
                      {settings.iconStyle === 'emoji' ? <span>🗑️</span> : <Trash2 size={16} className={getAccentTextClass(settings)} />}
                    </button>
                  </div>
        </AnimatedCard>
              );
}, (prev, next) => {
  // Compara tudo exceto os números do tick (vão ao DOM direto).
  // Exceção: cruzar 0→>0 troca indeterminado→barra.
  if (prev.settings !== next.settings) return false;
  if (prev.queuePos !== next.queuePos || prev.queuedTotal !== next.queuedTotal) return false;
  return isCardStaticEqual(prev.item, next.item);
});

export function isCardStaticEqual(a: DownloadItem, b: DownloadItem): boolean {
  if (a === b) return true;
  if ((a.progress <= 0) !== (b.progress <= 0)) return false;
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.thumbnailUrl === b.thumbnailUrl &&
    a.platform === b.platform &&
    a.format === b.format &&
    a.formatString === b.formatString &&
    a.audioOnly === b.audioOnly &&
    a.audioFormat === b.audioFormat &&
    a.audioQuality === b.audioQuality &&
    a.writeSubs === b.writeSubs &&
    a.writeAutoSubs === b.writeAutoSubs &&
    a.subLangs === b.subLangs &&
    a.subFormat === b.subFormat &&
    a.embedSubs === b.embedSubs &&
    a.writeThumbnail === b.writeThumbnail &&
    a.embedThumbnail === b.embedThumbnail &&
    a.embedMetadata === b.embedMetadata &&
    a.mergeOutputFormat === b.mergeOutputFormat &&
    a.restrictFilenames === b.restrictFilenames &&
    a.noOverwrites === b.noOverwrites &&
    a.keepVideo === b.keepVideo &&
    a.concurrentFragments === b.concurrentFragments &&
    a.retries === b.retries &&
    a.downloadSections === b.downloadSections &&
    a.videoOnly === b.videoOnly &&
    a.sponsorblockRemove === b.sponsorblockRemove &&
    a.fpsMax === b.fpsMax &&
    a.bandLimit === b.bandLimit &&
    a.customFilename === b.customFilename &&
    a.videoFormat === b.videoFormat &&
    a.videoCodec === b.videoCodec &&
    a.normalizeAudio === b.normalizeAudio &&
    a.videoSharpen === b.videoSharpen &&
    a.imageSource === b.imageSource &&
    a.sizeTotal === b.sizeTotal &&
    a.durationSeconds === b.durationSeconds &&
    a.status === b.status &&
    a.processing === b.processing &&
    a.activity === b.activity &&
    a.addedAt === b.addedAt &&
    a.finishedAt === b.finishedAt &&
    a.url === b.url &&
    a.error === b.error &&
    a.subWarning === b.subWarning &&
    a.filePath === b.filePath &&
    a.finalArgs === b.finalArgs
  );
}
