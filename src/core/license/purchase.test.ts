// BR Code: estrutura + CRC conforme manual do Banco Central.
import { describe, it, expect } from 'vitest';
import { buildPixPayload, crc16, pixText, PIX_KEY, whatsappBuyLink, validContact, maskPhoneBR, validPhone, validEmail } from './purchase';

describe('pix BR Code', () => {
  it('crc16 do vetor conhecido', () => {
    // Vetor padrão do exemplo oficial: '123456789' → 0x29B1.
    expect(crc16('123456789')).toBe('29B1');
  });

  it('payload contém a chave e fecha com CRC válido', () => {
    const p = buildPixPayload();
    expect(p).toContain(PIX_KEY);
    expect(p).toMatch(/^00020126/);
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
    expect(p).toContain('54049.99'); // R$ 9,99
  });

  it('contato tipado: máscara BR e validação', () => {
    expect(maskPhoneBR('11987654321')).toBe('(11) 98765-4321');
    expect(maskPhoneBR('1132131000')).toBe('(11) 3213-1000');
    expect(maskPhoneBR('5511987654321')).toBe('(11) 98765-4321');
    expect(validPhone('11987654321')).toBe(true);
    expect(validPhone('123')).toBe(false);
    expect(validEmail('natan@exemplo.com')).toBe(true);
    expect(validEmail('natan@')).toBe(false);
  });

  it('link do WhatsApp embute o contato', () => {
    expect(validContact('11987654321')).toBe(true);
    expect(validContact('+55 11 98765-4321')).toBe(true);
    expect(validContact('natan@exemplo.com')).toBe(true);
    expect(validContact('abc')).toBe(false);
    expect(validContact('123')).toBe(false);
    expect(whatsappBuyLink('11987654321')).toContain(encodeURIComponent('11987654321'));
  });

  it('sanitiza nome/cidade (sem acento, teto de tamanho)', () => {
    expect(pixText('João da Silva-Souza', 25)).toBe('JOAO DA SILVASOUZA');
    expect(pixText('São Paulo do Potengi Extra', 15)).toBe('SAO PAULO DO PO');
  });
});
