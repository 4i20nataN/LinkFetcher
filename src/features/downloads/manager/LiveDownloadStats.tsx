// Métricas vivas via refs (sem setState): o engine avisa 2x/s sem re-render.
import { useEffect, useRef } from 'react';
import { DownloadItem, type AppSettings } from '../../../types';
import { DownloadEngine } from '../../../core/engine/DownloadEngine';
import { getAccentBgClass, getAccentTextClass } from '../../../components/ThemeWrapper';
import { TrendingUp, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatBytes, formatSpeed, formatEta } from './downloadFormat';

export interface LiveDownloadStatsProps {
  item: DownloadItem;
  settings: AppSettings;
}

export function LiveDownloadStats({ item, settings }: LiveDownloadStatsProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const barWrapRef = useRef<HTMLDivElement>(null);
  const bytesRef = useRef<HTMLSpanElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const etaRef = useRef<HTMLSpanElement>(null);
  // Idioma via ref: a troca chega na próxima pintura.
  const langRef = useRef(settings.language);
  langRef.current = settings.language;
  const id = item.id;

  useEffect(() => {
    const onTick = (items: DownloadItem[]) => {
      const it = items.find((i) => i.id === id);
      if (!it) return;
      const en = langRef.current === 'en';
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${(it.progress / 100).toFixed(4)})`;
      }
      if (barWrapRef.current) {
        barWrapRef.current.setAttribute('aria-valuenow', String(Math.round(it.progress)));
        barWrapRef.current.setAttribute('aria-label', `Download progress: ${Math.round(it.progress)}%`);
      }
      const cutRange = (it.downloadSections || '').replace(/^\*/, '');
      const silent = it.status === 'downloading' && !!it.downloadSections && !(it.progress > 0);
      if (bytesRef.current) {
        bytesRef.current.textContent = silent
          ? `${formatBytes(it.sizeDownloaded)} ${en ? 'downloaded' : 'baixados'}`
          : (it.sizeTotal > 0
            ? `${formatBytes(it.sizeDownloaded)} / ${formatBytes(it.sizeTotal)} (${it.progress}%)${it.status === 'downloading' && cutRange ? ` · ${cutRange}` : ''}`
            : `${formatBytes(it.sizeDownloaded)} (${it.progress}%)`
          );
      }
      if (speedRef.current) speedRef.current.textContent = formatSpeed(it.speed);
      if (etaRef.current) etaRef.current.textContent = formatEta(it.eta);
    };
    DownloadEngine.addListener(onTick);
    return () => {
      DownloadEngine.removeListener(onTick);
    };
  }, [id]);

  const isDownloading = item.status === 'downloading';
  const isPaused = item.status === 'paused';
  const isCompleted = item.status === 'completed';
  const isFailed = ['failed', 'cancelled'].includes(item.status);
  const isCutSilent = isDownloading && !!item.downloadSections && !(item.progress > 0);
  const cutRange = (item.downloadSections || '').replace(/^\*/, '');

  return (
    <div className="space-y-1">
      <div
        ref={barWrapRef}
        className="relative w-full h-1.5 rounded-full bg-white/5 overflow-hidden"
        role="progressbar"
        aria-valuenow={item.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Download progress: ${item.progress}%`}
      >
        {isCutSilent ? (
          /* Recorte: sem % real → indeterminado + bytes vivos */
          <div className="h-full w-1/4 rounded-full lf-indeterminate-bar" />
        ) : (
          <div
            ref={barRef}
            className={`h-full w-full origin-left rounded-full transition-colors duration-300 ${
              isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : isPaused ? 'bg-amber-500' : getAccentBgClass(settings).split(' ')[0]
            }`}
            style={{ transform: `scaleX(${(item.progress / 100).toFixed(4)})` }}
          />
        )}
      </div>

      <div className="flex justify-between items-center gap-3 text-[10px] lf-text-muted font-medium font-mono">
        <span
          ref={bytesRef}
          className="lf-text-secondary shrink-0"
          title={isDownloading && cutRange
            ? (settings.language === 'en'
              ? `Full video total — section ${cutRange} is extracted at the end`
              : `Total do vídeo completo — o trecho ${cutRange} é extraído ao final`)
            : undefined}
        >
          {isCutSilent
            ? `${formatBytes(item.sizeDownloaded)} ${settings.language === 'en' ? 'downloaded' : 'baixados'}`
            : (item.sizeTotal > 0
              ? `${formatBytes(item.sizeDownloaded)} / ${formatBytes(item.sizeTotal)} (${item.progress}%)${isDownloading && cutRange ? ` · ${cutRange}` : ''}`
              : `${formatBytes(item.sizeDownloaded)} (${item.progress}%)`
            )
          }
        </span>

        <div className="flex gap-3 shrink-0">
          {isDownloading && (item.activity ? (
            <span className="lf-text-secondary animate-pulse" title={item.activity}>
              {item.activity}
            </span>
          ) : isCutSilent ? (
            <span className="lf-text-secondary animate-pulse">
              {item.processing
                ? (settings.language === 'en' ? 'Processing cut…' : 'Processando corte…')
                : (settings.language === 'en' ? 'Downloading slice…' : 'Baixando trecho…')}
            </span>
          ) : (
            <>
              <span className="flex items-center gap-0.5">
                {settings.iconStyle === 'emoji' ? <span>📊</span> : <TrendingUp size={10} className={getAccentTextClass(settings)} />}
                <span ref={speedRef}>{formatSpeed(item.speed)}</span>
              </span>
              <span className="flex items-center gap-0.5">
                {settings.iconStyle === 'emoji' ? <span>⏳</span> : <Clock size={10} className={getAccentTextClass(settings)} />}
                <span ref={etaRef}>{formatEta(item.eta)}</span>
              </span>
            </>
          ))}
          {item.status === 'queued' && <span className="lf-text-muted animate-pulse">{settings.language === 'en' ? 'Waiting in queue...' : 'Aguardando na fila...'}</span>}
          {isPaused && <span className="text-amber-500">{settings.language === 'en' ? 'Paused' : 'Pausado'}</span>}
          {isCompleted && <span className="text-emerald-500 flex items-center gap-0.5"><CheckCircle2 size={10} /> {settings.language === 'en' ? 'Completed' : 'Concluído'}</span>}
          {isFailed && <span className="text-rose-500 flex items-center gap-0.5"><AlertTriangle size={10} /> {settings.language === 'en' ? 'Failed' : 'Falhou'}</span>}
        </div>
      </div>
      {/* Erro em linha própria: na row ele era esmagado. */}
      {isFailed && item.error && (
        <div className="text-[11px] text-rose-400/80 mt-1 break-words line-clamp-3" title={item.error}>
          {item.error}
        </div>
      )}
      {/* Aviso não-fatal: vídeo íntegro, acessório pendente (legendas) */}
      {isCompleted && item.subWarning && (
        <div className="text-[11px] text-amber-400/80 mt-1 break-words line-clamp-3" title={item.subWarning}>
          {item.subWarning}
        </div>
      )}
    </div>
  );
}
