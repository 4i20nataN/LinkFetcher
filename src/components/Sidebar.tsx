import React, { startTransition } from 'react';
import { useApp } from '../context/AppContext';
import { Link2, Search, ArrowDownToLine, Star, Clock, Settings, Sparkles, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAccentTextClass, getAccentBgClass } from './ThemeWrapper';
import { useTranslation, TranslationKey } from '../core/i18n';
import packageJson from '../../package.json';

export const Sidebar: React.FC<{ isOpen: boolean; toggleOpen: () => void }> = ({ isOpen, toggleOpen }) => {
  const { activeTab, setActiveTab, settings, downloads } = useApp();
  const { t } = useTranslation(settings);

  const authorName = packageJson.author?.name || 'Developer';
  const authorEmail = packageJson.author?.email || '';
  const authorInitials = authorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const menuItems = [
    { id: 'analyze', label: t('analyzeLink'), icon: '🔗', desc: t('analyzeDesc') },
    { id: 'search', label: t('onlineSearch'), icon: '🔍', desc: t('searchDesc') },
    { id: 'manager', label: t('downloads'), icon: '📥', desc: t('downloadsDesc'), badge: downloads.filter(d => ['downloading', 'queued'].includes(d.status)).length },
    { id: 'favorites', label: t('favorites'), icon: '⭐', desc: t('favoritesDesc') },
    { id: 'later', label: t('downloadLater'), icon: '⏰', desc: t('laterDesc') },
    { id: 'settings', label: t('settings'), icon: '⚙️', desc: t('settingsDesc') }
  ];

  return (
    <>
      {/* Mobile Header bar */}
      <header className="lg:hidden min-h-16 border-b lf-border bg-black/40 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-4 safe-top">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${getAccentBgClass(settings)} text-white shadow-lg shadow-indigo-500/10`}>
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">{t('universalDownloader')}</span>
        </div>
        <button 
          onClick={toggleOpen} 
          className="p-2 rounded-lg hover:bg-white/5 transition-colors focus:outline-none"
          aria-label="Toggle Menu"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleOpen}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Navigation Drawer */}
      <nav 
        className={`
          fixed top-16 bottom-0 left-0 z-40 w-64 glass-sidebar p-4
          lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:glass-sidebar lg:p-6
          transition-transform duration-300 transform
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
      <div className="h-full overflow-y-auto">
        {/* Title branding on desktop */}
        <div className="hidden lg:flex items-center gap-3 mb-10">
          <div className={`p-2.5 rounded-2xl ${getAccentBgClass(settings)} text-white shadow-xl shadow-indigo-500/10`}>
            <Sparkles size={24} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-xl tracking-tight text-white leading-tight">
              Universal
            </h1>
            <p className="text-xs lf-text-secondary font-mono tracking-wider uppercase">{t('mediaDownloader')}</p>
          </div>
        </div>

        {/* Sidebar Sections */}
        <div className="space-y-1.5 pb-28">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  startTransition(() => {
                    setActiveTab(item.id);
                  });
                  if (window.innerWidth < 1024) toggleOpen();
                }}
                className={`
                  w-full relative group flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-300
                  ${isActive 
                    ? 'text-white font-semibold' 
                    : 'lf-text-secondary hover:text-white hover:bg-white/5'
                  }
                `}
              >
                {/* Active Highlight Pill */}
                {isActive && (
                  <motion.div
                    layoutId="active-sidebar-pill"
                    className={`absolute inset-0 rounded-xl ${getAccentBgClass(settings).split(' ')[0]}`}
                    style={{ opacity: 0.10 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                
                {/* Active Left Indicator Bar */}
                {isActive && (
                  <motion.div
                    layoutId="active-sidebar-bar"
                    className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${getAccentBgClass(settings)}`}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}

                <div className="flex items-center gap-3.5 z-10">
                  <span 
                    className={`
                      text-xl transition-transform duration-300 group-hover:scale-110 
                      ${!isActive ? 'opacity-50 group-hover:opacity-100' : ''}
                      ${!isActive && !settings.colorfulIcons ? 'grayscale group-hover:grayscale-0' : ''}
                    `}
                  >
                    {item.icon}
                  </span>
                  <div>
                    <span className="font-medium text-sm block leading-none">{item.label}</span>
                    <span className="text-[10px] lf-text-muted block mt-1 group-hover:text-zinc-400 font-sans">
                      {item.desc}
                    </span>
                  </div>
                </div>

                {/* Badge for active downloads */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold z-10 ${getAccentBgClass(settings)} text-white animate-pulse`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>

        {/* User profile / watermark footer */}
        <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl glass-card flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full lf-surface-raised border lf-border-strong flex items-center justify-center font-bold text-xs lf-text-secondary">
              {authorInitials}
            </div>
            <div className="overflow-hidden">
              <span className="font-semibold text-xs text-zinc-200 block truncate">{authorEmail}</span>
              <span className="text-[10px] lf-text-muted font-mono uppercase block">{t('adminRole')}</span>
            </div>
          </div>
          <div className="pt-2 border-t lf-border flex items-center justify-between text-[10px] lf-text-muted">
            <span>{settings.language === 'en' ? 'Version 2.4.0 (Pro)' : 'Versão 2.4.0 (Pro)'}</span>
            <span className="font-mono text-emerald-500">● {t('activeDriver')}</span>
          </div>
        </div>
      </nav>
    </>
  );
};
