import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { DownloadItem, AppSettings } from '../../types';
import { DownloadEngine } from '../../core/engine/DownloadEngine';
import { CookieRetryPopup } from '../../components/CookieRetryPopup';
import { buildArgsPreview } from '../../core/ytdlp/buildArgsPreview';
import { 
  Play, Pause, X, Trash2, FolderOpen, Share2, RotateCcw, 
  ArrowUp, ArrowDown, ListOrdered, CheckCircle2, AlertTriangle, 
  Clock, TrendingUp, HelpCircle, ShieldCheck, ChevronRight,
  Subtitles, Scissors, Shield, Tag, Code, Music, Disc, Hash, Image as ImageIconLucide,
  Youtube, Tv, Instagram, Facebook, Twitter, MessageSquare, Twitch, Video, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../../core/i18n';
import { 
  getAccentBgClass, getAccentTextClass, getAccentBorderClass 
} from '../../components/ThemeWrapper';
import { ProviderRegistry } from '../../core/plugins/Providers';
import type { PlatformId } from '../../types';

const platformIconMap: Record<PlatformId, React.ComponentType<any>> = {
  youtube: Youtube,
  tiktok: Tv,
  instagram: Instagram,
  facebook: Facebook,
  x: Twitter,
  reddit: MessageSquare,
  soundcloud: Music,
  spotify: Disc,
  twitch: Twitch,
  pinterest: ImageIconLucide,
  threads: Hash,
  vimeo: Video,
  generic: Globe,
};

// Helper to format bytes to human readable sizes
const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Helper to format speed
const formatSpeed = (bytesPerSec: number) => {
  if (bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec)}/s`;
};

// Helper to format ETA
const formatEta = (seconds: number) => {
  if (seconds === Infinity || isNaN(seconds) || seconds <= 0) return '--';
  if (seconds >= 3600) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.ceil((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  return `${seconds}s`;
};

export const DownloadManager: React.FC = () => {
  const { settings, downloads } = useApp();
  const { t } = useTranslation(settings);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'audio' | 'video' | 'image' | 'playlist'>('all');
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [cookieRetry, setCookieRetry] = useState<{ itemId: string; error: string } | null>(null);
  const [commandPreview, setCommandPreview] = useState<DownloadItem | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2000);
  };

  useEffect(() => {
    const unsub = DownloadEngine.onCookieRetryRequest((itemId, error) => {
      setCookieRetry({ itemId, error });
    });
    return unsub;
  }, []);

  const handleUseCookies = useCallback((itemId: string, browser: string) => {
    DownloadEngine.retryWithCookies(itemId, browser);
    setCookieRetry(null);
    showToast(settings.language === 'en' ? 'Retrying with cookies...' : 'Retentando com cookies...');
  }, [settings.language, showToast]);

  const handleSkipCookieRetry = useCallback(() => {
    setCookieRetry(null);
  }, []);

  // Bulk queue operations
  const handlePauseAll = () => {
    downloads.forEach(d => {
      if (d.status === 'downloading') {
        DownloadEngine.pauseDownload(d.id);
      }
    });
    showToast(settings.language === 'en' ? 'All active downloads paused' : 'Todos os downloads ativos foram pausados');
  };

  const handleResumeAll = () => {
    downloads.forEach(d => {
      if (['paused', 'failed', 'cancelled'].includes(d.status)) {
        DownloadEngine.resumeDownload(d.id);
      }
    });
    showToast(settings.language === 'en' ? 'Download queue resumed' : 'Fila de downloads retomada');
  };

  const handleCancelAll = () => {
    downloads.forEach(d => {
      if (['queued', 'downloading', 'paused'].includes(d.status)) {
        DownloadEngine.cancelDownload(d.id);
      }
    });
    showToast(settings.language === 'en' ? 'Download queue cancelled' : 'Fila de downloads cancelada');
  };

  const handleClearStatusFilters = () => {
    setStatusFilters(new Set());
  };

  // Media type detection for filtering
  const getMediaType = (item: DownloadItem): string => {
    if (item.audioOnly) return 'audio';
    if (item.format.type === 'audio') return 'audio';
    if (item.format.type === 'image') return 'image';
    if (item.url.includes('list=')) return 'playlist';
    return 'video';
  };

  // Toggle status filter (multi-select OR)
  const toggleStatus = (status: string) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  // Reordering helpers
  const handleMoveUp = (index: number) => {
    DownloadEngine.reorderQueue(index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    DownloadEngine.reorderQueue(index, index + 1);
  };

  const handleShare = async (item: DownloadItem) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, url: item.url });
      } catch (err: any) {
        // AbortError = user dismissed the native share sheet, not a real failure
        if (err?.name !== 'AbortError') {
          showToast(settings.language === 'en' ? 'Failed to share link.' : 'Falha ao compartilhar link.');
        }
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(item.url);
      showToast(settings.language === 'en' ? 'Original link copied for sharing!' : 'Link original copiado para compartilhamento!');
    } catch (_) {
      showToast(settings.language === 'en' ? 'Failed to copy link.' : 'Falha ao copiar link.');
    }
  };

  const handleOpenFolder = async (item: DownloadItem) => {
    const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

    if (isCapacitor) {
      if (!item.filePath) {
        showToast(settings.language === 'en' ? 'File path unavailable' : 'Caminho do arquivo indisponível');
        return;
      }
      try {
        const { default: plugin } = await import('../../core/ytdlp/CapacitorYtDlp');
        await (plugin as any).openFile({ filePath: item.filePath });
      } catch (err) {
        showToast(settings.language === 'en' ? 'Failed to open file' : 'Falha ao abrir arquivo');
      }
      return;
    }

    if (!window.electron?.invoke) return;
    const dir = settings.defaultDir || await window.electron.invoke('shell:getDownloadsPath');
    if (dir) {
      window.electron.invoke('shell:openPath', dir).catch(() => {
        showToast(settings.language === 'en' ? 'Failed to open folder' : 'Falha ao abrir pasta');
      });
    }
  };

  // Calculate global summary states
  const activeDownloads = downloads.filter(d => d.status === 'downloading');
  const totalSpeed = activeDownloads.reduce((sum, d) => sum + d.speed, 0);
  
  const downloadingOrQueued = downloads.filter(d => ['downloading', 'queued'].includes(d.status));
  const overallProgress = downloadingOrQueued.length > 0 
    ? Math.floor(downloadingOrQueued.reduce((sum, d) => sum + d.progress, 0) / downloadingOrQueued.length)
    : 0;

  // Filter list: media type (AND) + status (OR)
  const filteredDownloads = downloads.filter(item => {
    // Media type filter (AND)
    if (mediaFilter !== 'all') {
      if (getMediaType(item) !== mediaFilter) return false;
    }
    // Status filter (OR) — if none active, show all
    if (statusFilters.size > 0) {
      if (!statusFilters.has(item.status)) return false;
    }
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2 md:py-6 px-4 relative">
      {/* Toast alert popup */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-50 px-4 py-3 rounded-xl lf-surface border lf-border-strong text-xs font-semibold text-white shadow-2xl flex items-center gap-2.5"
          >
            <ShieldCheck size={16} className={getAccentTextClass(settings)} />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Info */}
      <div className="text-center md:text-left space-y-2">
        <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white tracking-tight">
          {t('downloadsTitle')}
        </h2>
        <p className="lf-text-secondary text-sm md:text-base">
          {t('downloadsSubtitle')}
        </p>
      </div>

      {/* Global Progress Dashboard Stats */}
      {downloadingOrQueued.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl glass-card shadow-lg grid grid-cols-1 md:grid-cols-3 gap-6 items-center"
        >
          {/* Progress circle info */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="absolute w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="none" />
                <circle 
                  cx="32" 
                  cy="32" 
                  r="28" 
                  stroke="var(--color-primary)" 
                  strokeWidth="4" 
                  fill="none" 
                  strokeDasharray={175} 
                  strokeDashoffset={175 - (175 * overallProgress) / 100}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="font-display font-bold text-sm text-white">{overallProgress}%</span>
            </div>
            <div>
              <span className="text-[10px] lf-text-muted font-mono uppercase block">{t('generalProgress')}</span>
              <span className="text-sm font-bold text-white block mt-0.5">
                {settings.language === 'en' ? 'Downloading' : 'Baixando'} {downloadingOrQueued.length} {downloadingOrQueued.length === 1 ? (settings.language === 'en' ? 'item' : 'mídia') : (settings.language === 'en' ? 'items' : 'mídias')}
              </span>
            </div>
          </div>

          {/* Speed stats */}
          <div className="flex items-center gap-3.5 border-y md:border-y-0 md:border-x lf-border py-4 md:py-0 md:px-6">
            <div className={`p-2 rounded-xl lf-surface ${getAccentTextClass(settings)} shrink-0`}>
              <TrendingUp size={20} className="animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] lf-text-muted font-mono uppercase block">{t('activeSpeed')}</span>
              <span className="text-base font-bold text-white block mt-0.5">{formatSpeed(totalSpeed)}</span>
            </div>
          </div>

          {/* Bulk actions tools */}
          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
            <button 
              onClick={handlePauseAll}
              className="px-3 py-1.5 rounded-lg lf-surface-raised hover:bg-zinc-700 border border-zinc-700/40 text-[10px] font-bold lf-text-secondary hover:text-white transition-colors"
            >
              {settings.language === 'en' ? 'Pause All' : 'Pausar Todos'}
            </button>
            <button 
              onClick={handleResumeAll}
              className="px-3 py-1.5 rounded-lg lf-surface-raised hover:bg-zinc-700 border border-zinc-700/40 text-[10px] font-bold lf-text-secondary hover:text-white transition-colors"
            >
              {settings.language === 'en' ? 'Resume All' : 'Retomar Todos'}
            </button>
            <button 
              onClick={handleCancelAll}
              className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/30 border border-red-900/20 text-[10px] font-bold text-red-300 hover:text-red-200 transition-colors"
            >
              {settings.language === 'en' ? 'Cancel All' : 'Cancelar Todos'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Media Type Tabs + Status Chips */}
      <div className="space-y-2">
        {/* Row 1: Media type tabs (underline style, full width) */}
        <div className="flex items-center gap-1 border-b lf-border">
          {[
            { id: 'all', label: settings.language === 'en' ? 'All' : 'Todos', icon: null },
            { id: 'audio', label: 'Audio', icon: '🔊' },
            { id: 'video', label: 'Video', icon: '🎞️' },
            { id: 'image', label: 'Imagem', icon: '🖼️' },
            { id: 'playlist', label: 'Playlists', icon: '📋' },
          ].map((tab) => {
            const isActive = mediaFilter === tab.id;
            const count = tab.id === 'all'
              ? downloads.length
              : downloads.filter(d => getMediaType(d) === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setMediaFilter(tab.id as any)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all relative
                  ${isActive ? getAccentTextClass(settings) : 'lf-text-muted hover:text-zinc-300'}
                `}
              >
                <span>{tab.icon && `${tab.icon} `}{tab.label}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${isActive ? 'bg-white/15' : 'bg-white/5 lf-text-muted'}`}>
                    {count}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="active-media-tab"
                    className={`absolute bottom-0 left-0 right-0 h-0.5 ${getAccentBgClass(settings).split(' ')[0]}`}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Row 2: Status filter chips (discrete) */}
        <div className="flex flex-wrap items-center gap-1 px-1">
          <span className="text-[9px] lf-text-muted font-medium mr-0.5">
            {settings.language === 'en' ? 'Status:' : 'Filtros:'}
          </span>
          {[
            { id: 'downloading', label: settings.language === 'en' ? 'Downloading' : 'Baixando', icon: <TrendingUp size={9} /> },
            { id: 'queued', label: settings.language === 'en' ? 'Queued' : 'Fila', icon: <Clock size={9} /> },
            { id: 'completed', label: settings.language === 'en' ? 'Done' : 'Prontos', icon: <CheckCircle2 size={9} /> },
            { id: 'paused', label: settings.language === 'en' ? 'Paused' : 'Pausados', icon: <Pause size={9} /> },
            { id: 'failed', label: settings.language === 'en' ? 'Failed' : 'Falhas', icon: <AlertTriangle size={9} /> },
            { id: 'cancelled', label: settings.language === 'en' ? 'Cancelled' : 'Cancelados', icon: <X size={9} /> },
          ].map((chip) => {
            const isActive = statusFilters.has(chip.id);
            const count = downloads.filter(d => d.status === chip.id).length;
            return (
              <button
                key={chip.id}
                onClick={() => toggleStatus(chip.id)}
                className={`
                  px-2 py-0.5 rounded text-[9px] font-medium transition-all flex items-center gap-0.5
                  ${isActive ? 'bg-white/10 lf-text-secondary border border-white/10' : 'lf-text-muted hover:text-zinc-400 border border-transparent'}
                `}
              >
                {chip.icon}
                {chip.label}
                {count > 0 && <span className="ml-0.5 text-[7px] opacity-50">{count}</span>}
              </button>
            );
          })}

          {/* Clear status filters button */}
          {statusFilters.size > 0 && (
            <>
              <div className="w-px h-3 bg-white/10 mx-0.5" />
              <button
                onClick={handleClearStatusFilters}
                className="px-2 py-0.5 rounded text-[9px] lf-text-muted hover:text-zinc-300 font-medium transition-colors"
              >
                {settings.language === 'en' ? 'Clear' : 'Limpar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Queue items list */}
      <div className="space-y-3.5">
        {filteredDownloads.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center rounded-2xl lf-surface/10 border border-dashed lf-border flex flex-col items-center justify-center space-y-3">
            <div className="p-3 rounded-2xl lf-surface/60 lf-text-muted">
              <Clock size={28} />
            </div>
            <div>
              <h4 className="font-semibold text-sm lf-text-secondary">{settings.language === 'en' ? 'No downloads found' : 'Nenhum download encontrado'}</h4>
              <p className="text-xs lf-text-muted mt-1">
                {settings.language === 'en' ? 'Your filtered download list is currently empty.' : 'Sua lista de downloads filtrada está vazia no momento.'}
              </p>
            </div>
          </div>
        ) : (
          /* Downloads Grid and List */
          <AnimatePresence initial={false}>
            {filteredDownloads.map((item, index) => {
              const platform = ProviderRegistry.getPlatformConfig(item.platform);
              const isQueued = item.status === 'queued';
              const isDownloading = item.status === 'downloading';
              const isPaused = item.status === 'paused';
              const isCompleted = item.status === 'completed';
              const isFailed = ['failed', 'cancelled'].includes(item.status);

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  className="p-4 rounded-xl glass-card flex flex-col md:flex-row gap-4 items-start md:items-center relative overflow-hidden group hover:bg-white/10 transition-colors"
                >
                  {/* Status left indicator colored bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : isPaused ? 'bg-amber-500' : 'bg-indigo-500'
                  }`} />

                  {/* Thumbnail */}
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

                  {/* Info contents details */}
                  <div className="flex-1 min-w-0 space-y-1.5 w-full">
                    <div className="flex flex-col sm:flex-row justify-between gap-1">
                      <h4 className="font-semibold text-xs text-white truncate pr-4" title={item.title}>
                        {item.title}
                      </h4>
                    </div>

                    {/* Feature tags row */}
                    <div className="flex flex-wrap gap-1">
                      {/* Platform badge with Lucide icon */}
                      {platform && (() => {
                        const PlatformIcon = platformIconMap[item.platform];
                        return (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold ${platform.color}`}>
                            {PlatformIcon && <PlatformIcon size={8} />}
                            {platform.name}
                          </span>
                        );
                      })()}
                      {/* Format ext chip */}
                      {item.format.ext && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-white/10 lf-text-secondary border border-white/10">
                          {item.format.ext.toUpperCase()}
                        </span>
                      )}
                      {/* Image source badge */}
                      {item.imageSource && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold border ${
                          item.imageSource === 'user-link'
                            ? 'bg-pink-900/60 text-pink-300 border-pink-800/40'
                            : 'bg-zinc-700/60 text-zinc-400 border-zinc-600/40'
                        }`}>
                          {item.imageSource === 'user-link' ? '🔗 Imagem URL' : '🖼️ Thumbnail'}
                        </span>
                      )}
                      {/* Subtitles */}
                      {(item.writeSubs || item.writeAutoSubs) && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-800/40">
                          <Subtitles size={8} />
                          {item.subLangs || 'EN'}
                        </span>
                      )}
                      {/* SponsorBlock */}
                      {item.sponsorblockRemove && item.sponsorblockRemove !== '' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-purple-900/60 text-purple-300 border border-purple-800/40">
                          <Shield size={8} />
                          Sponsor
                        </span>
                      )}
                      {/* Trimmed */}
                      {item.downloadSections && item.downloadSections !== '' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-amber-900/60 text-amber-300 border border-amber-800/40">
                          <Scissors size={8} />
                          Cortado
                        </span>
                      )}
                      {/* Audio Only */}
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

                    {/* Progress tracking bar */}
                    <div className="space-y-1">
                      <div className="relative w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : isPaused ? 'bg-amber-500' : getAccentBgClass(settings).split(' ')[0]
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      
                      {/* Sub progress metrics */}
                      <div className="flex justify-between items-center text-[10px] lf-text-muted font-medium font-mono">
                        <span className="lf-text-secondary">
                          {item.sizeTotal > 0
                            ? `${formatBytes(item.sizeDownloaded)} / ${formatBytes(item.sizeTotal)} (${item.progress}%)`
                            : `${formatBytes(item.sizeDownloaded)} (${item.progress}%)`
                          }
                        </span>
                        
                        <div className="flex gap-3">
                          {isDownloading && (
                            <>
                              <span className="flex items-center gap-0.5">
                                <TrendingUp size={10} className={getAccentTextClass(settings)} />
                                {formatSpeed(item.speed)}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Clock size={10} />
                                {formatEta(item.eta)}
                              </span>
                            </>
                          )}
                          {isQueued && <span className="lf-text-muted animate-pulse">{settings.language === 'en' ? 'Waiting in queue...' : 'Aguardando na fila...'}</span>}
                          {isPaused && <span className="text-amber-500">{settings.language === 'en' ? 'Paused' : 'Pausado'}</span>}
                          {isCompleted && <span className="text-emerald-500 flex items-center gap-0.5"><CheckCircle2 size={10} /> {settings.language === 'en' ? 'Completed' : 'Concluído'}</span>}
                          {isFailed && <span className="text-rose-500 flex items-center gap-0.5"><AlertTriangle size={10} /> {settings.language === 'en' ? 'Failed' : 'Falhou'}</span>}
                        </div>
                        {isFailed && item.error && (
                          <div className="text-[11px] text-rose-400/80 mt-1 break-words" title={item.error}>
                            {item.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick controls Toolbelt block */}
                  <div className="flex items-center gap-2 justify-end w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 lf-border">
                    {/* Reordering Controls (Only for queue/active lists) */}
                    {['queued', 'downloading', 'paused'].includes(item.status) && (
                      <div className="flex flex-col gap-1 mr-2 border-r lf-border pr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button 
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-white/5 lf-text-muted hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
                          title={settings.language === 'en' ? 'Move up' : 'Mover para cima'}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button 
                          onClick={() => handleMoveDown(index)}
                          disabled={index === downloads.length - 1}
                          className="p-1 rounded hover:bg-white/5 lf-text-muted hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
                          title={settings.language === 'en' ? 'Move down' : 'Mover para baixo'}
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    )}

                    {/* Main Action Toggles */}
                    {isDownloading && (
                      <button
                        onClick={() => DownloadEngine.pauseDownload(item.id)}
                        className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-750 lf-text-secondary hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Pause' : 'Pausar'}
                      >
                        <Pause size={13} />
                      </button>
                    )}
                    {isPaused && (
                      <button
                        onClick={() => DownloadEngine.resumeDownload(item.id)}
                        className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Resume' : 'Retomar'}
                      >
                        <Play size={13} fill="currentColor" />
                      </button>
                    )}
                    {isFailed && (
                      <button
                        onClick={() => DownloadEngine.retryDownload(item.id)}
                        className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Retry Download' : 'Repetir Download'}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}

                    {/* Common / Helper Utilities */}
                    {isCompleted && (
                      <button
                        onClick={() => handleOpenFolder(item)}
                        className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Open Folder' : 'Abrir Pasta'}
                      >
                        <FolderOpen size={13} />
                      </button>
                    )}

                    <button
                      onClick={() => setCommandPreview(item)}
                      className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text-secondary hover:text-zinc-200 transition-colors"
                      title={settings.language === 'en' ? 'View Command' : 'Ver Comando'}
                    >
                      <Code size={13} />
                    </button>

                    <button
                      onClick={() => handleShare(item)}
                      className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text-secondary hover:text-zinc-200 transition-colors"
                      title={settings.language === 'en' ? 'Share Link' : 'Compartilhar Link'}
                    >
                      <Share2 size={13} />
                    </button>

                    <button
                      onClick={() => DownloadEngine.removeDownload(item.id)}
                      className="p-2.5 rounded-lg lf-surface-raised hover:bg-red-950/40 lf-text-muted hover:text-rose-400 transition-colors"
                      title={settings.language === 'en' ? 'Delete Record' : 'Excluir Registro'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {cookieRetry && (
          <CookieRetryPopup
            itemId={cookieRetry.itemId}
            error={cookieRetry.error}
            onUseCookies={handleUseCookies}
            onSkip={handleSkipCookieRetry}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {commandPreview && (
          <motion.div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCommandPreview(null)}
          >
            <motion.div
              className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700/50">
                <div className="flex items-center gap-2.5">
                  <Code size={16} className="text-zinc-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">
                    {settings.language === 'en' ? 'Download Command' : 'Comando de Download'}
                  </h3>
                </div>
                <button
                  onClick={() => setCommandPreview(null)}
                  className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-5 py-4">
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  {settings.language === 'en' ? 'Title' : 'Titulo'}
                </p>
                <p className="text-xs text-zinc-300 mb-4 truncate">{commandPreview.title}</p>

                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  yt-dlp
                </p>
                <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-emerald-400 whitespace-pre-wrap break-all">
                  {(() => {
                    const args = buildArgsPreview(commandPreview);
                    const lines: string[] = ['yt-dlp \\'];
                    for (let i = 0; i < args.length; i++) {
                      const arg = args[i];
                      if (i === args.length - 1) {
                        lines.push(`  "${arg}"`);
                      } else if (arg.startsWith('-')) {
                        const next = args[i + 1];
                        if (next && !next.startsWith('-')) {
                          lines.push(`  ${arg} "${next}" \\`);
                          i++;
                        } else {
                          lines.push(`  ${arg} \\`);
                        }
                      } else {
                        lines.push(`  "${arg}" \\`);
                      }
                    }
                    return lines.join('\n');
                  })()}
                </pre>
              </div>

              <div className="px-5 py-3 border-t border-zinc-700/50 flex justify-end">
                <button
                  onClick={() => {
                    const args = buildArgsPreview(commandPreview);
                    const cmd = 'yt-dlp ' + args.map(a => `"${a}"`).join(' ');
                    navigator.clipboard.writeText(cmd).then(() => {
                      showToast(settings.language === 'en' ? 'Command copied!' : 'Comando copiado!');
                    });
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
                >
                  {settings.language === 'en' ? 'Copy Command' : 'Copiar Comando'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
