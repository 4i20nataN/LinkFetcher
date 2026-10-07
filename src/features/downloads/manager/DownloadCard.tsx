// Card de download (extraído do DownloadManager). Memoizado por identidade
// do item: o engine troca a ref (touch) só do item que mudou — cards intactos
// pulam o re-render (antes, cada tick de progresso re-renderizava a lista
// inteira). settings/queue entram no compare para tema/idioma/fila
// continuarem propagando.
import React from 'react';
import { DownloadItem, type AppSettings } from '../../../types';
import { DownloadEngine } from '../../../core/engine/DownloadEngine';
import {
  Play, Pause, Trash2, FolderOpen, Share2, RotateCcw,
  ArrowUp, ArrowDown, CheckCircle2, AlertTriangle,
  Clock, TrendingUp,
  Subtitles, Scissors, Shield, Tag, Code
} from 'lucide-react';
import { AnimatedCard } from '../../../animation/AnimatedCard';
import { slideExitLeft } from '../../../animation/variants';
import { useTranslation } from '../../../core/i18n';
import {
  getAccentBgClass, getAccentTextClass
} from '../../../components/ThemeWrapper';
import { ProviderRegistry } from '../../../core/plugins/Providers';
import { PlatformBadge } from '../../../components/PlatformBadge';
import { formatBytes, formatSpeed, formatEta } from './downloadFormat';

// Recorte (download_sections): o backend baixa o arquivo CHEIO pelo yt-dlp
// nativo (progresso real, resume) e corta local com ffmpeg (`-c copy`) ao
// final — delegar `--download-sections` ao yt-dlp faria o fetch via ffmpeg
// remoto (lento/403 no YouTube, stdout mudo, sem resume). Efeito colateral
// honesto: o total exibido é o do vídeo completo; o trecho é extraído no
// fim (fase `processing`). Por isso a linha de tamanho identifica o total
// como original quando há `downloadSections`.

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
}

export const DownloadCard = React.memo(function DownloadCard({
  item, settings, t, queuePos, queuedTotal,
  onMoveUp, onMoveDown, onOpenFolder, onShare, onPreview,
}: DownloadCardProps) {
              const platform = ProviderRegistry.getPlatformConfig(item.platform);
              const isQueued = item.status === 'queued';
              const isDownloading = item.status === 'downloading';
              const isPaused = item.status === 'paused';
              const isCompleted = item.status === 'completed';
              const isFailed = ['failed', 'cancelled'].includes(item.status);
              // Recorte sem % real (stdout mudo) → indeterminado + bytes vivos.
              // O total exibido seria do arquivo cheio: omitir p/ não induzir.
              const isCutSilent = isDownloading && !!item.downloadSections && !(item.progress > 0);
              // Intervalo do trecho (`*01:00-02:00` → `01:00-02:00`) p/ rotular
              // o total como original completo durante o download.
              const cutRange = (item.downloadSections || '').replace(/^\*/, '');
              // Posição na fila real (só-queued): setas desabilitadas nos extremos.

              return (
                <AnimatedCard
                  animateKey={item.id}
                  variant={slideExitLeft}
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
                      {/* Platform badge */}
                      {platform && (
                        <PlatformBadge platformId={item.platform} name={platform.name} color={platform.color} variant="inline" />
                      )}
                      {/* Format ext chip — concluído: extensão do ARQUIVO real
                          (stream único ignora --merge-output-format, ex. webm
                          com tag MP4); pendente: container prometido */}
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
                      {/* Image source badge */}
                      {item.imageSource && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold border ${
                          item.imageSource === 'user-link'
                            ? 'bg-pink-900/60 text-pink-300 border-pink-800/40'
                            : 'bg-zinc-700/60 text-zinc-400 border-zinc-600/40'
                        }`}>
                          {item.imageSource === 'user-link' ? `🔗 ${t('badgeImageUrl')}` : '🖼️ Thumbnail'}
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
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-semibold bg-amber-900/60 text-amber-300 border border-amber-800/40"
                          title={settings.language === 'en' ? 'Downloads the full video, then extracts this section locally' : 'Baixa o vídeo completo e extrai este trecho localmente'}
                        >
                          <Scissors size={8} />
                          {t('badgeCut')}
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
                      <div
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
                            /* scaleX em vez de width: largura anima layout a
                               cada tick (2x/s por card); transform só pinta. */
                            className={`h-full w-full origin-left rounded-full transition-colors duration-300 ${
                              isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : isPaused ? 'bg-amber-500' : getAccentBgClass(settings).split(' ')[0]
                            }`}
                            style={{ transform: `scaleX(${(item.progress / 100).toFixed(4)})` }}
                          />
                        )}
                      </div>

                      {/* Sub progress metrics */}
                      <div className="flex justify-between items-center gap-3 text-[10px] lf-text-muted font-medium font-mono">
                        <span
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
                                {formatSpeed(item.speed)}
                              </span>
                              <span className="flex items-center gap-0.5">
                                {settings.iconStyle === 'emoji' ? <span>⏳</span> : <Clock size={10} className={getAccentTextClass(settings)} />}
                                {formatEta(item.eta)}
                              </span>
                            </>
                          ))}
                          {isQueued && <span className="lf-text-muted animate-pulse">{settings.language === 'en' ? 'Waiting in queue...' : 'Aguardando na fila...'}</span>}
                          {isPaused && <span className="text-amber-500">{settings.language === 'en' ? 'Paused' : 'Pausado'}</span>}
                          {isCompleted && <span className="text-emerald-500 flex items-center gap-0.5"><CheckCircle2 size={10} /> {settings.language === 'en' ? 'Completed' : 'Concluído'}</span>}
                          {isFailed && <span className="text-rose-500 flex items-center gap-0.5"><AlertTriangle size={10} /> {settings.language === 'en' ? 'Failed' : 'Falhou'}</span>}
                        </div>
                      </div>
                      {/* Erro em linha própria, largura total: dentro da row de
                          métricas ele era esmagado entre bytes e status. */}
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
                  </div>

                  {/* Quick controls Toolbelt block */}
                  <div className="flex items-center gap-2 justify-end w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 lf-border">
                    {/* Reordering Controls (Only for queue/active lists) */}
                    {['queued', 'downloading', 'paused'].includes(item.status) && (
                      <div className="flex flex-col gap-1 mr-2 border-r lf-border pr-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          onClick={() => onMoveUp(item.id)}
                          disabled={queuePos <= 0}
                          className="p-1 rounded hover:bg-white/5 lf-text-muted hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
                          title={settings.language === 'en' ? 'Move up' : 'Mover para cima'}
                        >
                          {settings.iconStyle === 'emoji' ? <span>⬆️</span> : <ArrowUp size={12} className={getAccentTextClass(settings)} />}
                        </button>
                        <button
                          onClick={() => onMoveDown(item.id)}
                          disabled={queuePos < 0 || queuePos >= queuedTotal - 1}
                          className="p-1 rounded hover:bg-white/5 lf-text-muted hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent"
                          title={settings.language === 'en' ? 'Move down' : 'Mover para baixo'}
                        >
                          {settings.iconStyle === 'emoji' ? <span>⬇️</span> : <ArrowDown size={12} className={getAccentTextClass(settings)} />}
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
                        {settings.iconStyle === 'emoji' ? <span>⏸️</span> : <Pause size={13} className={getAccentTextClass(settings)} />}
                      </button>
                    )}
                    {isPaused && (
                      <button
                        onClick={() => DownloadEngine.resumeDownload(item.id)}
                        className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Resume' : 'Retomar'}
                      >
                        {settings.iconStyle === 'emoji' ? <span>▶️</span> : <Play size={13} fill="currentColor" className={getAccentTextClass(settings)} />}
                      </button>
                    )}
                    {isFailed && (
                      <button
                        onClick={() => DownloadEngine.retryDownload(item.id)}
                        className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Retry Download' : 'Repetir Download'}
                      >
                        {settings.iconStyle === 'emoji' ? <span>🔄</span> : <RotateCcw size={13} className={getAccentTextClass(settings)} />}
                      </button>
                    )}

                    {/* Common / Helper Utilities */}
                    {isCompleted && (
                      <button
                        onClick={() => onOpenFolder(item)}
                        className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white transition-colors"
                        title={settings.language === 'en' ? 'Open Folder' : 'Abrir Pasta'}
                      >
                        {settings.iconStyle === 'emoji' ? <span>📁</span> : <FolderOpen size={13} className={getAccentTextClass(settings)} />}
                      </button>
                    )}

                    <button
                      onClick={() => onPreview(item)}
                      className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text-secondary hover:text-zinc-200 transition-colors"
                      title={settings.language === 'en' ? 'View Command' : 'Ver Comando'}
                    >
                      {settings.iconStyle === 'emoji' ? <span>💻</span> : <Code size={13} className={getAccentTextClass(settings)} />}
                    </button>

                    <button
                      onClick={() => onShare(item)}
                      className="p-2.5 rounded-lg lf-surface-raised hover:bg-zinc-800 lf-text-secondary hover:text-zinc-200 transition-colors"
                      title={settings.language === 'en' ? 'Share Link' : 'Compartilhar Link'}
                    >
                      {settings.iconStyle === 'emoji' ? <span>🔗</span> : <Share2 size={13} className={getAccentTextClass(settings)} />}
                    </button>

                    <button
                      onClick={() => DownloadEngine.removeDownload(item.id)}
                      className="p-2.5 rounded-lg lf-surface-raised hover:bg-red-950/40 lf-text-muted hover:text-rose-400 transition-colors"
                      title={settings.language === 'en' ? 'Delete Record' : 'Excluir Registro'}
                    >
                      {settings.iconStyle === 'emoji' ? <span>🗑️</span> : <Trash2 size={13} className={getAccentTextClass(settings)} />}
                    </button>
                  </div>
        </AnimatedCard>
              );
}, (prev, next) =>
  prev.item === next.item &&
  prev.settings === next.settings &&
  prev.queuePos === next.queuePos &&
  prev.queuedTotal === next.queuedTotal
);
