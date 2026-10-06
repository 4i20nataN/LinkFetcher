// Painel "Armazenamento" (extraído do SettingsView): só pasta de destino.
// Idioma e notificações moravam aqui por acidente e ganharam casa própria.
import { HardDrive, FolderOpen, FolderPlus } from 'lucide-react';
import type { AppSettings } from '../../../types';
import { useTranslation } from '../../../core/i18n';
import { getAccentTextClass, getAccentRingClass } from '../../../components/ThemeWrapper';

export interface StoragePanelProps {
  settings: AppSettings;
  updateSettings: (p: Partial<AppSettings>) => void;
  t: ReturnType<typeof useTranslation>['t'];
  isAndroid: boolean;
  mobileDir: string;
  engineVersion: string | null;
  onOpenFolder: () => void;
  onSelectFolder: () => void;
}

export function StoragePanel({ settings, updateSettings, t, isAndroid, mobileDir, engineVersion, onOpenFolder, onSelectFolder }: StoragePanelProps) {
  return (
    <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md cv-auto">
      <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
        <HardDrive size={16} className={getAccentTextClass(settings)} /> {t('storageSettings')}
      </h3>

      <div className="space-y-2">
          <span className="text-xs lf-text-secondary font-medium">{t('destinationFolder')}</span>
          {isAndroid ? (
          <>
          <div className="flex gap-2">
            <input
              type="text"
              value={mobileDir || (settings.language === 'en' ? 'App folder (loading…)' : 'Pasta do app (carregando…)')}
              readOnly
              className={`flex-1 min-w-0 px-3 py-2 rounded-xl lf-surface border border-zinc-800 text-xs lf-text-secondary font-mono focus:outline-none focus:ring-2 ${getAccentRingClass(settings)}`}
            />
            <button
              onClick={onOpenFolder}
              className="px-3 py-2 rounded-xl lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-zinc-700/50 transition-all whitespace-nowrap"
            >
              <FolderOpen size={12} />
              {settings.language === 'en' ? 'Open' : 'Abrir'}
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-[11px] lf-text-muted font-mono whitespace-nowrap">Downloads/</span>
            <input
              type="text"
              value={settings.mobilePublicSubdir ?? 'LinkFetcher'}
              onChange={(e) => updateSettings({ mobilePublicSubdir: e.target.value.replace(/[/\\]/g, '').slice(0, 32) })}
              maxLength={32}
              className={`flex-1 min-w-0 px-3 py-2 rounded-xl lf-surface border border-zinc-800 text-xs lf-text-secondary font-mono focus:outline-none focus:ring-2 ${getAccentRingClass(settings)}`}
              placeholder="LinkFetcher"
            />
          </div>
          <p className="text-[10px] lf-text-faint flex items-start gap-1">
            <span className="shrink-0">📱</span>
            <span className="min-w-0 break-words">
            {(settings.mobilePublicSubdir ?? 'LinkFetcher') === ''
              ? (settings.language === 'en'
                ? 'Files go straight to Downloads root.'
                : 'Arquivos vão direto para a raiz de Downloads.')
              : (settings.language === 'en'
                ? `Files are published to Downloads/${settings.mobilePublicSubdir ?? 'LinkFetcher'} (visible in Files and players). Clear the field to use Downloads root. Arbitrary paths are blocked by Android scoped storage.`
                : `Arquivos publicados em Downloads/${settings.mobilePublicSubdir ?? 'LinkFetcher'} (visíveis em Arquivos e players). Apague o campo para usar a raiz de Downloads. Pasta arbitrária é bloqueada pelo scoped storage do Android.`)}
              </span>
            </p>
            {engineVersion && (
              <p className="text-[10px] lf-text-faint font-mono">
                yt-dlp {engineVersion}
              </p>
            )}
          </>
          ) : (
          <>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.defaultDir}
              onChange={(e) => updateSettings({ defaultDir: e.target.value })}
              className={`flex-1 min-w-0 px-3 py-2 rounded-xl lf-surface border border-zinc-800 text-xs lf-text-secondary font-mono focus:outline-none focus:ring-2 ${getAccentRingClass(settings)}`}
              placeholder={settings.language === 'en' ? 'Download folder path...' : 'Caminho da pasta de downloads...'}
            />
            <button
              onClick={onSelectFolder}
              className="px-3 py-2 rounded-xl lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-zinc-700/50 transition-all whitespace-nowrap"
              title={settings.language === 'en' ? 'Choose folder (native dialog)' : 'Escolher pasta (diálogo nativo)'}
            >
              <FolderPlus size={12} />
              {settings.language === 'en' ? 'Choose' : 'Escolher'}
            </button>
            <button
              onClick={onOpenFolder}
              className="px-3 py-2 rounded-xl lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-zinc-700/50 transition-all whitespace-nowrap"
            >
              <FolderOpen size={12} />
              {settings.language === 'en' ? 'Open' : 'Abrir'}
            </button>
          </div>
          <p className="text-[10px] lf-text-faint flex items-start gap-1">
            <span className="shrink-0">🖥️</span>
            <span className="min-w-0 break-words">
            {settings.language === 'en'
              ? 'Native folder dialogs available'
              : 'Diálogos de pasta nativos disponíveis'}
            </span>
          </p>
          </>
          )}
        </div>
    </div>
  );
}
