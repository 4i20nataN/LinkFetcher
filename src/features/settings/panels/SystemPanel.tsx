// Painel "Sistema" (extraído do SettingsView): notificações e atualização.
// Moravam dentro do card de armazenamento sem ser armazenamento.
import { Bell } from 'lucide-react';
import type { AppSettings } from '../../../types';
import { useTranslation } from '../../../core/i18n';
import { getAccentTextClass } from '../../../components/ThemeWrapper';
import { Toggle } from '../../../components/Toggle';
import { AndroidUpdater } from '../../update/AndroidUpdater';

export interface SystemPanelProps {
  settings: AppSettings;
  updateSettings: (p: Partial<AppSettings>) => void;
  t: ReturnType<typeof useTranslation>['t'];
  isAndroid: boolean;
}

export function SystemPanel({ settings, updateSettings, t, isAndroid }: SystemPanelProps) {
  return (
    <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md cv-auto">
      <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
        <Bell size={16} className={getAccentTextClass(settings)} /> {t('systemSettings')}
      </h3>

      <div className="space-y-3.5 pt-2">
        <div className="flex items-center justify-between p-3 rounded-xl lf-surface-40 lf-border">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold lf-text-secondary">{t('notifLabel')}</span>
            <p className="text-[10px] lf-text-muted">{t('notifDesc')}</p>
          </div>
          <Toggle value={settings.notifications} onChange={() => updateSettings({ notifications: !settings.notifications })} settings={settings} />
        </div>

        {/* Auto-update: desktop usa o updater Tauri; no Android (sem Play
            Store) o update é sideload via releases do GitHub. */}
        {!isAndroid ? (
        <div className="flex items-center justify-between p-3 rounded-xl lf-surface-40 lf-border">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold lf-text-secondary">{t('updatesLabel')}</span>
            <p className="text-[10px] lf-text-muted">{t('updatesDesc')}</p>
          </div>
          <Toggle value={settings.updates} onChange={() => updateSettings({ updates: !settings.updates })} settings={settings} />
        </div>
        ) : (
          <AndroidUpdater />
        )}
      </div>
    </div>
  );
}
