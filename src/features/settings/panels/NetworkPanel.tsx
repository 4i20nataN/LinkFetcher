// Painel "Rede e Fila de Downloads" (extraído do SettingsView).
import { Sliders } from 'lucide-react';
import type { AppSettings } from '../../../types';
import { useTranslation } from '../../../core/i18n';
import { getAccentTextClass } from '../../../components/ThemeWrapper';
import { Toggle } from '../../../components/Toggle';

export interface NetworkPanelProps {
  settings: AppSettings;
  updateSettings: (p: Partial<AppSettings>) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

export function NetworkPanel({ settings, updateSettings, t }: NetworkPanelProps) {
  return (
    <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md cv-auto">
      <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
        <Sliders size={16} className={getAccentTextClass(settings)} /> {t('networkSettings')}
      </h3>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium">
          <span className="lf-text-secondary">{t('simultaneousDownloads')}</span>
          <span className="text-white">{t('simultCount', { count: settings.maxConcurrent })}</span>
        </div>
        <div className="flex gap-2 p-1 rounded-xl lf-surface lf-border">
          {[1, 2, 3, 5, 10].map((num) => (
            <button
              key={num}
              onClick={() => updateSettings({ maxConcurrent: num })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${settings.maxConcurrent === num ? 'lf-surface text-white shadow-md border lf-border' : 'lf-text-muted hover:text-zinc-300 border border-transparent'}`}
            >
              {num}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl lf-surface-40 lf-border">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold lf-text-secondary">
              {settings.language === 'en' ? 'Start Downloads Automatically' : 'Iniciar Downloads Automaticamente'}
            </span>
            <p className="text-[10px] lf-text-muted">
              {settings.language === 'en' ? 'Starts downloading right after analyzer finishes.' : 'Inicia o download logo após a análise, sem aguardar na fila.'}
            </p>
          </div>
          <Toggle value={settings.autoDownload} onChange={() => updateSettings({ autoDownload: !settings.autoDownload })} settings={settings} />
        </div>
      </div>
    </div>
  );
}
