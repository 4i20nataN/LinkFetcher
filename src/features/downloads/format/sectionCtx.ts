// Props compartilhadas das seções do seletor de formato.
// Um único objeto `ctx` (montado no FormatSelector) evita furar ~20 props
// em cada seção. Seções leem `settings`/`t` via hooks, não pelo ctx.
import type { RefObject } from 'react';
import type { MediaInfo } from '../../../types';
import type { FormatOptions } from '../FormatOptions';

export interface FormatSectionCtx {
  options: FormatOptions;
  update: (partial: Partial<FormatOptions>) => void;
  mediaInfo: MediaInfo;
  openSections: Set<string>;
  toggleSection: (id: string) => void;
  accentBg: string;
  maxRes: number;
  allowedCodecs: string[] | null;
  allowedContainers: string[] | null;
  isFpsAvailable: (fps: number) => boolean;
  selectedTargetHeight?: number;
  showSubs: boolean;
  setShowSubs: (v: boolean) => void;
  showSubsPicker: boolean;
  setShowSubsPicker: (v: boolean) => void;
  useUnderscore: boolean;
  setUseUnderscore: (v: boolean) => void;
  descExpanded: boolean;
  setDescExpanded: (v: boolean) => void;
  trimStart: number;
  setTrimStart: (v: number) => void;
  trimEnd: number;
  setTrimEnd: (v: number) => void;
  trimStartRef: RefObject<HTMLInputElement | null>;
  trimEndRef: RefObject<HTMLInputElement | null>;
}
