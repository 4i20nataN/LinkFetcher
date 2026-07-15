import React from 'react';
import { useApp } from '../context/AppContext';
import {
  MonitorPlay, FileVideo, Music, Volume2, SlidersHorizontal,
  Subtitles, Pencil, Scissors, ArrowDownToLine, Gauge,
  Shield, Tag, Image, Settings, Zap, RefreshCw, Rocket,
} from 'lucide-react';

export type BlockId =
  | 'resolution' | 'video-format' | 'audio-extract' | 'audio-format'
  | 'audio-quality' | 'subtitles' | 'custom-format' | 'trim'
  | 'output-mode' | 'fps' | 'sponsorblock' | 'metadata'
  | 'thumbnail' | 'behavior' | 'fragments' | 'retries' | 'speed-limit';

const EMOJI_MAP: Record<BlockId, string> = {
  resolution: '🎬',
  'video-format': '📼',
  'audio-extract': '🎵',
  'audio-format': '🔊',
  'audio-quality': '🎚️',
  subtitles: '📝',
  'custom-format': '✏️',
  trim: '✂️',
  'output-mode': '📤',
  fps: '⏱️',
  sponsorblock: '🛡️',
  metadata: '🏷️',
  thumbnail: '🖼️',
  behavior: '⚙️',
  fragments: '⚡',
  retries: '🔄',
  'speed-limit': '🚀',
};

const LUCIDE_MAP: Record<BlockId, React.ComponentType<{ size?: number; className?: string }>> = {
  resolution: MonitorPlay,
  'video-format': FileVideo,
  'audio-extract': Music,
  'audio-format': Volume2,
  'audio-quality': SlidersHorizontal,
  subtitles: Subtitles,
  'custom-format': Pencil,
  trim: Scissors,
  'output-mode': ArrowDownToLine,
  fps: Gauge,
  sponsorblock: Shield,
  metadata: Tag,
  thumbnail: Image,
  behavior: Settings,
  fragments: Zap,
  retries: RefreshCw,
  'speed-limit': Rocket,
};

const COLOR_MAP: Record<BlockId, string> = {
  resolution: 'text-zinc-400',
  'video-format': 'text-zinc-400',
  'audio-extract': 'text-zinc-400',
  'audio-format': 'text-zinc-400',
  'audio-quality': 'text-zinc-400',
  subtitles: 'text-blue-400',
  'custom-format': 'text-zinc-400',
  trim: 'text-amber-400',
  'output-mode': 'text-zinc-400',
  fps: 'text-zinc-400',
  sponsorblock: 'text-purple-400',
  metadata: 'text-emerald-400',
  thumbnail: 'text-sky-400',
  behavior: 'text-zinc-400',
  fragments: 'text-zinc-400',
  retries: 'text-zinc-400',
  'speed-limit': 'text-zinc-400',
};

export const BlockIcon: React.FC<{ blockId: BlockId; size?: number }> = ({ blockId, size = 14 }) => {
  const { settings } = useApp();
  const style = settings.iconStyle || 'lucide-mono';

  if (style === 'emoji') {
    return <span className="text-sm leading-none">{EMOJI_MAP[blockId]}</span>;
  }

  const Icon = LUCIDE_MAP[blockId];
  if (style === 'lucide-color') {
    return <Icon size={size} className={COLOR_MAP[blockId]} />;
  }
  return <Icon size={size} className="text-zinc-400" />;
};

export const BlockTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide">{children}</label>
);
