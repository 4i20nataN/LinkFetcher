// Painel "Sistema": notificações e atualização.
import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
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
  // Autostart real via plugin Tauri (Linux .desktop / Windows Run).
  // `null` = ainda carregando. No Android a linha nem existe (sem conceito
  // de autostart no app mobile). No desktop, se o plugin falhar, a linha
  // aparece DESABILITADA com o motivo — nunca some sem explicação.
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [autoLoadError, setAutoLoadError] = useState<string | null>(null);
  // Erro honesto do toggle (ex.: ~/.config/autostart sem escrita): a linha
  // NUNCA some — mostra o motivo e mantém o valor real.
  const [autoError, setAutoError] = useState<string | null>(null);
  const autoBusy = useRef(false);

  useEffect(() => {
    if (isAndroid) return;
    let alive = true;
    (async () => {
      try {
        const { isEnabled } = await import('@tauri-apps/plugin-autostart');
        const on = await isEnabled();
        if (alive) setAutostart(on);
      } catch (e) {
        // Plugin ausente (build antigo, browser preview): linha desabilitada
        // com motivo, em vez de sumir sem explicação.
        if (alive) {
          setAutostart(null);
          const detail = typeof e === 'string' ? e : (e as Error)?.message ?? String(e);
          setAutoLoadError(detail || 'Recurso indisponível nesta versão.');
        }
      }
    })();
    return () => { alive = false; };
  }, [isAndroid]);

  const toggleAutostart = async () => {
    if (autostart === null || autoBusy.current) return;
    autoBusy.current = true;
    setAutoError(null);
    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart');
      if (autostart) {
        await disable();
      } else {
        // Pasta de autostart de outro dono (ex.: root): pede a senha e
        // corrige antes de gravar — sem exigir configuração manual.
        try {
          await invoke('autostart_repair');
        } catch (repairErr) {
          const detail = typeof repairErr === 'string'
            ? repairErr : (repairErr as Error)?.message ?? String(repairErr);
          throw new Error(detail || 'Permissão necessária para ativar a inicialização automática.');
        }
        await enable();
      }
      setAutostart(!autostart);
    } catch (e) {
      // Falha (ex.: pasta autostart sem permissão de escrita): relê o estado
      // real em vez de sumir com a opção. Motivo visível, sem toggle mentiroso.
      console.error('[autostart] toggle falhou:', e);
      const detail = typeof e === 'string' ? e : (e as Error)?.message ?? String(e);
      setAutoError(detail || 'Não foi possível alterar.');
      try {
        const { isEnabled } = await import('@tauri-apps/plugin-autostart');
        setAutostart(await isEnabled());
      } catch { /* mantém o valor anterior */ }
    } finally {
      autoBusy.current = false;
    }
  };

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
          <Toggle value={settings.notifications} onChange={() => updateSettings({ notifications: !settings.notifications })} settings={settings} label={t('notifLabel')} />
        </div>

        {/* Desktop: updater Tauri; Android: sideload via GitHub. */}
        {!isAndroid ? (
        <div className="flex items-center justify-between p-3 rounded-xl lf-surface-40 lf-border">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold lf-text-secondary">{t('updatesLabel')}</span>
            <p className="text-[10px] lf-text-muted">{t('updatesDesc')}</p>
          </div>
          <Toggle value={settings.updates} onChange={() => updateSettings({ updates: !settings.updates })} settings={settings} label={t('updatesLabel')} />
        </div>
        ) : (
          <AndroidUpdater />
        )}

        {/* Desktop com plugin: iniciar com o sistema (boot minimizado). */}
        {!isAndroid && (autostart !== null || autoLoadError) && (
        <div className="flex items-center justify-between p-3 rounded-xl lf-surface-40 lf-border">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold lf-text-secondary">{t('autostartLabel')}</span>
            {autoError || autoLoadError ? (
              <p className="text-[10px] text-red-400" title={autoError ?? autoLoadError ?? ''}>Falha: {autoError ?? autoLoadError}</p>
            ) : (
              <p className="text-[10px] lf-text-muted">{t('autostartDesc')}</p>
            )}
          </div>
          <Toggle
            value={autostart ?? false}
            onChange={toggleAutostart}
            settings={settings}
            disabled={autostart === null}
            label={t('autostartLabel')}
          />
        </div>
        )}
      </div>
    </div>
  );
}
