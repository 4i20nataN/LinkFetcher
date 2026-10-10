import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Clock, Trash2, ArrowRight } from 'lucide-react';
import { AnimatedCard } from '../../animation/AnimatedCard';
import { AnimatedList } from '../../animation/AnimatedList';
import { slideUpLight } from '../../animation/variants';
import { useTranslation } from '../../core/i18n';
import { 
  getAccentBgClass, getAccentTextClass 
} from '../../components/ThemeWrapper';
import { ProviderRegistry } from '../../core/plugins/Providers';
import { PlatformBadge } from '../../components/PlatformBadge';

export const DownloadLaterView: React.FC = () => {
  const { settings, downloadLater, removeFromDownloadLater, setSelectedUrl, setActiveTab } = useApp();
  const { t } = useTranslation(settings);
  // Cap de render: mesmo padrão da fila de downloads.
  const LIST_PAGE = 60;
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE);

  const handleAnalyzeNow = (url: string) => {
    setSelectedUrl(url);
    setActiveTab('analyze');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2 md:py-6 px-4">
      <div className="text-center md:text-left space-y-2">
        <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white tracking-tight">
          {t('laterTitle')}
        </h2>
        <p className="lf-text-secondary text-sm md:text-base">
          {t('laterSubtitle')}
        </p>
      </div>

      {downloadLater.length === 0 ? (
        <div className="p-16 text-center rounded-3xl glass-card border-dashed flex flex-col items-center justify-center space-y-4">
          <div className="p-4 rounded-2xl lf-surface-raised/60 lf-text-muted">
            {settings.iconStyle === 'emoji' ? <span className="text-3xl">⏰</span> : <Clock size={32} className={getAccentTextClass(settings)} />}
          </div>
          <div>
            <h4 className="font-semibold text-sm lf-text-secondary">{t('noLater')}</h4>
            <p className="text-xs lf-text-muted mt-1 max-w-sm mx-auto">
              {t('noLaterDesc')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatedList initial={false}>
            {downloadLater.slice(0, visibleCount).map((item) => {
              const platform = ProviderRegistry.getPlatformConfig(item.platform);

              return (
                <AnimatedCard
                  animateKey={item.id}
                  variant={slideUpLight}
                  className="p-3.5 rounded-2xl glass-card flex flex-col sm:flex-row gap-4 justify-between sm:items-center group hover:bg-white/10 transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_120px]"
                >
                  <div className="flex gap-4 items-center min-w-0">
                    <div className="relative w-20 aspect-video rounded-lg overflow-hidden border lf-border lf-surface shrink-0">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                      />
                      {platform && (
                        <PlatformBadge platformId={item.platform} name={platform.name} color={platform.color} variant="overlay" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="font-semibold text-xs text-white leading-snug truncate pr-2 group-hover:text-zinc-200 transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex gap-3 text-[10px] lf-text-muted mt-1 font-mono font-medium">
                        <span className="truncate max-w-[200px]">{item.url}</span>
                        <span>• {settings.language === 'en' ? 'Added: ' : 'Adicionado: '}{new Date(item.dateAdded).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end pt-3 sm:pt-0 border-t sm:border-t-0 lf-border">
                    <button
                      onClick={() => removeFromDownloadLater(item.url)}
                      className="px-3 py-2 rounded-lg bg-zinc-850 hover:bg-red-950/40 lf-text-muted hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      {settings.iconStyle === 'emoji' ? <span>🗑️</span> : <Trash2 size={13} className={getAccentTextClass(settings)} />} {settings.language === 'en' ? 'Delete' : 'Excluir'}
                    </button>

                    <button
                      onClick={() => handleAnalyzeNow(item.url)}
                      className={`
                        px-4 py-2 rounded-lg text-white font-bold text-xs flex items-center gap-1 transition-all
                        ${getAccentBgClass(settings)}
                      `}
                    >
                      {settings.language === 'en' ? 'Analyze Now' : 'Analisar Agora'} <ArrowRight size={12} />
                    </button>
                  </div>
                </AnimatedCard>
              );
            })}
          </AnimatedList>
          {downloadLater.length > visibleCount && (
            <button
              onClick={() => setVisibleCount(c => c + LIST_PAGE)}
              className="w-full py-2.5 rounded-xl lf-surface-40 border lf-border lf-text-secondary hover:text-white text-xs font-semibold transition-colors"
            >
              {settings.language === 'en'
                ? `Show more (${downloadLater.length - visibleCount} remaining)`
                : `Mostrar mais (${downloadLater.length - visibleCount} restantes)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
