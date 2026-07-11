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

export interface ProbeOptions {
  url: string;
  cookies?: string;
  cookiesFromBrowser?: string;
  proxy?: string;
}

export interface SearchOptions {
  query: string;
  platform: 'youtube' | 'vimeo' | 'dailymotion' | 'bilibili' | 'soundcloud';
  maxResults?: number;
  cookies?: string;
  proxy?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: number;          // seconds
  duration_string: string;   // "12:45"
  view_count: number;
  uploader: string;
  description: string;
}

export interface DownloadOptions {
  url: string;
  outputPath?: string;
  filename?: string;
  // Format options
  format?: string;
  audioOnly?: boolean;
  audioFormat?: 'mp3' | 'aac' | 'flac' | 'm4a' | 'opus' | 'wav';
  audioQuality?: string;
  mergeOutputFormat?: string;
  // Subtitle options
  writeSubs?: boolean;
  writeAutoSubs?: boolean;
  subLangs?: string;
  subFormat?: string;
  embedSubs?: boolean;
  // Thumbnail options
  writeThumbnail?: boolean;
  embedThumbnail?: boolean;
  // Metadata options
  embedMetadata?: boolean;
  // Advanced options
  outputTemplate?: string;
  restrictFilenames?: boolean;
  noOverwrites?: boolean;
  keepVideo?: boolean;
  // Auth options
  cookies?: string;
  cookiesFromBrowser?: string;
  proxy?: string;
  ffmpegLocation?: string;
}
