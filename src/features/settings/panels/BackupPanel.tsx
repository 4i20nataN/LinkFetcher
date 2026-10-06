// Painel "Backup" (extraído do SettingsView): exportar/importar links.
// Estado do formulário e handlers moram aqui — só o toast vem de fora.
import { useState } from 'react';
import { RefreshCw, Upload, Download } from 'lucide-react';
import type { AppSettings } from '../../../types';
import { useTranslation } from '../../../core/i18n';
import {
  getAccentBgClass, getAccentTextClass, getAccentRingClass
} from '../../../components/ThemeWrapper';
import { AnimatedCard } from '../../../animation/AnimatedCard';
import { fadeIn } from '../../../animation/variants';
import { StorageService } from '../../../core/storage/Storage';

export interface BackupPanelProps {
  settings: AppSettings;
  t: ReturnType<typeof useTranslation>['t'];
  isAndroid: boolean;
  mobileDir: string;
  showToast: (msg: string) => void;
}

export function BackupPanel({ settings, t, isAndroid, mobileDir, showToast }: BackupPanelProps) {
  const [importText, setImportText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);

  const handleExport = async () => {
    try {
      const dataStr = StorageService.exportLinksBackup();
      if (isAndroid) {
        // WebView ignora `a[download]`: salva via plugin-fs e publica em
        // Downloads (mesmo caminho dos downloads concluídos).
        const { invoke } = await import('@tauri-apps/api/core');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        const { join } = await import('@tauri-apps/api/path');
        const dir = mobileDir || await invoke<string>('fs_get_downloads_path');
        // Timestamp no nome: MediaStore tolera DISPLAY_NAME repetido e o
        // usuário terminaria com arquivos indistinguíveis em Downloads.
        const stamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
        const filename = `linkfetcher-links-${stamp}.json`;
        const filePath = await join(dir, filename);
        await writeFile(filePath, new TextEncoder().encode(dataStr));
        await invoke('plugin:ytdlp|publishFile', { path: filePath });
        showToast(t('backupSuccess'));
        return;
      }
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
      a.download = `linkfetcher-links-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(t('backupSuccess'));
    } catch (_) {
      showToast(settings.language === 'en' ? 'Failed to export links' : 'Falha ao exportar links');
    }
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const result = StorageService.importLinksBackup(importText);
    if (result.errors.length === 0 && result.imported > 0) {
      showToast(`${settings.language === 'en' ? 'Imported' : 'Importado'} ${result.imported} ${settings.language === 'en' ? 'items' : 'itens'}. ${settings.language === 'en' ? 'Restarting...' : 'Reiniciando...'}`);
      setTimeout(() => { window.location.reload(); }, 1000);
    } else if (result.imported === 0) {
      showToast(t('importFailed'));
    } else {
      showToast(`${settings.language === 'en' ? 'Imported' : 'Importado'} ${result.imported} ${settings.language === 'en' ? 'items' : 'itens'} (${result.errors.join(', ')})`);
    }
  };

  return (
    <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md cv-auto">
      <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
        <RefreshCw size={16} className={getAccentTextClass(settings)} /> {t('backupSettings')}
      </h3>
      <p className="text-[10px] lf-text-muted">
        {settings.language === 'en'
          ? 'Export/import only links (favorites, downloads, download later). Lightweight format for easy sharing.'
          : 'Exportar/importar apenas links (favoritos, downloads, baixar depois). Formato leve para fácil compartilhamento.'}
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex-1 px-4 py-2.5 rounded-xl lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-zinc-700/50 transition-all"
        >
          <Upload size={14} /> {t('exportBackup')}
        </button>
        <button
          onClick={() => setShowImportArea(!showImportArea)}
          className="flex-1 px-4 py-2.5 rounded-xl lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-zinc-700/50 transition-all"
        >
          <Download size={14} /> {t('importBackup')}
        </button>
      </div>

      {showImportArea && (
        <AnimatedCard
          animateKey="import-area"
          variant={fadeIn}
          className="space-y-2 pt-2"
        >
          <span className="text-[10px] lf-text-muted font-mono block">
            {settings.language === 'en' ? 'Paste the links JSON below:' : 'Cole o JSON de links abaixo:'}
          </span>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{"favorites": [...], "downloadLater": [...], "downloads": [...]}'
            rows={4}
            className={`w-full p-2.5 rounded-lg lf-surface border border-zinc-800 text-xs lf-text-secondary font-mono placeholder-zinc-700 focus:outline-none focus:ring-2 ${getAccentRingClass(settings)}`}
          />
          <button
            onClick={handleImport}
            className={`w-full py-2 rounded-lg text-white font-semibold text-xs shadow-md ${getAccentBgClass(settings)}`}
          >
            {settings.language === 'en' ? 'Confirm Import' : 'Confirmar Importação'}
          </button>
        </AnimatedCard>
      )}
    </div>
  );
}
