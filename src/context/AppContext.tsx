import React, { createContext, useContext, useState, useEffect } from 'react';
import { FavoriteItem, DownloadLaterItem, AppSettings, DownloadItem } from '../types';
import { StorageService } from '../core/storage/Storage';
import { DownloadEngine } from '../core/engine/DownloadEngine';

interface AppContextType {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  favorites: FavoriteItem[];
  toggleFavorite: (item: Omit<FavoriteItem, 'dateAdded'>) => boolean;
  updateFavoriteNotes: (id: string, notes: string) => void;
  isFavorite: (url: string) => boolean;
  downloadLater: DownloadLaterItem[];
  addToDownloadLater: (item: Omit<DownloadLaterItem, 'dateAdded'>) => boolean;
  removeFromDownloadLater: (url: string) => void;
  isDownloadLater: (url: string) => boolean;
  downloads: DownloadItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedUrl: string;
  setSelectedUrl: (url: string) => void;
  clearAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());
  const [favorites, setFavorites] = useState<FavoriteItem[]>(StorageService.getFavorites());
  const [downloadLater, setDownloadLater] = useState<DownloadLaterItem[]>(StorageService.getDownloadLater());
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('analyze');
  const [selectedUrl, setSelectedUrl] = useState<string>('');

  // Sync settings with Download Engine
  useEffect(() => {
    DownloadEngine.setSettings(settings);
  }, [settings]);

  // Subscribe to Download Engine progress ticks
  useEffect(() => {
    const handleUpdate = (items: DownloadItem[]) => {
      setDownloads(items);
    };
    DownloadEngine.addListener(handleUpdate);
    return () => {
      DownloadEngine.removeListener(handleUpdate);
    };
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    StorageService.saveSettings(updated);
  };

  const toggleFavorite = (item: Omit<FavoriteItem, 'dateAdded'>): boolean => {
    const added = StorageService.toggleFavorite(item);
    setFavorites(StorageService.getFavorites());
    return added;
  };

  const updateFavoriteNotes = (id: string, notes: string) => {
    StorageService.updateFavoriteNotes(id, notes);
    setFavorites(StorageService.getFavorites());
  };

  const addToDownloadLater = (item: Omit<DownloadLaterItem, 'dateAdded'>): boolean => {
    const added = StorageService.addToDownloadLater(item);
    if (added) {
      setDownloadLater(StorageService.getDownloadLater());
    }
    return added;
  };

  const removeFromDownloadLater = (url: string) => {
    StorageService.removeFromDownloadLater(url);
    setDownloadLater(StorageService.getDownloadLater());
  };

  const isFavorite = (url: string) => favorites.some(f => f.url === url);
  const isDownloadLater = (url: string) => downloadLater.some(l => l.url === url);

  const clearAllData = () => {
    StorageService.clearAllData();
    DownloadEngine.clearHistory();
    setSettings(StorageService.getSettings());
    setFavorites([]);
    setDownloadLater([]);
    setDownloads([]);
  };

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        favorites,
        toggleFavorite,
        updateFavoriteNotes,
        isFavorite,
        downloadLater,
        addToDownloadLater,
        removeFromDownloadLater,
        isDownloadLater,
        downloads,
        activeTab,
        setActiveTab,
        selectedUrl,
        setSelectedUrl,
        clearAllData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
