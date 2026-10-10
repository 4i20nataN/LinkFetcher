import { DownloadItem, MediaInfo, MediaFormat, AppSettings, PlatformId } from '../../types';
import type { FormatOptions } from '../../features/downloads/FormatOptions';
import {
  formatActivityMessage,
  parseIpcNumber,
  progressEventSignature,
  progressShowsMovement,
  shouldNotifyProgress,
  smoothSpeed,
  withRateLimitHint,
} from './progress';

type EngineListener = (items: DownloadItem[]) => void;

// Quality label → height string for yt-dlp
function extractQualityHeight(qualityLabel: string): string {  if (qualityLabel.includes('2160') || qualityLabel.includes('4K')) return '2160';
  if (qualityLabel.includes('1440')) return '1440';
  if (qualityLabel.includes('1080')) return '1080';
  if (qualityLabel.includes('720')) return '720';
  if (qualityLabel.includes('480')) return '480';
  if (qualityLabel.includes('360')) return '360';
  if (qualityLabel.includes('240')) return '240';
  return '1080'; // safe default
}

// Platforms that support real yt-dlp extraction
const YT_DLP_PLATFORMS = new Set([
  'youtube', 'tiktok', 'instagram', 'facebook', 'x', 'reddit', 'soundcloud', 'twitch', 'vimeo'
]);

class DownloadEngineClass {
  private items: DownloadItem[] = [];
  private listeners: Set<EngineListener> = new Set();

  // Kill nativo por download. `cleanup` explícito: `true` = cancela e apaga
  // o .part; `false` = pausa e preserva p/ resume. Quem chama decide.
  private cancelFns = new Map<string, (cleanup: boolean) => void>();
  // Último notify de progresso por download (throttle de renders, ms).
  private lastProgressNotify = new Map<string, number>();
  // Último evento por download (base do reconcile pós-background).
  private lastEventAt = new Map<string, number>();
  // Assinatura do último evento aplicado: o transporte é duplo e a duplicata
  // não muda nada visível — descarta.
  private lastEventSig = new Map<string, string>();
  // Unlisten do `listen('yt-dlp-progress')` por download (soltar no settle).
  private unlistenFns = new Map<string, () => void>();
  // Poll de segurança por download (só Android, 1x/s, request/response).
  // Mata no settle.
  private pollTimers = new Map<string, ReturnType<typeof setInterval>>();

  private stopPoll(id: string) {
    const t = this.pollTimers.get(id);
    if (t !== undefined) {
      clearInterval(t);
      this.pollTimers.delete(id);
    }
  }

  private settings: AppSettings = {
    themeMode: 'dark',
    accentColor: 'emerald',
    iconStyle: 'lucide-mono',
    language: 'pt',
    defaultDir: '',
    mobilePublicSubdir: 'LinkFetcher',
    bandLimit: 0,
    maxConcurrent: 3,
    autoDownload: true,
    notifications: true,
    updates: true,
    clipboardEnabled: true,
  };

  constructor() {
    this.loadState();
    this.reconcileUnfinished().catch(() => {});
  }

  // Cura pós-kill: pausado/fila com arquivo final em disco vira concluído
  // sem baixar de novo. Fora: pós-processamento ffmpeg (corte, extração,
  // merge, embed, SponsorBlock, filtros) — ali um parcial existiria como
  // "completo", então esses retomam o download normal.
  private hasPostProcessing(item: DownloadItem): boolean {
    if (item.audioOnly || item.mergeOutputFormat) return true;
    if (item.embedThumbnail || item.embedSubs || item.embedMetadata) return true;
    if (item.downloadSections) return true;
    if (item.sponsorblockRemove) return true;
    if (item.normalizeAudio) return true;
    if (item.videoSharpen && item.videoSharpen !== 'none') return true;
    return false;
  }

  private markHealed(id: string, path: string, size: number): boolean {
    const live = this.items.find(i => i.id === id);
    if (!live || !['paused', 'queued', 'downloading'].includes(live.status)) return false;
    live.status = 'completed';
    live.progress = 100;
    live.processing = false;
    live.speed = 0;
    live.eta = 0;
    live.activity = undefined;
    // Fallback pode eleger o final renomeado (merge trocou o container):
    // persiste o eleito p/ abrir pasta/stats usarem o caminho real.
    live.filePath = path;
    live.sizeDownloaded = size;
    live.sizeTotal = Math.max(live.sizeTotal || 0, size);
    live.finishedAt = new Date().toISOString();
    this.touch(live.id);
    this.notify(true);
    return true;
  }

  private async completeFromDiskIfPresent(item: DownloadItem): Promise<boolean> {
    if (!item.filePath) return false;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const st = await invoke<{ exists: boolean; size: number }>('fs_file_stat', { path: item.filePath });
      if (st?.exists && st.size > 0) {
        // Caminho exato: só cura sem pós-processamento — ali um parcial
        // (merge/recode interrompido) existiria como "completo".
        if (this.hasPostProcessing(item)) return false;
        return this.markHealed(item.id, item.filePath, st.size);
      }
      // Fallback: `destination` obsoleto (merge trocou o container, retry
      // renomeou). Elege o final pelo mesmo radical no diretório.
      const el = await invoke<{ path: string; size: number; hasPart: boolean } | null>(
        'fs_elect_finished', { hintPath: item.filePath });
      if (!el?.path || !(el.size > 0) || el.hasPart) return false;
      if (this.hasPostProcessing(item)) {
        // Pós-processado: só com prova positiva (tamanho >= total conhecido)
        // e sem parcial em voo. Recorte entrega arquivo MENOR que o total —
        // nunca cura aqui, retoma o download normal.
        const live = this.items.find(i => i.id === item.id);
        if (!live || !(live.sizeTotal > 0) || el.size < live.sizeTotal) return false;
      }
      return this.markHealed(item.id, el.path, el.size);
    } catch {
      return false;
    }
  }

  // Boot: itens que o kill interrompeu com arquivo pronto já abrem verdes.
  // Serial e best-effort; quem falhar aqui cura no resume (startDownload).
  // Pública p/ o botão de verificação da lista (retorna quantos curou).
  async reconcileUnfinished(): Promise<number> {
    const cands = this.items.filter(i =>
      (i.status === 'paused' || i.status === 'queued') && !!i.filePath);
    let healed = 0;
    for (const c of cands) {
      if (await this.completeFromDiskIfPresent(c)) healed++;
    }
    this.processQueue();
    return healed;
  }

  setSettings(newSettings: AppSettings) {
    this.settings = newSettings;
    this.processQueue();
  }

  private loadState() {
    try {
      const stored = localStorage.getItem('universal_downloader_items');
      if (stored) {
        const parsed: DownloadItem[] = JSON.parse(stored);
        this.items = parsed.map(item => {
          // `processing`/`activity` são transientes — nunca sobrevivem reload.
          // Reset in-progress downloads to queued on reload
          if (item.status === 'downloading') {
            return { ...item, status: 'paused', speed: 0, eta: 0, processing: false, activity: undefined };
          }
          return { ...item, processing: false, activity: undefined };
        });
      }
    } catch (e) {
      console.error('Error loading engine state', e);
      this.items = [];
    }
  }

  // localStorage do WebView é ~5MB: persiste no máx. 300 concluídos.
  // Ativos (queued/downloading/paused) nunca são cortados.
  private static readonly MAX_PERSISTED_FINISHED = 300;

  // Progresso notifica até 4x/s: persiste no máx. 1x/2s em atividade;
  // transições de estado forçam persistência.
  private static readonly PERSIST_THROTTLE_MS = 2000;
  private lastPersistedAt = 0;

  private saveState(force = false) {
    const now = Date.now();
    if (!force && now - this.lastPersistedAt < DownloadEngineClass.PERSIST_THROTTLE_MS) return;
    this.lastPersistedAt = now;
    try {
      const active = this.items.filter(i => ['queued', 'downloading', 'paused'].includes(i.status));
      const finished = this.items.filter(i => !['queued', 'downloading', 'paused'].includes(i.status));
      const slim = (list: DownloadItem[]) => list.map(({ activity: _a, ...rest }) => rest);
      // Quota do WebView (~5MB, dividida com o resto do app): após uso forte
      // (playlist de 1300+ faixas) o payload pode estourar. Degrada o
      // histórico de concluídos em vez de perder tudo — ativos nunca cortam.
      const caps = [DownloadEngineClass.MAX_PERSISTED_FINISHED, 100, 30, 0];
      for (let k = 0; k < caps.length; k++) {
        try {
          const toPersist = [...active, ...finished.slice(0, caps[k])];
          localStorage.setItem('universal_downloader_items', JSON.stringify(slim(toPersist)));
          return;
        } catch (e) {
          if (k === caps.length - 1) throw e;
        }
      }
    } catch (e) {
      console.error('Error saving engine state', e);
    }
  }

  getItems(): DownloadItem[] {
    return [...this.items];
  }

  addListener(listener: EngineListener) {
    this.listeners.add(listener);
    listener(this.getItems());
  }

  removeListener(listener: EngineListener) {
    this.listeners.delete(listener);
  }

  private notify(persist = true) {
    const current = this.getItems();
    this.listeners.forEach(l => l(current));
    this.saveState(persist);
  }

  // Troca a ref do item (update imutável): o memo dos cards compara por
  // identidade — sem isso cada tick re-renderiza a lista inteira.
  private touch(id: string) {
    const i = this.items.findIndex(x => x.id === id);
    if (i >= 0) this.items[i] = { ...this.items[i] };
  }

  addDownload(media: MediaInfo, format: MediaFormat, formatOptions?: FormatOptions | null) {
    // Repetidos permitidos com sufixo (1), (2)...: evita sobrescrever o
    // arquivo no disco e dois processos brigando pelo mesmo .part.
    const outContainerOf = (audioOnly?: boolean, audioFormat?: string, mergeFmt?: string, ext?: string) =>
      audioOnly ? (audioFormat || 'mp3') : (mergeFmt || ext || '');
    const familyBaseOf = (name?: string) =>
      ((name && name.trim()) || '%(title)s').replace(/ \(\d+\)$/, '');
    const newContainer = outContainerOf(
      formatOptions?.audioOnly, formatOptions?.audioFormat,
      formatOptions?.videoFormat, format.ext,
    );
    const newBase = familyBaseOf(formatOptions?.customFilename);
    const sameCount = this.items.filter(item =>
      item.url === media.originalUrl
      && (item.playlistName || '') === (formatOptions?.playlistName || '')
      && outContainerOf(item.audioOnly, item.audioFormat, item.mergeOutputFormat, item.format.ext) === newContainer
      && familyBaseOf(item.customFilename) === newBase
    ).length;
    let customFilename = formatOptions?.customFilename;
    if (sameCount > 0) {
      customFilename = `${newBase} (${sameCount})`;
    }

    const defaultSizeByType: Record<string, number> = {
      video: 25 * 1024 * 1024,
      audio: 6 * 1024 * 1024,
      image: 2 * 1024 * 1024,
    };

    // Use probe size if available; real file size will be updated via OS-native
    // stat after download + FFmpeg merge completes (see complete handlers below).
    const sizeTotal = format.sizeBytes > 0 ? format.sizeBytes : 0;

    const newItem: DownloadItem = {
      id: `dl_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      title: media.title,
      thumbnailUrl: media.thumbnailUrl,
      platform: media.platform,
      format,
      formatString: formatOptions?.audioOnly ? 'bestaudio/best' : formatOptions?.format,
      audioOnly: formatOptions?.audioOnly,
      audioFormat: formatOptions?.audioFormat,
      audioQuality: formatOptions?.audioQuality,
      writeSubs: formatOptions?.writeSubs,
      writeAutoSubs: formatOptions?.writeAutoSubs,
      subLangs: formatOptions?.subLangs,
      subFormat: formatOptions?.subFormat,
      embedSubs: formatOptions?.embedSubs,
      writeThumbnail: formatOptions?.writeThumbnail,
      embedThumbnail: formatOptions?.embedThumbnail,
      embedMetadata: formatOptions?.embedMetadata,
      mergeOutputFormat: formatOptions?.videoFormat || undefined,
      concurrentFragments: formatOptions?.concurrentFragments,
      retries: formatOptions?.retries,
      restrictFilenames: formatOptions?.restrictFilenames,
      noOverwrites: formatOptions?.noOverwrites,
      keepVideo: formatOptions?.keepVideo,
      videoOnly: formatOptions?.videoOnly,
      downloadSections: formatOptions?.downloadSections,
      sponsorblockRemove: formatOptions?.sponsorblockRemove,
      fpsMax: formatOptions?.fpsMax,
      bandLimit: formatOptions?.bandLimit,
      videoCodec: formatOptions?.videoCodec,
      customFilename,
      playlistName: formatOptions?.playlistName,
      normalizeAudio: formatOptions?.normalizeAudio,
      videoSharpen: formatOptions?.videoSharpen,
      imageSource: (format.type === 'image' && /\.(jpe?g|png|gif|webp|bmp|tiff?|svg|heic|avif)(\?|$)/i.test(media.originalUrl))
        ? 'user-link'
        : undefined,
      sizeTotal,
      sizeDownloaded: 0,
      progress: 0,
      durationSeconds: media.durationSeconds > 0 ? media.durationSeconds : undefined,
      speed: 0,
      eta: 0,
      status: 'queued',
      addedAt: new Date().toISOString(),
      url: media.originalUrl,
    };

    this.items.unshift(newItem);
    this.notify();
    this.processQueue();
  }

  // advanceQueue: pausa única libera o slot; bulk (pauseAll) mantém false.
  pauseDownload(id: string, advanceQueue = false) {
    const item = this.items.find(i => i.id === id);
    if (!item || item.status !== 'downloading') return;

    // Estado primeiro: o kill é fire-and-forget e o `catch` decide
    // "intenção do usuário" vs "failed" pelo status.
    item.status = 'paused';
    item.speed = 0;
    item.eta = 0;
    item.processing = false;
    item.activity = undefined;
    this.touch(id);

    // Mata o processo preservando o .part (resume reaproveita).
    const cancelFn = this.cancelFns.get(id);
    if (cancelFn) {
      try { cancelFn(false); } catch {}
      this.cancelFns.delete(id);
    } else {
      // Sem handle local (ex. reload com nativo órfão): tenta matar direto.
      this.forceNativeCancel(id, false);
    }
    this.stopPoll(id);
    this.unlistenFns.get(id)?.();
    this.unlistenFns.delete(id);
    this.lastProgressNotify.delete(id);
    this.lastEventSig.delete(id);

    this.notify();
    if (advanceQueue) this.processQueue();
  }

  resumeDownload(id: string) {
    const item = this.items.find(i => i.id === id);
    if (!item || item.status !== 'paused') return;

    item.status = 'queued';
    item.processing = false;
    this.touch(id);
    this.notify();
    this.processQueue();
  }

  // Limpeza de parciais (.part/.ytdl/.cuttmp/-Frag*). Nunca toca o arquivo
  // final — seguro p/ qualquer status.
  private fireCleanup(id: string, filePath?: string) {
    import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke('ytdlp_cleanup', { id, filePath }).catch(() => {})
    ).catch(() => {});
  }

  // advanceQueue: cancelamento único avança a fila; bulk mantém false.
  cancelDownload(id: string, advanceQueue = false) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    if (!['queued', 'downloading', 'paused'].includes(item.status)) return;

    // Estado primeiro (mesmo motivo do pauseDownload): kill é async e o
    // desfecho do invoke consulta o status.
    item.status = 'cancelled';
    item.speed = 0;
    item.eta = 0;
    item.processing = false;
    item.activity = undefined;
    this.touch(id);

    // Cancelamento definitivo: mata o nativo + apaga .part.
    const cancelFn = this.cancelFns.get(id);
    if (cancelFn) {
      try { cancelFn(true); } catch {}
      this.cancelFns.delete(id);
    } else {
      this.forceNativeCancel(id, true);
    }
    this.stopPoll(id);
    this.unlistenFns.get(id)?.();
    this.unlistenFns.delete(id);
    this.lastProgressNotify.delete(id);
    this.lastEventSig.delete(id);
    this.fireCleanup(item.id, item.filePath);

    this.notify();
    if (advanceQueue) this.processQueue();
  }

  // Excluir: ativo primeiro para o nativo (kill com cleanup) e só então
  // some da lista — senão o yt-dlp segue em background. Finalizado só
  // remove o registro (arquivo em disco intacto).
  removeDownload(id: string) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    const isActive = ['queued', 'downloading', 'paused'].includes(item.status);
    if (isActive) {
      item.status = 'cancelled';
      const cancelFn = this.cancelFns.get(id);
      if (cancelFn) {
        try { cancelFn(true); } catch {}
        this.cancelFns.delete(id);
      } else {
        this.forceNativeCancel(id, true);
      }
      this.stopPoll(id);
      this.unlistenFns.get(id)?.();
      this.unlistenFns.delete(id);
      this.lastProgressNotify.delete(id);
      this.lastEventAt.delete(id);
      this.lastEventSig.delete(id);
      this.fireCleanup(item.id, item.filePath);
    } else {
      this.fireCleanup(item.id, item.filePath);
    }
    this.items = this.items.filter(i => i.id !== id);
    this.notify(true);
    this.processQueue();
  }

  // Mata um nativo órfão (sem handle local): reload com download correndo,
  // item pausado sem cancelFn, etc. Fire-and-forget — erro significa "nada
  // rodando", que já é o estado desejado.
  private forceNativeCancel(id: string, cleanup: boolean) {
    import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke('ytdlp_cancel', { id, cleanup }).catch(() => {})
    ).catch(() => {});
  }

  // Registra um arquivo já salvo em disco (ex. capa) como item concluído,
  // para aparecer na aba Downloads com 100%. Sem processo, sem parciais.
  registerCompletedFile(info: {
    title: string;
    filePath: string;
    size: number;
    platform: PlatformId;
    url: string;
    thumbnailUrl?: string;
    ext: string;
  }) {
    const now = new Date().toISOString();
    const ext = (info.ext || 'jpg').toLowerCase();
    const newItem: DownloadItem = {
      id: `file_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      title: info.title,
      thumbnailUrl: info.thumbnailUrl || '',
      platform: info.platform,
      format: {
        id: `file-${ext}`,
        ext,
        quality: 'original',
        sizeEst: '',
        sizeBytes: info.size,
        codec: '',
        type: 'image',
      },
      sizeTotal: info.size,
      sizeDownloaded: info.size,
      progress: 100,
      speed: 0,
      eta: 0,
      status: 'completed',
      addedAt: now,
      finishedAt: now,
      url: info.url,
      filePath: info.filePath,
    };
    this.items.unshift(newItem);
    this.notify();
  }

  clearCompleted() {
    const removed = this.items.filter(i => ['completed', 'failed', 'cancelled'].includes(i.status));
    this.items = this.items.filter(i => !['completed', 'failed', 'cancelled'].includes(i.status));
    for (const item of removed) {
      this.fireCleanup(item.id, item.filePath);
    }
    this.notify();
  }

  retryDownload(id: string) {
    const item = this.items.find(i => i.id === id);
    if (!item || !['failed', 'cancelled'].includes(item.status)) return;

    // Reaproveita o preset anterior no argv; zera contadores p/ não exibir
    // bytes obsoletos enquanto retoma o .part.
    item.status = 'queued';
    item.progress = 0;
    item.speed = 0;
    item.eta = 0;
    item.sizeDownloaded = 0;
    item.processing = false;
    item.error = undefined;
    item.subWarning = undefined;
    this.touch(id);
    this.notify();
    this.processQueue();
  }

  pauseAll() {
    this.items
      .filter(i => i.status === 'downloading')
      .forEach(i => this.pauseDownload(i.id));
  }

  resumeAll() {
    this.items
      .filter(i => i.status === 'paused')
      .forEach(i => this.resumeDownload(i.id));
  }

  cancelAll() {
    this.items
      .filter(i => ['queued', 'downloading'].includes(i.status))
      .forEach(i => this.cancelDownload(i.id));
  }

  private processQueue() {
    const activeCount = this.items.filter(i => i.status === 'downloading').length;
    const maxConcurrent = this.settings.maxConcurrent || 3;

    if (activeCount >= maxConcurrent) return;

    const queued = this.items
      .filter(i => i.status === 'queued')
      .sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime());

    const slotsAvailable = maxConcurrent - activeCount;
    const toStart = queued.slice(0, slotsAvailable);

    for (const item of toStart) {
      this.startDownload(item);
    }
  }

  private async startDownload(item: DownloadItem) {
    item.status = 'downloading';
    this.lastEventAt.set(item.id, Date.now());
    this.lastEventSig.delete(item.id);
    this.touch(item.id);
    this.notify();

    // Desktop Tauri é o único transporte (web/mobile removidos).
    const isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
    if (!isTauri) {      const live = this.items.find(i => i.id === item.id) ?? item;
      live.status = 'failed';
      live.error = 'Download disponível apenas no app desktop';
      this.touch(live.id);
      this.notify();
      return;
    }
    // Arquivo final já em disco (kill após renomear): conclui sem spawn.
    if (await this.completeFromDiskIfPresent(item)) {
      this.processQueue();
      return;
    }
    await this.startTauriDownload(item);
  }
  private async startTauriDownload(item: DownloadItem) {
    const { adapterErrorMessage } = await import('../ytdlp/YtDlpAdapter');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Get default download dir
      let outputDir = this.settings.defaultDir || '';
      if (!outputDir) {
        try {
          outputDir = await invoke('fs_get_downloads_path');
        } catch {
          outputDir = '';
        }
      }

      // Prepare params for ytdlp_download (uses DownloadParams from args.rs)
      const params = {
        id: item.id,
        url: item.url,
        title: item.title,
        format: item.formatString,
        audioOnly: item.audioOnly,
        audioFormat: item.audioFormat,
        audioQuality: item.audioQuality,
        writeSubs: item.writeSubs,
        writeAutoSubs: item.writeAutoSubs,
        subLangs: item.subLangs,
        subFormat: item.subFormat,
        embedSubs: item.embedSubs,
        writeThumbnail: item.writeThumbnail,
        embedThumbnail: item.embedThumbnail,
        embedMetadata: item.embedMetadata,
        mergeOutputFormat: item.mergeOutputFormat,
        restrictFilenames: item.restrictFilenames,
        concurrentFragments: item.concurrentFragments,
        retries: item.retries,
        keepVideo: item.keepVideo,
        videoOnly: item.videoOnly,
        downloadSections: item.downloadSections,
        sponsorblockRemove: item.sponsorblockRemove,
        fpsMax: item.fpsMax,
        customFilename: item.customFilename,
        videoCodec: item.videoCodec,
        normalizeAudio: item.normalizeAudio,
        videoSharpen: item.videoSharpen,
        bandLimit: item.bandLimit,
        noOverwrites: item.noOverwrites,
        // Android: subpasta pública (MediaStore). `??` preserva "" (raiz de
        // Downloads); ausente = padrão. Desktop ignora.
        mobilePublicSubdir: this.settings.mobilePublicSubdir ?? 'LinkFetcher',
        outputDir,
      };

      // Handler de progresso unificado (suporta listen do Tauri desktop e CustomEvent no Android)
      const handleProgressData = (data: any) => {
        if (!data || data.id !== item.id) return;
        const sig = progressEventSignature(data);
        if (this.lastEventSig.get(item.id) === sig) return;
        this.lastEventSig.set(item.id, sig);
        this.lastEventAt.set(item.id, Date.now());

        if (data.type === 'progress') {
          this.applyProgressEvent(item.id, data);
        } else if (data.type === 'processing') {
          const live = this.items.find(i => i.id === item.id);
          if (live && live.status === 'downloading') {
            live.processing = true;
            live.speed = 0;
            live.eta = 0;
            // Rótulo da fase silenciosa (merge/recode/extract): sem ele a
            // barra congela no último % com velocidade fantasma.
            live.activity = this.settings.language === 'en' ? 'Merging…' : 'Mesclando…';
            this.touch(live.id);
            this.notify();
          }
        } else if (data.type === 'activity') {
          const live = this.items.find(i => i.id === item.id);
          if (live && live.status === 'downloading') {
            live.activity = formatActivityMessage(data, this.settings.language);
            this.touch(live.id);
            this.notify(false);
          }
        } else if (data.type === 'destination' && typeof data.path === 'string' && data.path) {
          // Caminho final conhecido cedo: persiste p/ reconciliar após kill.
          const live = this.items.find(i => i.id === item.id);
          if (live && ['downloading', 'queued', 'paused'].includes(live.status)) {
            live.filePath = data.path;
            this.touch(live.id);
            this.notify(true);
          }
        } else if (data.type === 'complete' || data.type === 'error') {
          finish();
          if (this.applyTerminalEvent(item.id, data)) {
            this.processQueue();
          }
        }
      };

      // Transporte duplo no Android (Tauri-listen + CustomEvent): só um
      // deles já falhou em campo — os dois ficam.
      const unlisten = await listen('yt-dlp-progress', (event) => {
        handleProgressData(event.payload);
      });

      // Listen for yt-dlp-progress CustomEvents (Android WebView)
      const onCustomProgress = (e: Event) => {
        handleProgressData((e as CustomEvent).detail);
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('yt-dlp-progress', onCustomProgress);
      }
      this.unlistenFns.set(item.id, () => {
        try { unlisten(); } catch { /* unlisten idempotente */ }
        if (typeof window !== 'undefined') {
          window.removeEventListener('yt-dlp-progress', onCustomProgress);
        }
      });
      // Poll de segurança (só Android, 1x/s): request/response sobrevive
      // onde o push morre.
      if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
        this.stopPoll(item.id);
        const timer = setInterval(() => {
          this.pollProgress(item.id).catch(() => {});
        }, 1000);
        this.pollTimers.set(item.id, timer);
      }

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.stopPoll(item.id);
        this.unlistenFns.get(item.id)?.();
        this.unlistenFns.delete(item.id);
      };

      // Kill hook p/ cancel/pausa. `cleanup` explícito: pause=false
      // preserva o .part; cancel/delete=true apaga.
      this.cancelFns.set(item.id, (cleanup: boolean) => {
        finish();
        this.lastProgressNotify.delete(item.id);
        this.lastEventAt.delete(item.id);
        this.lastEventSig.delete(item.id);
        this.unlistenFns.get(item.id)?.();
        this.unlistenFns.delete(item.id);
        const args = cleanup
          ? { id: item.id, cleanup: true }
          : { id: item.id };
        invoke('ytdlp_cancel', args).catch(() => {});
      });

      // Start download
      const resultPath = await invoke<string>('ytdlp_download', { options: params });
      finish();
      // Re-find: o closure pode estar obsoleto (ver applyTerminalEvent).
      // Limpeza total aqui também (antes vazava listener/unlisten/poll a cada
      // conclusão por este caminho).
      const done = this.items.find(i => i.id === item.id);
      if (resultPath && done && done.status === 'downloading') {
        done.status = 'completed';
        done.progress = 100;
        done.processing = false;
        done.filePath = resultPath;
        done.finishedAt = new Date().toISOString();
        this.cancelFns.delete(done.id);
        this.stopPoll(done.id);
        this.lastEventAt.delete(done.id);
        this.lastEventSig.delete(done.id);
        this.lastProgressNotify.delete(done.id);
        this.unlistenFns.get(done.id)?.();
        this.unlistenFns.delete(done.id);
        this.touch(done.id);
        this.notify();
        this.processQueue();
      }
    } catch (error: any) {
      // O kill de pausa/cancelamento rejeita o invoke de propósito: a intenção
      // do usuário prevalece — nunca converter em "failed".
      const live = this.items.find(i => i.id === item.id);
      if (!live) return;
      if (live.status === 'paused' || live.status === 'cancelled') {
        live.processing = false;
        this.cancelFns.delete(live.id);
        this.stopPoll(live.id);
        this.lastProgressNotify.delete(live.id);
        this.lastEventAt.delete(live.id);
        this.lastEventSig.delete(live.id);
        this.unlistenFns.get(live.id)?.();
        this.unlistenFns.delete(live.id);
        this.touch(live.id);
        this.notify();
        return;
      }
      live.status = 'failed';
      live.processing = false;
      live.error = withRateLimitHint(adapterErrorMessage(error, 'Download failed'), this.settings.language);
      this.cancelFns.delete(live.id);
      this.stopPoll(live.id);
      this.lastProgressNotify.delete(live.id);
      this.lastEventAt.delete(live.id);
      this.lastEventSig.delete(live.id);
      this.unlistenFns.get(live.id)?.();
      this.unlistenFns.delete(live.id);
      this.touch(live.id);
      this.notify();
    }
  }

  // Reordena por id: o índice visível é da lista filtrada, não do interno.
  moveQueuedItem(id: string, delta: -1 | 1): void {
    const queued = this.items.filter(i => i.status === 'queued');
    const from = queued.findIndex(i => i.id === id);
    if (from < 0) return;
    const to = from + delta;
    if (to < 0 || to >= queued.length) return;

    const [moved] = queued.splice(from, 1);
    queued.splice(to, 0, moved);

    // Não-queued mantêm lugar; só a ordem dos queued muda.
    const nonQueued = this.items.filter(i => i.status !== 'queued');
    this.items = [...queued, ...nonQueued];
    this.notify();
  }

  clearHistory(): void {
    const removed = this.items.filter(i => !['queued', 'downloading', 'paused'].includes(i.status));
    this.items = this.items.filter(i => ['queued', 'downloading', 'paused'].includes(i.status));
    for (const item of removed) {
      this.fireCleanup(item.id, item.filePath);
    }
    this.notify();
  }

  // Terminal (complete/error) no item VIVO (find por id): o closure é
  // anterior ao `touch` — sem o re-find a transição ia para um órfão.
  // Retorna true numa transição real (chamador avança a fila).
  private applyTerminalEvent(id: string, data: any): boolean {
    const live = this.items.find(i => i.id === id);
    if (!live) return false;
    if (data.type === 'complete') {
      if (live.status === 'paused' || live.status === 'cancelled') return false;
      // Dedupe defensivo: `complete` repetido do mesmo ciclo é no-op, sem
      // re-render nem persistência.
      if (live.status === 'completed') return false;
      live.status = 'completed';
      live.progress = 100;
      live.processing = false;
      if (data.filePath) live.filePath = data.filePath;
      if (data.subWarning) live.subWarning = data.subWarning;
      if (data.size && data.size > 0) {
        live.sizeTotal = data.size;
        live.sizeDownloaded = data.size;
      }
      live.finishedAt = new Date().toISOString();
    } else if (data.type === 'error') {
      if (live.status === 'paused' || live.status === 'cancelled') return false;
      // Mesmo dedupe do `complete`: erro duplicado não re-renderiza.
      if (live.status === 'failed') return false;
      live.status = 'failed';
      live.processing = false;
      live.error = withRateLimitHint(data.message || 'Download failed', this.settings.language);
    } else {
      return false;
    }
    this.cancelFns.delete(id);
    this.lastProgressNotify.delete(id);
    this.lastEventAt.delete(id);
    this.lastEventSig.delete(id);
    this.unlistenFns.get(id)?.();
    this.unlistenFns.delete(id);
    this.touch(id);
    this.notify();
    return true;
  }

  // Aplica um evento de progresso (push ou poll): corpo único p/ não
  // divergir. Throttle de notify continua valendo (500ms Android).
  private applyProgressEvent(id: string, data: any) {
    const item = this.items.find(i => i.id === id);
    if (!item || item.status !== 'downloading') return;
    item.progress = typeof data.percent === 'number' ? data.percent : (parseFloat(data.percent) || 0);
    item.speed = smoothSpeed(item.speed, parseIpcNumber(data.speed));
    item.eta = parseIpcNumber(data.eta);
    // Linha zerada num stall (throttle/429) não apaga a prova de vida: o
    // último sinal (`Iniciando…`, `Extraindo…`, `Tentando de novo…`,
    // `Mesclando…`) fica visível até os bytes voltarem a andar.
    if (progressShowsMovement(data.downloaded, item.progress)) {
      item.activity = undefined;
      item.processing = false;
    }
    if (data.downloaded && data.downloaded > 0) {
      item.sizeDownloaded = data.downloaded;
    }
    if (data.total && data.total > 0) {
      item.sizeTotal = data.total;
    }
    const now = Date.now();
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    if (shouldNotifyProgress(now, this.lastProgressNotify.get(item.id) ?? 0, isAndroid)) {
      this.lastProgressNotify.set(item.id, now);
      this.touch(item.id);
      this.notify(false);
    }
  }

  // Poll de segurança (só Android): se o job sumiu, reconcilia na hora.
  // Erro = tenta no próximo tick.
  private async pollProgress(id: string) {
    const item = this.items.find(i => i.id === id);
    if (!item || item.status !== 'downloading') {
      this.stopPoll(id);
      return;
    }
    let invokeFn: ((cmd: string, args?: unknown) => Promise<unknown>) | null = null;
    try {
      ({ invoke: invokeFn } = await import('@tauri-apps/api/core'));
    } catch {
      return;
    }
    let snap: any = null;
    try {
      snap = await invokeFn!('ytdlp_job_progress', { id });
    } catch {
      return;
    }
    if (!snap || snap.active !== true) {
      this.stopPoll(id);
      this.reconcileStuck().catch(() => {});
      return;
    }
    if (typeof snap.percent !== 'number') return;
    // Reaproveita o caminho do push: dedupe + throttle + touch valem igual.
    this.applyProgressEvent(id, {
      id, type: 'progress',
      percent: snap.percent, speed: snap.speed, eta: snap.eta,
      downloaded: snap.downloaded, total: snap.total,
    });
  }

  // Pós-background (Android): evento com WebView suspenso é descartado.
  // Na volta, consulta o desfecho ao Kotlin sem reiniciar (só `finished`).
  async reconcileStuck() {
    if (typeof navigator === 'undefined' || !/Android/i.test(navigator.userAgent)) return;
    const STALE_MS = 20_000;
    const now = Date.now();
    const stale = this.items.filter(i =>
      i.status === 'downloading' && (now - (this.lastEventAt.get(i.id) ?? 0)) >= STALE_MS
    );
    if (stale.length === 0) return;
    let invokeFn: ((cmd: string, args?: unknown) => Promise<unknown>) | null = null;
    try {
      ({ invoke: invokeFn } = await import('@tauri-apps/api/core'));
    } catch {
      return;
    }
    let applied = false;
    for (const item of stale) {
      let st: any = null;
      try {
        st = await invokeFn!('ytdlp_job_state', { id: item.id });
      } catch {
        continue;
      }
      if (!st || st.state !== 'finished') continue;
      const cur = this.items.find(i => i.id === item.id);
      if (!cur || cur.status !== 'downloading') continue;
      if (st.ok && st.filePath) {
        cur.status = 'completed';
        cur.progress = 100;
        cur.processing = false;
        cur.filePath = st.filePath;
        if (typeof st.size === 'number' && st.size > 0) {
          cur.sizeTotal = st.size;
          cur.sizeDownloaded = st.size;
        }
        cur.finishedAt = new Date().toISOString();
      } else {
        cur.status = 'failed';
        cur.processing = false;
        cur.error = typeof st.error === 'string' && st.error
          ? st.error
          : 'Download interrompido em segundo plano — toque para repetir';
      }
      this.cancelFns.delete(item.id);
      this.lastProgressNotify.delete(item.id);
      this.lastEventAt.delete(item.id);
      this.lastEventSig.delete(item.id);
      this.unlistenFns.get(item.id)?.();
      this.unlistenFns.delete(item.id);
      this.touch(item.id);
      this.notify();
      applied = true;
    }
    if (applied) this.processQueue();
  }

  // Progress helpers
  getOverallProgress(): { total: number; downloaded: number; percentage: number } {
    const active = this.items.filter(i => ['queued', 'downloading', 'paused'].includes(i.status));
    const total = active.reduce((sum, i) => sum + (i.sizeTotal || 0), 0);
    const downloaded = active.reduce((sum, i) => sum + (i.sizeDownloaded || 0), 0);
    return {
      total,
      downloaded,
      percentage: total > 0 ? Math.round((downloaded / total) * 100) : 0,
    };
  }

  getActiveDownloads(): DownloadItem[] {
    return this.items.filter(i => i.status === 'downloading');
  }

  getQueuedDownloads(): DownloadItem[] {
    return this.items.filter(i => i.status === 'queued');
  }

  getCompletedDownloads(): DownloadItem[] {
    return this.items.filter(i => i.status === 'completed');
  }

  getFailedDownloads(): DownloadItem[] {
    return this.items.filter(i => i.status === 'failed');
  }

  getCancelledDownloads(): DownloadItem[] {
    return this.items.filter(i => i.status === 'cancelled');
  }

  getPausedDownloads(): DownloadItem[] {
    return this.items.filter(i => i.status === 'paused');
  }
}

// Singleton export
export const DownloadEngine = new DownloadEngineClass();
export default DownloadEngine;
