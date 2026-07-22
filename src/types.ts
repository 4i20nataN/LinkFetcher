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
  durationSeconds: number; // e.g. 255
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
  description?: string;
  status: 'idle' | 'analyzing' | 'success' | 'failed';
  error?: string;
}

export interface DownloadItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  platform: PlatformId;
  format: MediaFormat;
  formatString?: string;
  audioOnly?: boolean;
  audioFormat?: string;
  audioQuality?: string;
  writeSubs?: boolean;
  writeAutoSubs?: boolean;
  subLangs?: string;
  subFormat?: string;
  embedSubs?: boolean;
  writeThumbnail?: boolean;
  embedThumbnail?: boolean;
  embedMetadata?: boolean;
  mergeOutputFormat?: string;
  restrictFilenames?: boolean;
  noOverwrites?: boolean;
  keepVideo?: boolean;
  concurrentFragments?: number;
  retries?: number;
  downloadSections?: string;
  videoOnly?: boolean;
  sponsorblockRemove?: string;
  fpsMax?: number;
  bandLimit?: number;
  customFilename?: string;
  sizeTotal: number;
  sizeDownloaded: number;
  progress: number;
  speed: number;
  eta: number;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  addedAt: string;
  finishedAt?: string;
  url: string;
  error?: string;
  filePath?: string;
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
  iconStyle: 'emoji' | 'lucide-mono' | 'lucide-color';
  language: 'pt' | 'en';
  defaultDir: string;
  bandLimit: number; // KB/s, 0 = unlimited
  maxConcurrent: number;
  wifiOnly: boolean;
  autoDownload: boolean;
  notifications: boolean;
  updates: boolean;
  colorfulIcons: boolean;
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
  // Trim/cut
  downloadSections?: string; // e.g. "*01:30-05:00"
  // Video only (no audio track)
  videoOnly?: boolean;
  // SponsorBlock
  sponsorblockRemove?: string; // e.g. "all" or comma-separated categories
  // FPS limit
  fpsMax?: number;
  // Auth options
  cookies?: string;
  cookiesFromBrowser?: string;
  proxy?: string;
  ffmpegLocation?: string;
  // Rate limiting
  bandLimit?: number; // KB/s, 0 = unlimited
}
