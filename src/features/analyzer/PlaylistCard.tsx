// Card de playlist (extraído do LinkAnalyzer): loading + preview dos itens
// + download de todos com progresso/cancelamento do pool de probes.
import { useApp } from '../../context/AppContext';
import {
  getAccentBgClass, getAccentTextClass
} from '../../components/ThemeWrapper';
import { AnimatedCard } from '../../animation/AnimatedCard';
import { AnimatedList } from '../../animation/AnimatedList';
import { slideUpStrong } from '../../animation/variants';
import { ListMusic, ChevronUp, ChevronDown, Download } from 'lucide-react';
import type { PlaylistInfo } from '../../types';

export interface PlaylistCardProps {
  playlistLoading: boolean;
  playlistInfo: PlaylistInfo | null;
  playlistExpanded: boolean;
  setPlaylistExpanded: (v: boolean) => void;
  enqueueProgress: { done: number; total: number } | null;
  onCancelEnqueue: () => void;
  onDownloadAll: () => void;
}

export function PlaylistCard({
  playlistLoading, playlistInfo, playlistExpanded, setPlaylistExpanded,
  enqueueProgress, onCancelEnqueue, onDownloadAll,
}: PlaylistCardProps) {
  const { settings } = useApp();
  return (
    <>
      {/* PLAYLIST LOADING STATE */}
      {playlistLoading && (
        <div className="p-6 rounded-3xl glass-card text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full mx-auto" />
          <p className="lf-text-secondary text-sm">
            {settings.language === 'en' ? 'Loading playlist...' : 'Carregando playlist...'}
          </p>
        </div>
      )}

      {/* PLAYLIST PREVIEW CARD */}
      <AnimatedList>
        {playlistInfo && !playlistLoading && (
          <AnimatedCard
            variant={slideUpStrong}
            className="p-5 rounded-3xl glass-card shadow-2xl space-y-4"
          >
            {/* Playlist Header */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-indigo-600/20 flex items-center justify-center shrink-0">
                <ListMusic size={24} className={getAccentTextClass(settings)} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-display font-bold text-zinc-100 truncate">
                  {playlistInfo.title}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs lf-text-secondary">
                    {playlistInfo.items.length} {settings.language === 'en' ? 'items' : 'itens'}
                  </span>
                  {playlistInfo.totalDuration && playlistInfo.totalDuration > 0 && (
                    <span className="text-xs lf-text-secondary">
                      • {Math.floor(playlistInfo.totalDuration / 60)}min total
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Preview items (first 5) */}
            <div className="space-y-1.5">
              {playlistInfo.items.slice(0, playlistExpanded ? playlistInfo.items.length : 5).map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <span className="text-[10px] lf-text-secondary w-5 text-center shrink-0">
                    {item.index}
                  </span>
                  <span className="text-xs text-zinc-300 truncate flex-1">
                    {item.title}
                  </span>
                  {item.duration && (
                    <span className="text-[10px] lf-text-secondary shrink-0">
                      {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Expand/Collapse */}
            {playlistInfo.items.length > 5 && (
              <button
                onClick={() => setPlaylistExpanded(!playlistExpanded)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs lf-text-secondary hover:text-zinc-300 transition-colors"
              >
                {playlistExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {playlistExpanded
                  ? settings.language === 'en' ? 'Show less' : 'Mostrar menos'
                  : settings.language === 'en' ? `Show all ${playlistInfo.items.length}` : `Ver todos (${playlistInfo.items.length})`}
              </button>
            )}

            {/* Download All Button (com progresso + cancelar durante o pool) */}
            {enqueueProgress ? (
              <div className="space-y-2">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full w-full origin-left rounded-full bg-current opacity-80"
                    style={{ transform: `scaleX(${(enqueueProgress.done / Math.max(1, enqueueProgress.total)).toFixed(4)})` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs lf-text-secondary">
                    {enqueueProgress.done}/{enqueueProgress.total}
                  </span>
                  <button
                    onClick={onCancelEnqueue}
                    className="px-4 py-2 rounded-xl text-xs font-bold lf-surface-raised border lf-border lf-text-secondary hover:text-white transition-all"
                  >
                    {settings.language === 'en' ? 'Cancel' : 'Cancelar'}
                  </button>
                </div>
              </div>
            ) : (
            <button
              onClick={onDownloadAll}
              className={`w-full py-2.5 rounded-xl font-display font-bold text-sm transition-all ${getAccentBgClass(settings)} hover:opacity-90 text-white shadow-lg`}
            >
              <span className="flex items-center justify-center gap-2">
                <Download size={14} />
                {settings.language === 'en' ? `Download All (${playlistInfo.items.length})` : `Baixar Todos (${playlistInfo.items.length})`}
              </span>
            </button>
            )}
          </AnimatedCard>
        )}
      </AnimatedList>
    </>
  );
}
