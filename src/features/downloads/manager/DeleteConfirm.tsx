// Popup de confirmação ao parar/excluir: ativo (queued/downloading/paused)
// oferece Pausar/Retomar, Cancelar (mantém o registro) e Excluir (para o
// processo nativo de verdade + remove da lista + limpa .part). Finalizado
// só confirma a remoção do registro — o arquivo em disco nunca é apagado.
import { useEffect } from 'react';
import { DownloadItem, type AppSettings } from '../../../types';
import { DownloadEngine } from '../../../core/engine/DownloadEngine';
import { Pause, Play, X, Trash2 } from 'lucide-react';
import { AnimatedCard } from '../../../animation/AnimatedCard';
import { scaleIn, transitions } from '../../../animation/variants';

export interface DeleteConfirmProps {
  item: DownloadItem;
  settings: AppSettings;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export function DeleteConfirm({ item, settings, onClose, showToast }: DeleteConfirmProps) {
  const st = item.status;
  const isActive = ['queued', 'downloading', 'paused'].includes(st);
  const isQueued = st === 'queued';
  const langEn = settings.language === 'en';
  const act = (fn: () => void, msg: string) => () => { fn(); showToast(msg); onClose(); };
  const baseBtn = 'px-4 py-3 min-h-[48px] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]';

  // Fecha com Escape (desktop/teclado BT no Android).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusLabel = isQueued
    ? (langEn ? 'Queued' : 'Na fila')
    : st === 'downloading'
      ? (langEn ? 'Downloading' : 'Baixando')
      : st === 'paused'
        ? (langEn ? 'Paused' : 'Pausado')
        : st;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={langEn ? 'Confirm download action' : 'Confirmar ação do download'}
    >
      <AnimatedCard
        variant={scaleIn}
        transition={transitions.modal}
        className="w-full max-w-sm bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden max-h-[85dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-700/50">
          <h3 className="text-sm font-semibold text-zinc-100">
            {isActive
              ? (langEn ? `Download ${statusLabel.toLowerCase()} — what to do?` : `Download ${statusLabel.toLowerCase()} — o que fazer?`)
              : (langEn ? 'Delete record?' : 'Excluir registro?')}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 truncate" title={item.title}>{item.title}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-400 leading-relaxed">
            {isActive
              ? (langEn
                ? 'Pause keeps the partial file for resume. Cancel stops the process but keeps the record. Delete stops the process, removes it from the list and cleans temp files.'
                : 'Pausar mantém o parcial para retomar. Cancelar para o processo mas mantém o registro. Excluir para o processo, remove da lista e limpa temporários.')
              : (langEn
                ? 'Remove this record from the list? The downloaded file on disk is kept.'
                : 'Remover este registro da lista? O arquivo já baixado é mantido no disco.')}
          </p>
        </div>
        <div className="px-5 py-4 border-t border-zinc-700/50 grid grid-cols-2 gap-2">
          {st === 'downloading' && (
            <button
              onClick={act(() => DownloadEngine.pauseDownload(item.id, true), langEn ? 'Download paused' : 'Download pausado')}
              className={`${baseBtn} bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-700/40`}
            >
              <Pause size={14} /> {langEn ? 'Pause' : 'Pausar'}
            </button>
          )}
          {st === 'paused' && (
            <button
              onClick={act(() => DownloadEngine.resumeDownload(item.id), langEn ? 'Download resumed' : 'Download retomado')}
              className={`${baseBtn} bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-700/40`}
            >
              <Play size={14} fill="currentColor" /> {langEn ? 'Resume' : 'Retomar'}
            </button>
          )}
          {isActive && (
            <button
              onClick={act(() => DownloadEngine.cancelDownload(item.id, true), langEn ? 'Download cancelled' : 'Download cancelado')}
              className={`${baseBtn} bg-zinc-700/60 hover:bg-zinc-700 text-zinc-200 border border-zinc-600/50`}
            >
              <X size={14} /> {isQueued ? (langEn ? 'Remove from queue' : 'Tirar da fila') : (langEn ? 'Cancel' : 'Cancelar')}
            </button>
          )}
          <button
            onClick={act(() => DownloadEngine.removeDownload(item.id), langEn ? 'Record deleted' : 'Registro excluído')}
            className={`${baseBtn} bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-700/40`}
          >
            <Trash2 size={14} /> {langEn ? 'Delete' : 'Excluir'}
          </button>
          <button
            onClick={onClose}
            className={`${baseBtn} bg-transparent hover:bg-white/5 text-zinc-400 border border-zinc-700/50 col-span-2`}
          >
            {langEn ? 'Keep' : 'Manter'}
          </button>
        </div>
      </AnimatedCard>
    </div>
  );
}
