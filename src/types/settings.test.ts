import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

// Contrato dos settings persistidos: localStorage com forma/tipo errado
// nunca quebra nem mente estado — cai no default campo a campo.
describe('sanitizeSettings (settings à prova de lixo)', () => {
  it('retorna defaults p/ null, array, string e undefined', () => {
    for (const raw of [null, undefined, [], 'null', 42]) {
      expect(sanitizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('mescla parcial com defaults (campos futuros nascem definidos)', () => {
    expect(sanitizeSettings({ themeMode: 'light' })).toEqual({
      ...DEFAULT_SETTINGS,
      themeMode: 'light',
    });
  });

  it('rejeita unions inválidas e tipos trocados', () => {
    const out = sanitizeSettings({
      themeMode: 'neon',
      iconStyle: 'x',
      language: 'es',
      notifications: 'false',
      maxConcurrent: -5,      bandLimit: NaN,
      autoDownload: 1,
    });
    expect(out.themeMode).toBe('dark');
    expect(out.iconStyle).toBe('lucide-mono');
    expect(out.language).toBe('pt');
    expect(out.notifications).toBe(true);
    expect(out.autoDownload).toBe(true);
    expect(out.bandLimit).toBe(0);
    expect(out.maxConcurrent).toBe(3);
  });

  it('limita maxConcurrent ao teto sem quebrar', () => {
    expect(sanitizeSettings({ maxConcurrent: 999 }).maxConcurrent).toBe(10);
    expect(sanitizeSettings({ maxConcurrent: 3 }).maxConcurrent).toBe(3);
  });

  it('ignora keys desconhecidas sem vazar p/ o estado', () => {
    const out = sanitizeSettings({ ...DEFAULT_SETTINGS, foo: 'bar' } as never);
    expect(out).toEqual(DEFAULT_SETTINGS);
    expect('foo' in out).toBe(false);
  });
});
