/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, Suspense } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeWrapper } from './components/ThemeWrapper';
import { Sidebar } from './components/Sidebar';
const LinkAnalyzer = React.lazy(() => import('./features/analyzer/LinkAnalyzer').then(m => ({ default: m.LinkAnalyzer })));
const YouTubeSearch = React.lazy(() => import('./features/youtube/YouTubeSearch').then(m => ({ default: m.YouTubeSearch })));
const DownloadManager = React.lazy(() => import('./features/downloads/DownloadManager').then(m => ({ default: m.DownloadManager })));
const FavoritesView = React.lazy(() => import('./features/favorites/FavoritesView').then(m => ({ default: m.FavoritesView })));
const DownloadLaterView = React.lazy(() => import('./features/later/DownloadLaterView').then(m => ({ default: m.DownloadLaterView })));
const SettingsView = React.lazy(() => import('./features/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const PrivacyPolicy = React.lazy(() => import('./features/privacy/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
import UpdateBanner from './features/update/UpdateBanner';
import { motion, AnimatePresence } from 'motion/react';

function DashboardContent() {
  const { activeTab, setActiveTab, settings } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Gap #12: Android hardware/gesture back button. Without this listener the
  // OS closes the app instead of navigating between tabs.
  useEffect(() => {
    const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
    if (!isCapacitor) return;

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (sidebarOpen) {
        setSidebarOpen(false);
        return;
      }
      if (activeTab !== 'analyze') {
        setActiveTab('analyze');
        return;
      }
      CapacitorApp.exitApp();
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [activeTab, sidebarOpen, setActiveTab]);

  // Gap #13: without this the header can render behind the status bar / notch.
  useEffect(() => {
    const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
    if (!isCapacitor) return;

    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    StatusBar.setStyle({ style: settings.themeMode === 'light' ? Style.Light : Style.Dark }).catch(() => {});
  }, [settings.themeMode]);

  const renderActiveView = () => {
    const views = { analyze: LinkAnalyzer, search: YouTubeSearch, manager: DownloadManager, favorites: FavoritesView, later: DownloadLaterView, settings: SettingsView, privacy: PrivacyPolicy } as const;
    const View = views[activeTab as keyof typeof views] || LinkAnalyzer;
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-32 text-zinc-500 text-sm">Carregando...</div>}>
        <View key={activeTab} />
      </Suspense>
    );
  };

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} toggleOpen={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain relative p-4 md:p-8 [mask-image:linear-gradient(to_bottom,transparent_0%,black_4%,black_96%,transparent_100%)]">

        {/* Auto-Update Banner */}
        <UpdateBanner />

        {/* Dynamic transition container */}
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {renderActiveView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ThemeWrapper>
        <DashboardContent />
      </ThemeWrapper>
    </AppProvider>
  );
}
