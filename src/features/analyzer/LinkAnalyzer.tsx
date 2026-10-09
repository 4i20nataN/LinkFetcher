import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ProviderRegistry, probePlaylistFull } from '../../core/plugins/Providers';
import { MediaInfo, MediaFormat, PlaylistInfo } from '../../types';
import {
  RefreshCw, ShieldCheck, HelpCircle, AlertCircle,
} from 'lucide-react';
import { AnimatedCard } from '../../animation/AnimatedCard';
import { scaleIn, fadeIn } from '../../animation/variants';
import { useTranslation } from '../../core/i18n';
import {
  getAccentTextClass
} from '../../components/ThemeWrapper';
import { DownloadEngine } from '../../core/engine/DownloadEngine';
import type { FormatOptions } from '../downloads/FormatOptions';
import { isPlaylistUrl } from '../../core/ytdlp/playlistUtils';
import { adapterErrorMessage } from '../../core/ytdlp/YtDlpAdapter';
import { sanitizeUrl, formatUploadDate as fmtDate } from './analyzerUtils';
import { AnalyzeForm } from './AnalyzeForm';
import { PlaylistCard } from './PlaylistCard';
import { MediaResultCard } from './MediaResultCard';



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
  
  const handleAnalyzeRef = useRef<(url: string) => void>(() => {});
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<MediaFormat | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistExpanded, setPlaylistExpanded] = useState(false);
  // Enfileiramento da playlist (pool de probes): progresso + cancelamento.
  const [enqueueProgress, setEnqueueProgress] = useState<{ done: number; total: number } | null>(null);
  const enqueueCancelRef = useRef(false);
  const [formatOptions, setFormatOptions] = useState<FormatOptions>({
    format: 'bestvideo+bestaudio/best',
    audioOnly: false,
    audioFormat: 'mp3',
    audioQuality: '0',
    writeSubs: false,
    writeAutoSubs: false,
    subLangs: '',
    subFormat: '',
    embedSubs: false,
    writeThumbnail: false,
    embedThumbnail: false,
    embedMetadata: false,
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
      const trimmed = selectedUrl.trim();
      if (trimmed && /^https?:\/\/.+/i.test(trimmed)) {
        const clean = sanitizeUrl(trimmed);
        handleAnalyze(clean);
      }
    }
  }, [selectedUrl]);

  // Listen for clipboard-detected URL from popup
  useEffect(() => {
    const handler = (e: Event) => {
      const url = (e as CustomEvent).detail?.url;
      if (url) {
        setUrl(url);
        const trimmed = url.trim();
        if (trimmed && /^https?:\/\/.+/i.test(trimmed)) {
          const clean = sanitizeUrl(trimmed);
          handleAnalyzeRef.current(clean);
        }
      }
    };
    window.addEventListener('clipboard:analyze', handler);
    return () => window.removeEventListener('clipboard:analyze', handler);
  }, []);

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

  // Persist com debounce: o estado inclui o dump parseado (100KB–1MB) e o
  // efeito anterior serializava a cada tecla/seleção na main thread.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const state = { url, mediaInfo, selectedFormat, formatOptions };
        localStorage.setItem('universal_downloader_analyzer_state', JSON.stringify(state));
      } catch { /* quota cheia: estado volátil, sem quebrar a análise */ }
    }, 800);
    return () => clearTimeout(t);
  }, [url, mediaInfo, selectedFormat, formatOptions]);

  const handleAnalyze = async (urlToAnalyze: string) => {
    const targetUrl = urlToAnalyze.trim();
    if (!targetUrl) return;

    setLoading(true);
    setError(null);
    setMediaInfo(null);
    setSelectedFormat(null);
    setFormatOptions({
      format: 'bestvideo+bestaudio/best',
      audioOnly: false,
      audioFormat: 'mp3',
      audioQuality: '0',
      writeSubs: false,
      writeAutoSubs: false,
      subLangs: '',
      subFormat: '',
      embedSubs: false,
      writeThumbnail: false,
      embedThumbnail: false,
      embedMetadata: false,
      videoOnly: false,
      sponsorblockRemove: '',
      fpsMax: 0,
      bandLimit: 0,
    });
    setSuccessMsg(null);
    setProbeError(null);
    setPlaylistInfo(null);

    // Check if URL is a playlist
    if (isPlaylistUrl(targetUrl)) {
      setPlaylistLoading(true);
      try {
        const playlist = await probePlaylistFull(targetUrl);
        setPlaylistInfo(playlist);
        setPlaylistLoading(false);
        setLoading(false);
        return;
      } catch (err: any) {
        setPlaylistLoading(false);
        setPlaylistInfo(null);
        // Fall through to normal analysis if playlist probe fails
      }
    }

    try {
      const provider = ProviderRegistry.getProviderForUrl(targetUrl);
      const info = await provider.analyze(targetUrl);
      
      setMediaInfo(info);
      if (info.formats && info.formats.length > 0) {
        setSelectedFormat(info.formats[0]); // Default to first format
      }
    } catch (err: any) {
      setError(adapterErrorMessage(err, settings.language === 'en' ? 'Error analyzing link. Please verify if link is correct.' : 'Erro ao analisar o link. Verifique se o link está correto.'));
    } finally {
      setLoading(false);
    }
  };
  handleAnalyzeRef.current = handleAnalyze;

  const handleSubmit = async () => {
    let trimmed = url.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError(settings.language === 'en' ? 'Please enter a valid URL starting with http:// or https://' : 'Insira uma URL válida começando com http:// ou https://');
      return;
    }
    
    trimmed = sanitizeUrl(trimmed);
    setUrl(trimmed); // Atualiza o input visualmente com a URL limpa

    await handleAnalyze(trimmed);
  };

  // Limpa o formulário e o estado da análise (era o × dentro do input).
  const handleClearForm = () => {
    setUrl('');
    setMediaInfo(null);
    setSelectedFormat(null);
    setProbeError(null);
    setFormatOptions({
      format: 'bestvideo+bestaudio/best',
      audioOnly: false,
      audioFormat: 'mp3',
      audioQuality: '0',
      writeSubs: false,
      writeAutoSubs: false,
      subLangs: '',
      subFormat: '',
      embedSubs: false,
      writeThumbnail: false,
      embedThumbnail: false,
      embedMetadata: false,
      videoOnly: false,
      sponsorblockRemove: '',
      fpsMax: 0,
      bandLimit: 0,
    });
  };

  const handlePaste = async () => {
    if (!settings.clipboardEnabled) {
      setError(settings.language === 'en' ? 'Clipboard access is disabled in settings. Enable it in Settings > Visual Preferences.' : 'Acesso à área de transferência desabilitado nas configurações. Ative em Configurações > Preferências Visuais.');
      return;
    }
    try {
      const { readClipboardText } = await import('../../native/clipboard');
      const text = await readClipboardText();
      if (text) {
        setUrl(text);
      } else {
        setError(settings.language === 'en' ? 'Clipboard is empty or unavailable. Type or paste manually.' : 'Área de transferência vazia ou indisponível. Digite ou cole manualmente.');
      }
    } catch (e) {
      setError(settings.language === 'en' ? 'Clipboard permission was denied. Type or paste manually.' : 'A permissão de área de transferência foi negada. Digite ou cole manualmente.');
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

    // Download description if format selected and description exists
    // ('none' é truthy — precisa do !== explícito, senão cai no else e grava .txt)
    if (formatOptions.descFormat && formatOptions.descFormat !== 'none' && mediaInfo.description) {
      const fmt = formatOptions.descFormat;
      const title = mediaInfo.title || 'video';
      const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 80);
      let content = '';
      let filename = '';
      if (fmt === 'md') {
        content = `# ${title}\n\n`;
        if (mediaInfo.channel) content += `**Canal:** ${mediaInfo.channel}\n`;
        if (mediaInfo.publishDate) content += `**Data:** ${fmtDate(mediaInfo.publishDate)}\n`;
        if (mediaInfo.views) content += `**Views:** ${mediaInfo.views}\n`;
        if (mediaInfo.duration) content += `**Duracao:** ${mediaInfo.duration}\n`;
        content += `\n---\n\n${mediaInfo.description}`;
        filename = `${safeTitle}.md`;
      } else {
        content = `${title}\n${'='.repeat(title.length)}\n\n`;
        if (mediaInfo.channel) content += `Canal: ${mediaInfo.channel}\n`;
        if (mediaInfo.publishDate) content += `Data: ${fmtDate(mediaInfo.publishDate)}\n`;
        if (mediaInfo.views) content += `Views: ${mediaInfo.views}\n`;
        if (mediaInfo.duration) content += `Duracao: ${mediaInfo.duration}\n`;
        content += `\n${mediaInfo.description}`;
        filename = `${safeTitle}.txt`;
      }
      if (window.electron) {
        window.electron.invoke('save-description', { filename, content });
      } else {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    }

    setSuccessMsg(settings.language === 'en' ? `Added to queue: ${mediaInfo.title.substring(0, 45)}...` : `Adicionado a fila: ${mediaInfo.title.substring(0, 45)}...`);
    
    // Auto-redirect to downloads manager
    setTimeout(() => {
      setActiveTab('manager');
    }, 1200);
  };

  // Download rápido — padrão equilibrado recomendado do yt-dlp:
  // vídeo: melhor até 1080p60 priorizando mp4+m4a (merge --merge-output-format
  // mp4 via copy, sem re-encode = merge mínimo) com fallback p/ qualquer
  // fonte ≤1080p; áudio: bestaudio extraído em MP3 qualidade 0 (máxima).
  // Mantém as demais opções atuais (pasta, nome, legendas). Sem desc file.
  const handleQuickDownload = (kind: 'audio' | 'video') => {
    if (!mediaInfo || mediaInfo.formats.length === 0) {
      setError(settings.language === 'en' ? 'No format selected. Please wait for analysis to complete.' : 'Nenhum formato selecionado. Aguarde a analise completar.');
      return;
    }
    const refFormat = kind === 'audio'
      ? (mediaInfo.formats.find(f => f.type === 'audio') ?? mediaInfo.formats[0])
      : mediaInfo.formats[0];
    const quickOptions: FormatOptions = {
      ...formatOptions,
      format: kind === 'audio'
        ? 'bestaudio/best'
        : 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b[height<=1080]',
      audioOnly: kind === 'audio',
      audioFormat: kind === 'audio' ? 'mp3' : formatOptions.audioFormat,
      audioQuality: kind === 'audio' ? '0' : formatOptions.audioQuality,
      videoOnly: false,
      // Vídeo rápido: teto 1080p60, container mp4, codecs originais (sem
      // --format-sort vcodec nem --ppa = merge copy, sem re-encode).
      ...(kind === 'video' ? {
        fpsMax: 60,
        videoFormat: 'mp4',
        videoCodec: '',
        normalizeAudio: false,
        videoSharpen: 'none' as const,
      } : {}),
    };
    setFormatOptions(quickOptions);
    setSelectedFormat(refFormat);
    DownloadEngine.addDownload(mediaInfo, refFormat, quickOptions);
    setSuccessMsg(settings.language === 'en' ? `Added to queue: ${mediaInfo.title.substring(0, 45)}...` : `Adicionado a fila: ${mediaInfo.title.substring(0, 45)}...`);
    setTimeout(() => {
      setActiveTab('manager');
    }, 1200);
  };

  const handleDownloadAllPlaylist = async () => {
    if (!playlistInfo || playlistInfo.items.length === 0 || enqueueProgress) return;

    // Pool de 3 probes concorrentes (sequencial levava N×~5-10s no armv7);
    // cancelável pelo botão. `next` é seguro: JS é single-thread e o
    // incremento ocorre de forma síncrona entre awaits.
    enqueueCancelRef.current = false;
    const items = playlistInfo.items;
    setEnqueueProgress({ done: 0, total: items.length });
    let next = 0;
    const worker = async () => {
      for (;;) {
        if (enqueueCancelRef.current) return;
        const i = next++;
        if (i >= items.length) return;
        const item = items[i];
        try {
          const provider = ProviderRegistry.getProviderForUrl(item.url);
          const info = await provider.analyze(item.url);
          if (!enqueueCancelRef.current && info.formats && info.formats.length > 0) {
            DownloadEngine.addDownload(info, info.formats[0], formatOptions);
          }
        } catch (err) {
          console.warn(`Failed to probe playlist item: ${item.title}`, err);
        }
        setEnqueueProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
      }
    };
    await Promise.all([worker(), worker(), worker()]);

    const cancelled = enqueueCancelRef.current;
    setEnqueueProgress(null);
    if (cancelled) return;
    setSuccessMsg(settings.language === 'en'
      ? `Added ${playlistInfo.items.length} items to queue`
      : `${playlistInfo.items.length} itens adicionados a fila`);
    setTimeout(() => setActiveTab('manager'), 1200);
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

  const [showCoverFormats, setShowCoverFormats] = useState(false);

  const handleDownloadThumbnail = async (targetExt?: 'jpg' | 'png' | 'webp') => {
    if (!mediaInfo || !mediaInfo.thumbnailUrl) return;
    // Sem formato escolhido: abre o seletor
    if (!targetExt) {
      setShowCoverFormats(v => !v);
      return;
    }
    setShowCoverFormats(false);
    const titleBase = ((mediaInfo.title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 80));
    // Converte bytes (já em mãos) para o formato do botão via blob: limpo:
    // blob: é same-origin, então o canvas nunca é contaminado — sem CORS.
    const convertCoverBytes = (raw: Uint8Array, srcMime: string, target: 'jpg' | 'png' | 'webp'): Promise<Uint8Array> =>
      new Promise((resolve, reject) => {
        const objUrl = URL.createObjectURL(new Blob([raw as BlobPart], { type: srcMime }));
        const done = () => URL.revokeObjectURL(objUrl);
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx || !canvas.width || !canvas.height) throw new Error('convert');
            ctx.drawImage(img, 0, 0);
            const mime = target === 'jpg' ? 'image/jpeg' : target === 'png' ? 'image/png' : 'image/webp';
            const quality = target === 'png' ? undefined : 0.92;
            canvas.toBlob((b) => {
              done();
              if (!b) { reject(new Error('convert')); return; }
              b.arrayBuffer().then(
                (ab) => resolve(new Uint8Array(ab)),
                () => reject(new Error('convert')),
              );
            }, mime, quality);
          } catch {
            done();
            reject(new Error('convert'));
          }
        };
        img.onerror = () => { done(); reject(new Error('convert')); };
        img.src = objUrl;
      });
    const mimeOf = (ext: string) =>
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    try {
      setSuccessMsg(settings.language === 'en' ? 'Downloading thumbnail...' : 'Baixando capa...');
      const isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        // 1. Bytes via backend (sem CORS): vi_webp não envia ACAO, então
        // carregar por <img> com crossOrigin jamais funcionaria aqui.
        const fetched = await invoke<{ success: boolean; data: string; ext: string; size: number }>(
          'fs_fetch_cover',
          { url: mediaInfo.thumbnailUrl },
        );
        const raw = Uint8Array.from(atob(fetched.data), (c) => c.charCodeAt(0));
        const realExt = (fetched.ext || 'jpg').toLowerCase();
        // 2. Respeita o botão: converte para o formato escolhido; se a
        // conversão falhar, entrega os bytes originais com a extensão real.
        let outBytes = raw;
        let outExt = realExt;
        if (targetExt !== realExt) {
          try {
            outBytes = await convertCoverBytes(raw, mimeOf(realExt), targetExt);
            outExt = targetExt;
          } catch {
            outBytes = raw;
            outExt = realExt;
          }
        }
        // 3. Salva e registra nas Downloads como item concluído.
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        const { join } = await import('@tauri-apps/api/path');
        let dir = settings.defaultDir || '';
        if (!dir) {
          try {
            dir = await invoke<string>('fs_get_downloads_path');
          } catch { dir = ''; }
        }
        if (!dir) throw new Error('nodir');
        const filename = `${titleBase}_capa.${outExt}`;
        const filePath = await join(dir, filename);
        try {
          await writeFile(filePath, outBytes);
        } catch {
          throw new Error('write');
        }
        DownloadEngine.registerCompletedFile({
          title: mediaInfo.title || titleBase,
          filePath,
          size: outBytes.length,
          platform: mediaInfo.platform,
          url: mediaInfo.thumbnailUrl,
          thumbnailUrl: mediaInfo.thumbnailUrl,
          ext: outExt,
        });
        const shown = outExt.toUpperCase();
        setSuccessMsg(settings.language === 'en' ? `Cover saved (${shown})!` : `Capa salva (${shown})!`);
        setTimeout(() => setSuccessMsg(null), 2000);
        return;
      }
      // Web (sem Tauri): caminho antigo por canvas direto da URL.
      const mime = targetExt === 'jpg' ? 'image/jpeg' : targetExt === 'png' ? 'image/png' : 'image/webp';
      const quality = targetExt === 'png' ? undefined : 0.92;
      const filename = `${titleBase}_capa.${targetExt}`;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('img'));
        img.src = mediaInfo.thumbnailUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, mime, quality));
      if (!blob) throw new Error('convert');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg(settings.language === 'en' ? `Cover saved (${targetExt.toUpperCase()})!` : `Capa salva (${targetExt.toUpperCase()})!`);
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const detail = raw ? ` (${raw.replace(/^Error: /, '').substring(0, 80)})` : '';
      console.warn('Error downloading thumbnail:', err);
      setSuccessMsg(settings.language === 'en' ? `Failed to download thumbnail${detail}` : `Falha ao baixar capa${detail}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const isFav = mediaInfo ? isFavorite(mediaInfo.originalUrl) : false;
  const isLater = mediaInfo ? isDownloadLater(mediaInfo.originalUrl) : false;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2 md:py-6 px-4">
      {/* Title Header */}
      <div className="text-center md:text-left space-y-2">
        <p className="lf-text-secondary text-sm md:text-base">
          {settings.language === 'en' 
            ? 'Enter video, audio or image link from any supported platform to start.' 
            : 'Insira o link de vídeos, áudios ou imagens de qualquer plataforma suportada para começar.'}
        </p>
      </div>

      <AnalyzeForm
        url={url}
        setUrl={setUrl}
        loading={loading}
        onPaste={handlePaste}
        onSubmit={handleSubmit}
        onClear={handleClearForm}
      />

      {/* Error View */}
      {error && (
        <AnimatedCard
          variant={fadeIn}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3"
        >
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">{settings.language === 'en' ? 'Analysis failed' : 'Falha na análise'}</h4>
            <p className="text-xs mt-1 text-red-300">{error}</p>
          </div>
        </AnimatedCard>
      )}

      {/* Success Notification pop */}
      {successMsg && (
        <AnimatedCard
          variant={scaleIn}
          className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3 shadow-lg shadow-emerald-500/5"
        >
          <ShieldCheck size={20} className="shrink-0" />
          <span className="font-semibold text-sm">{successMsg}</span>
        </AnimatedCard>
      )}

      {/* Skeleton Loading Card */}
      {loading && (
        <div className="p-4 md:p-6 rounded-2xl lf-surface-40 border lf-border animate-pulse space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-56 h-36 lf-surface-raised rounded-xl shrink-0" />
            <div className="flex-1 space-y-4">
              <div className="h-4 lf-surface-raised rounded-full w-2/3" />
              <div className="h-3 lf-surface-raised rounded-full w-1/3" />
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="h-3 lf-surface-raised rounded-full w-3/4" />
                <div className="h-3 lf-surface-raised rounded-full w-1/2" />
                <div className="h-3 lf-surface-raised rounded-full w-2/3" />
                <div className="h-3 lf-surface-raised rounded-full w-1/3" />
              </div>
            </div>
          </div>
          <div className="border-t lf-border pt-6 space-y-4">
            <div className="h-4 lf-surface-raised rounded-full w-1/4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 lf-surface-raised rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      )}

      <PlaylistCard
        playlistLoading={playlistLoading}
        playlistInfo={playlistInfo}
        playlistExpanded={playlistExpanded}
        setPlaylistExpanded={setPlaylistExpanded}
        enqueueProgress={enqueueProgress}
        onCancelEnqueue={() => { enqueueCancelRef.current = true; }}
        onDownloadAll={handleDownloadAllPlaylist}
      />

      {/* RICH CONTENT CARD */}
      {mediaInfo && !loading && (
        <MediaResultCard
          mediaInfo={mediaInfo}
          isFav={isFav}
          isLater={isLater}
          onToggleFav={handleToggleFav}
          onToggleLater={handleToggleLater}
          onDownloadThumbnail={handleDownloadThumbnail}
          showCoverFormats={showCoverFormats}
          probeLoading={probeLoading}
          probeError={probeError}
          formatOptions={formatOptions}
          onFormatSelect={setFormatOptions}
          onFormatChange={setSelectedFormat}
          selectedFormat={selectedFormat}
          onStartDownload={handleStartDownload}
          onQuickDownload={handleQuickDownload}
        />
      )}

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
              <div className={`p-2 rounded-lg lf-surface ${getAccentTextClass(settings)} shrink-0`}>
                <Icon size={16} />
              </div>
              <div>
                <p className="font-semibold text-xs text-white">{item.title}</p>
                <p className="text-[10px] lf-text-secondary mt-1">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
