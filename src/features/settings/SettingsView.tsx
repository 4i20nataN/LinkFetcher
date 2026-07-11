import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AppSettings } from '../../types';
import { StorageService } from '../../core/storage/Storage';
import { 
  Settings, Volume2, Globe, Sliders, HardDrive, Bell, AlertCircle, 
  Trash2, ShieldCheck, Download, Upload, Info, RefreshCw, Key, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../../core/i18n';
import { 
  getAccentBgClass, getAccentTextClass, getAccentBorderClass, getAccentRingClass 
} from '../../components/ThemeWrapper';

const accentColorsList = [
  { id: 'indigo', name: 'indigo', color: 'bg-indigo-500' },
  { id: 'emerald', name: 'emerald', color: 'bg-emerald-500' },
  { id: 'amber', name: 'amber', color: 'bg-amber-500' },
  { id: 'rose', name: 'rose', color: 'bg-rose-500' },
  { id: 'violet', name: 'violet', color: 'bg-violet-500' },
  { id: 'sky', name: 'sky', color: 'bg-sky-500' },
  { id: 'teal', name: 'teal', color: 'bg-teal-500' },
  { id: 'fuchsia', name: 'fuchsia', color: 'bg-fuchsia-500' },
  { id: 'orange', name: 'orange', color: 'bg-orange-500' },
  { id: 'cyan', name: 'cyan', color: 'bg-cyan-500' },
  { id: 'lime', name: 'lime', color: 'bg-lime-500' },
  { id: 'crimson', name: 'crimson', color: 'bg-red-500' },
  { id: 'pink', name: 'pink', color: 'bg-pink-500' },
  { id: 'slate', name: 'slate', color: 'bg-slate-400' }
];

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, clearAllData } = useApp();
  const { t } = useTranslation(settings);
  const [importText, setImportText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [ytdlpStatus, setYtdlpStatus] = useState<{ ready: boolean; binaryPath?: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2000);
  };

  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');

  // Check yt-dlp binary status
  useEffect(() => {
    fetch('/api/ytdlp/status')
      .then(r => r.json())
      .then(data => setYtdlpStatus(data))
      .catch(() => setYtdlpStatus({ ready: false }));
  }, []);

  const checkForUpdates = async () => {
    try {
      const response = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
      const release = await response.json();
      const latest = release.tag_name?.replace('v', '');
      if (latest) {
        setUpdateAvailable(true);
        setLatestVersion(latest);
      }
    } catch (error) {
      console.error('Update check failed:', error);
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateAvailable(false);
    showToast(settings.language === 'en' ? 'Checking GitHub repository for updates...' : 'Conectando ao GitHub para buscar atualizações...');
    try {
      const response = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
      const release = await response.json();
      const latest = release.tag_name?.replace('v', '');
      const current = '0.0.0';
      if (latest && latest !== current) {
        setUpdateAvailable(true);
        setLatestVersion(latest);
        showToast(settings.language === 'en' 
          ? `New version available: ${latest}` 
          : `Nova versão disponível: ${latest}`
        );
      } else {
        showToast(settings.language === 'en' 
          ? `You are running the latest version! (${current})` 
          : `Você já está rodando a versão mais recente! (${current})`
        );
      }
    } catch (error) {
      showToast(settings.language === 'en' 
        ? 'Update check failed — try again later.' 
        : 'Falha ao verificar atualizações — tente novamente.'
      );
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleOpenFolder = async () => {
    const downloadPath = settings.defaultDir || 'C:\\Downloads\\UniversalDownloader';
    if (window.electron) {
      await window.electron.invoke('shell:openPath', downloadPath);
    } else {
      try {
        await navigator.clipboard.writeText(downloadPath);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      } catch (_) {
        showToast(downloadPath);
      }
    }
  };

  const handleExport = () => {
    try {
      const dataStr = StorageService.exportConfig();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `downloader-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(t('backupSuccess'));
    } catch (_) {
      showToast(settings.language === 'en' ? 'Failed to export settings' : 'Falha ao exportar configurações');
    }
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const success = StorageService.importConfig(importText);
    if (success) {
      showToast(t('importSuccess') + (settings.language === 'en' ? ' Restarting...' : ' Reiniciando...'));
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showToast(t('importFailed'));
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
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2 md:py-6 px-4 pb-12">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-white shadow-2xl flex items-center gap-2.5"
          >
            <ShieldCheck size={16} className={getAccentTextClass(settings)} />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Info */}
      <div className="text-center md:text-left space-y-2">
        <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white tracking-tight">
          {t('settingsTitle')}
        </h2>
        <p className="text-zinc-400 text-sm md:text-base">
          {t('settingsSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Theme & Visual Layout Settings */}
          <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Settings size={16} className={getAccentTextClass(settings)} /> {t('visualPrefs')}
            </h3>

            {/* Light / Dark Mode selector */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 font-medium">{t('themeMode')}</span>
              <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-zinc-950/60 border border-white/5">
                {[
                  { id: 'light', name: t('themeLight') },
                  { id: 'dark', name: t('themeDark') },
                  { id: 'gray', name: t('themeGray') }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => updateSettings({ themeMode: mode.id as any })}
                    className={`
                      py-2 rounded-lg text-xs font-semibold transition-all
                      ${settings.themeMode === mode.id 
                        ? 'bg-zinc-900 text-white shadow-md border border-white/5' 
                        : 'text-zinc-500 hover:text-zinc-300'
                      }
                    `}
                  >
                    {mode.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color Chooser */}
            <div className="space-y-2.5">
              <span className="text-xs text-zinc-400 font-medium block">{t('accentColor')}</span>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {accentColorsList.map((color) => {
                  const isSelected = settings.accentColor === color.id;
                  return (
                    <button
                      key={color.id}
                      onClick={() => updateSettings({ accentColor: color.id })}
                      className={`
                        p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all
                        ${isSelected 
                          ? `${getAccentBorderClass(settings)} bg-white/5` 
                          : 'border-zinc-800 bg-transparent hover:bg-white/5'
                        }
                      `}
                    >
                      <span className={`w-4 h-4 rounded-full ${color.color} block shadow-inner`} />
                      <span className="text-[10px] text-zinc-400 font-medium capitalize">{t(color.name as any)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Network & Limits Setting */}
          <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <Sliders size={16} className={getAccentTextClass(settings)} /> {t('networkSettings')}
            </h3>

            {/* Max Concurrent */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-zinc-400">{t('simultaneousDownloads')}</span>
                <span className="text-white">{t('simultCount', { count: settings.maxConcurrent })}</span>
              </div>
              <div className="flex gap-2 p-1 rounded-xl bg-zinc-950/60 border border-white/5">
                {[1, 2, 3, 5, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => updateSettings({ maxConcurrent: num })}
                    className={`
                      flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${settings.maxConcurrent === num 
                        ? 'bg-zinc-900 text-white shadow-md border border-white/5' 
                        : 'text-zinc-500 hover:text-zinc-300'
                      }
                    `}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Bandwidth Limiter Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-zinc-400">{t('bandwidthLimit')}</span>
                <span className="text-white">{settings.bandLimit === 0 ? t('unlimitedMax') : `${settings.bandLimit} KB/s`}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="500"
                value={settings.bandLimit}
                onChange={(e) => updateSettings({ bandLimit: parseInt(e.target.value) })}
                className={`w-full accent-current h-1.5 rounded-lg bg-zinc-800 ${getAccentTextClass(settings)} cursor-pointer`}
              />
              <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                <span>{settings.language === 'en' ? 'Unlimited' : 'Ilimitado'}</span>
                <span>5 MB/s</span>
                <span>10 MB/s</span>
              </div>
            </div>

            {/* Switches */}
            <div className="space-y-3.5 pt-2">
              {/* Wi-Fi Download only */}
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">{t('wifiOnly')}</span>
                  <p className="text-[10px] text-zinc-500">{t('wifiOnlyDesc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.wifiOnly}
                  onChange={(e) => updateSettings({ wifiOnly: e.target.checked })}
                  className={`w-9 h-5 bg-zinc-800 rounded-full appearance-none relative checked:bg-current ${getAccentTextClass(settings)} checked:before:translate-x-4 before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-zinc-300 before:top-0.5 before:left-0.5 before:transition-transform cursor-pointer shadow-inner`}
                />
              </label>

              {/* Auto Download */}
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">
                    {settings.language === 'en' ? 'Start Downloads Automatically' : 'Iniciar Downloads Automaticamente'}
                  </span>
                  <p className="text-[10px] text-zinc-500">
                    {settings.language === 'en' ? 'Starts downloading right after analyzer finishes.' : 'Inicia o download logo após a análise, sem aguardar na fila.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoDownload}
                  onChange={(e) => updateSettings({ autoDownload: e.target.checked })}
                  className={`w-9 h-5 bg-zinc-800 rounded-full appearance-none relative checked:bg-current ${getAccentTextClass(settings)} checked:before:translate-x-4 before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-zinc-300 before:top-0.5 before:left-0.5 before:transition-transform cursor-pointer shadow-inner`}
                />
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* General Directory & Settings */}
          <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <HardDrive size={16} className={getAccentTextClass(settings)} /> {t('storageSettings')}
            </h3>

            {/* Default Directory path display */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 font-medium">{t('destinationFolder')}</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.defaultDir}
                  onChange={(e) => updateSettings({ defaultDir: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs text-zinc-300 font-mono focus:outline-none"
                />
                <button
                  onClick={handleOpenFolder}
                  className="px-3 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-zinc-700/50 transition-all whitespace-nowrap"
                >
                  <ExternalLink size={12} />
                  {showCopied
                    ? (settings.language === 'en' ? 'Copied!' : 'Copiado!')
                    : (settings.language === 'en' ? 'Open Folder' : 'Abrir Pasta')
                  }
                </button>
              </div>
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 font-medium flex items-center gap-1">
                <Globe size={14} /> {t('appLanguage')}
              </span>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-950/60 border border-white/5">
                {[
                  { id: 'pt', name: 'Português (BR)' },
                  { id: 'en', name: 'English (US)' }
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => updateSettings({ language: lang.id as any })}
                    className={`
                      py-2 rounded-lg text-xs font-semibold transition-all
                      ${settings.language === lang.id 
                        ? 'bg-zinc-900 text-white shadow-md border border-white/5' 
                        : 'text-zinc-500 hover:text-zinc-300'
                      }
                    `}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications & System switches */}
            <div className="space-y-3.5 pt-2">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">{t('notifLabel')}</span>
                  <p className="text-[10px] text-zinc-500">{t('notifDesc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={(e) => updateSettings({ notifications: e.target.checked })}
                  className={`w-9 h-5 bg-zinc-800 rounded-full appearance-none relative checked:bg-current ${getAccentTextClass(settings)} checked:before:translate-x-4 before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-zinc-300 before:top-0.5 before:left-0.5 before:transition-transform cursor-pointer shadow-inner`}
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">{t('updatesLabel')}</span>
                  <p className="text-[10px] text-zinc-500">{t('updatesDesc')}</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.updates}
                  onChange={(e) => updateSettings({ updates: e.target.checked })}
                  className={`w-9 h-5 bg-zinc-800 rounded-full appearance-none relative checked:bg-current ${getAccentTextClass(settings)} checked:before:translate-x-4 before:content-[''] before:absolute before:w-4 before:h-4 before:rounded-full before:bg-zinc-300 before:top-0.5 before:left-0.5 before:transition-transform cursor-pointer shadow-inner`}
                />
              </label>
            </div>
          </div>

          {/* Backup & Import Configuration */}
          <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md">
            <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
              <RefreshCw size={16} className={getAccentTextClass(settings)} /> {t('backupSettings')}
            </h3>

            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-zinc-700/50 transition-all"
              >
                <Upload size={14} /> {t('exportBackup')}
              </button>
              <button
                onClick={() => setShowImportArea(!showImportArea)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-zinc-700/50 transition-all"
              >
                <Download size={14} /> {t('importBackup')}
              </button>
            </div>

            {showImportArea && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 pt-2"
              >
                <span className="text-[10px] text-zinc-500 font-mono block">
                  {settings.language === 'en' ? 'Enter JSON configuration code:' : 'Insira o código JSON de configuração:'}
                </span>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='{"settings": {...}, "favorites": []}'
                  rows={4}
                  className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-mono placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleImport}
                  className={`w-full py-2 rounded-lg text-white font-semibold text-xs shadow-md ${getAccentBgClass(settings)}`}
                >
                  {settings.language === 'en' ? 'Confirm Import' : 'Confirmar Importação'}
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Dangerous Operations / Storage management */}
      <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div>
          <h4 className="font-semibold text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle size={14} /> {settings.language === 'en' ? 'Dangerous Storage Management' : 'Gerenciamento de Armazenamento Perigoso'}
          </h4>
          <p className="text-[10px] text-zinc-500 mt-1 max-w-sm">
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

      {/* yt-dlp Engine Status */}
      <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md">
        <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
          <Download size={16} className={getAccentTextClass(settings)} />
          {settings.language === 'en' ? 'Download Engine (yt-dlp)' : 'Motor de Download (yt-dlp)'}
        </h3>

        <div className="flex items-start gap-4">
          <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            ytdlpStatus === null ? 'bg-zinc-600 animate-pulse' :
            ytdlpStatus.ready ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
          }`} />
          <div className="space-y-1 flex-1">
            <p className="text-xs font-semibold text-zinc-200">
              {ytdlpStatus === null
                ? (settings.language === 'en' ? 'Checking status...' : 'Verificando status...')
                : ytdlpStatus.ready
                  ? (settings.language === 'en' ? 'yt-dlp ready — Real downloads active' : 'yt-dlp pronto — Downloads reais ativos')
                  : (settings.language === 'en' ? 'yt-dlp not found — will auto-install on first download' : 'yt-dlp não encontrado — será instalado automaticamente no primeiro download')
              }
            </p>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              {settings.language === 'en'
                ? 'yt-dlp runs locally on your hardware. No paid APIs. Video+audio merging is done by your CPU/GPU automatically.'
                : 'yt-dlp roda localmente no seu hardware. Zero APIs pagas. O merge de vídeo+áudio é feito pelo seu CPU/GPU automaticamente.'
              }
            </p>
            {ytdlpStatus?.binaryPath && (
              <p className="text-[9px] font-mono text-zinc-600 break-all">
                {settings.language === 'en' ? 'Binary:' : 'Binário:'} {ytdlpStatus.binaryPath}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* App Info / About */}
      <div className="p-6 rounded-3xl glass-card space-y-4 shadow-md">
        <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
          <Info size={16} /> {t('aboutTitle')}
        </h3>

        <div className="text-xs text-zinc-400 leading-relaxed space-y-3 font-medium">
          <p>
            {t('aboutDesc')}
          </p>
          <p>
            {settings.language === 'en' 
              ? 'Downloads use yt-dlp running locally on your machine — no paid APIs, no external services. Video and audio streams are fetched and merged using your own CPU, then delivered directly to your browser as a real file.'
              : 'Os downloads usam o yt-dlp rodando localmente na sua máquina — zero APIs pagas, nenhum serviço externo. Os streams de vídeo e áudio são baixados e mesclados usando o seu próprio CPU, e entregues direto ao navegador como um arquivo real.'}
          </p>
        </div>

        <div className="pt-4 border-t border-white/5 flex flex-wrap justify-between items-center text-[10px] text-zinc-500 font-mono">
          <span>{settings.language === 'en' ? 'Licensed under Apache 2.0' : 'Licenciado sob licença Apache 2.0'}</span>
          <span>© 2026 Downloader Universal Co. {settings.language === 'en' ? 'All rights reserved.' : 'Todos os direitos reservados.'}</span>
        </div>
      </div>
    </div>
  );
};
