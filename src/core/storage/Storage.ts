import { FavoriteItem, DownloadLaterItem, AppSettings } from '../../types';

export class StorageService {
  // --- FAVORITES ---
  static getFavorites(): FavoriteItem[] {
    try {
      const data = localStorage.getItem('universal_downloader_favorites');
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  static saveFavorites(favs: FavoriteItem[]) {
    localStorage.setItem('universal_downloader_favorites', JSON.stringify(favs));
  }

  static toggleFavorite(fav: Omit<FavoriteItem, 'dateAdded'>): boolean {
    const list = this.getFavorites();
    const index = list.findIndex(f => f.url === fav.url);
    let isAdded = false;

    if (index >= 0) {
      list.splice(index, 1);
    } else {
      list.unshift({
        ...fav,
        dateAdded: new Date().toISOString()
      });
      isAdded = true;
    }
    this.saveFavorites(list);
    return isAdded;
  }

  static isFavorite(url: string): boolean {
    const list = this.getFavorites();
    return list.some(f => f.url === url);
  }

  static updateFavoriteNotes(id: string, notes: string) {
    const list = this.getFavorites();
    const item = list.find(f => f.id === id);
    if (item) {
      item.notes = notes;
      this.saveFavorites(list);
    }
  }

  // --- DOWNLOAD LATER ---
  static getDownloadLater(): DownloadLaterItem[] {
    try {
      const data = localStorage.getItem('universal_downloader_later');
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  static saveDownloadLater(list: DownloadLaterItem[]) {
    localStorage.setItem('universal_downloader_later', JSON.stringify(list));
  }

  static addToDownloadLater(item: Omit<DownloadLaterItem, 'dateAdded'>): boolean {
    const list = this.getDownloadLater();
    const exists = list.some(l => l.url === item.url);
    if (exists) return false;

    list.unshift({
      ...item,
      dateAdded: new Date().toISOString()
    });
    this.saveDownloadLater(list);
    return true;
  }

  static removeFromDownloadLater(url: string) {
    const list = this.getDownloadLater();
    const filtered = list.filter(l => l.url !== url);
    this.saveDownloadLater(filtered);
  }

  static isDownloadLater(url: string): boolean {
    return this.getDownloadLater().some(l => l.url === url);
  }

  // --- SETTINGS CONFIGS ---
  static getSettings(): AppSettings {
    try {
      const data = localStorage.getItem('universal_downloader_settings');
      if (data) return JSON.parse(data);
    } catch (_) {
      // ignore
    }
    return {
      themeMode: 'dark',
      accentColor: 'indigo',
      iconStyle: 'lucide-mono',
      language: 'pt',
      defaultDir: '',
      bandLimit: 0,
      maxConcurrent: 3,
      wifiOnly: false,
      autoDownload: true,
      notifications: true,
      updates: false,
    };
  }

  static saveSettings(settings: AppSettings) {
    localStorage.setItem('universal_downloader_settings', JSON.stringify(settings));
  }

  // --- EXPORT / IMPORT CONFIGS ---
  static exportConfig(): string {
    const data = {
      settings: this.getSettings(),
      favorites: this.getFavorites(),
      later: this.getDownloadLater()
    };
    return JSON.stringify(data, null, 2);
  }

  static importConfig(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.settings) {
        this.saveSettings(parsed.settings);
      }
      if (parsed.favorites) {
        this.saveFavorites(parsed.favorites);
      }
      if (parsed.later) {
        this.saveDownloadLater(parsed.later);
      }
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }

  // --- CLEAR CACHE & STORAGE ---
  static clearCache() {
    localStorage.removeItem('universal_downloader_later');
  }

  static clearAllData() {
    localStorage.removeItem('universal_downloader_settings');
    localStorage.removeItem('universal_downloader_favorites');
    localStorage.removeItem('universal_downloader_later');
    localStorage.removeItem('universal_downloader_items');
  }
}
