// Modal de ativação PRO: colar a chave → verifica assinatura → salva.
// Quando já ativo, mostra status + botão de remover. Sem backdoors.
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { verifyLicenseKey, isLicenseActive } from './license';
import { getLicense, saveLicense, clearLicense, useLicense } from './licenseStore';
import { PRO_PLAN, buildPixPayload, validPhone, validEmail, maskPhoneBR, onlyDigits } from './purchase';
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
  // Compra automática: e-mail → Pix → poll → ativa sozinho.
  const [autoEmail, setAutoEmail] = useState('');
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoCheckout, setAutoCheckout] = useState<AutoCheckout | null>(null);
  const [autoQr, setAutoQr] = useState<string | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [contact, setContact] = useState('');
  const [ctype, setCtype] = useState<'wa' | 'mail'>('wa');
  const contactOk = ctype === 'wa' ? validPhone(contact) : validEmail(contact);
  // QR do Pix manual após Comprar PRO; campo da chave após contato válido.
  const [buyIntent, setBuyIntent] = useState(false);
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

  // Poll da chave: pago → verifica → salva → fecha. Para nos estados
  // terminais (pago/rejeitado/cancelado/divergente/expirado).
  useEffect(() => {
    if (view !== 'auto' || !autoCheckout) return;
    const terminalMsg: Record<string, string> = {
      rejected: isEn ? 'Payment rejected. Cancel and generate another Pix.' : 'Pagamento rejeitado. Cancele e gere outro Pix.',
      cancelled: isEn ? 'Payment cancelled. Cancel and generate another Pix.' : 'Pagamento cancelado. Cancele e gere outro Pix.',
      amount_mismatch: isEn ? 'Amount mismatch — contact support.' : 'Valor divergente — fale com o suporte.',
    };
    let alive = true;
    const email = autoEmail.trim().toLowerCase();
    const t = setInterval(async () => {
      try {
        if (Date.now() > autoCheckout.expiresAt) {
          clearInterval(t);
          if (alive) setAutoError(isEn ? 'Pix expired. Cancel and generate another.' : 'Pix expirado. Cancele e gere outro.');
          return;
        }
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
          return;
        }
        const msg = terminalMsg[r.status];
        if (msg) {
          clearInterval(t);
          if (alive) setAutoError(msg);
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
      onClose();
    } finally {
      setBusy(false);
    }
  };

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
            <div className="text-center">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-widest">PRO</span>
              <p className="mt-1 text-2xl font-bold text-white">
                R$ {PRO_PLAN.price.toFixed(2).replace('.', ',')}
                <span className="text-sm font-normal lf-text-muted">/mês</span>
              </p>
              <p className="fs-sm lf-text-muted">
                {isEn ? `${PRO_PLAN.days} days of Custom Download` : `${PRO_PLAN.days} dias de Download Personalizado`}
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
            {(() => {
              const steps = [
                { label: isEn ? 'Contact' : 'Contato', done: contactOk, on: !contactOk },
                { label: 'Pix', done: false, on: contactOk },
                { label: isEn ? 'Key' : 'Chave', done: false, on: key.trim().length > 0 },
              ];
              return (
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
              );
            })()}
            {autoBuyEnabled() && (
              <button
                onClick={() => { setView('auto'); setAutoError(null); }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold fs-sm transition-all"
              >
                {isEn ? '⚡ Pix with instant release' : '⚡ Pix com liberação na hora'}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(['wa', 'mail'] as const).map(t => {
                const on = ctype === t;
                return (
                  <button
                    key={t}
                    onClick={() => { setCtype(t); setContact(''); setBuyIntent(false); }}
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
            <div>
              <input
                value={ctype === 'wa' ? maskPhoneBR(contact) : contact}
                onChange={e => { setContact(ctype === 'wa' ? onlyDigits(e.target.value).slice(0, 13) : e.target.value); setBuyIntent(false); }}
                inputMode={ctype === 'wa' ? 'tel' : 'email'}
                autoComplete="off"
                placeholder={ctype === 'wa' ? '(XX) XXXXX-XXXX' : 'voce@email.com'}
                className="w-full p-2.5 rounded-xl lf-surface-40 lf-border text-sm text-white placeholder:text-zinc-600 focus:outline-none"
              />
              {contact.trim() && !contactOk && (
                <p className="fs-sm text-red-400 mt-1">
                  {ctype === 'wa'
                    ? (isEn ? 'Enter a valid WhatsApp (DDD + number).' : 'Digite um WhatsApp válido (DDD + número).')
                    : (isEn ? 'Enter a valid email.' : 'Digite um e-mail válido.')}
                </p>
              )}
            </div>
            {!buyIntent ? (
              <button
                onClick={() => { if (contactOk) setBuyIntent(true); }}
                disabled={!contactOk}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white font-bold fs-sm transition-all"
              >
                {isEn ? 'Buy PRO' : 'Comprar PRO'}
              </button>
            ) : contactOk ? (
              <>
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
              </>
            ) : (
              <p className="text-center fs-sm lf-text-muted">
                {isEn ? 'Enter your contact above to generate the Pix.' : 'Informe seu contato acima para gerar o Pix.'}
              </p>
            )}
            <textarea
              value={key}
              onChange={e => setKey(e.target.value)}
              rows={2}
              spellCheck={false}
              autoComplete="off"
              disabled={!keyUnlocked}
              placeholder={keyUnlocked
                ? 'LF1-XXXX-XXXX-...'
                : (isEn ? 'Fill a valid contact above to unlock' : 'Preencha um contato válido acima para liberar')}
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
  ), document.body);
}
