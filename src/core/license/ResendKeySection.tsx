// Reenvio da chave PRO pelo e-mail da compra ("perdi minha chave", aparelho
// novo, formatação). Um só componente para a aba Sobre e o modal de licença:
// o botão só liga com e-mail válido e o servidor manda para o endereço CADASTRADO
// na compra — nunca para o endereço digitado aqui.
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { recoverKey } from './autoBuy';
import { validEmail } from './purchase';

const INPUT_CLS = 'w-full p-2.5 rounded-xl lf-surface-40 lf-border text-sm text-white placeholder:text-zinc-600 focus:outline-none';
const PRIMARY_BTN = 'w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-bold fs-sm transition-all';
const GHOST_BTN = 'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-white fs-sm font-semibold transition-colors';

/** `withRelease`: libera a cota de 2 aparelhos da chave antes de reenviar
 *  (o servidor só faz isso com a chave ainda vigente). */
export function ResendKeySection({ initialEmail = '', withRelease = false }: {
  initialEmail?: string;
  withRelease?: boolean;
}) {
  const { settings } = useApp();
  const isEn = settings.language === 'en';
  const t = (pt: string, en: string) => (isEn ? en : pt);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typed = email.trim();
  const ok = validEmail(typed);

  async function send(release: boolean): Promise<void> {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await recoverKey(typed.toLowerCase(), release ? { release: true } : undefined);
      setSent(true);
    } catch (e) {
      const code = (e as { body?: { error?: string } })?.body?.error;
      setError(code === 'rate-limited'
        ? t('Muitas tentativas. Espere um minuto e tente de novo.', 'Too many attempts. Wait a minute and try again.')
        : t('Não conseguiu enviar. Confira a conexão e tente de novo.', 'Could not send. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <p className="fs-sm lf-text-secondary">
        {t(
          'Digite o e-mail da compra. A chave é enviada para o e-mail cadastrado no pagamento — nunca para outro endereço.',
          'Enter the purchase email. The key goes to the email registered at payment — never to another address.',
        )}
      </p>
      <input
        value={email}
        onChange={(e) => { setEmail(e.target.value); setSent(false); setError(null); }}
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        placeholder="voce@email.com"
        className={INPUT_CLS}
      />
      {!ok && typed.length > 0 && (
        <p className="fs-sm text-red-400">{t('E-mail incompleto ou inválido.', 'Incomplete or invalid email.')}</p>
      )}
      <button
        onClick={() => void send(false)}
        disabled={!ok || busy}
        title={ok ? undefined : t('Digite o e-mail da compra primeiro.', 'Type the purchase email first.')}
        className={PRIMARY_BTN}
      >
        {busy ? '…' : t('Reenviar minha chave', 'Resend my key')}
      </button>
      {withRelease && (
        <>
          <button
            onClick={() => void send(true)}
            disabled={!ok || busy}
            className={GHOST_BTN}
          >
            {busy ? '…' : t('Liberar os aparelhos e reenviar', 'Release devices and resend')}
          </button>
          <p className="fs-sm lf-text-muted">
            {t(
              'Trocou de aparelho ou reinstalou? Limpa a cota de 2 aparelhos da chave e reenvia a chave.',
              'New device or reinstall? Clears the key 2-device quota and resends the key.',
            )}
          </p>
        </>
      )}
      {sent && (
        <p className="fs-sm text-emerald-400">
          {t(
            'Pronto. Se houver assinatura ativa nesse e-mail, a chave chega em alguns minutos — chave vencida não é reenviada.',
            'Done. If that email has an active subscription, the key arrives in a few minutes — expired keys are not resent.',
          )}
        </p>
      )}
      {error && <p className="fs-sm text-red-400">{error}</p>}
    </div>
  );
}
