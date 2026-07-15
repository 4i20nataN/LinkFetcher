/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeWrapper } from './components/ThemeWrapper';
import { Sidebar } from './components/Sidebar';
import { LinkAnalyzer } from './features/analyzer/LinkAnalyzer';
import { YouTubeSearch } from './features/youtube/YouTubeSearch';
import { DownloadManager } from './features/downloads/DownloadManager';
import { FavoritesView } from './features/favorites/FavoritesView';
import { DownloadLaterView } from './features/later/DownloadLaterView';
import { SettingsView } from './features/settings/SettingsView';
import { motion, AnimatePresence } from 'motion/react';

function DashboardContent() {
  const { activeTab } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'analyze':
        return <LinkAnalyzer key="analyze" />;
      case 'search':
        return <YouTubeSearch key="search" />;
      case 'manager':
        return <DownloadManager key="manager" />;
      case 'favorites':
        return <FavoritesView key="favorites" />;
      case 'later':
        return <DownloadLaterView key="later" />;
      case 'settings':
        return <SettingsView key="settings" />;
      default:
        return <LinkAnalyzer key="analyze" />;
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} toggleOpen={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative p-4 md:p-8 bg-black/35 [mask-image:linear-gradient(to_bottom,transparent_0%,black_4%,black_96%,transparent_100%)]">
        {/* Subtle background abstract decorations matching premium Nothing OS feel */}
        <div className="absolute top-[-10%] left-[20%] w-[350px] h-[350px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[10%] w-[450px] h-[450px] rounded-full bg-emerald-500/3 blur-[120px] pointer-events-none" />

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
