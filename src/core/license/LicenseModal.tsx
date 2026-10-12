// Modal PRO: comprar (e-mail → Pix → chave na tela + e-mail) ou ativar com
// chave existente (chave + e-mail do comprador). Reenvio da chave por e-mail.
// Quando ativo: status + remover. Sem backdoors.
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { verifyLicenseKey, isLicenseActive, keyBelongsToContact } from './license';
import { getLicense, saveLicense, clearLicense, useLicense } from './licenseStore';
import { PRO_PLAN, validEmail } from './purchase';
import { createAutoCheckout, fetchAutoKey, recoverKey, saveLastCheckout, loadLastCheckout, clearLastCheckout, type AutoCheckout } from './autoBuy';
import QRCode from 'qrcode';
import { KeyRound, X, Lock, Trash2, Copy, Check } from 'lucide-react';

const ERR_PT: Record<string, string> = {
  format: 'Formato inválido. Confira a chave recebida (começa com LF1-).',
  signature: 'Assinatura inválida. Chave recusada.',
  version: 'Chave de outra versão. Fale com o suporte.',
  plan: 'Plano desconhecido nesta chave.',
  expired: 'Chave expirada. Renove para continuar no PRO.',
  unconfigured: 'Licenciamento ainda não configurado neste build.',
};
const ERR_EN: Record<string, string> = {
  format: 'Invalid format. Check the key you received (starts with LF1-).',
  signature: 'Invalid signature. Key rejected.',
  version: 'Key from another version. Contact support.',
  plan: 'Unknown plan in this key.',
  expired: 'Key expired. Renew to stay PRO.',
  unconfigured: 'Licensing not configured in this build yet.',
};

const INPUT_CLS = 'w-full p-2.5 rounded-xl lf-surface-40 lf-border text-sm text-white placeholder:text-zinc-600 focus:outline-none';
const PRIMARY_BTN = 'w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-bold fs-sm transition-all';
const GHOST_BTN = 'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-white fs-sm font-semibold transition-colors';
const LINK_BTN = 'w-full text-center fs-sm lf-text-muted hover:text-zinc-200 transition-colors';

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="fs-sm text-red-400">{message}</p>;
}

function CopyButton({ copied, onCopy, label, copiedLabel }: {
  copied: boolean; onCopy: () => void; label: string; copiedLabel: string;
}) {
  return (
    <button onClick={onCopy} className={GHOST_BTN}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? copiedLabel : label}
    </button>
  );
}

async function qrFromCheckout(co: AutoCheckout): Promise<string | null> {
  if (co.qrImage) return co.qrImage;
  if (!co.qrText) return null;
  try {
    return await QRCode.toDataURL(co.qrText, { width: 200, margin: 1 });
  } catch {
    return null;
  }
}

export function LicenseModal({ onClose }: { onClose: () => void }) {
  const { settings } = useApp();
  const isEn = settings.language === 'en';
  const lic = useLicense() ?? getLicense();
  const active = isLicenseActive(lic);
  const [view, setView] = useState<'buy' | 'activate' | 'recover'>('buy');

  // Compra: e-mail → Pix → poll → chave na tela + e-mail.
  const [email, setEmail] = useState('');
  const [buying, setBuying] = useState(false);
  const [checkout, setCheckout] = useState<AutoCheckout | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const [doneExp, setDoneExp] = useState<number | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [resumed, setResumed] = useState(() => loadLastCheckout());

  // Ativação: chave + e-mail do comprador (novo aparelho, formatou, perdeu).
  const [key, setKey] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);

  const emailOk = validEmail(email);
  const price = `R$ ${PRO_PLAN.price.toFixed(2).replace('.', ',')}`;
  const t = (pt: string, en: string) => (isEn ? en : pt);

  function flash(setter: (v: boolean) => void): void {
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  function resetPurchase(): void {
    setCheckout(null);
    setQr(null);
    setPayError(null);
    setDoneKey(null);
    setDoneExp(null);
    clearLastCheckout();
    setResumed(null);
  }

  async function startBuy(): Promise<void> {
    const buyer = email.trim().toLowerCase();
    if (!validEmail(buyer) || buying) return;
    setBuying(true);
    setPayError(null);
    setDoneKey(null);
    setDoneExp(null);
    try {
      const co = await createAutoCheckout(buyer, buyer);
      setCheckout(co);
      saveLastCheckout(buyer, co);
      setResumed(null);
      setQr(await qrFromCheckout(co));
    } catch (e) {
      const body = (e as { body?: { validUntil?: string } })?.body;
      if (e instanceof Error && e.message === 'server-409') {
        const until = body?.validUntil ? new Date(body.validUntil).toLocaleDateString(isEn ? 'en' : 'pt-BR') : null;
        setPayError(until
          ? t(`Este e-mail já tem PRO ativo até ${until} — enviamos a chave pro seu e-mail.`, `This email already has PRO active until ${until} — we sent the key to your email.`)
          : t('Este e-mail já tem PRO ativo — enviamos a chave pro seu e-mail.', 'This email already has PRO active — we sent the key to your email.'));
      } else {
        setPayError(t('Não gerou o Pix. Tente de novo.', 'Could not generate Pix. Try again.'));
      }
    } finally {
      setBuying(false);
    }
  }

  async function resumeLast(): Promise<void> {
    if (!resumed) return;
    setEmail(resumed.email);
    setCheckout(resumed.co);
    setResumed(null);
    setQr(await qrFromCheckout(resumed.co));
  }

  // Poll da chave: pago → valida → salva → mostra na tela + e-mail.
  // Para nos estados terminais (rejeitado/cancelado/divergente/expirado).
  useEffect(() => {
    if (view !== 'buy' || !checkout || doneKey) return;
    const terminalMsg: Record<string, string> = {
      rejected: t('Pagamento rejeitado. Cancele e gere outro Pix.', 'Payment rejected. Cancel and generate another Pix.'),
      cancelled: t('Pagamento cancelado. Cancele e gere outro Pix.', 'Payment cancelled. Cancel and generate another Pix.'),
      amount_mismatch: t('Valor divergente — fale com o suporte.', 'Amount mismatch — contact support.'),
    };
    let alive = true;
    const buyer = email.trim().toLowerCase();
    const check = async (): Promise<boolean> => {
      try {
        if (Date.now() > checkout.expiresAt) {
          if (alive) setPayError(t('Pix expirado. Cancele e gere outro.', 'Pix expired. Cancel and generate another.'));
          return true;
        }
        const r = await fetchAutoKey(checkout.checkoutId, buyer);
        if (!alive) return true;
        if (r.status === 'paid' && r.key) {
          const chk = await verifyLicenseKey(r.key);
          if (!alive) return true;
          if (chk.valid) {
            saveLicense({
              key: r.key, name: chk.name ?? '', plan: chk.plan ?? 'PRO',
              expiresAt: chk.expiresAt ?? 0, activatedAt: new Date().toISOString(),
              contact: buyer,
            });
            clearLastCheckout();
            setDoneKey(r.key);
            setDoneExp(chk.expiresAt ?? 0);
          } else {
            setPayError(t('Chave inválida do servidor.', 'Invalid key from server.'));
          }
          return true;
        }
        const msg = terminalMsg[r.status];
        if (msg) {
          if (alive) setPayError(msg);
          return true;
        }
      } catch { /* próximo tick tenta */ }
      return false;
    };
    void check().then(done => {
      if (done || !alive) return;
      const timer = setInterval(async () => {
        if (await check()) clearInterval(timer);
      }, 5000);
      const cleanup = () => clearInterval(timer);
      timers.push(cleanup);
    });
    const timers: Array<() => void> = [];
    return () => { alive = false; timers.forEach(fn => fn()); };
  }, [view, checkout, doneKey, email, isEn]);

  async function copyPix(): Promise<void> {
    if (!checkout?.qrText) return;
    try {
      await navigator.clipboard.writeText(checkout.qrText);
      flash(setPixCopied);
    } catch {
      setPayError(t('Falha ao copiar — selecione o código manualmente.', 'Copy failed — long-press the code.'));
    }
  }

  async function copyDoneKey(): Promise<void> {
    if (!doneKey) return;
    try {
      await navigator.clipboard.writeText(doneKey);
      flash(setKeyCopied);
    } catch {
      setPayError(t('Falha ao copiar — selecione a chave manualmente.', 'Copy failed — long-press the key.'));
    }
  }

  async function downloadDoneKey(): Promise<void> {
    if (!doneKey) return;
    const content = `LinkFetcher PRO — sua chave\n\n${doneKey}\n\nAtive em: Download Personalizado → Ativar PRO → Já tenho uma chave.\n`;
    try {
      const isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        const { join } = await import('@tauri-apps/api/path');
        let dir = '';
        try {
          dir = await invoke<string>('fs_get_downloads_path');
        } catch { dir = ''; }
        if (!dir) throw new Error('nodir');
        await writeFile(await join(dir, 'linkfetcher-chave-pro.txt'), new TextEncoder().encode(content));
      } else {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'linkfetcher-chave-pro.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }
    } catch {
      setPayError(t('Não salvou o arquivo — copie a chave.', 'Could not save the file — copy the key instead.'));
    }
  }

  async function activate(): Promise<void> {
    if (!key.trim() || busy) return;
    const contact = buyerEmail.trim().toLowerCase();
    if (!contact) {
      setError(t('Digite o e-mail do comprador.', 'Enter the buyer email.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const chk = await verifyLicenseKey(key);
      if (!chk.valid) {
        setError((isEn ? ERR_EN : ERR_PT)[chk.error ?? 'signature'] ?? t('Chave inválida.', 'Invalid key.'));
        return;
      }
      // A chave pertence ao contato da compra: trava uso de chave alheia.
      if (!keyBelongsToContact(chk.name, contact)) {
        setError(t('Esta chave pertence a outro contato de compra.', 'This key belongs to another buyer contact.'));
        return;
      }
      saveLicense({
        key: key.trim(),
        name: chk.name ?? '',
        plan: chk.plan ?? 'PRO',
        expiresAt: chk.expiresAt ?? 0,
        activatedAt: new Date().toISOString(),
        contact,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function sendRecovery(): Promise<void> {
    const contact = buyerEmail.trim().toLowerCase();
    if (!validEmail(contact) || recoverBusy) return;
    setRecoverBusy(true);
    setRecoverMsg(null);
    try {
      const r = await recoverKey(contact);
      if (r.status === 'sent') {
        setRecoverMsg(t('Chave enviada pro seu e-mail.', 'Key sent to your email.'));
      } else if (r.status === 'send-failed') {
        setRecoverMsg(t('Compra encontrada, mas o e-mail falhou — fale com o suporte.', 'Purchase found, but email failed — contact support.'));
      } else {
        setRecoverMsg(t('Nenhuma compra paga para este e-mail.', 'No paid purchase for this email.'));
      }
    } catch {
      setRecoverMsg(t('Não enviou. Tente de novo.', 'Could not send. Try again.'));
    } finally {
      setRecoverBusy(false);
    }
  }

  const steps = [
    { label: 'E-mail', done: emailOk, on: !emailOk },
    { label: 'Pix', done: !!doneKey, on: emailOk && !doneKey },
    { label: t('Chave', 'Key'), done: !!doneKey, on: !!checkout },
  ];

  // Portal no body: `fixed` sob ancestral animado ancora fora da tela.
  return createPortal((
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm p-5 rounded-2xl bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 shadow-2xl space-y-4 max-h-[85dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <KeyRound size={16} />
            {t('Ativar PRO', 'Activate PRO')}
          </div>
          <button onClick={onClose} className="p-1 rounded lf-text-muted hover:text-white" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {active && lic ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 fs-sm text-emerald-300">
              {t('PRO ativo', 'PRO active')}
              {lic.name ? (isEn ? ` — licensed to ${lic.name}` : ` — licenciado para ${lic.name}`) : ''}
              {lic.expiresAt !== 0 && (
                <span className="block lf-text-muted">
                  {t('Expira: ', 'Expires: ')}{new Date(lic.expiresAt * 1000).toLocaleDateString()}
                </span>
              )}
            </div>
            <button
              onClick={() => { clearLicense(); onClose(); }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-red-400 fs-sm font-semibold transition-colors"
            >
              <Trash2 size={14} />
              {t('Remover licença', 'Remove license')}
            </button>
          </div>
        ) : view === 'buy' ? (
          <div className="space-y-3">
            <div className="text-center">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-widest">PRO</span>
              <p className="mt-1 text-2xl font-bold text-white">
                {price}
                <span className="text-sm font-normal lf-text-muted">/mês</span>
              </p>
              <p className="fs-sm lf-text-muted">
                {t(`${PRO_PLAN.days} dias de versão PRO`, `${PRO_PLAN.days} days of PRO version`)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(isEn
                ? ['Up to 4K', 'Every codec', 'Trims and subtitles', 'SponsorBlock']
                : ['Até 4K', 'Codecs e formatos', 'Cortes e legendas', 'SponsorBlock']
              ).map(b => (
                <div key={b} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 fs-sm lf-text-secondary">
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{b}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 px-1">
              {steps.map((s, i) => (
                <div key={s.label} className="flex-1 flex items-center gap-1 min-w-0">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${s.done ? 'bg-emerald-500 text-white' : s.on ? 'border border-emerald-500 text-emerald-400' : 'border border-zinc-700 text-zinc-600'}`}>
                    {s.done ? <Check size={11} /> : (i + 1)}
                  </span>
                  <span className={`fs-sm truncate ${s.done || s.on ? 'text-zinc-200' : 'lf-text-muted'}`}>{s.label}</span>
                  {i < steps.length - 1 && <span className="flex-1 h-px bg-zinc-700/60 min-w-2" />}
                </div>
              ))}
            </div>

            {doneKey ? (
              <>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center font-bold text-emerald-300 fs-sm">
                  {t('Pagamento confirmado — 30 dias de PRO ativos!', 'Payment confirmed — 30 days of PRO active!')}
                  {doneExp !== null && doneExp !== 0 && (
                    <span className="block lf-text-muted font-normal">
                      {t('Válida até ', 'Valid until ')}
                      {new Date(doneExp * 1000).toLocaleDateString(isEn ? 'en' : 'pt-BR')}
                    </span>
                  )}
                </div>
                <p className="break-all font-mono text-xs text-white bg-black/30 rounded-lg p-2.5 max-h-24 overflow-y-auto select-all">
                  {doneKey}
                </p>
                <CopyButton copied={keyCopied} onCopy={() => void copyDoneKey()} label={t('Copiar chave', 'Copy key')} copiedLabel={t('Copiado!', 'Copied!')} />
                <button onClick={() => void downloadDoneKey()} className={PRIMARY_BTN}>
                  {t('Baixar chave (.txt)', 'Download key (.txt)')}
                </button>
                <p className="text-center fs-sm lf-text-muted">
                  {t('A chave também foi enviada pro seu e-mail.', 'The key was also sent to your email.')}
                </p>
                <button onClick={onClose} className={LINK_BTN}>
                  {t('Concluir', 'Done')}
                </button>
              </>
            ) : !checkout ? (
              <>
                {resumed && (
                  <button
                    onClick={() => void resumeLast()}
                    className="w-full py-2.5 rounded-xl border border-emerald-500 bg-emerald-500/10 text-white font-bold fs-sm transition-all"
                  >
                    {t(`Continuar último pagamento (${resumed.email})`, `Continue last payment (${resumed.email})`)}
                  </button>
                )}
                <div>
                  <label className="block fs-sm lf-text-secondary mb-1">
                    {t('Digite seu e-mail', 'Enter your email')}
                  </label>
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    inputMode="email"
                    autoComplete="off"
                    placeholder="voce@email.com"
                    className={INPUT_CLS}
                  />
                  {email.trim() && !emailOk && (
                    <p className="fs-sm text-red-400 mt-1">
                      {t('Digite um e-mail válido.', 'Enter a valid email.')}
                    </p>
                  )}
                  <p className="fs-sm lf-text-muted mt-1">
                    {t('A chave vai para este e-mail.', 'The key goes to this email.')}
                  </p>
                </div>
                <button
                  onClick={() => void startBuy()}
                  disabled={!emailOk || buying}
                  className={PRIMARY_BTN}
                >
                  {buying ? '…' : t(`Comprar — ${price}`, `Buy — ${price}`)}
                </button>
                <FieldError message={payError} />
              </>
            ) : (
              <>
                <div className="flex justify-center">
                  <div className="p-2.5 rounded-xl bg-white">
                    {qr ? <img src={qr} alt="QR Pix" className="w-44 h-44" /> : <div className="w-44 h-44" />}
                  </div>
                </div>
                <p className="text-center fs-sm lf-text-secondary animate-pulse">
                  {t('Aguardando pagamento…', 'Waiting for payment…')}
                </p>
                <p className="text-center fs-sm font-semibold text-white">
                  {t(`Confira no banco: ${price} para LinkFetcher`, `Check in your bank app: ${price} to LinkFetcher`)}
                </p>
                <p className="text-center fs-sm lf-text-muted">
                  {t('A chave também chega no seu e-mail.', 'The key also arrives in your email.')}
                </p>
                {checkout.qrText && (
                  <>
                    <p className="break-all font-mono text-[10px] lf-text-muted bg-black/30 rounded-lg p-2 max-h-16 overflow-y-auto select-all">
                      {checkout.qrText}
                    </p>
                    <CopyButton copied={pixCopied} onCopy={() => void copyPix()} label={t('Copiar código Pix', 'Copy Pix code')} copiedLabel={t('Copiado!', 'Copied!')} />
                  </>
                )}
                <FieldError message={payError} />
                <button onClick={resetPurchase} className={LINK_BTN}>
                  {t('Cancelar e gerar outro', 'Cancel and generate another')}
                </button>
              </>
            )}
            <button
              onClick={() => { setView('activate'); setError(null); }}
              className={LINK_BTN}
            >
              {t('Já tenho uma chave', 'I already have a key')}
            </button>
          </div>
        ) : view === 'activate' ? (
          <div className="space-y-3">
            <button
              onClick={() => { setView('buy'); setError(null); }}
              className="fs-sm lf-text-muted hover:text-zinc-200 transition-colors"
            >
              ← {t('Voltar ao pagamento', 'Back to payment')}
            </button>
            <p className="fs-sm lf-text-secondary">
              {t(
                'Cole a chave recebida e o e-mail do comprador para liberar o PRO neste aparelho.',
                'Paste the key you received and the buyer email to unlock PRO on this device.',
              )}
            </p>
            <textarea
              value={key}
              onChange={e => setKey(e.target.value)}
              rows={3}
              spellCheck={false}
              autoComplete="off"
              placeholder="LF1-XXXX-XXXX-..."
              className="w-full p-2.5 rounded-xl lf-surface-40 lf-border font-mono text-xs text-white placeholder:text-zinc-600 focus:outline-none"
            />
            <input
              value={buyerEmail}
              onChange={e => setBuyerEmail(e.target.value)}
              inputMode="email"
              autoComplete="off"
              placeholder="voce@email.com"
              className={INPUT_CLS}
            />
            {error && (
              <p className="flex items-center gap-1.5 fs-sm text-red-400">
                <Lock size={13} className="shrink-0" />
                {error}
              </p>
            )}
            <button
              onClick={() => void activate()}
              disabled={!key.trim() || !buyerEmail.trim() || busy}
              className={PRIMARY_BTN}
            >
              {busy ? '…' : t('Ativar', 'Activate')}
            </button>
            <button
              onClick={() => { setView('recover'); setRecoverMsg(null); }}
              className={LINK_BTN}
            >
              {t('Perdi minha chave', 'Lost my key')}
            </button>
          </div>
        ) : view === 'recover' ? (
          <div className="space-y-3">
            <button
              onClick={() => { setView('activate'); setRecoverMsg(null); }}
              className="fs-sm lf-text-muted hover:text-zinc-200 transition-colors"
            >
              ← {t('Voltar à ativação', 'Back to activation')}
            </button>
            <p className="fs-sm lf-text-secondary">
              {t(
                'Digite o e-mail da compra: se ele já comprou, reenviamos a chave (válida até a expiração).',
                'Enter the purchase email: if it already bought, we resend the key (valid until expiration).',
              )}
            </p>
            <input
              value={buyerEmail}
              onChange={e => setBuyerEmail(e.target.value)}
              inputMode="email"
              autoComplete="off"
              placeholder="voce@email.com"
              className={INPUT_CLS}
            />
            <button
              onClick={() => void sendRecovery()}
              disabled={!validEmail(buyerEmail) || recoverBusy}
              className={PRIMARY_BTN}
            >
              {recoverBusy ? '…' : t('Enviar minha chave no e-mail', 'Send my key by email')}
            </button>
            {recoverMsg && (
              <p className="fs-sm lf-text-secondary">{recoverMsg}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  ), document.body);
}
