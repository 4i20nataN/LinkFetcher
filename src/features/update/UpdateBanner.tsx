import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, CheckCircle, AlertCircle, Loader2, Shield, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

const isAndroid = Capacitor.getPlatform() === 'android';

/** Import dinâmico, mesmo padrão de YtDlpAdapter.ts — evita empacotar o plugin Capacitor no bundle Web/Electron. */
async function getCapacitorYtDlp() {
  const { default: plugin } = await import('../../core/ytdlp/CapacitorYtDlp');
  return plugin;
}

type UpdateStage = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'dismissed';

interface UpdateInfo {
  version: string;
}

interface ProgressData {
  stage: string;
  percent?: number;
  received?: number;
  total?: number;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function UpdateBanner() {
  const [stage, setStage] = useState<UpdateStage>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [receivedBytes, setReceivedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [installerPath, setInstallerPath] = useState('');
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Android: URL do APK vindo do checkUpdate(), guardado para o downloadUpdate()
  const androidApkUrlRef = useRef<string>('');
  const androidChecksumsUrlRef = useRef<string>('');

  // Listen for auto-detected updates from main process (5s after launch) — Electron only.
  useEffect(() => {
    if (isAndroid) return;
    if (!window.electron?.onUpdateAvailable) return;
    const unsub = window.electron.onUpdateAvailable((data) => {
      if (data?.version) {
        setUpdateInfo({ version: data.version });
        setStage('available');
      }
    });
    return unsub;
  }, []);

  // Android: checagem automática de versão ao iniciar (assíncrona, sem travar a UI)
  useEffect(() => {
    if (!isAndroid) return;
    let cancelled = false;
    getCapacitorYtDlp().then((plugin) => plugin.checkUpdate())
      .then((result) => {
        if (cancelled || !result.available) return;
        if (result.version && result.version !== __APP_VERSION__) {
          androidApkUrlRef.current = result.apkUrl;
          androidChecksumsUrlRef.current = result.checksumsUrl || '';
          setUpdateInfo({ version: result.version });
          setStage('available');
        }
      })
      .catch(() => {
        // Silencioso no boot — checagem manual continua disponível via checkForUpdates()
      });
    return () => { cancelled = true; };
  }, []);

  // Listen for download progress — Electron only (Android usa listener nativo separado abaixo).
  useEffect(() => {
    if (isAndroid) return;
    if (!window.electron?.onUpdateProgress) return;
    const unsub = window.electron.onUpdateProgress((data: ProgressData) => {
      if (data.stage === 'downloading') {
        if (typeof data.percent === 'number') setProgress(data.percent);
        if (typeof data.received === 'number') setReceivedBytes(data.received);
        if (typeof data.total === 'number') setTotalBytes(data.total);
      } else if (data.stage === 'ready') {
        setStage('ready');
        setProgress(100);
      } else if (data.stage === 'error') {
        setErrorMsg(data.error || 'Erro desconhecido');
        setStage('error');
      } else if (data.stage === 'verifying') {
        setProgress(0);
      }
    });
    return unsub;
  }, []);

  // Android: progresso de download do APK via evento nativo do plugin YtDlp
  useEffect(() => {
    if (!isAndroid) return;
    let handle: Promise<{ remove: () => void }> | null = null;
    getCapacitorYtDlp().then((plugin) => {
      handle = plugin.addListener('update-progress', (data) => {
        if (data.stage === 'downloading') {
          if (typeof data.percent === 'number') setProgress(data.percent);
          if (typeof data.received === 'number') setReceivedBytes(data.received);
          if (typeof data.total === 'number') setTotalBytes(data.total);
        }
      });
    });
    return () => { handle?.then((h) => h.remove()); };
  }, []);

  const checkForUpdates = useCallback(async () => {
    setStage('checking');
    setErrorMsg('');
    if (isAndroid) {
      try {
        const plugin = await getCapacitorYtDlp();
        const result = await plugin.checkUpdate();
        if (result.available && result.version !== __APP_VERSION__) {
          androidApkUrlRef.current = result.apkUrl;
          androidChecksumsUrlRef.current = result.checksumsUrl || '';
          setUpdateInfo({ version: result.version });
          setStage('available');
        } else {
          setStage('idle');
        }
      } catch {
        setErrorMsg('Falha ao verificar atualizações');
        setStage('error');
      }
      return;
    }
    if (!window.electron?.checkForUpdate) return;
    try {
      const result = await window.electron.checkForUpdate();
      if (result.updateAvailable && result.version) {
        setUpdateInfo({ version: result.version });
        setStage('available');
      } else {
        setStage('idle');
      }
    } catch {
      setErrorMsg('Falha ao verificar atualizações');
      setStage('error');
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    if (!updateInfo) return;
    setStage('downloading');
    setProgress(0);
    setReceivedBytes(0);
    setTotalBytes(0);
    if (isAndroid) {
      try {
        const plugin = await getCapacitorYtDlp();
        const result = await plugin.downloadUpdate({
          apkUrl: androidApkUrlRef.current,
          checksumsUrl: androidChecksumsUrlRef.current || undefined,
        });
        if (result.ok && result.apkPath) {
          setInstallerPath(result.apkPath);
          setStage('ready');
          setProgress(100);
        } else {
          setErrorMsg('Falha ao baixar atualização');
          setStage('error');
        }
      } catch {
        setErrorMsg('Falha ao baixar atualização');
        setStage('error');
      }
      return;
    }
    if (!window.electron?.applyUpdate) return;
    try {
      const result = await window.electron.applyUpdate({ version: updateInfo.version });
      if (result.ok && result.installerPath) {
        setInstallerPath(result.installerPath);
        setStage('ready');
      } else {
        setErrorMsg(result.error || 'Falha ao baixar atualização');
        setStage('error');
      }
    } catch {
      setErrorMsg('Falha ao baixar atualização');
      setStage('error');
    }
  }, [updateInfo]);

  const installUpdate = useCallback(async () => {
    if (!installerPath) return;
    if (isAndroid) {
      try {
        // Não bloqueia nem apaga DB/config local: apenas dispara a Intent do instalador
        // do sistema, que sobrepõe o APK atual preservando dados do app (mesmo packageName).
        const plugin = await getCapacitorYtDlp();
        await plugin.installUpdate({ apkPath: installerPath });
      } catch (err: any) {
        if (String(err?.message || err).includes('PERMISSION_REQUIRED')) {
          setErrorMsg('Ative "Instalar apps desconhecidos" para o LinkFetcher na tela que abriu e toque em Instalar novamente.');
        } else {
          setErrorMsg('Falha ao iniciar instalador');
        }
        setStage('error');
      }
      return;
    }
    if (!window.electron?.installUpdate) return;
    try {
      await window.electron.installUpdate({ installerPath });
    } catch {
      setErrorMsg('Falha ao iniciar instalador');
      setStage('error');
    }
  }, [installerPath]);

  const dismiss = useCallback(() => {
    setStage('dismissed');
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  const currentVersion = (isAndroid || window.electron?.checkForUpdate) ? __APP_VERSION__ : '?';

  return (
    <AnimatePresence>
      {stage !== 'idle' && stage !== 'dismissed' && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="mb-4 relative z-20"
        >
          {/* Checking */}
          {stage === 'checking' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl lf-surface border lf-border backdrop-blur-md">
              <div className="relative">
                <Loader2 size={16} className="animate-spin lf-text-secondary" />
              </div>
              <span className="text-sm lf-text-secondary">Verificando atualizações...</span>
            </div>
          )}

          {/* Update Available — Premium */}
          {stage === 'available' && updateInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/[0.08] via-indigo-500/[0.04] to-transparent backdrop-blur-md"
            >
              {/* Shimmer accent line */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />

              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                      <Sparkles size={15} className="text-indigo-400" />
                    </div>
                    {/* Pulse ring */}
                    <div className="absolute inset-0 rounded-lg bg-indigo-500/10 animate-ping" style={{ animationDuration: '2s' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      Atualização disponível
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
                        v{updateInfo.version}
                      </span>
                    </p>
                    <p className="text-[11px] lf-text-muted mt-0.5 flex items-center gap-1.5">
                      <Shield size={10} className="lf-text-faint" />
                      Verificada &bull; v{currentVersion} → v{updateInfo.version}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={downloadUpdate}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    <Download size={13} />
                    Baixar
                  </motion.button>
                  <button
                    onClick={dismiss}
                    className="p-1.5 lf-text-faint hover:text-zinc-400 transition-colors rounded-md hover:bg-white/5"
                    aria-label="Dispensar"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Downloading — Premium Progress */}
          {stage === 'downloading' && (
            <div className="relative overflow-hidden rounded-xl border lf-border lf-surface backdrop-blur-md">
              <div className="px-4 py-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <Loader2 size={14} className="animate-spin text-indigo-400" />
                    <span className="text-sm font-medium text-zinc-200">Baixando atualização...</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    {totalBytes > 0 && (
                      <span className="lf-text-faint font-mono">
                        {formatBytes(receivedBytes)} / {formatBytes(totalBytes)}
                      </span>
                    )}
                    <span className="font-mono font-bold text-indigo-400">{progress}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative w-full bg-zinc-800/80 rounded-full h-[5px] overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                  {/* Shimmer effect on progress bar */}
                  {progress > 0 && progress < 100 && (
                    <motion.div
                      className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      animate={{ left: ['-10%', '110%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </div>

                {/* Security badge */}
                <div className="flex items-center gap-1.5 mt-2">
                  <Shield size={10} className="lf-text-faint" />
                  <span className="text-[10px] lf-text-faint">SHA-256 verificado após download</span>
                </div>
              </div>
            </div>
          )}

          {/* Ready to Install — Premium */}
          {stage === 'ready' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.08] via-emerald-500/[0.04] to-transparent backdrop-blur-md"
            >
              {/* Success accent line */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <CheckCircle size={15} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      Pronto para instalar
                      {updateInfo?.version && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">
                          v{updateInfo.version}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] lf-text-muted mt-0.5">
                      O app será fechado e o instalador será iniciado automaticamente
                    </p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={installUpdate}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-500/20 shrink-0"
                >
                  Instalar
                  <ArrowRight size={13} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Error — Premium */}
          {stage === 'error' && (
            <div className="relative overflow-hidden rounded-xl border border-rose-500/20 bg-gradient-to-r from-rose-500/[0.06] via-rose-500/[0.03] to-transparent backdrop-blur-md">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-rose-400/30 to-transparent" />

              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                    <AlertCircle size={15} className="text-rose-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">Falha na atualização</p>
                    <p className="text-[11px] lf-text-muted mt-0.5 truncate">{errorMsg}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={checkForUpdates}
                    className="flex items-center gap-1.5 px-3 py-1.5 lf-surface-raised hover:bg-zinc-700 lf-text-secondary text-xs font-medium rounded-lg transition-colors border lf-border"
                  >
                    <RotateCcw size={12} />
                    Tentar
                  </motion.button>
                  <button
                    onClick={dismiss}
                    className="p-1.5 lf-text-faint hover:text-zinc-400 transition-colors rounded-md hover:bg-white/5"
                    aria-label="Fechar"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
