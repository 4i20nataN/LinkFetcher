/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { AppProvider, useApp, SettingsSync } from './context/AppContext';
import { ThemeWrapper } from './components/ThemeWrapper';
import { LazyMotionProvider } from './animation/LazyMotionProvider';
import { CSSPageTransition } from './animation/CSSPageTransition';
import { isAndroid } from './core/ytdlp/YtDlpAdapter';
const Sidebar = React.lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })));
const LinkAnalyzer = React.lazy(() => import('./features/analyzer/LinkAnalyzer').then(m => ({ default: m.LinkAnalyzer })));
const YouTubeSearch = React.lazy(() => import('./features/youtube/YouTubeSearch').then(m => ({ default: m.YouTubeSearch })));
const DownloadManager = React.lazy(() => import('./features/downloads/DownloadManager').then(m => ({ default: m.DownloadManager })));
const FavoritesView = React.lazy(() => import('./features/favorites/FavoritesView').then(m => ({ default: m.FavoritesView })));
const DownloadLaterView = React.lazy(() => import('./features/later/DownloadLaterView').then(m => ({ default: m.DownloadLaterView })));
const SettingsView = React.lazy(() => import('./features/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const PrivacyPolicy = React.lazy(() => import('./features/privacy/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const AboutView = React.lazy(() => import('./features/about/AboutView').then(m => ({ default: m.AboutView })));
const UpdateBanner = React.lazy(() => import('./features/update/UpdateBanner').then(m => ({ default: m.default })));
const BinarySetupOverlay = React.lazy(() => import('./features/setup/BinarySetupOverlay').then(m => ({ default: m.BinarySetupOverlay })));

function DashboardContent() {
  const { activeTab, setActiveTab, settings } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Callbacks estáveis: evitam re-render de Sidebar memoizada a cada tick.
  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), []);

  const isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
  // No Android o yt-dlp é embarcado (ytdlp_status sempre ready): sem overlay
  // de setup — evita invoke+listen inúteis no boot mobile.
  const [needsSetup, setNeedsSetup] = useState(isTauri && !isAndroid());

  // Espelha o toggle de updates no plugin nativo (self-update do yt-dlp e
  // afins respeitam). Só Android; desktop não tem o comando (ignora o erro).
  useEffect(() => {
    if (!isAndroid()) return;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('plugin:ytdlp|setUpdatesEnabled', { enabled: settings.updates !== false });
      } catch { /* plugin indisponível: padrão ligado no nativo */ }
    })();
  }, [settings.updates]);

  const views = useMemo(() => ({
    analyze: LinkAnalyzer,
    search: YouTubeSearch,
    manager: DownloadManager,
    favorites: FavoritesView,
    later: DownloadLaterView,
    settings: SettingsView,
    privacy: PrivacyPolicy,
    about: AboutView,
  } as const), []);

  const renderActiveView = useCallback(() => {
    // 'manager' tem montagem permanente abaixo (keep-alive) — nunca por aqui.
    if (activeTab === 'manager') return null;
    const View = views[activeTab as keyof typeof views] || LinkAnalyzer;
    return (
      <div className="lf-suspense-view">
        <Suspense fallback={
          <div className="max-w-4xl mx-auto space-y-8 py-2 md:py-6 px-4">
            <div className="text-center md:text-left space-y-2">
              <div className="h-10 w-80 lf-surface-raised rounded-lg animate-pulse mx-auto md:mx-0" />
              <div className="h-4 w-96 lf-surface-raised rounded-full animate-pulse mx-auto md:mx-0" />
            </div>
            <div className="p-6 rounded-3xl lf-surface-40 border lf-border animate-pulse space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 h-12 lf-surface-raised rounded-xl" />
                <div className="h-12 w-24 lf-surface-raised rounded-xl" />
                <div className="h-12 w-24 lf-surface-raised rounded-xl" />
              </div>
              <div className="flex gap-2 overflow-hidden">
                {[1,2,3,4,5].map(i => <div key={i} className="h-9 w-20 lf-surface-raised rounded-lg shrink-0" />)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="p-4 rounded-2xl lf-surface-40 border lf-border animate-pulse h-20" />)}
            </div>
          </div>
        }>
          <View key={activeTab} />
        </Suspense>
      </div>
    );
  }, [activeTab, views]);

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {needsSetup && !isAndroid() && (
        <Suspense fallback={null}>
          <BinarySetupOverlay onReady={() => setNeedsSetup(false)} />
        </Suspense>
      )}
      {/* Navegação lateral */}
      <div className="lf-suspense-sidebar">
        <Suspense fallback={null}>
          <Sidebar isOpen={sidebarOpen} toggleOpen={toggleSidebar} />
        </Suspense>
      </div>

      {/* Painel principal */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain relative p-4 md:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">

      {/* Banner de update (só desktop) */}
        {!isAndroid() && (
          <Suspense fallback={null}>
            <UpdateBanner />
          </Suspense>
        )}

        {/* Transição entre abas */}
        <div className="lf-animated-view">
          {/* Keep-alive: trocar de aba nunca desmonta a fila de downloads. */}
          <div
            className="lf-suspense-view"
            style={activeTab === 'manager' ? undefined : { display: 'none' }}
          >
            <Suspense fallback={null}>
              <DownloadManager />
            </Suspense>
          </div>
          {activeTab !== 'manager' && (
            <CSSPageTransition activeKey={activeTab}>
              {renderActiveView()}
            </CSSPageTransition>
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LazyMotionProvider>
      <AppProvider>
        <SettingsSync />
        <ThemeWrapper>
          <DashboardContent />
        </ThemeWrapper>
      </AppProvider>
    </LazyMotionProvider>
  );
}
