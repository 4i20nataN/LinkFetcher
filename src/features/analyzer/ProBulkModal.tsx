// Pop-up "playlist em lote é PRO": abre no fim da análise de playlist para o
// gratuito e quando o gratuito clica num botão de lote. A análise continua
// gratuita — só enfileirar a lista inteira pede licença.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { AnimatedModal } from '../../animation/AnimatedModal';
import { KeyRound, X } from 'lucide-react';

export interface ProBulkModalProps {
  onClose: () => void;
  /** Fecha o aviso e abre o modal de licença da casa. */
  onActivate: () => void;
}

export function ProBulkModal({ onClose, onActivate }: ProBulkModalProps) {
  const { settings } = useApp();
  const isEn = settings.language === 'en';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal no body: a transição de aba anima o ancestral e sequestra o `fixed`.
  return createPortal(
    <AnimatedModal
      open
      onClose={onClose}
      id="pro-bulk-playlist-modal"
      cardClassName="w-full max-w-sm p-5 rounded-2xl bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 shadow-2xl space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-white fs-sm">
          <KeyRound size={16} />
          {isEn ? 'Playlists are a PRO feature' : 'Playlist é recurso PRO'}
        </div>
        <button onClick={onClose} className="p-1 rounded lf-text-muted hover:text-white" aria-label={isEn ? 'Close' : 'Fechar'}>
          <X size={16} />
        </button>
      </div>
      <p className="fs-sm lf-text-secondary leading-relaxed">
        {isEn
          ? 'You can analyze and browse every item for free. Downloading the whole playlist at once needs PRO.'
          : 'Dá para analisar e ver todos os itens de graça. Baixar a playlist inteira de uma vez precisa do PRO.'}
      </p>
      <div className="space-y-2">
        <button
          onClick={onActivate}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold fs-sm transition-all"
        >
          {isEn ? 'Activate PRO' : 'Ativar PRO'}
        </button>
        <button
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-white fs-sm font-semibold transition-colors"
        >
          {isEn ? 'Not now' : 'Agora não'}
        </button>
      </div>
    </AnimatedModal>,
    document.body,
  );
}
