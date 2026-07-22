import React from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, Database, Lock, Clock, ArrowLeft, ExternalLink, Mail } from 'lucide-react';

const POLICY_CARDS = [
  {
    icon: Database,
    title: 'Coleta de Dados',
    items: [
      'Links e URLs enviados para análise e download.',
      'Endereço de IP anonimizado para estatísticas de uso.',
      'Nenhum dado pessoal (nome, e-mail, etc.) é armazenado, a menos que você forneça voluntariamente.',
    ],
  },
  {
    icon: Lock,
    title: 'Uso das Informações',
    items: [
      'Processar downloads e extrair metadados de mídia.',
      'Melhorar a experiência do usuário e otimizar o motor de decodificação.',
      'Nunca compartilhamos seus links ou dados com terceiros.',
    ],
  },
  {
    icon: Shield,
    title: 'Segurança',
    items: [
      'Criptografia TLS em todas as conexões (HTTPS).',
      'Os arquivos baixados são temporários e removidos após o envio.',
      'Não armazenamos histórico de downloads em servidores.',
    ],
  },
  {
    icon: Clock,
    title: 'Cookies & Rastreamento',
    items: [
      'Usamos cookies de sessão para manter sua preferência de tema.',
      'Nenhum cookie de rastreamento ou publicidade é utilizado.',
      'Você pode desativar cookies a qualquer momento nas configurações do navegador.',
    ],
  },
];

const USER_RIGHTS = [
  {
    label: 'Acesso e Correção',
    text: 'Você pode solicitar a correção ou exclusão de qualquer dado pessoal que tenha fornecido.',
  },
  {
    label: 'Portabilidade',
    text: 'Não armazenamos dados pessoais, portanto não há o que exportar.',
  },
  {
    label: 'Revogação',
    text: 'Você pode revogar o consentimento para coleta de dados de uso a qualquer momento.',
  },
];

export function PrivacyPolicy() {
  const { setActiveTab, settings } = useApp();
  const version = (window as any).__APP_VERSION__ ?? '0.0.0';
  const isLight = settings.themeMode === 'light';

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 md:px-8 relative">
      {/* Floating header bar */}
      <div className="w-full max-w-[1000px] mb-6">
        <button
          onClick={() => setActiveTab('settings')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
            ${isLight
              ? 'text-zinc-600 border border-zinc-200/50 bg-white/40 hover:bg-white/70 hover:border-blue-300 hover:text-blue-600'
              : 'text-zinc-400 border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-blue-500/30 hover:text-blue-400'
            }`}
        >
          <ArrowLeft size={14} />
          Voltar para Configurações
        </button>
      </div>

      {/* Main container — glassmorphism */}
      <div
        className={`w-full max-w-[1000px] rounded-3xl p-8 md:p-10 relative z-10
          ${isLight
            ? 'bg-white/60 backdrop-blur-[40px] saturate-[160%] border border-zinc-200/50 shadow-[0_40px_90px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.8)]'
            : 'bg-white/[0.03] backdrop-blur-[40px] saturate-[160%] border border-white/[0.07] shadow-[0_40px_90px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.05)]'
          }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-6 mb-7 border-b flex-wrap gap-5 ${isLight ? 'border-zinc-200/60' : 'border-white/5'}`}>
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0
                ${isLight
                  ? 'border border-blue-200/50 text-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.15)] bg-blue-50/50'
                  : 'border border-blue-500/50 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)] bg-white/[0.01]'
                }`}
            >
              <Shield size={22} />
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isLight ? 'text-zinc-900' : 'text-white'}`}>
                Link<span className="text-blue-500">Fatcher</span>
              </h1>
              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Política de Privacidade
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-7">
          {/* Title + intro */}
          <div>
            <h2
              className={`text-2xl font-semibold tracking-tight mb-1.5 bg-gradient-to-br from-current to-zinc-400 bg-clip-text
                ${isLight ? 'text-zinc-800' : 'text-white'}`}
              style={{ WebkitTextFillColor: 'transparent' }}
            >
              Compromisso com sua privacidade
            </h2>
            <div
              className={`text-xs border-l-2 pl-3.5 mb-2.5
                ${isLight ? 'text-zinc-500 border-blue-500' : 'text-zinc-400 border-blue-500'}`}
            >
              Última atualização: 15 de julho de 2026
            </div>
            <p className={`text-[15px] leading-relaxed ${isLight ? 'text-zinc-700' : 'text-white/80'}`}>
              Na <strong className={isLight ? 'text-zinc-900 font-semibold' : 'text-white font-semibold'}>LinkFatcher</strong>, a transparência e a segurança dos seus dados são prioridades.
              Esta política descreve como coletamos, usamos e protegemos as informações quando você utiliza
              nossa plataforma de download e gerenciamento de links.
            </p>
          </div>

          {/* Policy cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
            {POLICY_CARDS.map((card) => (
              <div
                key={card.title}
                className={`rounded-2xl p-6 transition-all duration-300
                  ${isLight
                    ? 'bg-white/50 border border-zinc-200/40 hover:border-blue-300/40 hover:shadow-lg'
                    : 'bg-white/[0.02] border border-white/[0.04] hover:border-blue-500/20 hover:shadow-[0_8px_25px_rgba(0,0,0,0.3)]'
                  }`}
              >
                <h3 className={`text-base font-semibold mb-3 flex items-center gap-2.5 ${isLight ? 'text-zinc-800' : 'text-white'}`}>
                  <card.icon size={18} className="text-blue-500 shrink-0" />
                  {card.title}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {card.items.map((item, i) => (
                    <li
                      key={i}
                      className={`text-[13px] leading-relaxed pl-5 relative
                        ${isLight ? 'text-zinc-600' : 'text-white/70'}`}
                    >
                      <span className="absolute left-0 top-0 text-blue-500 font-light">▹</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* User rights card */}
          <div
            className={`rounded-2xl p-6 transition-all duration-300
              ${isLight
                ? 'bg-white/50 border border-zinc-200/40 hover:border-blue-300/40 hover:shadow-lg'
                : 'bg-white/[0.02] border border-white/[0.04] hover:border-blue-500/20 hover:shadow-[0_8px_25px_rgba(0,0,0,0.3)]'
              }`}
          >
            <h3 className={`text-base font-semibold mb-3 flex items-center gap-2.5 ${isLight ? 'text-zinc-800' : 'text-white'}`}>
              <Shield size={18} className="text-blue-500 shrink-0" />
              Seus Direitos
            </h3>
            <ul className="flex flex-col gap-1.5">
              {USER_RIGHTS.map((right, i) => (
                <li
                  key={i}
                  className={`text-[13px] leading-relaxed pl-5 relative
                    ${isLight ? 'text-zinc-600' : 'text-white/70'}`}
                >
                  <span className="absolute left-0 top-0 text-blue-500 font-light">▹</span>
                  <strong className={isLight ? 'text-zinc-800 font-semibold' : 'text-white font-semibold'}>{right.label}:</strong> {right.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Commitment note */}
          <p
            className={`mt-2.5 text-[13px] border-l-2 pl-4.5
              ${isLight ? 'text-zinc-500 border-blue-500' : 'text-zinc-400 border-blue-500'}`}
          >
            <span className="text-blue-500 font-medium">🔒 Compromisso</span> — A LinkFatcher é construída com foco em privacidade desde a origem.
            Seus links e dados são tratados com o mais alto nível de confidencialidade.
          </p>
        </div>

        {/* Footer */}
        <div
          className={`mt-8 pt-5 border-t flex justify-between items-center flex-wrap gap-3.5 text-xs
            ${isLight ? 'border-zinc-200/50 text-zinc-500' : 'border-white/[0.04] text-zinc-400'}`}
        >
          <div className="flex items-center gap-3.5">
            <span
              className={`px-3.5 py-1 rounded-full text-[11px] font-medium
                ${isLight
                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                }`}
            >
              🔐 Privacidade em primeiro lugar
            </span>
            <span className="flex items-center gap-1.5">
              <Mail size={12} />
              natan.vanim@gmail.com · ADMIN
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a href="#" className={`hover:text-white transition-colors border-b border-dotted hover:border-blue-500 ${isLight ? 'border-zinc-300' : 'border-white/10'}`}>
              Termos de Uso
            </a>
            <span>·</span>
            <a href="#" className={`hover:text-white transition-colors border-b border-dotted hover:border-blue-500 ${isLight ? 'border-zinc-300' : 'border-white/10'}`}>
              Suporte
            </a>
            <span>·</span>
            <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>v{version}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
