import type { PlatformId } from './platform';

export interface PlaylistItem {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  duration?: number;
  index: number;
  /** Canal/uploader da entry flat. */
  uploader?: string;
  /** view_count da entry flat. */
  views?: number;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  itemCount: number;
  totalDuration?: number;
  platform: PlatformId;
  url: string;
  items: PlaylistItem[];
  /** Canal do 1º item (cabeçalho sem probe extra). */
  channel?: string;
}
