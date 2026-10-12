import type { MediaInfo, PlatformId } from '../../types';
import type { MediaProvider } from './MediaProvider';
import { matchPlatformForUrl } from './platformConfigs';
import { probeWithYtdlp, buildMediaInfoFromProbe } from './probeShared';

export class YtDlpProvider implements MediaProvider {
  id: PlatformId = 'generic';
  name = 'YtDLP Provider';
  domains: RegExp[] = [];

  canHandle(url: string): boolean {
    const platform = matchPlatformForUrl(url);
    return platform !== null && platform.id !== 'generic';
  }

  async analyze(url: string): Promise<MediaInfo> {
    const platform = matchPlatformForUrl(url);
    if (!platform) throw new Error('No matching platform found');

    const metadata = await probeWithYtdlp(url);
    return buildMediaInfoFromProbe(metadata, url, platform.id);
  }
}
