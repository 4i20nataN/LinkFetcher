import { describe, expect, it } from 'vitest';
import { scrollDeltaForKey } from './keyboardScroll';

// Contrato das setas no desktop: passo fixo por linha, página com folga,
// Home/End como salto absoluto (±Infinity).
describe('scrollDeltaForKey', () => {
  it('setas são passo fixo de uma linha', () => {
    expect(scrollDeltaForKey('ArrowDown', 800)).toBe(72);
    expect(scrollDeltaForKey('ArrowUp', 800)).toBe(-72);
  });

  it('Page segue a altura do viewport (folga p/ não perder o contexto)', () => {
    expect(scrollDeltaForKey('PageDown', 800)).toBeCloseTo(680);
    expect(scrollDeltaForKey('PageUp', 800)).toBeCloseTo(-680);
  });

  it('Home/End são salto absoluto', () => {
    expect(scrollDeltaForKey('Home', 800)).toBe(-Infinity);
    expect(scrollDeltaForKey('End', 800)).toBe(Infinity);
  });

  it('ignora teclas alheias (digitáveis/atalhos)', () => {
    for (const k of ['a', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', ' ']) {
      expect(scrollDeltaForKey(k, 800)).toBeNull();
    }
  });
});
