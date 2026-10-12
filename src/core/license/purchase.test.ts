// Compra PRO: plano e validação de e-mail.
import { describe, it, expect } from 'vitest';
import { PRO_PLAN, validEmail } from './purchase';

describe('compra', () => {
  it('plano vigente', () => {
    expect(PRO_PLAN.price).toBe(9.99);
    expect(PRO_PLAN.days).toBe(30);
  });

  it('só e-mail válido passa', () => {
    expect(validEmail('cliente@exemplo.com')).toBe(true);
    expect(validEmail('cliente@')).toBe(false);
    expect(validEmail('  ')).toBe(false);
    expect(validEmail('11987654321')).toBe(false);
  });
});
