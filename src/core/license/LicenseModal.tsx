// Modal de ativação PRO: colar a chave → verifica assinatura → salva.
// Quando já ativo, mostra status + botão de remover. Sem backdoors.
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { verifyLicenseKey, isLicenseActive } from './license';
import { getLicense, saveLicense, clearLicense, useLicense } from './licenseStore';
import { PRO_PLAN, buildPixPayload, whatsappBuyLink, validPhone, validEmail, maskPhoneBR, onlyDigits } from './purchase';
import { autoBuyEnabled, createAutoCheckout, fetchAutoKey, type AutoCheckout } from './autoBuy';
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

export function LicenseModal({ onClose }: { onClose: () => void }) {
  const { settings } = useApp();
  const isEn = settings.language === 'en';
  const lic = useLicense() ?? getLicense();
  const active = isLicenseActive(lic);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'buy' | 'activate' | 'auto'>('buy');
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Compra automática (Mercado Pago): e-mail → Pix → poll → ativa sozinho.
  const [autoEmail, setAutoEmail] = useState('');
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoCheckout, setAutoCheckout] = useState<AutoCheckout | null>(null);
  const [autoQr, setAutoQr] = useState<string | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [contact, setContact] = useState('');
  const [ctype, setCtype] = useState<'wa' | 'mail'>('wa');
  const [contactSet, setContactSet] = useState<string | null>(null);
  const typedOk = ctype === 'wa' ? validPhone(contact) : validEmail(contact);
  const contactLabel = contactSet ? (ctype === 'wa' ? maskPhoneBR(contactSet) : contactSet) : '';
  const contactOk = contactSet !== null;
  // Campo da chave libera após contato confirmado (é pra onde a chave vai).
  const keyUnlocked = contactOk;
  const pixPayload = !(active && lic) && view === 'buy' ? buildPixPayload() : '';

  useEffect(() => {
    if (!pixPayload) return;
    let alive = true;
    QRCode.toDataURL(pixPayload, { width: 200, margin: 1 }).then(
      url => { if (alive) setQr(url); },
      () => { if (alive) setQr(null); },
    );
    return () => { alive = false; };
  }, [pixPayload]);

  const copyPix = async () => {    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(isEn ? 'Copy failed — long-press the code.' : 'Falha ao copiar — selecione o código manualmente.');
    }
  };

  const startAuto = async () => {
    if (!validEmail(autoEmail) || autoBusy) return;
    setAutoBusy(true);
    setAutoError(null);
    try {
      const co = await createAutoCheckout(autoEmail.trim().toLowerCase(), autoEmail.trim().toLowerCase());
      setAutoCheckout(co);
      if (co.qrImage) setAutoQr(co.qrImage);
      else if (co.qrText) setAutoQr(await QRCode.toDataURL(co.qrText, { width: 200, margin: 1 }));
    } catch {
      setAutoError(isEn ? 'Could not generate Pix. Try again.' : 'Não gerou o Pix. Tente de novo.');
    } finally {
      setAutoBusy(false);
    }
  };

  // Poll da chave: pago → verifica assinatura → salva → fecha sozinho.
  useEffect(() => {
    if (view !== 'auto' || !autoCheckout) return;
    let alive = true;
    const email = autoEmail.trim().toLowerCase();
    const t = setInterval(async () => {
      try {
        const r = await fetchAutoKey(autoCheckout.checkoutId, email);
        if (!alive) return;
        if (r.status === 'paid' && r.key) {
          clearInterval(t);
          const chk = await verifyLicenseKey(r.key);
          if (!alive) return;
          if (chk.valid) {
            saveLicense({
              key: r.key, name: chk.name ?? '', plan: chk.plan ?? 'PRO',
              expiresAt: chk.expiresAt ?? 0, activatedAt: new Date().toISOString(),
            });
            onClose();
          } else {
            setAutoError(isEn ? 'Invalid key from server.' : 'Chave inválida do servidor.');
          }
        }
      } catch { /* próximo tick tenta */ }
    }, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [view, autoCheckout, autoEmail, isEn, onClose]);

  const activate = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const chk = await verifyLicenseKey(key);
      if (!chk.valid) {
        setError((isEn ? ERR_EN : ERR_PT)[chk.error ?? 'signature'] ?? (isEn ? 'Invalid key.' : 'Chave inválida.'));
        return;
      }
      saveLicense({
        key: key.trim(),
        name: chk.name ?? '',
        plan: chk.plan ?? 'PRO',
        expiresAt: chk.expiresAt ?? 0,
        activatedAt: new Date().toISOString(),
      });
      // Chave com assinatura válida = pagamento reconhecido. Libera na hora.
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-sm p-5 rounded-2xl lf-surface-raised lf-border-strong space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <KeyRound size={16} />
            {isEn ? 'Activate PRO' : 'Ativar PRO'}
          </div>
          <button onClick={onClose} className="p-1 rounded lf-text-muted hover:text-white" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {active && lic ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 fs-sm text-emerald-300">
              {isEn ? 'PRO active' : 'PRO ativo'}
              {lic.name ? (isEn ? ` — licensed to ${lic.name}` : ` — licenciado para ${lic.name}`) : ''}
              {lic.expiresAt !== 0 && (
                <span className="block lf-text-muted">
                  {isEn ? 'Expires: ' : 'Expira: '}{new Date(lic.expiresAt * 1000).toLocaleDateString()}
                </span>
              )}
            </div>
            <button
              onClick={() => { clearLicense(); onClose(); }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-red-400 fs-sm font-semibold transition-colors"
            >
              <Trash2 size={14} />
              {isEn ? 'Remove license' : 'Remover licença'}
            </button>
          </div>
        ) : view === 'buy' ? (
          <div className="space-y-3">
            <p className="text-center font-bold text-white fs-sm">
              {PRO_PLAN.label} — R$ {PRO_PLAN.price.toFixed(2).replace('.', ',')}
              <span className="block lf-text-muted font-normal">
                {isEn ? `${PRO_PLAN.days} days of Custom Download` : `${PRO_PLAN.days} dias de Download Personalizado`}
              </span>
            </p>
            {autoBuyEnabled() && (
              <button
                onClick={() => { setView('auto'); setAutoError(null); }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold fs-sm transition-all"
              >
                {isEn ? '⚡ Pix with instant release' : '⚡ Pix com liberação na hora'}
              </button>
            )}
            <div className="flex justify-center">
              <div className="p-2.5 rounded-xl bg-white">
                {qr ? <img src={qr} alt="QR Pix" className="w-44 h-44" /> : <div className="w-44 h-44" />}
              </div>
            </div>
            <button
              onClick={copyPix}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-white fs-sm font-semibold transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? (isEn ? 'Copied!' : 'Copiado!') : (isEn ? 'Copy Pix code' : 'Copiar código Pix')}
            </button>
            <div className="grid grid-cols-2 gap-2">
              {(['wa', 'mail'] as const).map(t => {
                const on = ctype === t;
                return (
                  <button
                    key={t}
                    onClick={() => { setCtype(t); setContact(''); setContactSet(null); }}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl border fs-sm font-bold transition-all ${on ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'lf-border lf-surface-40 lf-text-muted hover:text-zinc-200'}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${on ? 'border-emerald-400' : 'border-zinc-600'}`}>
                      {on && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </span>
                    {t === 'wa' ? 'WhatsApp' : 'E-mail'}
                  </button>
                );
              })}
            </div>
            {contactSet ? (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 fs-sm text-emerald-300">
                <Check size={14} className="shrink-0" />
                <span className="flex-1 truncate">{contactLabel}</span>
                <button
                  onClick={() => { setContactSet(null); }}
                  className="fs-sm lf-text-muted hover:text-zinc-200 underline"
                >
                  {isEn ? 'change' : 'trocar'}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={ctype === 'wa' ? maskPhoneBR(contact) : contact}
                  onChange={e => setContact(ctype === 'wa' ? onlyDigits(e.target.value).slice(0, 13) : e.target.value)}
                  inputMode={ctype === 'wa' ? 'tel' : 'email'}
                  autoComplete="off"
                  placeholder={ctype === 'wa' ? '(46) 99917-4002' : 'voce@email.com'}
                  className="flex-1 min-w-0 p-2.5 rounded-xl lf-surface-40 lf-border text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                />
                <button
                  onClick={() => { if (typedOk) setContactSet(ctype === 'wa' ? onlyDigits(contact) : contact.trim().toLowerCase()); }}
                  disabled={!typedOk}
                  className="px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white fs-sm font-bold transition-all"
                >
                  {isEn ? 'Confirm' : 'Confirmar'}
                </button>
              </div>
            )}
            {contact.trim() && !typedOk && !contactSet && (
              <p className="fs-sm text-red-400">
                {ctype === 'wa'
                  ? (isEn ? 'Enter a valid WhatsApp (DDD + number).' : 'Digite um WhatsApp válido (DDD + número).')
                  : (isEn ? 'Enter a valid email.' : 'Digite um e-mail válido.')}
              </p>
            )}
            <a
              href={whatsappBuyLink(contactSet ? contactLabel : undefined)}
              target="_blank"
              rel="noreferrer"
              className="w-full text-center fs-sm lf-text-muted hover:text-zinc-200 transition-colors"
            >
              {isEn ? 'Need help? Talk on WhatsApp' : 'Precisa de ajuda? Fale no WhatsApp'}
            </a>
            <textarea
              value={key}
              onChange={e => setKey(e.target.value)}
              rows={2}
              spellCheck={false}
              autoComplete="off"
              disabled={!keyUnlocked}
              placeholder={keyUnlocked
                ? 'LF1-XXXX-XXXX-...'
                : (isEn ? 'Confirm your contact above to unlock' : 'Confirme seu contato acima para liberar')}
              className="w-full p-2.5 rounded-xl lf-surface-40 lf-border font-mono text-xs text-white placeholder:text-zinc-600 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={activate}
              disabled={!keyUnlocked || !key.trim() || busy}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-bold fs-sm transition-all"
            >
              {busy ? '…' : (isEn ? 'Activate' : 'Ativar')}
            </button>
            {error && (
              <p className="flex items-center gap-1.5 fs-sm text-red-400">
                <Lock size={13} className="shrink-0" />
                {error}
              </p>
            )}
            <button
              onClick={() => { setView('activate'); setError(null); }}
              className="w-full text-center fs-sm lf-text-muted hover:text-zinc-200 transition-colors"
            >
              {isEn ? 'I already have a key' : 'Já tenho uma chave'}
            </button>
          </div>
        ) : view === 'auto' ? (
          <div className="space-y-3">
            <button
              onClick={() => setView('buy')}
              className="fs-sm lf-text-muted hover:text-zinc-200 transition-colors"
            >
              ← {isEn ? 'Back' : 'Voltar'}
            </button>
            <p className="text-center font-bold text-white fs-sm">
              {isEn ? '⚡ Pix with instant release' : '⚡ Pix com liberação na hora'}
              <span className="block lf-text-muted font-normal">
                {isEn ? 'Pay and the key activates by itself' : 'Pagou, a chave ativa sozinha'}
              </span>
            </p>
            {!autoCheckout ? (
              <>
                <input
                  value={autoEmail}
                  onChange={e => setAutoEmail(e.target.value)}
                  inputMode="email"
                  autoComplete="off"
                  placeholder="voce@email.com"
                  className="w-full p-2.5 rounded-xl lf-surface-40 lf-border text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                />
                <button
                  onClick={startAuto}
                  disabled={!validEmail(autoEmail) || autoBusy}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-bold fs-sm transition-all"
                >
                  {autoBusy ? '…' : (isEn ? 'Generate Pix R$ 9,99' : 'Gerar Pix R$ 9,99')}
                </button>
                {autoError && (
                  <p className="fs-sm text-red-400">{autoError}</p>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-center">
                  <div className="p-2.5 rounded-xl bg-white">
                    {autoQr ? <img src={autoQr} alt="QR Pix" className="w-44 h-44" /> : <div className="w-44 h-44" />}
                  </div>
                </div>
                <p className="text-center fs-sm lf-text-secondary animate-pulse">
                  {isEn ? 'Waiting for payment…' : 'Aguardando pagamento…'}
                </p>
                {autoError && (
                  <p className="fs-sm text-red-400">{autoError}</p>
                )}
                <button
                  onClick={() => { setAutoCheckout(null); setAutoQr(null); }}
                  className="w-full text-center fs-sm lf-text-muted hover:text-zinc-200 transition-colors"
                >
                  {isEn ? 'Cancel and generate another' : 'Cancelar e gerar outro'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => { setView('buy'); setError(null); }}
              className="fs-sm lf-text-muted hover:text-zinc-200 transition-colors"
            >
              ← {isEn ? 'Back to payment' : 'Voltar ao pagamento'}
            </button>
            <p className="fs-sm lf-text-secondary">
              {isEn
                ? 'Paste the key you received after purchase to unlock Custom Download.'
                : 'Cole a chave recebida após a compra para liberar o Download Personalizado.'}
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
            {error && (
              <p className="flex items-center gap-1.5 fs-sm text-red-400">
                <Lock size={13} className="shrink-0" />
                {error}
              </p>
            )}
            <button
              onClick={activate}
              disabled={!key.trim() || busy}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-bold fs-sm transition-all"
            >
              {busy ? '…' : (isEn ? 'Activate' : 'Ativar')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
