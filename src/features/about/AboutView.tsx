// Aba Sobre: licença PRO (chave + contato da compra), planos (gratuito × PRO),
// privacidade, suporte e informações do app. Mesmo padrão visual da
// PrivacyPolicy (ramo isLight + tokens lf-*) para os 4 temas.
// Os planos vêm de `PLANS` (purchase.ts): preço/duração nunca são digitados
// aqui, para a página não divergir do checkout.
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLicense, getLicense, clearLicense } from '../../core/license/licenseStore';
import { appVersion } from '../../core/version';
import { isLicenseActive } from '../../core/license/license';
import { PLANS, formatBRL } from '../../core/license/purchase';
import { LicenseModal } from '../../core/license/LicenseModal';
import { ResendKeySection } from '../../core/license/ResendKeySection';
import { PrivacyPolicy } from '../privacy/PrivacyPolicy';
import {
  Info, KeyRound, ShieldCheck, Copy, Check, Eye, EyeOff,
  Trash2, ChevronRight, Cpu, Sparkles, Layers, Mail,
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
  // 'white' cai no ramo claro: classes dark + remap CSS geravam hover
  // exagerado (sombra preta 0.3 sobre fundo branco).
  const isLight = settings.themeMode === 'light' || settings.themeMode === 'white';
  const lic = useLicense() ?? getLicense();
  const active = isLicenseActive(lic);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const version = appVersion();

  if (showPrivacy) return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />;

  const copyKey = async () => {
    if (!lic?.key) return;
    try {
      await navigator.clipboard.writeText(lic.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível: seleção manual */ }
  };

  const card = `rounded-2xl p-6 transition-all duration-300 cv-auto
    ${isLight
      ? 'bg-white/50 border border-zinc-200/40 hover:border-zinc-300 hover:shadow-sm'
      : 'bg-white/[0.02] border border-white/[0.04] hover:border-white/10 hover:shadow-lg'
    }`;
  const cardTitle = `text-base font-semibold mb-3 flex items-center gap-2.5 ${isLight ? 'text-zinc-800' : 'text-white'}`;
  const body = `text-[13px] leading-relaxed ${isLight ? 'text-zinc-600' : 'lf-text-secondary'}`;
  const rowLabel = `text-[11px] uppercase tracking-wider font-semibold ${isLight ? 'text-zinc-500' : 'lf-text-muted'}`;
  const rowValue = `text-sm font-medium ${isLight ? 'text-zinc-800' : 'text-white'}`;
  const planRow = `flex items-baseline gap-3 py-2 border-b last:border-0 ${isLight ? 'border-zinc-200/60' : 'border-white/[0.05]'}`;

  // Gratuito = rota rápida (analyzerUtils.buildQuickOptions): vídeo até
  // 1080p60 com merge mp4, ou áudio MP3 na qualidade máxima.
  const freeList = isEn
    ? [
        'Link analysis, download queue, favorites and "download later"',
        'Video up to 1080p60 (merged into MP4)',
        'Audio as MP3 at maximum quality',
        'No sign-up and no key to activate',
      ]
    : [
        'Análise de link, fila de download, favoritos e "baixar depois"',
        'Vídeo até 1080p60 (merge em MP4)',
        'Áudio em MP3 na qualidade máxima',
        'Sem cadastro e sem chave para ativar',
      ];
  // PRO = painel Download Personalizado (FormatSelector/LinkAnalyzer), que sem
  // licença fica travado para leitura.
  const proList = isEn
    ? [
        'Resolution up to 4K, plus FPS cap and codec choice',
        'Section cuts — download only a range of the video',
        'Subtitles (manual and auto): language, format, embed',
        'SponsorBlock segment removal',
        'Cover art: save, embed; metadata inside the file',
        'Custom filename, audio normalize and video sharpen (desktop)',
        'Bandwidth limit and parallel fragment downloads',
        'Whole playlist in bulk, with any preset — quick or custom',
      ]
    : [
        'Resolução até 4K, além de teto de FPS e escolha de codec',
        'Cortes por seção — baixar só um trecho do vídeo',
        'Legendas (manuais e automáticas): idioma, formato, embutir',
        'Remoção de segmentos com SponsorBlock',
        'Capa: salvar e incrustar; metadados dentro do arquivo',
        'Nome do arquivo, normalização de áudio e nitidez de vídeo (desktop)',
        'Limite de banda e fragmentos baixados em paralelo',
        'Playlist inteira em lote, em qualquer ajuste — rápido ou personalizado',
      ];

  const howItWorks = isEn
    ? [
        'Paid with Pix; the key arrives by e-mail and inside the app itself.',
        'Validity starts at payment confirmation — not at activation.',
        'Activation needs the key plus the buyer e-mail, so a new device or a format never loses the license.',
        'Up to 2 devices per key; changed device or reinstalled? Use "Release devices and resend" under "Resend key by email".',
        'Lost the key? The resend goes only to the email registered at payment, and only while the subscription is still active.',
        'No auto-renewal: when it expires, the next purchase is a new key.',
        'The key is signed (ECDSA P-256) and verified offline by the app — privileged actions re-check the signature.',
      ]
    : [
        'Pagamento por Pix; a chave chega por e-mail e no próprio app.',
        'A validade começa na confirmação do pagamento, não na ativação.',
        'Ativar pede a chave + o e-mail do comprador: aparelho novo ou formatação não perde a licença.',
        'Até 2 aparelhos por chave; trocou de aparelho ou reinstalou? Use "Liberar os aparelhos e reenviar", embaixo de "Reenviar chave por e-mail".',
        'Perdeu a chave? O reenvio só sai para o e-mail cadastrado no pagamento e só enquanto a assinatura ainda está ativa.',
        'Sem renovação automática: quando expira, a compra seguinte gera uma nova chave.',
        'A chave é assinada (ECDSA P-256) e verificada offline pelo app — ações privilegiadas revalidam a assinatura.',
      ];

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
                    onClick={() => setShowResend(v => !v)}
                    aria-expanded={showResend}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-white text-xs font-semibold transition-colors"
                  >
                    <Mail size={14} />
                    {isEn ? 'Resend key by email' : 'Reenviar chave por e-mail'}
                  </button>
                  <button
                    onClick={() => { clearLicense(); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl lf-surface-40 lf-border lf-text-secondary hover:text-red-400 text-xs font-semibold transition-colors"
                  >
                    <Trash2 size={14} />
                    {isEn ? 'Remove license' : 'Remover licença'}
                  </button>
                </div>
                {showResend && (
                  <div className="p-3.5 rounded-xl lf-surface-40 lf-border">
                    <ResendKeySection initialEmail={lic.contact || ''} withRelease />
                  </div>
                )}
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
                {/* Expirou ou formatou o aparelho: a porta de entrada do
                    reenvio também aparece aqui, não só escondida no modal. */}
                <button
                  onClick={() => setShowResend(v => !v)}
                  aria-expanded={showResend}
                  className="flex items-center gap-2 fs-sm lf-text-muted hover:text-zinc-200 transition-colors"
                >
                  <Mail size={14} />
                  {isEn ? 'Already bought? Resend my key by email' : 'Já comprei? Reenviar minha chave por e-mail'}
                </button>
                {showResend && (
                  <div className="p-3.5 rounded-xl lf-surface-40 lf-border">
                    <ResendKeySection withRelease />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Planos: o que é gratuito e o que o PRO libera */}
          <div className={card}>
            <h3 className={cardTitle}>
              <Layers size={18} className="text-blue-500 shrink-0" />
              {isEn ? 'Free and PRO' : 'Gratuito e PRO'}
            </h3>
            <p className={`${body} mb-4`}>
              {isEn
                ? 'The free plan is not a trial: the app keeps working without a key, with video up to 1080p60 and MP3 audio. A playlist you can still analyze and browse item by item for free — downloading the whole list at once is PRO. PRO unlocks the Custom Download panel — without it those controls are readable but locked.'
                : 'O plano gratuito não é avaliação: o app continua funcionando sem chave, com vídeo até 1080p60 e áudio MP3. Playlist ele continua analisando e mostrando todos os itens de graça — o lote da lista inteira é PRO. O PRO libera o painel Download Personalizado — sem ele, esses controles aparecem à mostra mas travados.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <p className={`${rowLabel} mb-2`}>{isEn ? 'Included in the free plan' : 'Incluso no plano gratuito'}</p>
                <ul className="flex flex-col gap-1.5">
                  {freeList.map((item, i) => (
                    <li key={i} className={`${body} flex items-start gap-2`}>
                      <Check size={14} className={`mt-0.5 shrink-0 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={`${rowLabel} mb-2`}>{isEn ? 'Unlocked by PRO' : 'Liberado pelo PRO'}</p>
                <ul className="flex flex-col gap-1.5">
                  {proList.map((item, i) => (
                    <li key={i} className={`${body} flex items-start gap-2`}>
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Durações PRO: mesmo acesso, só muda o tempo e o preço do período */}
          <div className={card}>
            <h3 className={cardTitle}>
              <Sparkles size={18} className="text-blue-500 shrink-0" />
              {isEn ? 'PRO durations' : 'Durações PRO'}
            </h3>
            <p className={`${body} mb-3`}>
              {isEn
                ? 'Every PRO key carries the same plan: the same features, the same 2-device allowance, the same offline signature. What changes is only how long the key stays active — and the price of that period. The longer the period, the cheaper per day.'
                : 'Toda chave PRO carrega o mesmo plano: as mesmas funções, a mesma cota de 2 aparelhos, a mesma assinatura offline. O que muda é apenas o tempo de atividade da chave — e o preço desse período. Quanto mais longo, mais barato por dia.'}
            </p>
            <div className="mb-1">
              {PLANS.map(p => {
                const perDay = p.price / p.days;
                return (
                  <div key={p.id} className={planRow}>
                    <div className="flex-1 min-w-0">
                      <p className={rowValue}>
                        {isEn ? p.labelEn : p.label}
                        {p.tag && (
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold align-middle
                            ${isLight
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                            {p.id === 'mensal' && isEn ? 'most popular' : p.tag}
                          </span>
                        )}
                      </p>
                      <p className={`text-[11px] ${isLight ? 'text-zinc-500' : 'lf-text-muted'}`}>
                        {isEn
                          ? `≈ ${formatBRL(perDay)} per day`
                          : `≈ ${formatBRL(perDay)} por dia`}
                      </p>
                    </div>
                    <p className={`${rowValue} shrink-0`}>{formatBRL(p.price)}</p>
                  </div>
                );
              })}
            </div>
            <p className={`${body} mt-3`}>
              {isEn
                ? 'Prices and durations mirror the license server catalog.'
                : 'Preços e durações espelham o catálogo do servidor de licenças.'}
            </p>
            {!active && (
              <button
                onClick={() => setShowLicense(true)}
                className="mt-4 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
              >
                {isEn ? 'Activate PRO' : 'Ativar PRO'}
              </button>
            )}
          </div>

          {/* Como a licença funciona na prática */}
          <div className={card}>
            <h3 className={cardTitle}>
              <KeyRound size={18} className="text-blue-500 shrink-0" />
              {isEn ? 'How activation works' : 'Como a ativação funciona'}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {howItWorks.map((item, i) => (
                <li key={i} className={`${body} pl-5 relative`}>
                  <span className="absolute left-0 top-0 text-blue-500 font-light">▹</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

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
