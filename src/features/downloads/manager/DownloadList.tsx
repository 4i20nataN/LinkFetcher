// Lista memoizada por assinatura (ids+status): ticks quentes pulam a reconciliação.
// Handlers fora do comparador: estáveis por construção.
import React from 'react';
import { DownloadItem, type AppSettings } from '../../../types';
import { useTranslation } from '../../../core/i18n';
import { getAccentTextClass } from '../../../components/ThemeWrapper';
import { AnimatedList } from '../../../animation/AnimatedList';
import { Clock } from 'lucide-react';
import { DownloadCard } from './DownloadCard';

export interface DownloadListProps {
  items: DownloadItem[];
  visibleCount: number;
  onShowMore: () => void;
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

export function listSignature(items: DownloadItem[]): string {
  return items.map((i) => `${i.id}:${i.status}`).join('|');
}

export const DownloadList = React.memo(function DownloadList({
  items: filteredDownloads, visibleCount, onShowMore, settings, t, queuedIds,
  onMoveUp, onMoveDown, onOpenFolder, onShare, onPreview, onRequestDelete,
}: DownloadListProps) {
  return (
    // Padding folgado: a barra de gestos cobre o último card.
    <div className="space-y-3.5 pb-[max(5rem,env(safe-area-inset-bottom))]">
      {filteredDownloads.length === 0 ? (
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
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onOpenFolder={onOpenFolder}
                onShare={onShare}
                onPreview={onPreview}
                onRequestDelete={onRequestDelete}
              />
            );
          })}
        </AnimatedList>
        {filteredDownloads.length > visibleCount && (
          <button
            onClick={onShowMore}
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
  );
}, (prev, next) => {
  if (prev.visibleCount !== next.visibleCount) return false;
  if (prev.settings !== next.settings) return false;
  if (prev.queuedIds.join(',') !== next.queuedIds.join(',')) return false;
  return listSignature(prev.items) === listSignature(next.items);
});
