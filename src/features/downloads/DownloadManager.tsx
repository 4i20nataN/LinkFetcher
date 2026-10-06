import React, { useState, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { DownloadItem } from '../../types';
import { DownloadEngine } from '../../core/engine/DownloadEngine';
import {
  Pause, X, CheckCircle2, AlertTriangle,
  Clock, TrendingUp, ShieldCheck,
} from 'lucide-react';
import { AnimatedCard } from '../../animation/AnimatedCard';
import { AnimatedList } from '../../animation/AnimatedList';
import { TabIndicator, LayoutGroup } from '../../animation/TabIndicator';
import { scaleIn, fadeIn } from '../../animation/variants';
import { useTranslation } from '../../core/i18n';
import {
  getAccentBgClass, getAccentTextClass
} from '../../components/ThemeWrapper';
import { getMediaType, formatSpeed } from './manager/downloadFormat';
import { DownloadCard } from './manager/DownloadCard';
import { CommandPreview } from './manager/CommandPreview';


export const DownloadManager: React.FC = () => {
  const { settings, downloads } = useApp();
  const { t } = useTranslation(settings);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'audio' | 'video' | 'image' | 'playlist'>('all');
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  // Cap de render: 300 itens com cards animados derrubam o scroll no armv7.
  // Contadores/filtros usam a lista cheia; só o DOM é paginado.
  const LIST_PAGE = 60;
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [commandPreview, setCommandPreview] = useState<DownloadItem | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2000);
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

  // Reordering helpers — por id: o índice visível é da lista filtrada e não
  // corresponde ao array interno do engine (só-queued).
  const handleMoveUp = (id: string) => {
    DownloadEngine.moveQueuedItem(id, -1);
  };

  const handleMoveDown = (id: string) => {
    DownloadEngine.moveQueuedItem(id, 1);
  };

  // Toggle status filter (multi-select OR)
  const toggleStatus = (status: string) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
    setVisibleCount(LIST_PAGE);
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
    // No Tauri (desktop + Android) `window.electron` é o shim p/ `fs_open_path`
    // (Kotlin `openFile` no mobile). Sem ele, avisa em vez de no-op mudo.
    if (!window.electron?.invoke) {
      showToast(settings.language === 'en' ? 'Open not available in this environment.' : 'Abertura indisponível neste ambiente.');
      return;
    }
    const target = item.filePath || settings.defaultDir || await window.electron.invoke('shell:getDownloadsPath');
    if (target) {
      window.electron.invoke('shell:openPath', target).catch((err: any) => {
        // Erro real no toast (não genérico): sem isso o "não abre" é mudo e
        // impossível de diagnosticar sem logcat.
        const detail = typeof err === 'string' ? err : err?.message;
        showToast((settings.language === 'en' ? 'Failed to open: ' : 'Falha ao abrir: ') + (detail || target));
      });
    }
  };

  // Calculate global summary states
  const activeDownloads = useMemo(() => downloads.filter(d => d.status === 'downloading'), [downloads]);
  const totalSpeed = useMemo(() => activeDownloads.reduce((sum, d) => sum + d.speed, 0), [activeDownloads]);
  
  const downloadingOrQueued = useMemo(() => downloads.filter(d => ['downloading', 'queued'].includes(d.status)), [downloads]);
  const overallProgress = downloadingOrQueued.length > 0 
    ? Math.floor(downloadingOrQueued.reduce((sum, d) => sum + d.progress, 0) / downloadingOrQueued.length)
    : 0;

  // Filter list: media type (AND) + status (OR)
  const filteredDownloads = useMemo(() => downloads.filter(item => {
    // Media type filter (AND)
    if (mediaFilter !== 'all') {
      if (getMediaType(item) !== mediaFilter) return false;
    }
    // Status filter (OR) — if none active, show all
    if (statusFilters.size > 0) {
      if (!statusFilters.has(item.status)) return false;
    }
    return true;
  }), [downloads, mediaFilter, statusFilters]);

  // Ordem real da fila (só-queued): base p/ habilitar as setas de reordenar.
  const queuedIds = useMemo(() => downloads.filter(d => d.status === 'queued').map(d => d.id), [downloads]);

  return (
    <LayoutGroup>
    <div className="max-w-4xl mx-auto space-y-6 py-2 md:py-6 px-4 relative">
      {/* Toast alert popup */}
      <AnimatedList>
        {toastMsg && (
          <AnimatedCard
            variant={scaleIn}
            className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-50 px-4 py-3 rounded-xl lf-surface border lf-border-strong text-xs font-semibold text-white shadow-2xl flex items-center gap-2.5"
          >
            {settings.iconStyle === 'emoji' ? <span>✅</span> : <ShieldCheck size={16} className={getAccentTextClass(settings)} />}
            {toastMsg}
          </AnimatedCard>
        )}
      </AnimatedList>

      {/* Header Info */}
      <div className="text-center md:text-left space-y-2">
        <h2 className="font-display font-extrabold text-2xl md:text-4xl text-white tracking-tight leading-tight break-words">
          {t('downloadsTitle')}
        </h2>
        <p className="lf-text-secondary text-sm md:text-base">
          {t('downloadsSubtitle')}
        </p>
      </div>

      {/* Global Progress Dashboard Stats */}
      {downloadingOrQueued.length > 0 && (
        <AnimatedCard
          variant={fadeIn}
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
                  /* Sem transition: atualiza 4x/s e interpolar em loop repinta sem parar */
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
              {/* Sem bounce: animação infinita decorativa repinta sem parar */}
              <TrendingUp size={20} />
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
          </AnimatedCard>
      )}

      {/* Media Type Tabs + Status Chips */}
      <div className="space-y-2">
        {/* Row 1: Media type tabs (underline style, full width) */}
        <div className="flex items-center gap-1 border-b lf-border overflow-x-auto overscroll-contain">
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
                onClick={() => { setMediaFilter(tab.id as any); setVisibleCount(LIST_PAGE); }}
                className={`
                  flex-1 shrink-0 min-w-16 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold transition-all relative
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
                  <TabIndicator
                    layoutId="active-media-tab"
                    className={`absolute bottom-0 left-0 right-0 h-0.5 ${getAccentBgClass(settings).split(' ')[0]}`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Row 2: Status filter chips (discrete) */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs lf-text-muted font-medium mr-1">
            {settings.language === 'en' ? 'Status:' : 'Filtros:'}
          </span>
          {[
            { id: 'downloading', label: settings.language === 'en' ? 'Downloading' : 'Baixando', icon: settings.iconStyle === 'emoji' ? <span className="text-sm">📊</span> : <TrendingUp size={13} className={getAccentTextClass(settings)} /> },
            { id: 'queued', label: settings.language === 'en' ? 'Queued' : 'Fila', icon: settings.iconStyle === 'emoji' ? <span className="text-sm">⏳</span> : <Clock size={13} className={getAccentTextClass(settings)} /> },
            { id: 'completed', label: settings.language === 'en' ? 'Done' : 'Prontos', icon: settings.iconStyle === 'emoji' ? <span className="text-sm">✅</span> : <CheckCircle2 size={13} className={getAccentTextClass(settings)} /> },
            { id: 'paused', label: settings.language === 'en' ? 'Paused' : 'Pausados', icon: settings.iconStyle === 'emoji' ? <span className="text-sm">⏸️</span> : <Pause size={13} className={getAccentTextClass(settings)} /> },
            { id: 'failed', label: settings.language === 'en' ? 'Failed' : 'Falhas', icon: settings.iconStyle === 'emoji' ? <span className="text-sm">⚠️</span> : <AlertTriangle size={13} className={getAccentTextClass(settings)} /> },
            { id: 'cancelled', label: settings.language === 'en' ? 'Cancelled' : 'Cancelados', icon: settings.iconStyle === 'emoji' ? <span className="text-sm">❌</span> : <X size={13} className={getAccentTextClass(settings)} /> },
          ].map((chip) => {
            const isActive = statusFilters.has(chip.id);
            const count = downloads.filter(d => d.status === chip.id).length;
            return (
              <button
                key={chip.id}
                onClick={() => toggleStatus(chip.id)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5
                  ${isActive ? 'bg-white/10 lf-text-secondary border border-white/10' : 'lf-text-muted hover:text-zinc-400 border border-transparent'}
                `}
              >
                {chip.icon}
                {chip.label}
                {count > 0 && <span className="ml-0.5 text-[10px] opacity-50">{count}</span>}
              </button>
            );
          })}

          {/* Clear status filters button */}
          {statusFilters.size > 0 && (
            <>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button
                onClick={handleClearStatusFilters}
                className="px-3 py-1.5 rounded-lg text-xs lf-text-muted hover:text-zinc-300 font-medium transition-colors"
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
              {settings.iconStyle === 'emoji' ? <span className="text-2xl">⏳</span> : <Clock size={28} className={getAccentTextClass(settings)} />}
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
          <>
          <AnimatedList initial={false}>
                       {filteredDownloads.slice(0, visibleCount).map((item) => {
              const queuePos = queuedIds.indexOf(item.id);
              return (
                <DownloadCard
                  key={item.id}
                  item={item}
                  settings={settings}
                  t={t}
                  queuePos={queuePos}
                  queuedTotal={queuedIds.length}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onOpenFolder={handleOpenFolder}
                  onShare={handleShare}
                  onPreview={setCommandPreview}
                />
              );
            })}
          </AnimatedList>
          {filteredDownloads.length > visibleCount && (
            <button
              onClick={() => setVisibleCount(c => c + LIST_PAGE)}
              className="w-full py-2.5 rounded-xl lf-surface-40 border lf-border lf-text-secondary hover:text-white text-xs font-semibold transition-colors"
            >
              {settings.language === 'en'
                ? `Show more (${filteredDownloads.length - visibleCount} remaining)`
                : `Mostrar mais (${filteredDownloads.length - visibleCount} restantes)`}
            </button>
          )}
          </>
        )}
      </div>

      <AnimatedList>
        {commandPreview && (
          <CommandPreview
            item={commandPreview}
            settings={settings}
            onClose={() => setCommandPreview(null)}
            showToast={showToast}
          />
        )}
      </AnimatedList>
    </div>
    </LayoutGroup>
  );
};
