import { MediaInfo, PlatformId } from '../../types';

export interface MediaProvider {
  id: PlatformId;
  name: string;
  domains: RegExp[];
  
  /** Diz se este provider atende a URL. */
  canHandle(url: string): boolean;

  /** Analisa a URL e extrai os metadados. */
  analyze(url: string): Promise<MediaInfo>;
}
