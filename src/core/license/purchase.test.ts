// Compra PRO: plano e validação de e-mail.
import { describe, it, expect } from 'vitest';
import { PRO_PLAN, PLANS, planById, formatBRL, validEmail } from './purchase';

describe('compra', () => {
  it('plano vigente', () => {
    expect(PRO_PLAN.price).toBe(9.99);
    expect(PRO_PLAN.days).toBe(30);
  });

  it('catálogo com 5 planos e mensal como padrão', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['semanal', 'mensal', 'trimestral', 'semestral', 'anual']);
    expect(planById('mensal').price).toBe(9.99);
    expect(planById('semanal')).toMatchObject({ days: 7, price: 5 });
    expect(planById('anual')).toMatchObject({ days: 365, price: 79.99 });
    expect(planById('inexistente').id).toBe('mensal');
    expect(formatBRL(9.99)).toBe('R$ 9,99');
    const prices = PLANS.map((p) => p.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('só e-mail válido passa', () => {
    expect(validEmail('cliente@exemplo.com')).toBe(true);
    expect(validEmail('cliente@')).toBe(false);
    expect(validEmail('  ')).toBe(false);
    expect(validEmail('11987654321')).toBe(false);
  });
});
