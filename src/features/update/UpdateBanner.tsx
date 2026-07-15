import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

type UpdateStage = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'dismissed';

interface UpdateInfo {
  version: string;
}

interface ProgressData {
  stage: string;
  percent?: number;
  error?: string;
}

export default function UpdateBanner() {
  const [stage, setStage] = useState<UpdateStage>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [installerPath, setInstallerPath] = useState('');

  // Listen for auto-detected updates from main process (5s after launch)
  useEffect(() => {
    if (!window.electron?.onUpdateAvailable) return;
    const unsub = window.electron.onUpdateAvailable((data) => {
      if (data?.version) {
        setUpdateInfo({ version: data.version });
        setStage('available');
      }
    });
    return unsub;
  }, []);

  // Listen for download progress
  useEffect(() => {
    if (!window.electron?.onUpdateProgress) return;
    const unsub = window.electron.onUpdateProgress((data: ProgressData) => {
      if (data.stage === 'downloading' && typeof data.percent === 'number') {
        setProgress(data.percent);
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

  const checkForUpdates = useCallback(async () => {
    if (!window.electron?.checkForUpdate) return;
    setStage('checking');
    setErrorMsg('');
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
    if (!window.electron?.applyUpdate || !updateInfo) return;
    setStage('downloading');
    setProgress(0);
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
    if (!window.electron?.installUpdate || !installerPath) return;
    try {
      await window.electron.installUpdate({ installerPath });
    } catch {
      setErrorMsg('Falha ao iniciar instalador');
      setStage('error');
    }
  }, [installerPath]);

  const dismiss = useCallback(() => setStage('dismissed'), []);

  const currentVersion = window.electron?.checkForUpdate ? __APP_VERSION__ : '?';

  return (
    <AnimatePresence>
      {stage !== 'idle' && stage !== 'dismissed' && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mb-4"
        >
          {/* Checking */}
          {stage === 'checking' && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-400">
              <Loader2 size={14} className="animate-spin" />
              <span>Verificando atualizações...</span>
            </div>
          )}

          {/* Update Available */}
          {stage === 'available' && updateInfo && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-950/40 border border-blue-800/40 rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <Download size={16} className="text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-200">
                    Nova versão disponível: <span className="font-mono">v{updateInfo.version}</span>
                  </p>
                  <p className="text-xs text-blue-400/70 mt-0.5">
                    Sua versão: {currentVersion}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={downloadUpdate}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors"
                >
                  Atualizar
                </button>
                <button
                  onClick={dismiss}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Downloading */}
          {stage === 'downloading' && (
            <div className="px-4 py-3 bg-zinc-800/60 border border-zinc-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-blue-400" />
                  <span className="text-sm text-zinc-300">Baixando atualização...</span>
                </div>
                <span className="text-xs font-mono text-zinc-500">{progress}%</span>
              </div>
              <div className="w-full bg-zinc-700/50 rounded-full h-1.5">
                <motion.div
                  className="bg-blue-500 h-1.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Ready to Install */}
          {stage === 'ready' && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-emerald-950/40 border border-emerald-800/40 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle size={16} className="text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-200">
                    Download completo — {updateInfo?.version && `v${updateInfo.version}`}
                  </p>
                  <p className="text-xs text-emerald-400/70 mt-0.5">
                    O app será fechado e o instalador será iniciado
                  </p>
                </div>
              </div>
              <button
                onClick={installUpdate}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md transition-colors"
              >
                Instalar e Reiniciar
              </button>
            </div>
          )}

          {/* Error */}
          {stage === 'error' && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-950/40 border border-red-800/40 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle size={16} className="text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-200">Falha na atualização</p>
                  <p className="text-xs text-red-400/70 mt-0.5">{errorMsg}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={checkForUpdates}
                  className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium rounded-md transition-colors"
                >
                  Tentar Novamente
                </button>
                <button
                  onClick={() => setStage('idle')}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
