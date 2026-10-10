// Painel "Captura de Links": comportamento da área de transferência.
import { Clipboard } from 'lucide-react';
import type { AppSettings } from '../../../types';
import { useTranslation } from '../../../core/i18n';
import { getAccentTextClass } from '../../../components/ThemeWrapper';
import { Toggle } from '../../../components/Toggle';

export interface CapturePanelProps {
  settings: AppSettings;
  updateSettings: (p: Partial<AppSettings>) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

export function CapturePanel({ settings, updateSettings, t }: CapturePanelProps) {
  return (
    <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md cv-auto">
      <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
        <Clipboard size={16} className={getAccentTextClass(settings)} /> {t('captureSettings')}
      </h3>

      <div className="flex items-center justify-between p-3 rounded-xl lf-surface-40 lf-border">
        <div className="space-y-1">
          <span className="text-xs text-white font-medium flex items-center gap-1.5">
            <Clipboard size={14} className="lf-text-secondary" />
            {settings.language === 'en' ? 'Allow Clipboard Access' : 'Permitir Acesso à Área de Transferência'}
          </span>
          <p className="text-[10px] lf-text-muted">
            {settings.language === 'en' ? 'Enable "paste link" button to read from clipboard automatically' : 'Ativar botão "colar link" para ler automaticamente da área de transferência'}
          </p>
        </div>
        <Toggle value={settings.clipboardEnabled} onChange={() => updateSettings({ clipboardEnabled: !settings.clipboardEnabled })} settings={settings} />
      </div>
    </div>
  );
}
