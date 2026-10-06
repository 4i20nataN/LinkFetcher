import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { StorageService } from '../../core/storage/Storage';
import {
  AlertCircle,
  Trash2, ShieldCheck,
} from 'lucide-react';
import { AnimatedCard } from '../../animation/AnimatedCard';
import { AnimatedList } from '../../animation/AnimatedList';
import { slideUp } from '../../animation/variants';
import { useTranslation } from '../../core/i18n';
import {
  getAccentBgClass, getAccentTextClass
} from '../../components/ThemeWrapper';
import { useMobileInfo } from './useMobileInfo';
import { VisualPanel } from './panels/VisualPanel';
import { CapturePanel } from './panels/CapturePanel';
import { NetworkPanel } from './panels/NetworkPanel';
import { StoragePanel } from './panels/StoragePanel';
import { SystemPanel } from './panels/SystemPanel';
import { BackupPanel } from './panels/BackupPanel';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, clearAllData, setActiveTab } = useApp();
  const { t } = useTranslation(settings);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const { isElectron, isAndroid, mobileDir, engineVersion } = useMobileInfo();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => { setToastMsg(null); }, 2000);
  };

  useEffect(() => {
    if (isElectron && (!settings.defaultDir || settings.defaultDir === 'Downloads')) {
      window.electron!.invoke('shell:getDownloadsPath').then((p: any) => {
        if (p && typeof p === 'string') {
          updateSettings({ defaultDir: p });
        }
      }).catch(() => {});
    }
  }, []);

  // Sync auto-update preference to main process
  useEffect(() => {
    if (isElectron && window.electron?.setAutoCheck) {
      window.electron.setAutoCheck(settings.updates);
    }
  }, [settings.updates, isElectron]);

  const handleOpenFolder = async () => {
    if (isAndroid) {
      // No Android abre a pasta do app (resolve na hora). `defaultDir` é
      // ignorado no mobile (scoped storage) — nunca cai no fluxo desktop.
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const dir = mobileDir || await invoke<string>('fs_get_downloads_path');
          await invoke('fs_open_path', { targetPath: dir });
      } catch (err: any) {
        const detail = typeof err === 'string' ? err : err?.message;
        showToast((settings.language === 'en' ? 'Failed to open: ' : 'Falha ao abrir: ') + (detail || ''));
      }
      return;
    }
    const downloadPath = settings.defaultDir || '';
    if (!downloadPath) {
      showToast(settings.language === 'en' ? 'No folder configured. Choose a destination folder first.' : 'Nenhuma pasta configurada. Escolha uma pasta de destino primeiro.');
      return;
    }
    if (!isElectron) return;
    await window.electron!.invoke('shell:openPath', downloadPath);
  };

  const handleSelectFolder = async () => {
    if (!isElectron) return;
    const selectedPath = await window.electron!.invoke('shell:selectFolder', settings.defaultDir) as string | null;
    if (selectedPath) {
      updateSettings({ defaultDir: selectedPath });
      showToast(settings.language === 'en' ? `Download folder set to: ${selectedPath}` : `Pasta de downloads definida para: ${selectedPath}`);
    }
  };

  const handleClearCache = () => {
    StorageService.clearCache();
    showToast(settings.language === 'en' ? 'App cache cleared successfully' : 'Cache do aplicativo limpo com sucesso');
  };

  const handleResetData = () => {
    const msg = settings.language === 'en'
      ? 'Are you sure you want to reset ALL settings, favorites, and download history? This action cannot be undone.'
      : 'Tem certeza de que deseja redefinir TODAS as configurações, favoritos e histórico de download? Esta ação não pode ser desfeita.';
    if (window.confirm(msg)) {
      clearAllData();
      showToast(settings.language === 'en' ? 'All data reset to defaults' : 'Todos os dados foram redefinidos para os padrões');
      setTimeout(() => { window.location.reload(); }, 1000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2 md:py-6 px-4 pb-12">
      <AnimatedList>
        {toastMsg && (
          <AnimatedCard
            animateKey="toast"
            variant={slideUp}
            className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-50 px-4 py-3 rounded-xl lf-surface lf-border-strong text-xs font-semibold text-white shadow-2xl flex items-center gap-2.5"
          >
            <ShieldCheck size={16} className={getAccentTextClass(settings)} />
            {toastMsg}
          </AnimatedCard>
        )}
      </AnimatedList>

      <div className="text-center md:text-left space-y-2">
        <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white tracking-tight">
          {t('settingsTitle')}
        </h2>
        <p className="lf-text-secondary text-sm md:text-base">
          {t('settingsSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <VisualPanel settings={settings} updateSettings={updateSettings} t={t} />
          <NetworkPanel settings={settings} updateSettings={updateSettings} t={t} />
        </div>

        <div className="space-y-6 min-w-0">
          <StoragePanel settings={settings} updateSettings={updateSettings} t={t} isAndroid={isAndroid} mobileDir={mobileDir} engineVersion={engineVersion} onOpenFolder={handleOpenFolder} onSelectFolder={handleSelectFolder} />
          <SystemPanel settings={settings} updateSettings={updateSettings} t={t} isAndroid={isAndroid} />
          <BackupPanel settings={settings} t={t} isAndroid={isAndroid} mobileDir={mobileDir} showToast={showToast} />
          <CapturePanel settings={settings} updateSettings={updateSettings} t={t} />
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div>
          <h4 className="font-semibold text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle size={14} /> {settings.language === 'en' ? 'Dangerous Storage Management' : 'Gerenciamento de Armazenamento Perigoso'}
          </h4>
          <p className="text-[10px] lf-text-muted mt-1 max-w-sm">
            {settings.language === 'en' 
              ? 'These actions irreversibly clear local browser lists. Use with extreme caution.' 
              : 'Estas ações limpam as listas locais armazenadas no navegador de forma irreversível. Use com bastante cautela.'}
          </p>
        </div>
        <div className="flex gap-2 justify-start md:justify-end">
          <button
            onClick={handleClearCache}
            className="px-4 py-2.5 rounded-xl border border-red-500/10 bg-red-950/20 text-red-300 hover:text-red-200 hover:bg-red-900/20 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            {settings.language === 'en' ? 'Clear Temp Cache' : 'Limpar Cache Temporário'}
          </button>
          <button
            onClick={handleResetData}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/10"
          >
            <Trash2 size={14} /> {settings.language === 'en' ? 'Reset All' : 'Redefinir Tudo'}
          </button>
        </div>
      </div>

      <button
        onClick={() => setActiveTab('privacy')}
        className="w-full p-4 rounded-2xl glass-card hover:bg-white/5 transition-all flex items-center gap-3 group cv-auto"
      >
        <div className={`p-2 rounded-xl ${getAccentBgClass(settings)} text-white shadow-lg`}>
          <ShieldCheck size={18} />
        </div>
        <div className="text-left">
          <span className="text-xs font-semibold text-white block">
            {settings.language === 'en' ? 'Privacy Policy' : 'Política de Privacidade'}
          </span>
          <span className="text-[10px] lf-text-muted">
            {settings.language === 'en' ? 'View how we handle your data' : 'Veja como tratamos seus dados'}
          </span>
        </div>
      </button>

    </div>
  );
};