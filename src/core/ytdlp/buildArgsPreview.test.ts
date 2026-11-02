import { describe, expect, it } from 'vitest';
import { buildArgsPreview } from './buildArgsPreview';

describe('buildArgsPreview', () => {
  it('only emits --keep-video together with audio extraction', () => {
    const audio = buildArgsPreview({ url: 'https://x/y', audioOnly: true, keepVideo: true });
    expect(audio).toContain('--extract-audio');
    expect(audio).toContain('--keep-video');

    // Sem `--extract-audio` a flag é no-op no yt-dlp: não poluir o preview.
    const video = buildArgsPreview({ url: 'https://x/y', keepVideo: true });
    expect(video).not.toContain('--keep-video');
  });
});
