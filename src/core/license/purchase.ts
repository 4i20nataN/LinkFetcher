// Venda PRO via Pix (semi-automática, sem servidor): o app exibe QR +
// copia-e-cola gerados na hora (padrão BR Code/EMV do Banco Central) e um
// botão de WhatsApp com mensagem pronta. Você confere o pagamento e vende a
// chave com: node scripts/mint-key.mjs "Nome do Cliente" 30
// (mensal = 30 dias; vitalícia = sem o número).

export const PRO_PLAN = {
  label: 'PRO mensal',
  price: 9.99,
  days: 30,
} as const;

// Conta do vendedor (obrigatórios no BR Code, como está no banco).
export const PIX_KEY = 'f84b864f-d051-4aed-a87b-db49a400fca7';
export const PIX_RECEIVER_NAME = 'NATAN ANTUNES'; // max 25 letras (completo tem 27)
export const PIX_CITY = 'SAO JOAO'; // max 15 letras
export const WHATS_NUMBER = '5546999174002'; // DDI+DDD+número, só dígitos

const field = (id: string, value: string): string =>
  `${id}${String(value.length).padStart(2, '0')}${value}`;

/** Remove acentos, mantém A-Z 0-9 espaço, maiúsculas, trunca. */
export function pixText(s: string, max: number): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** CRC16-CCITT (0xFFFF, poly 0x1021) — dígito verificador do BR Code. */
export function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Monta o Pix copia-e-cola (BR Code) a partir das constantes acima. */
export function buildPixPayload(): string {
  const gui = field('00', 'br.gov.bcb.pix') + field('01', PIX_KEY);
  const amount = PRO_PLAN.price.toFixed(2);
  const base =
    field('00', '01') +
    field('26', gui) +
    field('52', '0000') +
    field('53', '986') +
    field('54', amount) +
    field('58', 'BR') +
    field('59', pixText(PIX_RECEIVER_NAME, 25)) +
    field('60', pixText(PIX_CITY, 15)) +
    field('62', field('05', '***')) +
    '6304';
  return base + crc16(base);
}

export function whatsappBuyLink(contact?: string): string {
  const msg =
    `Olá! Assinei o LinkFetcher ${PRO_PLAN.label} ` +
    `(R$ ${PRO_PLAN.price.toFixed(2).replace('.', ',')}).` +
    (contact ? ` Meu contato p/ receber a chave: ${contact}.` : '');
  return `https://wa.me/${WHATS_NUMBER}?text=${encodeURIComponent(msg)}`;
}

/** E-mail válido OU WhatsApp com 10..15 dígitos (aceita +, espaços, traços). */
export function validContact(s: string): boolean {
  return validEmail(s) || validPhone(s);
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

export function validEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

export function validPhone(s: string): boolean {
  const d = onlyDigits(s);
  return d.length >= 10 && d.length <= 13;
}

/** Máscara BR progressiva: (46) 99917-4002. Tolera 55 na frente. */
export function maskPhoneBR(s: string): string {
  let n = onlyDigits(s).slice(0, 13);
  if (n.length > 11 && n.startsWith('55')) n = n.slice(2);
  if (!n) return '';
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}
