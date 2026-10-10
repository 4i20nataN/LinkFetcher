// Álbum de playlist na aba Playlists: um card por playlist (capa, nome,
// nº de faixas, tamanho total, progresso médio), expansível p/ as faixas.
// Faixas reaproveitam o DownloadCard — zero duplicação de ações.
import React from 'react';
import type { DownloadItem, AppSettings } from '../../../types';
import { useTranslation } from '../../../core/i18n';
import { getAccentTextClass } from '../../../components/ThemeWrapper';
import { AnimatedCard } from '../../../animation/AnimatedCard';
import { AnimatedList } from '../../../animation/AnimatedList';
import { ChevronDown, ListMusic } from 'lucide-react';
import { DownloadCard } from './DownloadCard';
import { formatBytes } from './downloadFormat';

export interface PlaylistGroup {
  key: string;
  title: string;
  items: DownloadItem[];
}

// Origem em lote vence; sem ela, a URL identifica o álbum (item avulso de
// playlist vira álbum de 1 faixa, nunca some da aba).
export function groupPlaylistItems(items: DownloadItem[]): PlaylistGroup[] {
  const order: string[] = [];
  const map = new Map<string, PlaylistGroup>();
  for (const item of items) {
    const key = item.playlistName || item.url;
    let g = map.get(key);
    if (!g) {
      g = { key, title: item.playlistName || item.title, items: [] };
      map.set(key, g);
      order.push(key);
    }
    g.items.push(item);
  }
  return order.map((k) => map.get(k)!);
}

export interface PlaylistAlbumCardProps {
  group: PlaylistGroup;
  expanded: boolean;
  onToggle: (key: string) => void;
  settings: AppSettings;
  t: ReturnType<typeof useTranslation>['t'];
  queuedIds: string[];
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onOpenFolder: (item: DownloadItem) => void;
  onShare: (item: DownloadItem) => void;
  onPreview: (item: DownloadItem) => void;
  onRequestDelete: (item: DownloadItem) => void;
}

export const PlaylistAlbumCard = React.memo(function PlaylistAlbumCard({
  group, expanded, onToggle, settings, t, queuedIds,
  onMoveUp, onMoveDown, onOpenFolder, onShare, onPreview, onRequestDelete,
}: PlaylistAlbumCardProps) {
  const { items } = group;
  const total = items.length;
  const done = items.filter((i) => i.status === 'completed').length;
  const downloading = items.filter((i) => i.status === 'downloading').length;
  const totalSize = items.reduce((s, i) => s + (i.sizeTotal || i.sizeDownloaded || 0), 0);
  const avgProgress = total > 0 ? Math.floor(items.reduce((s, i) => s + i.progress, 0) / total) : 0;
  const failed = items.some((i) => ['failed', 'cancelled'].includes(i.status));
  const paused = items.some((i) => i.status === 'paused');
  const allDone = total > 0 && done === total;
  const cover = items.find((i) => i.thumbnailUrl)?.thumbnailUrl;
  const isEn = settings.language === 'en';

  return (
    <AnimatedCard
      animateKey={group.key}
      className="rounded-xl glass-card relative overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
        allDone ? 'bg-emerald-500' : failed ? 'bg-rose-500' : paused ? 'bg-amber-500' : 'bg-indigo-500'
      }`} />
      <button
        onClick={() => onToggle(group.key)}
        aria-expanded={expanded}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="relative w-20 aspect-square rounded-lg overflow-hidden border lf-border lf-surface shrink-0">
          {cover ? (
            <img
              src={cover}
              alt={group.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center lf-text-muted">
              {settings.iconStyle === 'emoji' ? <span className="text-2xl">📋</span> : <ListMusic size={24} className={getAccentTextClass(settings)} />}
            </div>
          )}
          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono font-bold text-white">
            {total} {isEn ? (total === 1 ? 'track' : 'tracks') : (total === 1 ? 'faixa' : 'faixas')}
          </span>
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <h4 className="font-semibold text-sm text-white truncate" title={group.title}>
            {group.title}
          </h4>
          <p className="text-[11px] lf-text-secondary">
            {done}/{total} {isEn ? 'ready' : 'prontas'}
            {totalSize > 0 && <> • {formatBytes(totalSize)}</>}
            {downloading > 0 && <> • {isEn ? 'downloading' : 'baixando'} {downloading}</>}
          </p>
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full ${allDone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${allDone ? 100 : avgProgress}%` }}
            />
          </div>
        </div>

        <ChevronDown
          size={18}
          className={`shrink-0 lf-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2.5 border-t lf-border">
          <AnimatedList initial={false}>
            {items.map((item) => (
              <DownloadCard
                key={item.id}
                item={item}
                settings={settings}
                t={t}
                queuePos={queuedIds.indexOf(item.id)}
                queuedTotal={queuedIds.length}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onOpenFolder={onOpenFolder}
                onShare={onShare}
                onPreview={onPreview}
                onRequestDelete={onRequestDelete}
                hideAccent
              />
            ))}
          </AnimatedList>
        </div>
      )}
    </AnimatedCard>
  );
});
