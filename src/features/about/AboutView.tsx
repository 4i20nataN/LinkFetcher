// Aba Sobre: licença PRO (chave + contato da compra), privacidade,
// suporte e informações do app. Mesmo padrão visual da PrivacyPolicy
// (ramo isLight + tokens lf-*) para os 4 temas.
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLicense, getLicense, clearLicense } from '../../core/license/licenseStore';
import { isLicenseActive } from '../../core/license/license';
import { LicenseModal } from '../../core/license/LicenseModal';
import { WHATS_NUMBER } from '../../core/license/purchase';
import { PrivacyPolicy } from '../privacy/PrivacyPolicy';
import {
  Info, KeyRound, ShieldCheck, Copy, Check, Eye, EyeOff,
  Trash2, MessageCircle, ChevronRight, Cpu,
} from 'lucide-react';

/** Mostra prefixo + 1º grupo; o resto vira •••• (evita shoulder surfing). */
function maskKey(key: string): string {
  const parts = key.split('-');
  if (parts.length <= 2) return '••••';
  return [parts[0], parts[1], ...parts.slice(2).map(() => '••••')].join('-');
}

export function AboutView() {
  const { settings } = useApp();
  const isEn = settings.language === 'en';
  const isLight = settings.themeMode === 'light';
  const lic = useLicense() ?? getLicense();
  const active = isLicenseActive(lic);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.1';

  if (showPrivacy) return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />;

  const copyKey = async () => {
    if (!lic?.key) return;
    try {
      await navigator.clipboard.writeText(lic.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível: seleção manual */ }
  };

  const supportLink = `https://wa.me/${WHATS_NUMBER}?text=${encodeURIComponent(
    isEn ? 'Hello! I need help with LinkFetcher.' : 'Olá! Preciso de ajuda com o LinkFetcher.',
  )}`;

  const card = `rounded-2xl p-6 transition-all duration-300 cv-auto
    ${isLight
      ? 'bg-white/50 border border-zinc-200/40 hover:border-blue-300/40 hover:shadow-lg'
      : 'bg-white/[0.02] border border-white/[0.04] hover:border-blue-500/20 hover:shadow-[0_8px_25px_rgba(0,0,0,0.3)]'
    }`;
  const cardTitle = `text-base font-semibold mb-3 flex items-center gap-2.5 ${isLight ? 'text-zinc-800' : 'text-white'}`;
  const body = `text-[13px] leading-relaxed ${isLight ? 'text-zinc-600' : 'lf-text-secondary'}`;
  const rowLabel = `text-[11px] uppercase tracking-wider font-semibold ${isLight ? 'text-zinc-500' : 'lf-text-muted'}`;
  const rowValue = `text-sm font-medium ${isLight ? 'text-zinc-800' : 'text-white'}`;

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 md:px-8 relative">
      <div
        className={`w-full max-w-[1000px] rounded-3xl p-8 md:p-10 relative z-10
          ${isLight
            ? 'bg-white/60 backdrop-blur-xl border border-zinc-200/50 shadow-2xl'
            : 'bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] shadow-2xl'
          }`}
      >
        <div className="flex items-center justify-between pb-6 mb-7 border-b lf-border flex-wrap gap-5">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0
                ${isLight
                  ? 'border border-blue-200/50 text-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.15)] bg-blue-50/50'
                  : 'border border-blue-500/50 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)] bg-white/[0.01]'
                }`}
            >
              <Info size={22} />
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                Link<span className="text-blue-500">Fetcher</span>
              </h1>
              <p className="text-[11px] mt-0.5 lf-text-secondary">
                {isEn ? 'About the app' : 'Sobre o aplicativo'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3.5 py-1 rounded-full text-[11px] font-medium
                ${isLight
                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                }`}
            >
              v{version}
            </span>
            <span
              className={`px-3.5 py-1 rounded-full text-[11px] font-bold tracking-widest
                ${active
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : isLight
                    ? 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                    : 'bg-white/5 text-zinc-400 border border-white/10'
                }`}
            >
              {active ? 'PRO' : 'FREE'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4.5">
          {/* Licença */}
          <div className={card}>
            <h3 className={cardTitle}>
              <KeyRound size={18} className="text-blue-500 shrink-0" />
              {isEn ? 'PRO license' : 'Licença PRO'}
            </h3>
            {active && lic ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 fs-sm text-emerald-300">
                  {isEn ? 'PRO active' : 'PRO ativo'}
                  {lic.name ? (isEn ? ` — licensed to ${lic.name}` : ` — licenciado para ${lic.name}`) : ''}
                  {lic.expiresAt !== 0 && (
                    <span className="block lf-text-muted">
                      {isEn ? 'Expires: ' : 'Expira: '}
                      {new Date(lic.expiresAt * 1000).toLocaleDateString(isEn ? 'en' : 'pt-BR')}
                    </span>
                  )}
                  {lic.expiresAt === 0 && (
                    <span className="block lf-text-muted">
                      {isEn ? 'Lifetime license' : 'Licença vitalícia'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <p className={rowLabel}>{isEn ? 'Purchase contact' : 'Contato da compra'}</p>
                    <p className={rowValue}>{lic.contact || (isEn ? 'Not provided' : 'Não informado')}</p>
                  </div>
                  <div>
                    <p className={rowLabel}>{isEn ? 'Activated on' : 'Ativada em'}</p>
                    <p className={rowValue}>
                      {lic.activatedAt
                        ? new Date(lic.activatedAt).toLocaleDateString(isEn ? 'en' : 'pt-BR')
                        : '—'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className={rowLabel}>{isEn ? 'Key' : 'Chave'}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className={`flex-1 min-w-0 p-2.5 rounded-xl font-mono text-xs break-all
                      ${isLight ? 'bg-zinc-100 text-zinc-700 border border-zinc-200' : 'lf-surface-40 lf-border text-zinc-200'}`}>
                      {showKey ? lic.key : maskKey(lic.key)}
                    </code>
                    <button
                      onClick={() => setShowKey(v => !v)}
                      aria-label={showKey ? (isEn ? 'Hide key' : 'Ocultar chave') : (isEn ? 'Show key' : 'Mostrar chave')}
                      className="p-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-white transition-colors shrink-0"
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={copyKey}
                      aria-label={isEn ? 'Copy key' : 'Copiar chave'}
                      className="p-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-white transition-colors shrink-0"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setShowLicense(true)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                  >
                    {isEn ? 'Manage license' : 'Gerenciar licença'}
                  </button>
                  <button
                    onClick={() => { clearLicense(); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-red-400 text-xs font-semibold transition-colors"
                  >
                    <Trash2 size={14} />
                    {isEn ? 'Remove license' : 'Remover licença'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className={body}>
                  {isEn
                    ? 'You are on the free plan. Activate PRO to unlock Custom Download (up to 4K, cuts, subtitles, SponsorBlock).'
                    : 'Você está no plano gratuito. Ative o PRO para liberar o Download Personalizado (até 4K, cortes, legendas, SponsorBlock).'}
                </p>
                <button
                  onClick={() => setShowLicense(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                >
                  {isEn ? 'Activate PRO' : 'Ativar PRO'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
            {/* Privacidade */}
            <button onClick={() => setShowPrivacy(true)} className={`${card} text-left group`}>
              <h3 className={cardTitle}>
                <ShieldCheck size={18} className="text-blue-500 shrink-0" />
                {isEn ? 'Privacy Policy' : 'Política de Privacidade'}
                <ChevronRight size={16} className="ml-auto lf-text-muted group-hover:translate-x-0.5 transition-transform" />
              </h3>
              <p className={body}>
                {isEn
                  ? 'See what stays on your machine and who the app talks to online.'
                  : 'Veja o que fica na sua máquina e com quem o app fala na rede.'}
              </p>
            </button>

            {/* Suporte */}
            <div className={card}>
              <h3 className={cardTitle}>
                <MessageCircle size={18} className="text-blue-500 shrink-0" />
                {isEn ? 'Support' : 'Suporte'}
              </h3>
              <p className={`${body} mb-3`}>
                {isEn
                  ? 'Lost your key or having trouble? Call us with your purchase contact at hand.'
                  : 'Perdeu a chave ou com problema? Chame com o contato da compra em mãos.'}
              </p>
              <a
                href={supportLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
              >
                <MessageCircle size={14} />
                WhatsApp
              </a>
            </div>
          </div>

          {/* App */}
          <div className={card}>
            <h3 className={cardTitle}>
              <Cpu size={18} className="text-blue-500 shrink-0" />
              {isEn ? 'About the app' : 'Sobre o app'}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {[
                `${isEn ? 'Version' : 'Versão'}: ${version}`,
                `${isEn ? 'Engine' : 'Motor'}: yt-dlp + ffmpeg`,
                isEn
                  ? 'Automatic updates with verified signature'
                  : 'Atualizações automáticas com assinatura verificada',
              ].map((item, i) => (
                <li key={i} className={`${body} pl-5 relative`}>
                  <span className="absolute left-0 top-0 text-blue-500 font-light">▹</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {showLicense && <LicenseModal onClose={() => setShowLicense(false)} />}
    </div>
  );
}
