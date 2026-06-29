export type PlatformId = 
  | 'youtube' 
  | 'tiktok' 
  | 'instagram' 
  | 'facebook' 
  | 'x' 
  | 'reddit' 
  | 'soundcloud' 
  | 'spotify' 
  | 'twitch' 
  | 'pinterest' 
  | 'threads' 
  | 'vimeo'
  | 'generic';

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  icon: string;
  color: string;
  domains: string[];
}

export type MediaType = 'video' | 'audio' | 'image';

export interface MediaFormat {
  id: string;
  ext: string;
  quality: string;
  sizeEst: string;
  sizeBytes: number;
  codec: string;
  type: MediaType;
}

export interface MediaInfo {
  id: string;
  title: string;
  author: string;
  channel: string;
  duration: string; // e.g. "04:15"
  resolution?: string;
  sizeEst: string;
  formats: MediaFormat[];
  codec: string;
  type: MediaType;
  publishDate?: string;
  views?: string;
  platform: PlatformId;
  originalUrl: string;
  thumbnailUrl: string;
  status: 'idle' | 'analyzing' | 'success' | 'failed';
  error?: string;
}

export interface DownloadItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  platform: PlatformId;
  format: MediaFormat;
  sizeTotal: number; // in bytes
  sizeDownloaded: number; // in bytes
  progress: number; // 0 to 100
  speed: number; // in bytes/sec
  eta: number; // remaining seconds
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  addedAt: string;
  finishedAt?: string;
  url: string;
  error?: string;
}

export interface FavoriteItem {
  id: string;
  title: string;
  url: string;
  platform: PlatformId;
  thumbnailUrl: string;
  dateAdded: string;
  notes?: string;
}

export interface DownloadLaterItem {
  id: string;
  title: string;
  url: string;
  platform: PlatformId;
  thumbnailUrl: string;
  dateAdded: string;
}

export interface AppSettings {
  themeMode: 'light' | 'dark' | 'gray';
  accentColor: string; // e.g., 'indigo', 'emerald', 'amber', 'rose', 'violet', 'sky', 'teal', 'fuchsia'
  language: 'pt' | 'en';
  defaultDir: string;
  bandLimit: number; // KB/s, 0 = unlimited
  maxConcurrent: number;
  wifiOnly: boolean;
  autoDownload: boolean;
  notifications: boolean;
  updates: boolean;
  customApiUrl?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  channel: string;
  views: string;
  duration: string;
  publishDate: string;
  thumbnailUrl: string;
  url: string;
}
