// Painel "Personalização Visual" (extraído do SettingsView): tema, cor de
// destaque (fileira única com scroll lateral), estilo de ícones, emojis da
// lateral e idioma.
import { Settings, Globe, Smile, Palette } from 'lucide-react';
import type { AppSettings } from '../../../types';
import { useTranslation } from '../../../core/i18n';
import {
  getAccentTextClass, getAccentBorderClass
} from '../../../components/ThemeWrapper';
import { Toggle } from '../../../components/Toggle';

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

export interface VisualPanelProps {
  settings: AppSettings;
  updateSettings: (p: Partial<AppSettings>) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

export function VisualPanel({ settings, updateSettings, t }: VisualPanelProps) {
  return (
    <div className="p-5 rounded-3xl glass-card space-y-4 shadow-md cv-auto">
      <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
        <Settings size={16} className={getAccentTextClass(settings)} /> {t('visualPrefs')}
      </h3>

      <div className="space-y-2">
        <span className="text-xs lf-text-secondary font-medium">{t('themeMode')}</span>
        <div className="grid grid-cols-4 gap-2 p-1 rounded-xl lf-surface lf-border">
          {[
            { id: 'light', name: t('themeLight') },
            { id: 'dark', name: t('themeDark') },
            { id: 'gray', name: t('themeGray') },
            { id: 'white', name: t('themeWhite') }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => updateSettings({ themeMode: mode.id as any })}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${settings.themeMode === mode.id ? 'lf-surface text-white shadow-md border lf-border' : 'lf-text-muted hover:text-zinc-300 border border-transparent'}`}
            >
              {mode.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <span className="text-xs lf-text-secondary font-medium block">{t('accentColor')}</span>
        <div className="flex gap-2 overflow-x-auto pb-1.5">
          {accentColorsList.map((color) => {
            const isSelected = settings.accentColor === color.id;
            return (
              <button
                key={color.id}
                onClick={() => updateSettings({ accentColor: color.id })}
                className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all shrink-0 ${isSelected ? `${getAccentBorderClass(settings)} bg-white/5` : 'border-zinc-800 bg-transparent hover:bg-white/5'}`}
              >
                <span className={`w-4 h-4 rounded-full ${color.color} block shadow-inner`} />
                <span className="text-[10px] lf-text-secondary font-medium capitalize">{t(color.name as any)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs lf-text-secondary font-medium flex items-center gap-1">
          <Palette size={14} /> {settings.language === 'en' ? 'Icon Style' : 'Estilo dos Icones'}
        </span>
        <div className="grid grid-cols-3 gap-2 p-1 rounded-xl lf-surface lf-border">
          {[
            { id: 'emoji', name: 'Emoji', icon: '🎬' },
            { id: 'lucide-mono', name: 'Lucide', icon: null },
            { id: 'lucide-color', name: 'Colorido', icon: null },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => updateSettings({ iconStyle: mode.id as any })}
              className={`py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${settings.iconStyle === mode.id ? 'lf-surface text-white shadow-md border lf-border' : 'lf-text-muted hover:text-zinc-300 border border-transparent'}`}
            >
              {mode.icon ? (
                <span className="text-sm">{mode.icon}</span>
              ) : (
                <Palette size={12} className={mode.id === 'lucide-color' ? 'text-amber-400' : 'lf-text-secondary'} />
              )}
              {mode.name}
            </button>
          ))}
        </div>
        <p className="text-[10px] lf-text-faint">
          {settings.language === 'en'
            ? 'Choose how icons appear on download option blocks and format selector cards.'
            : 'Escolha como os icones aparecem nos blocos de opcoes de download e cards do seletor de formato.'}
        </p>
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl lf-surface-40 lf-border">
        <div className="space-y-1">
          <span className="text-xs text-white font-medium flex items-center gap-1.5">
            <Smile size={14} className="lf-text-secondary" />
            {settings.language === 'en' ? 'Colorful Sidebar Emojis' : 'Emojis Coloridos na Lateral'}
          </span>
          <p className="text-[10px] lf-text-muted">
            {settings.language === 'en' ? 'Keep sidebar emojis colored at all times instead of grayscale' : 'Manter emojis da barra lateral sempre coloridos em vez de preto e branco'}
          </p>
        </div>
        <Toggle value={settings.colorfulIcons} onChange={() => updateSettings({ colorfulIcons: !settings.colorfulIcons })} settings={settings} />
      </div>

      <div className="space-y-2">
        <span className="text-xs lf-text-secondary font-medium flex items-center gap-1">
          <Globe size={14} /> {t('appLanguage')}
        </span>
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl lf-surface lf-border">
          {[
            { id: 'pt', name: 'Português (BR)' },
            { id: 'en', name: 'English (US)' }
          ].map((lang) => (
            <button
              key={lang.id}
              onClick={() => updateSettings({ language: lang.id as any })}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${settings.language === lang.id ? 'lf-surface text-white shadow-md border lf-border' : 'lf-text-muted hover:text-zinc-300 border border-transparent'}`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
