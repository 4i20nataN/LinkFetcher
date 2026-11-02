import { describe, expect, it } from 'vitest';
import { VIDEO_PRESETS } from './formatData';

describe('VIDEO_PRESETS', () => {
  it('todo preset de resolução mantém o teto (height/width <= N)', () => {
    const capped = VIDEO_PRESETS.filter((p) => p.id !== 'best');
    expect(capped.length).toBe(6);
    for (const p of capped) {
      // Regressão: um branch final `bestvideo+bestaudio/best` sem filtro
      // baixaria 4K mesmo quando o usuário escolheu 360p/480p.
      for (const branch of p.format.split('/')) {
        expect(branch, `${p.id}: ${branch}`).toMatch(
          new RegExp(`\\[(height|width)<=\\d+\\]`),
        );
      }
      // Vertical/Reel: o short side é a largura — precisa do fallback.
      expect(p.format, p.id).toContain(`width<=${p.height}`);
    }
  });

  it('"Melhor" continua sem filtro de resolução', () => {
    const best = VIDEO_PRESETS.find((p) => p.id === 'best');
    expect(best?.format).toBe('bestvideo+bestaudio/best');
  });
});
