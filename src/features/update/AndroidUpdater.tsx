import { useState, useCallback } from 'react';
import { RefreshCw, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { Toggle } from '../../components/Toggle';
import { useApp } from '../../context/AppContext';

/** Sideload de APK via releases do GitHub (o DownloadManager nativo instala). */

const OWNER = '4i20nataN';
const REPO = 'LinkFetcher';
const LATEST_URL = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;

function parseVer(v: string): number[] {
  return v.trim().replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}

/** Retorna >0 se `a` é mais nova que `b`. */
function compareVer(a: string, b: string): number {
  const pa = parseVer(a);
  const pb = parseVer(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

type Stage = 'idle' | 'checking' | 'available' | 'downloading' | 'done' | 'error';

export type UpdateComplete = { status: 'ok' | 'failed' | 'timeout'; error?: string };

/** Dispara o update pela rota Rust (transporte provado do probe/execute),
 *  em vez do invoke direto no plugin. */
export async function invokeUpdateDownload(url: string, fileName: string): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('ytdlp_update_download', { options: { url, fileName } });
}

/** Aguarda o desfecho do instalador (`lf-update-complete` do plugin):
 *  ok = instalador abriu; failed = motivo em `error`; timeout = segue
 *  baixando pela notificação (sem erro). Transporte duplo igual ao engine. */
export function waitUpdateComplete(fileName: string, timeoutMs = 120_000): Promise<UpdateComplete> {
  return new Promise((resolve) => {
    let done = false;
    let unlistenTauri: (() => void) | null = null;
    let onCustom: ((e: Event) => void) | null = null;
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => finish({ status: 'timeout' }), timeoutMs);
    const finish = (r: UpdateComplete) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        unlistenTauri?.();
      } catch { /* idempotente */ }
      try {
        if (onCustom && typeof window !== 'undefined') window.removeEventListener('lf-update-complete', onCustom);
      } catch { /* idempotente */ }
      resolve(r);
    };
    const match = (d: any) => {
      if (!d || (d.fileName && d.fileName !== fileName)) return;
      finish(d.ok === false
        ? { status: 'failed', error: typeof d.error === 'string' ? d.error : undefined }
        : { status: 'ok' });
    };
    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlistenTauri = await listen('lf-update-complete', (e: any) => match(e?.payload));
      } catch { /* sem Tauri: só CustomEvent */ }
      if (typeof window !== 'undefined') {
        onCustom = (e: Event) => match((e as CustomEvent).detail);
        window.addEventListener('lf-update-complete', onCustom);
      }
    })();
  });
}

export interface AndroidUpdateAvailable {
  tag: string;
  apkUrl: string;
  apkName: string;
  body: string;
}

export interface AndroidCheckResult {
  available: boolean;
  /** tag remota (mesmo quando já está em dia) */
  tag: string;
  info?: AndroidUpdateAvailable;
}

/** Checagem pura reusável (banner automático + linha manual): resolve com
 *  o APK da ABI do aparelho quando há release maior que a instalada.
 *  Erros: AbortError (timeout 15s), NO_APK (sem APK), ou HTTP do GitHub. */
export async function checkAndroidUpdate(): Promise<AndroidCheckResult> {
  // Timeout: fetch sem sinal pendura a UI em rede móvel ruim.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    const current = await getVersion();
    const res = await fetch(LATEST_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
    const rel = await res.json();
    const tag: string = rel.tag_name || '';
    const assets: any[] = rel.assets || [];
    // APK da ABI do aparelho; fallback universal.
    let name = 'LinkFetcher.apk';
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { abi } = await invoke<{ abi: string }>('plugin:ytdlp|appAbi');
      const perAbi = abi ? `LinkFetcher-${abi}.apk` : '';
      if (perAbi && assets.some(a => a?.name === perAbi)) name = perAbi;
    } catch {
    }
    const apk = assets.find((a: any) => typeof a?.name === 'string' && a.name === name);
    if (!tag || !apk?.browser_download_url) throw new Error('NO_APK');
    if (compareVer(tag, current) > 0) {
      return {
        available: true,
        tag,
        info: {
          tag,
          apkUrl: apk.browser_download_url,
          apkName: name,
          body: typeof rel.body === 'string' ? rel.body : '',
        },
      };
    }
    return { available: false, tag };
  } finally {
    clearTimeout(timer);
  }
}

export function AndroidUpdater() {
  const { settings, updateSettings } = useApp();
  const en = settings.language === 'en';
  const [stage, setStage] = useState<Stage>('idle');
  const [remote, setRemote] = useState('');
  const [apkUrl, setApkUrl] = useState('');
  const [apkName, setApkName] = useState('LinkFetcher.apk');
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    setStage('checking');
    setError('');
    try {
      const r = await checkAndroidUpdate();
      if (r.available) {
        setRemote(r.info.tag);
        setApkUrl(r.info.apkUrl);
        setApkName(r.info.apkName);
        setStage('available');
      } else {
        setRemote(r.tag);
        setStage('idle');
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setError(en ? 'Check timed out (15s)' : 'Verificação expirou (15s)');
      } else if (e?.message === 'NO_APK') {
        setError(en ? 'No Android APK in latest release' : 'Release atual sem APK Android');
      } else {
        setError(e?.message || (en ? 'Check failed' : 'Falha na verificação'));
      }
      setStage('error');
      return;
    }
  }, [en]);

  const download = useCallback(async () => {
    if (!apkUrl) return;
    setStage('downloading');
    setError('');
    try {
      await invokeUpdateDownload(apkUrl, apkName);
      const done = await waitUpdateComplete(apkName);
      if (done.status === 'ok') {
        setStage('done');
      } else if (done.status === 'failed') {
        setError(done.error || (en ? 'Download failed' : 'Falha no download'));
        setStage('error');
      }
      // timeout = segue baixando pela notificação do sistema, sem erro.
    } catch (e: any) {
      const msg = typeof e === 'string' ? e : e?.message;
      setError(msg || (en ? 'Download failed' : 'Falha no download'));
      setStage('error');
    }
  }, [apkUrl, apkName, en]);

  const statusText =
    stage === 'checking'
      ? (en ? 'Checking…' : 'Verificando…')
      : stage === 'downloading'
        ? (en ? 'Downloading via system notification…' : 'Baixando pela notificação do sistema…')
        : stage === 'done'
          ? (en ? 'Installer opened — finish on the system screen' : 'Instalador aberto — conclua na tela do sistema')
          : stage === 'available'
            ? (en ? `${remote} available` : `${remote} disponível`)
            : remote
              ? (en ? `Up to date (${remote})` : `Em dia (${remote})`)
              : (en ? 'Check for app updates via GitHub releases' : 'Verifica atualizações nas releases do GitHub');

  return (
    <div className="flex items-center justify-between gap-2 p-3 rounded-xl lf-surface-40 lf-border">
      <div className="space-y-0.5 min-w-0">
        <span className="text-xs font-semibold lf-text-secondary">
          {en ? 'App updates' : 'Atualizações do app'}
        </span>
        <p className="text-[10px] lf-text-muted flex items-center gap-1">
          {stage === 'error' ? <AlertCircle size={10} className="text-rose-400 shrink-0" /> : null}
          {stage === 'done' ? <CheckCircle2 size={10} className="text-emerald-400 shrink-0" /> : null}
          <span className="break-words line-clamp-3">{stage === 'error' ? error : statusText}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Toggle value={settings.updates} onChange={() => updateSettings({ updates: !settings.updates })} settings={settings} />
        {stage === 'available' ? (
          <button
            onClick={download}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <Download size={12} />
            {en ? 'Install' : 'Instalar'}
          </button>
        ) : stage === 'idle' || stage === 'error' || stage === 'done' ? (
          <button
            onClick={check}
            className="px-3 py-2 rounded-xl lf-surface-raised hover:bg-zinc-800 lf-text hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-zinc-700/50 transition-all whitespace-nowrap"
          >
            <RefreshCw size={12} />
            {en ? 'Check' : 'Verificar'}
          </button>
        ) : (
          <span className="px-3 py-2 text-xs lf-text-muted flex items-center gap-1.5">
            {stage === 'available' || stage === 'downloading' ? <CheckCircle2 size={12} className="text-emerald-400" /> : <RefreshCw size={12} className="animate-spin" />}
            {stage === 'downloading' ? (en ? 'Downloading…' : 'Baixando…') : ''}
          </span>
        )}
      </div>
    </div>
  );
}
