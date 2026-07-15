import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ProviderRegistry } from '../../core/plugins/Providers';
import { MediaInfo, MediaFormat } from '../../types';
import { 
  Play, Download, Clock, Star, ExternalLink, RefreshCw, 
  Trash2, ShieldCheck, HelpCircle, AlertCircle, Info, FileVideo, Music, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../../core/i18n';
import { 
  getAccentBgClass, getAccentTextClass, getAccentBorderClass, getAccentRingClass 
} from '../../components/ThemeWrapper';
import { DownloadEngine } from '../../core/engine/DownloadEngine';
import { FormatSelector, FormatOptions } from '../downloads/FormatSelector';
import { probeUrlWithAdapter } from '../../core/ytdlp/YtDlpAdapter';

const SummaryPanel: React.FC<{ formatOptions: FormatOptions; selectedFormat: MediaFormat | null; mediaInfo: MediaInfo }> = ({ formatOptions, selectedFormat, mediaInfo }) => {
  const items: { icon: string; label: string }[] = [];

  if (formatOptions.audioOnly) {
    items.push({ icon: '🎵', label: formatOptions.audioFormat.toUpperCase() });
    if (formatOptions.audioQuality) {
      const q = Number(formatOptions.audioQuality);
      items.push({ icon: '🔊', label: q === 0 ? 'Melhor qualidade' : `${q} kbps` });
    }
  } else {
    if (formatOptions.videoFormat) items.push({ icon: '🎬', label: formatOptions.videoFormat.toUpperCase() });
    // Extract resolution from format string pattern height<=XXXX
    const fmt = formatOptions.format || '';
    const heightMatch = fmt.match(/height[<=>]+(\d+)/);
    if (heightMatch) {
      const h = Number(heightMatch[1]);
      const resMap: Record<number, string> = { 2160: '4K', 1440: '1440p', 1080: '1080p', 720: '720p', 480: '480p', 360: '360p' };
      items.push({ icon: '📺', label: resMap[h] || `${h}p` });
    } else if (fmt.includes('best') || fmt === '') {
      items.push({ icon: '📺', label: 'Melhor' });
    } else if (selectedFormat?.quality) {
      items.push({ icon: '📺', label: selectedFormat.quality });
    }
    if (formatOptions.videoCodec) {
      const codecMap: Record<string, string> = { h264: 'H.264', h265: 'H.265', vp9: 'VP9', av01: 'AV1' };
      items.push({ icon: '🎞', label: codecMap[formatOptions.videoCodec] || formatOptions.videoCodec });
    }
  }

  if (formatOptions.sponsorblockRemove && formatOptions.sponsorblockRemove !== '') {
    const sb = formatOptions.sponsorblockRemove === 'all' ? 'Tudo' : formatOptions.sponsorblockRemove.replace(/,/g, ' + ');
    items.push({ icon: '⚡', label: `SponsorBlock: ${sb}` });
  }
  if (formatOptions.downloadSections) items.push({ icon: '✂', label: `Corte: ${formatOptions.downloadSections.replace(/\*/g, '')}` });
  if (formatOptions.fpsMax && formatOptions.fpsMax > 0) items.push({ icon: '🎞', label: `${formatOptions.fpsMax} FPS` });
  if (formatOptions.writeSubs || formatOptions.writeAutoSubs) {
    const lang = formatOptions.subLangs || 'en';
    items.push({ icon: '📋', label: lang.toUpperCase() });
  }
  if (formatOptions.customFilename) items.push({ icon: '📁', label: formatOptions.customFilename });

  if (items.length === 0) return null;

  return (
    <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Resultado</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[11px] text-zinc-300">
            <span className="text-[10px]">{item.icon}</span>
            {item.label}
          </span>
        ))}
        {mediaInfo.duration && (
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-300">
            <span className="text-[10px]">🕒</span>
            {mediaInfo.duration}
          </span>
        )}
      </div>
    </div>
  );
};

export const LinkAnalyzer: React.FC = () => {
  const { 
    settings, 
    toggleFavorite, 
    isFavorite, 
    addToDownloadLater, 
    isDownloadLater,
    removeFromDownloadLater,
    selectedUrl, 
    setSelectedUrl,
    setActiveTab
  } = useApp();
  const { t } = useTranslation(settings);

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<MediaFormat | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [formatOptions, setFormatOptions] = useState<FormatOptions>({
    format: 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b',
    audioOnly: false,
    audioFormat: 'mp3',
    audioQuality: '0',
    writeSubs: false,
    writeAutoSubs: false,
    subLangs: 'en',
    subFormat: 'srt',
    embedSubs: false,
    writeThumbnail: false,
    embedThumbnail: false,
    embedMetadata: true,
    videoOnly: false,
    sponsorblockRemove: '',
    fpsMax: 0,
    bandLimit: 0,
  });

  // Auto-analyze URL from search / download later trigger
  useEffect(() => {
    if (selectedUrl) {
      setUrl(selectedUrl);
      setSelectedUrl(''); // Clear
      handleSubmit();
    }
  }, [selectedUrl]);

  // Persist analyzer state to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('universal_downloader_analyzer_state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.url) setUrl(state.url);
        if (state.mediaInfo) setMediaInfo(state.mediaInfo);
        if (state.selectedFormat) setSelectedFormat(state.selectedFormat);
        if (state.formatOptions) setFormatOptions(state.formatOptions);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const state = { url, mediaInfo, selectedFormat, formatOptions };
    localStorage.setItem('universal_downloader_analyzer_state', JSON.stringify(state));
  }, [url, mediaInfo, selectedFormat, formatOptions]);

  const handleAnalyze = async (urlToAnalyze: string) => {
    const targetUrl = urlToAnalyze.trim();
    if (!targetUrl) return;

    setLoading(true);
    setError(null);
    setMediaInfo(null);
    setSelectedFormat(null);
    setFormatOptions({
      format: 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b',
      audioOnly: false,
      audioFormat: 'mp3',
      audioQuality: '0',
      writeSubs: false,
      writeAutoSubs: false,
      subLangs: 'en',
      subFormat: 'srt',
      embedSubs: false,
      writeThumbnail: false,
      embedThumbnail: false,
      embedMetadata: true,
      videoOnly: false,
      sponsorblockRemove: '',
      fpsMax: 0,
      bandLimit: 0,
    });
    setSuccessMsg(null);
    setProbeError(null);

    try {
      const provider = ProviderRegistry.getProviderForUrl(targetUrl);
      const info = await provider.analyze(targetUrl);
      
      setMediaInfo(info);
      if (info.formats && info.formats.length > 0) {
        setSelectedFormat(info.formats[0]); // Default to first format
      }
    } catch (err: any) {
      setError(err?.message || (settings.language === 'en' ? 'Error analyzing link. Please verify if link is correct.' : 'Erro ao analisar o link. Verifique se o link está correto.'));
    } finally {
      setLoading(false);
    }
  };

  const handleProbe = async (probeUrl: string) => {
    setProbeLoading(true);
    setProbeError(null);

    try {
      const data = await probeUrlWithAdapter({ url: probeUrl });
      if (data.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setProbeError(err.message);
    } finally {
      setProbeLoading(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError(settings.language === 'en' ? 'Please enter a valid URL starting with http:// or https://' : 'Insira uma URL válida começando com http:// ou https://');
      return;
    }
    await handleAnalyze(trimmed);
    handleProbe(trimmed);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      }
    } catch (e) {
      setError(settings.language === 'en' ? 'Clipboard permission was denied. Type or paste manually.' : 'A permissão de área de transferência foi negada. Digite ou cole o link manualmente.');
    }
  };

  const handleStartDownload = () => {
    if (!mediaInfo || !selectedFormat) {
      setError(settings.language === 'en' ? 'No format selected. Please wait for analysis to complete.' : 'Nenhum formato selecionado. Aguarde a analise completar.');
      return;
    }

    DownloadEngine.addDownload(
      mediaInfo,
      selectedFormat,
      formatOptions
    );
    setSuccessMsg(settings.language === 'en' ? `Added to queue: ${mediaInfo.title.substring(0, 45)}...` : `Adicionado à fila: ${mediaInfo.title.substring(0, 45)}...`);
    
    // Auto-redirect to downloads manager
    setTimeout(() => {
      setActiveTab('manager');
    }, 1200);
  };

  const handleToggleFav = () => {
    if (!mediaInfo) return;
    toggleFavorite({
      id: mediaInfo.id,
      title: mediaInfo.title,
      url: mediaInfo.originalUrl,
      platform: mediaInfo.platform,
      thumbnailUrl: mediaInfo.thumbnailUrl
    });
  };

  const handleToggleLater = () => {
    if (!mediaInfo) return;
    const isAdded = isDownloadLater(mediaInfo.originalUrl);
    if (isAdded) {
      removeFromDownloadLater(mediaInfo.originalUrl);
    } else {
      addToDownloadLater({
        id: mediaInfo.id,
        title: mediaInfo.title,
        url: mediaInfo.originalUrl,
        platform: mediaInfo.platform,
        thumbnailUrl: mediaInfo.thumbnailUrl
      });
    }
  };

  const handleDownloadThumbnail = async () => {
    if (!mediaInfo || !mediaInfo.thumbnailUrl) return;
    try {
      setSuccessMsg(settings.language === 'en' ? 'Downloading thumbnail...' : 'Baixando capa...');
      
      const filename = `thumbnail_${mediaInfo.id || 'media'}.jpg`;
      const hasElectronBridge = typeof window !== 'undefined' && !!(window as any).electron?.invoke;
      if (hasElectronBridge) {
        const result = await (window as any).electron.invoke('download-file', {
          url: mediaInfo.thumbnailUrl,
          filename,
        });
        if (result?.canceled) {
          setSuccessMsg(null);
          return;
        }
      } else {
        const proxiedUrl = `/api/proxy-download?url=${encodeURIComponent(mediaInfo.thumbnailUrl)}&filename=${encodeURIComponent(filename)}`;
        const a = document.createElement('a');
        a.href = proxiedUrl;
        a.target = '_blank';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
      setSuccessMsg(settings.language === 'en' ? 'Thumbnail downloaded successfully!' : 'Capa baixada com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.warn('Error downloading thumbnail:', err);
      setSuccessMsg(settings.language === 'en' ? 'Failed to download thumbnail' : 'Falha ao baixar capa');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const platformConfig = mediaInfo ? ProviderRegistry.getPlatformConfig(mediaInfo.platform) : null;
  const isFav = mediaInfo ? isFavorite(mediaInfo.originalUrl) : false;
  const isLater = mediaInfo ? isDownloadLater(mediaInfo.originalUrl) : false;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2 md:py-6 px-4">
      {/* Title Header */}
      <div className="text-center md:text-left space-y-2">
        <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white tracking-tight">
          {t('universalDownloader')}
        </h2>
        <p className="text-zinc-400 text-sm md:text-base">
          {settings.language === 'en' 
            ? 'Enter video, audio or image link from any supported platform to start.' 
            : 'Insira o link de vídeos, áudios ou imagens de qualquer plataforma suportada para começar.'}
        </p>
      </div>

      {/* Main Input Box */}
      <div className="p-4 md:p-6 rounded-3xl glass-card shadow-2xl">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('mainPlaceholder')}
              className={`
                w-full pl-4 pr-12 py-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 text-sm text-white placeholder-zinc-500
                focus:border-transparent focus:outline-none focus:ring-2 ${getAccentRingClass(settings)} transition-all
              `}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {url && (
              <button
                onClick={() => {
                  setUrl('');
                  setMediaInfo(null);
                  setSelectedFormat(null);
                  setProbeError(null);
                  setFormatOptions({
                    format: 'bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b',
                    audioOnly: false,
                    audioFormat: 'mp3',
                    audioQuality: '0',
                    writeSubs: false,
                    writeAutoSubs: false,
                    subLangs: 'en',
                    subFormat: 'srt',
                    embedSubs: false,
                    writeThumbnail: false,
                    embedThumbnail: false,
                    embedMetadata: true,
                    videoOnly: false,
                    sponsorblockRemove: '',
                    fpsMax: 0,
                    bandLimit: 0,
                  });
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handlePaste}
              type="button"
              className="flex-1 md:flex-none px-4 py-3.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-850 text-zinc-200 border border-zinc-700/50 hover:text-white font-medium text-sm transition-all"
            >
              {t('btnPaste')}
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={loading || !url}
              className={`
                flex-1 md:flex-none px-6 py-3.5 rounded-xl text-white font-semibold text-sm transition-all shadow-lg
                ${loading || !url 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50 shadow-none' 
                  : `${getAccentBgClass(settings)} hover:shadow-indigo-500/20`
                }
              `}
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <RefreshCw size={16} className="animate-spin" /> {settings.language === 'en' ? 'Analyzing...' : 'Analisando...'}
                </span>
              ) : (
                t('btnAnalyze')
              )}
            </button>
          </div>
        </div>

        {/* Supported platforms strip */}
        <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-zinc-500">
          <span className="font-mono uppercase tracking-wider text-[10px]">{t('supportedPlats')}</span>
          <div className="flex flex-wrap gap-2">
            {['YouTube', 'TikTok', 'Instagram', 'Facebook', 'X (Twitter)', 'SoundCloud', 'Spotify', 'Twitch'].map((plat) => (
              <span key={plat} className="px-2.5 py-1 rounded-lg glass-pill text-zinc-300 font-medium hover:bg-white/10 transition-colors">
                {plat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Error View */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3"
        >
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">{settings.language === 'en' ? 'Analysis failed' : 'Falha na análise'}</h4>
            <p className="text-xs mt-1 text-red-300">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Success Notification pop */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3 shadow-lg shadow-emerald-500/5"
        >
          <ShieldCheck size={20} className="shrink-0" />
          <span className="font-semibold text-sm">{successMsg}</span>
        </motion.div>
      )}

      {/* Skeleton Loading Card */}
      {loading && (
        <div className="p-4 md:p-6 rounded-2xl bg-zinc-900/40 border border-white/5 animate-pulse space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-56 h-36 bg-zinc-800 rounded-xl shrink-0" />
            <div className="flex-1 space-y-4">
              <div className="h-4 bg-zinc-800 rounded-full w-2/3" />
              <div className="h-3 bg-zinc-800 rounded-full w-1/3" />
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="h-3 bg-zinc-800 rounded-full w-3/4" />
                <div className="h-3 bg-zinc-800 rounded-full w-1/2" />
                <div className="h-3 bg-zinc-800 rounded-full w-2/3" />
                <div className="h-3 bg-zinc-800 rounded-full w-1/3" />
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 space-y-4">
            <div className="h-4 bg-zinc-800 rounded-full w-1/4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-zinc-800 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RICH CONTENT CARD */}
      <AnimatePresence>
        {mediaInfo && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-4 md:p-6 rounded-3xl glass-card shadow-2xl space-y-6 overflow-hidden"
          >
            {/* Header / Thumbnail Block */}
            <div className="flex flex-col md:flex-row gap-6">
              {/* Thumbnail Container */}
              <div className="relative group w-full md:w-64 h-40 rounded-xl shrink-0 overflow-hidden border border-white/5 bg-zinc-950">
                <img 
                  src={mediaInfo.thumbnailUrl} 
                  alt={mediaInfo.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white">
                    <Play size={20} fill="currentColor" />
                  </div>
                </div>
                {/* Platform Badge overlay */}
                {platformConfig && (
                  <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold ${platformConfig.color} shadow-lg flex items-center gap-1.5`}>
                    {platformConfig.name}
                  </span>
                )}
              </div>

              {/* Rich Metadata Information */}
              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="font-display font-bold text-lg md:text-xl text-white leading-snug">
                    {mediaInfo.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-400 font-medium font-sans">
                    <span className="text-zinc-300 font-semibold">{t('authorLabel')} {mediaInfo.author}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1.5 text-zinc-300">
                      {mediaInfo.type === 'video' && <><FileVideo size={10} className={getAccentTextClass(settings)} /> {settings.language === 'en' ? 'Video' : 'Vídeo'}</>}
                      {mediaInfo.type === 'audio' && <><Music size={10} className={getAccentTextClass(settings)} /> {settings.language === 'en' ? 'Audio' : 'Áudio'}</>}
                      {mediaInfo.type === 'image' && <><ImageIcon size={10} className={getAccentTextClass(settings)} /> {settings.language === 'en' ? 'Image' : 'Imagem'}</>}
                    </span>
                  </div>
                </div>

                {/* Actions Toolbelt */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleToggleFav}
                    className={`
                      px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all
                      ${isFav 
                        ? `${getAccentBorderClass(settings)} bg-current text-white` 
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-white hover:bg-zinc-850'
                      }
                    `}
                    style={isFav ? { backgroundColor: `rgba(var(--color-primary-rgb), 0.1)`, color: 'var(--color-primary)' } : {}}
                  >
                    <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
                    {isFav ? (settings.language === 'en' ? 'Favorited' : 'Favoritado') : t('favorite')}
                  </button>

                  <button
                    onClick={handleToggleLater}
                    className={`
                      px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all
                      ${isLater 
                        ? `${getAccentBorderClass(settings)} bg-current text-white` 
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-white hover:bg-zinc-850'
                      }
                    `}
                    style={isLater ? { backgroundColor: `rgba(var(--color-primary-rgb), 0.1)`, color: 'var(--color-primary)' } : {}}
                  >
                    <Clock size={14} />
                    {isLater ? (settings.language === 'en' ? 'In Download Later' : 'Na Fila Baixar Depois') : t('laterBtn')}
                  </button>

                  <button
                    onClick={handleDownloadThumbnail}
                    className="px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-white hover:bg-zinc-850 text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    <ImageIcon size={14} className={getAccentTextClass(settings)} />
                    {settings.language === 'en' ? 'Download Thumbnail' : 'Baixar Capa'}
                  </button>

                  <a
                    href={mediaInfo.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:text-white hover:bg-zinc-850 text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    <ExternalLink size={14} />
                    {t('btnOriginal')}
                  </a>
                </div>
              </div>
            </div>

            {/* Format Selector with Probe Options */}
            <div className="border-t border-white/5 pt-6 space-y-5">
              {probeLoading && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-500/10 border border-white/5 text-zinc-300 text-xs font-medium">
                  <RefreshCw size={14} className="animate-spin" />
                  {settings.language === 'en' ? 'Probing media info...' : 'Analisando informações da mídia...'}
                </div>
              )}
              {probeError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                  <AlertCircle size={14} />
                  {settings.language === 'en' ? 'Probe error' : 'Erro na sonda'}: {probeError}
                </div>
              )}

              <FormatSelector
                mediaInfo={mediaInfo}
                onFormatSelect={setFormatOptions}
                onFormatChange={setSelectedFormat}
                formatOptions={formatOptions}
              />

              {/* ── Summary Panel ── */}
              <SummaryPanel formatOptions={formatOptions} selectedFormat={selectedFormat} mediaInfo={mediaInfo} />
            </div>

            {/* Execute Download trigger */}
            <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-medium">
                <Info size={14} className="text-zinc-500" />
                <span>{settings.language === 'en' ? 'The file will be saved in your configured download directory.' : 'O arquivo será salvo no diretório de downloads configurado no programa.'}</span>
              </div>
              
              <button
                onClick={handleStartDownload}
                disabled={!selectedFormat}
                className={`
                  w-full sm:w-auto px-6 py-3 rounded-xl text-white font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all
                  ${getAccentBgClass(settings)} hover:scale-[1.02] active:scale-[0.98]
                `}
              >
                <Download size={18} />
                {t('btnDownloadSelected')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety & Performance assurances info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: t('feat1Title'), icon: RefreshCw, desc: t('feat1Desc') },
          { title: t('feat2Title'), icon: ShieldCheck, desc: t('feat2Desc') },
          { title: t('feat3Title'), icon: HelpCircle, desc: t('feat3Desc') }
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="p-4 rounded-2xl glass-card flex gap-3.5 items-start">
              <div className={`p-2 rounded-lg bg-zinc-900 ${getAccentTextClass(settings)} shrink-0`}>
                <Icon size={16} />
              </div>
              <div>
                <h5 className="font-semibold text-xs text-white">{item.title}</h5>
                <p className="text-[10px] text-zinc-400 mt-1">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
