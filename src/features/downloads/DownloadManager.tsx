import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DownloadItem, AppSettings } from '../../types';
import { DownloadEngine } from '../../core/engine/DownloadEngine';
import { 
  Play, Pause, X, Trash2, FolderOpen, Share2, RotateCcw, 
  ArrowUp, ArrowDown, ListOrdered, CheckCircle2, AlertTriangle, 
  Clock, TrendingUp, HelpCircle, ShieldCheck, ChevronRight,
  Subtitles, Scissors, Shield, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../../core/i18n';
import { 
  getAccentBgClass, getAccentTextClass, getAccentBorderClass 
} from '../../components/ThemeWrapper';
import { ProviderRegistry } from '../../core/plugins/Providers';

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
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'paused' | 'failed_cancelled'>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2000);
  };

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

  const handleClearFinished = () => {
    DownloadEngine.clearHistory();
    showToast(settings.language === 'en' ? 'Finished history cleared' : 'Histórico concluído limpo');
  };

  // Reordering helpers
  const handleMoveUp = (index: number) => {
    DownloadEngine.reorderQueue(index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    DownloadEngine.reorderQueue(index, index + 1);
  };

  const handleShare = (item: DownloadItem) => {
    try {
      navigator.clipboard.writeText(item.url);
      showToast(settings.language === 'en' ? 'Original link copied for sharing!' : 'Link original copiado para compartilhamento!');
    } catch (_) {
      showToast(settings.language === 'en' ? 'Failed to copy link.' : 'Falha ao copiar link.');
    }
  };

  const handleOpenFolder = (item: DownloadItem) => {
    showToast(settings.language === 'en' ? `Folder opened virtually: ${settings.defaultDir}` : `Diretório aberto virtualmente: ${settings.defaultDir}`);
  };

  // Calculate global summary states
  const activeDownloads = downloads.filter(d => d.status === 'downloading');
  const totalSpeed = activeDownloads.reduce((sum, d) => sum + d.speed, 0);
  
  const downloadingOrQueued = downloads.filter(d => ['downloading', 'queued'].includes(d.status));
  const overallProgress = downloadingOrQueued.length > 0 
    ? Math.floor(downloadingOrQueued.reduce((sum, d) => sum + d.progress, 0) / downloadingOrQueued.length)
    : 0;

  // Filter list matching active category
  const filteredDownloads = downloads.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['downloading', 'queued'].includes(item.status);
    if (filter === 'completed') return item.status === 'completed';
    if (filter === 'paused') return item.status === 'paused';
    if (filter === 'failed_cancelled') return ['failed', 'cancelled'].includes(item.status);
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
            className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-white shadow-2xl flex items-center gap-2.5"
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
        <p className="text-zinc-400 text-sm md:text-base">
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
              <span className="text-[10px] text-zinc-500 font-mono uppercase block">{t('generalProgress')}</span>
              <span className="text-sm font-bold text-white block mt-0.5">
                {settings.language === 'en' ? 'Downloading' : 'Baixando'} {downloadingOrQueued.length} {downloadingOrQueued.length === 1 ? (settings.language === 'en' ? 'item' : 'mídia') : (settings.language === 'en' ? 'items' : 'mídias')}
              </span>
            </div>
          </div>

          {/* Speed stats */}
          <div className="flex items-center gap-3.5 border-y md:border-y-0 md:border-x border-white/5 py-4 md:py-0 md:px-6">
            <div className={`p-2 rounded-xl bg-zinc-900 ${getAccentTextClass(settings)} shrink-0`}>
              <TrendingUp size={20} className="animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 font-mono uppercase block">{t('activeSpeed')}</span>
              <span className="text-base font-bold text-white block mt-0.5">{formatSpeed(totalSpeed)}</span>
            </div>
          </div>

          {/* Bulk actions tools */}
          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
            <button 
              onClick={handlePauseAll}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/40 text-[10px] font-bold text-zinc-300 hover:text-white transition-colors"
            >
              {settings.language === 'en' ? 'Pause All' : 'Pausar Todos'}
            </button>
            <button 
              onClick={handleResumeAll}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/40 text-[10px] font-bold text-zinc-300 hover:text-white transition-colors"
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

      {/* Categories Switch Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-zinc-950/60 border border-white/5">
        {[
          { id: 'all', label: settings.language === 'en' ? 'All' : 'Todos' },
          { id: 'active', label: settings.language === 'en' ? 'Active' : 'Em Andamento' },
          { id: 'completed', label: settings.language === 'en' ? 'Completed' : 'Concluídos' },
          { id: 'paused', label: settings.language === 'en' ? 'Paused' : 'Pausados' },
          { id: 'failed_cancelled', label: settings.language === 'en' ? 'Failed / Cancelled' : 'Falhas e Cancelados' }
        ].map((tab) => {
          const isActive = filter === tab.id;
          const count = tab.id === 'all' 
            ? downloads.length 
            : tab.id === 'active' 
              ? downloadingOrQueued.length 
              : tab.id === 'completed' 
                ? downloads.filter(d => d.status === 'completed').length
                : tab.id === 'paused'
                  ? downloads.filter(d => d.status === 'paused').length
                  : downloads.filter(d => ['failed', 'cancelled'].includes(d.status)).length;

          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`
                px-4 py-2 rounded-lg text-xs font-semibold transition-all relative flex items-center gap-1.5
                ${isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="active-manager-tab"
                  className="absolute inset-0 bg-zinc-900 rounded-lg border border-white/5"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
              {count > 0 && (
                <span className={`relative z-10 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isActive ? 'bg-white/15 text-zinc-100' : 'bg-white/5 text-zinc-500'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {downloads.some(d => d.status === 'completed') && filter === 'completed' && (
          <button 
            onClick={handleClearFinished}
            className="ml-auto px-3 py-1 rounded-lg text-zinc-500 hover:text-zinc-300 text-[10px] font-bold transition-colors"
          >
            {t('clearCompleted')}
          </button>
        )}
      </div>

      {/* Queue items list */}
      <div className="space-y-3.5">
        {filteredDownloads.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center rounded-2xl bg-zinc-900/10 border border-dashed border-white/5 flex flex-col items-center justify-center space-y-3">
            <div className="p-3 rounded-2xl bg-zinc-900/60 text-zinc-500">
              <Clock size={28} />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-zinc-300">{settings.language === 'en' ? 'No downloads found' : 'Nenhum download encontrado'}</h4>
              <p className="text-xs text-zinc-500 mt-1">
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
                  <div className="relative w-full md:w-28 aspect-video rounded-lg overflow-hidden border border-white/5 bg-zinc-950 shrink-0">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {platform && (
                      <span className={`absolute top-1.5 left-1.5 p-1 rounded-md text-[8px] font-bold ${platform.color} shadow-lg`}>
                        {platform.name}
                      </span>
                    )}
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[8px] font-mono text-zinc-300">
                      {item.format.quality}
                    </span>
                  </div>

                  {/* Info contents details */}
                  <div className="flex-1 min-w-0 space-y-1.5 w-full">
                    <div className="flex flex-col sm:flex-row justify-between gap-1">
                      <h4 className="font-semibold text-xs text-white truncate pr-4" title={item.title}>
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-zinc-500 font-mono font-medium shrink-0">
                        {item.format.ext.toUpperCase()} • {formatBytes(item.sizeTotal)}
                      </span>
                    </div>

                    {/* Feature tags row */}
                    <div className="flex flex-wrap gap-1">
                      {/* Platform badge */}
                      {platform && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold ${platform.color}`}>
                          {platform.name}
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
                      <div className="flex justify-between items-center text-[10px] text-zinc-500 font-medium font-mono">
                        <span className="text-zinc-400">
                          {formatBytes(item.sizeDownloaded)} / {formatBytes(item.sizeTotal)} ({item.progress}%)
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
                          {isQueued && <span className="text-zinc-500 animate-pulse">{settings.language === 'en' ? 'Waiting in queue...' : 'Aguardando na fila...'}</span>}
                          {isPaused && <span className="text-amber-500">{settings.language === 'en' ? 'Paused' : 'Pausado'}</span>}
                          {isCompleted && <span className="text-emerald-500 flex items-center gap-0.5"><CheckCircle2 size={10} /> {settings.language === 'en' ? 'Completed' : 'Concluído'}</span>}
                          {isFailed && <span className="text-rose-500 flex items-center gap-0.5"><AlertTriangle size={10} /> {settings.language === 'en' ? 'Failed' : 'Falhou'}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick controls Toolbelt block */}
                  <div className="flex items-center gap-2 justify-end w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                    {/* Reordering Controls (Only for queue/active lists) */}
                    {['queued', 'downloading', 'paused'].includes(item.status) && (
                      <div className="flex flex-col gap-1 mr-2 border-r border-white/5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button 
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
                          title={settings.language === 'en' ? 'Move up' : 'Mover para cima'}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button 
                          onClick={() => handleMoveDown(index)}
                          disabled={index === downloads.length - 1}
                          className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
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
                        className="p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Pause' : 'Pausar'}
                      >
                        <Pause size={13} />
                      </button>
                    )}
                    {isPaused && (
                      <button
                        onClick={() => DownloadEngine.resumeDownload(item.id)}
                        className="p-2.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Resume' : 'Retomar'}
                      >
                        <Play size={13} fill="currentColor" />
                      </button>
                    )}
                    {isFailed && (
                      <button
                        onClick={() => DownloadEngine.retryDownload(item.id)}
                        className="p-2.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Retry Download' : 'Repetir Download'}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}

                    {/* Common / Helper Utilities */}
                    {isCompleted && (
                      <button
                        onClick={() => handleOpenFolder(item)}
                        className="p-2.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Open Folder' : 'Abrir Pasta'}
                      >
                        <FolderOpen size={13} />
                      </button>
                    )}

                    <button
                      onClick={() => handleShare(item)}
                      className="p-2.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title={settings.language === 'en' ? 'Share Link' : 'Compartilhar Link'}
                    >
                      <Share2 size={13} />
                    </button>

                    <button
                      onClick={() => DownloadEngine.removeDownload(item.id)}
                      className="p-2.5 rounded-lg bg-zinc-850 hover:bg-red-950/40 text-zinc-500 hover:text-rose-400 transition-colors"
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
    </div>
  );
};
