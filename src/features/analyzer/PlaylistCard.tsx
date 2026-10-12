// Card de playlist: preview + config única p/ todos os vídeos.
// Personalizado atrás do PRO (mesma regra do download unitário);
// o painel usa 1 vídeo de referência (sem probe por item).
import React, { Suspense, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../core/i18n';
import {
  getAccentBgClass, getAccentTextClass, getAccentBorderClass
} from '../../components/ThemeWrapper';
import { AnimatedCard } from '../../animation/AnimatedCard';
import { AnimatedList } from '../../animation/AnimatedList';
import { slideUpStrong } from '../../animation/variants';
import { PlatformBadge } from '../../components/PlatformBadge';
import { ProviderRegistry } from '../../core/plugins/Providers';
import { ListMusic, ChevronUp, ChevronDown, Download, Lock, Clapperboard, Music, Settings2, Star, Clock, Image as ImageIcon, FolderOpen, Play, X } from 'lucide-react';
import type { MediaFormat, MediaInfo, PlaylistInfo } from '../../types';
import type { FormatOptions } from '../downloads/FormatOptions';
import { formatCompactViews } from '../../core/ytdlp/playlistUtils';

const FormatSelector = React.lazy(() => import('../downloads/FormatSelector').then(m => ({ default: m.FormatSelector })));

export type BulkKind = 'custom' | 'audio' | 'video';

export interface PlaylistCardProps {
  playlistLoading: boolean;
  playlistInfo: PlaylistInfo | null;
  playlistExpanded: boolean;
  setPlaylistExpanded: (v: boolean) => void;
  proActive: boolean;
  onDownloadAll: (kind: BulkKind) => void;
  onUnlockPro: () => void;
  /** 1º vídeo com probe full: base real do painel (resoluções, codecs, fps). */
  refMedia: MediaInfo | null;
  refLoading: boolean;
  formatOptions: FormatOptions;
  onFormatSelect: (o: FormatOptions) => void;
  onFormatChange: (f: MediaFormat) => void;
  isFav: boolean;
  isLater: boolean;
  onToggleFav: () => void;
  onToggleLater: () => void;
  showCoverFormats: boolean;
  onDownloadCover: (targetExt?: 'jpg' | 'png' | 'webp') => void;
  /** Clique num item: confirma antes de analisar o vídeo avulso. */
  onAnalyzeItem: (url: string) => void;
  /** Remove o item só da lista em tela (não mexe no YouTube). */
  onRemoveItem: (id: string) => void;
}

export function PlaylistCard({
  playlistLoading, playlistInfo, playlistExpanded, setPlaylistExpanded,
  proActive, onDownloadAll, onUnlockPro,
  refMedia, refLoading, formatOptions, onFormatSelect, onFormatChange,
  isFav, isLater, onToggleFav, onToggleLater, showCoverFormats, onDownloadCover,
  onAnalyzeItem, onRemoveItem,
}: PlaylistCardProps) {
  const { settings } = useApp();
  const { t } = useTranslation(settings);
  const isEn = settings.language === 'en';
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  // Expansão paginada: "Ver todos" em playlist de 1300+ itens montava 1300
  // cards com thumb de uma vez (travada + pico de RAM). Mesmo padrão da
  // fila de downloads: lote inicial + "mostrar mais".
  const EXPANDED_PAGE = 100;
  const [visibleItems, setVisibleItems] = useState(EXPANDED_PAGE);
  const playlistId = playlistInfo?.id;
  useEffect(() => { setVisibleItems(EXPANDED_PAGE); }, [playlistId]);
  const platformConfig = playlistInfo ? ProviderRegistry.getPlatformConfig(playlistInfo.platform) : null;
  const customLocked = !proActive;
  // 0 itens nunca renderiza ações (o handler já barra).
  if (!playlistLoading && (!playlistInfo || playlistInfo.items.length === 0)) return null;
  return (
    <>
      {playlistLoading && (
        <div className="p-6 rounded-3xl glass-card text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full mx-auto" />
          <p className="lf-text-secondary text-sm">
            {isEn ? 'Loading playlist...' : 'Carregando playlist...'}
          </p>
        </div>
      )}

      <AnimatedList>
        {playlistInfo && !playlistLoading && (
          <AnimatedCard
            variant={slideUpStrong}
            className="p-5 rounded-3xl glass-card shadow-2xl space-y-4"
          >
            <div className="flex flex-col md:flex-row gap-6">
              <div className="relative group w-full md:w-64 h-40 rounded-xl shrink-0 overflow-hidden border lf-border lf-surface">
                {playlistInfo.thumbnailUrl ? (
                  <img
                    src={playlistInfo.thumbnailUrl}
                    alt={playlistInfo.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-600/20">
                    <ListMusic size={32} className={getAccentTextClass(settings)} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white">
                    <Play size={20} fill="currentColor" />
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="font-display font-bold text-xl md:text-2xl text-white leading-snug">
                    {playlistInfo.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm lf-text-secondary font-medium font-sans">
                    {playlistInfo.channel && (
                      <span className="lf-text-secondary font-semibold">{t('authorLabel')} {playlistInfo.channel}</span>
                    )}
                    {platformConfig && (
                      <PlatformBadge platformId={playlistInfo.platform} name={platformConfig.name} color={platformConfig.color} variant="inline" />
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-white/5 border lf-border text-[10px] uppercase font-mono tracking-wider flex items-center gap-1.5 lf-text-secondary">
                      {settings.iconStyle === 'emoji' ? <span>📋</span> : <ListMusic size={12} className="text-indigo-400" />}
                      {isEn ? 'Playlist' : 'Playlist'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1 text-xs lf-text-faint font-medium">
                    <span className="flex items-center gap-1 px-2">
                      {settings.iconStyle === 'emoji' ? <span>📁</span> : <FolderOpen size={12} className="text-emerald-400" />}
                      <span className="lf-text-secondary">{playlistInfo.items.length} {isEn ? 'items' : 'itens'}</span>
                    </span>
                    {playlistInfo.totalDuration && playlistInfo.totalDuration > 0 && (
                      <>
                        <span className="text-zinc-700">|</span>
                        <span className="flex items-center gap-1 px-2">
                          {settings.iconStyle === 'emoji' ? <span>⏱️</span> : <Clock size={12} className="text-violet-400" />}
                          <span className="lf-text-secondary">
                            {Math.floor(playlistInfo.totalDuration / 3600) > 0
                              ? `${Math.floor(playlistInfo.totalDuration / 3600)}h ${Math.floor((playlistInfo.totalDuration % 3600) / 60)}min`
                              : `${Math.floor(playlistInfo.totalDuration / 60)}min`}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-start gap-2">
                  <button
                    onClick={onToggleFav}
                    className={`
                      px-3.5 py-2 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all
                      ${isFav
                        ? `${getAccentBorderClass(settings)} bg-current text-white`
                        : 'lf-border lf-surface-40 lf-text-secondary hover:text-white hover:bg-zinc-850'
                      }
                    `}
                    style={isFav ? { backgroundColor: `rgba(var(--color-primary-rgb), 0.1)`, color: 'var(--color-primary)' } : {}}
                  >
                    {settings.iconStyle === 'emoji' ? <span>⭐</span> : <Star size={14} fill={isFav ? 'currentColor' : 'none'} className={getAccentTextClass(settings)} />}
                    {isFav ? (isEn ? 'Favorited' : 'Favoritado') : t('favorite')}
                  </button>

                  <button
                    onClick={onToggleLater}
                    className={`
                      px-3.5 py-2 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all
                      ${isLater
                        ? `${getAccentBorderClass(settings)} bg-current text-white`
                        : 'lf-border lf-surface-40 lf-text-secondary hover:text-white hover:bg-zinc-850'
                      }
                    `}
                    style={isLater ? { backgroundColor: `rgba(var(--color-primary-rgb), 0.1)`, color: 'var(--color-primary)' } : {}}
                  >
                    {settings.iconStyle === 'emoji' ? <span>⏰</span> : <Clock size={14} className={getAccentTextClass(settings)} />}
                    {isLater ? t('inLaterBtn') : t('laterBtn')}
                  </button>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-start gap-1.5">
                      <button
                        onClick={() => onDownloadCover()}
                        disabled={customLocked}
                        title={customLocked ? (isEn ? 'PRO only' : 'Somente PRO') : undefined}
                        className={`
                          px-3.5 py-2 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all
                          ${customLocked
                            ? 'lf-border lf-surface-40 lf-text-secondary opacity-60 cursor-not-allowed'
                            : 'lf-border lf-surface-40 lf-text-secondary hover:text-white hover:bg-zinc-850'
                          }
                        `}
                      >
                        {customLocked
                          ? <Lock size={14} />
                          : (settings.iconStyle === 'emoji' ? <span>🖼️</span> : <ImageIcon size={14} className={getAccentTextClass(settings)} />)}
                        {isEn ? 'Download Thumbnail' : 'Baixar Capa'}
                      </button>
                      <span className="px-1 rounded text-[7px] font-bold leading-tight bg-amber-500 text-black border border-amber-600">PRO</span>
                    </div>
                    {showCoverFormats && (
                      <div className="flex gap-1.5">
                        {(['jpg', 'png', 'webp'] as const).map(fmt => (
                          <button
                            key={fmt}
                            onClick={() => onDownloadCover(fmt)}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase lf-surface-40 lf-border lf-text-secondary hover:text-white transition-all"
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {playlistInfo.items.slice(0, playlistExpanded ? visibleItems : 5).map((item) => {
                const pending = pendingUrl === item.url;
                return (
                <div
                  key={item.id}
                  // Fora da viewport o navegador pula layout/paint da linha
                  // (scroll em lista de 1300 sem lag; ignorado se sem suporte).
                  className="[content-visibility:auto] [contain-intrinsic-size:auto_64px]"
                >
                  <div className={pending ? 'flex flex-col md:flex-row gap-2' : ''}>
                    <div className={`flex items-center gap-1 px-1 py-0.5 rounded-lg transition-colors ${pending ? 'bg-white/10 flex-1 min-w-0' : 'hover:bg-white/5'}`}>
                      <button
                        onClick={() => setPendingUrl(p => (p === item.url ? null : item.url))}
                        title={isEn ? 'Analyze this video' : 'Analisar este vídeo'}
                        className="flex-1 min-w-0 flex items-center gap-3 px-2 py-2 rounded-lg text-left"
                      >
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-16 h-9 rounded-md object-cover shrink-0"
                          />
                        ) : (
                          <span className="text-[10px] lf-text-secondary w-5 text-center shrink-0">
                            {item.index}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-300 truncate">
                            {item.title}
                          </p>
                          {(item.uploader || item.views !== undefined || item.duration) && (
                            <p className="text-[10px] lf-text-muted truncate mt-0.5">
                              {[item.uploader,
                                item.views !== undefined ? formatCompactViews(item.views, isEn ? 'en' : 'pt') : '',
                                item.duration ? `${Math.floor(item.duration / 60)}:${(Math.floor(item.duration) % 60).toString().padStart(2, '0')}` : '',
                              ].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => { if (pending) setPendingUrl(null); onRemoveItem(item.id); }}
                        title={isEn ? 'Remove from list' : 'Remover da lista'}
                        aria-label={isEn ? 'Remove from list' : 'Remover da lista'}
                        className="p-2 rounded-lg lf-text-muted hover:text-red-400 hover:bg-white/5 transition-colors shrink-0"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {pending && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] border lf-border md:w-72 shrink-0">
                        <p className="flex-1 text-xs lf-text-secondary leading-snug">
                          {isEn ? 'Analyze this video alone?' : 'Analisar este vídeo avulso?'}
                        </p>
                        <button
                          onClick={() => { setPendingUrl(null); onAnalyzeItem(item.url); }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap transition-all"
                        >
                          {isEn ? 'Analyze' : 'Analisar'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            {playlistInfo.items.length > 5 && (
              <button
                onClick={() => {
                  if (playlistExpanded) setVisibleItems(EXPANDED_PAGE);
                  setPlaylistExpanded(!playlistExpanded);
                }}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs lf-text-secondary hover:text-zinc-300 transition-colors"
              >
                {playlistExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {playlistExpanded
                  ? isEn ? 'Show less' : 'Mostrar menos'
                  : isEn ? `Show all ${playlistInfo.items.length}` : `Ver todos (${playlistInfo.items.length})`}
              </button>
            )}
            {playlistExpanded && playlistInfo.items.length > visibleItems && (
              <button
                onClick={() => setVisibleItems((v) => v + EXPANDED_PAGE)}
                className="w-full py-2 rounded-xl lf-surface-40 border lf-border lf-text-secondary hover:text-white text-xs font-semibold transition-colors"
              >
                {isEn
                  ? `Show more (${playlistInfo.items.length - visibleItems} remaining)`
                  : `Mostrar mais (${playlistInfo.items.length - visibleItems} restantes)`}
              </button>
            )}

            {/* Gratuito primeiro (mesma ordem do vídeo unitário). */}
            <div className="border-t lf-border pt-4 space-y-2">
              <p className="font-bold text-white text-center text-base">
                {isEn ? '📥 Free Download' : '📥 Download Gratuito'}
              </p>
              <div className="grid grid-cols-2 gap-5">
                <button
                  onClick={() => onDownloadAll('video')}
                  className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:brightness-110 text-white font-bold fs-sm whitespace-nowrap transition-all shadow-lg shadow-blue-500/25 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Clapperboard size={15} className="text-white shrink-0" />
                  {isEn ? 'Default Video' : 'Vídeo Padrão'}
                </button>
                <button
                  onClick={() => onDownloadAll('audio')}
                  className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:brightness-110 text-white font-bold fs-sm whitespace-nowrap transition-all shadow-lg shadow-blue-500/25 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Music size={15} className="text-white shrink-0" />
                  {isEn ? 'MP3 Audio' : 'Áudio MP3'}
                </button>
              </div>
            </div>

            {/* Um ajuste vale p/ todos (sem corte/nome/desc). */}
            <div className="border-t lf-border pt-4 space-y-3">
              <p className="font-bold text-white text-center text-base flex items-center justify-center gap-2">
                <Settings2 size={16} className={getAccentTextClass(settings)} />
                {isEn ? 'Batch settings — one setup for all' : 'Ajustes do lote — uma config para todos'}
              </p>
              {refLoading && !refMedia && (
                <div className="h-40 lf-surface-40 rounded-xl animate-pulse" />
              )}
              {refMedia && (
                <Suspense fallback={<div className="h-40 lf-surface-40 rounded-xl animate-pulse" />}>
                  <FormatSelector
                    key={playlistInfo.id}
                    mediaInfo={refMedia}
                    formatOptions={formatOptions}
                    onFormatSelect={onFormatSelect}
                    onFormatChange={onFormatChange}
                    bulk
                  />
                </Suspense>
              )}
            </div>

            <div className="space-y-2">
              {proActive ? (
                <button
                  onClick={() => onDownloadAll('custom')}
                  className={`w-full py-2.5 rounded-xl font-display font-bold text-sm transition-all ${getAccentBgClass(settings)} hover:opacity-90 text-white shadow-lg`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Download size={14} />
                    {isEn ? `Download All (${playlistInfo.items.length})` : `Baixar Todos (${playlistInfo.items.length})`}
                  </span>
                </button>
              ) : (
                <button
                  onClick={onUnlockPro}
                  className="w-full py-2.5 rounded-xl font-display font-bold text-sm transition-all bg-zinc-600 cursor-pointer opacity-80 hover:opacity-100 text-white shadow-lg"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Lock size={14} />
                    {isEn ? `Download All with these settings (${playlistInfo.items.length})` : `Baixar Todos com estes ajustes (${playlistInfo.items.length})`}
                    <span className="px-1 rounded text-[7px] font-bold leading-tight bg-amber-500 text-black border border-amber-600">PRO</span>
                  </span>
                </button>
              )}
            </div>
          </AnimatedCard>
        )}
      </AnimatedList>
    </>
  );
}
