// Venda PRO via Pix automático (license server em Cloudflare Workers).
// Contato da compra é sempre e-mail: a chave chega no poll do app e por
// e-mail. Suporte responde pelo e-mail onde a chave foi entregue.
// Geração de chaves: node scripts/mint-key.mjs "contato-curto" 30.

export const PRO_PLAN = {
  label: 'PRO mensal',
  price: 9.99,
  days: 30,
} as const;

/** E-mail válido (único contato aceito na compra). */
export function validEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

/** E-mail público de suporte (conta de papel, ex. a verificada no Brevo).
 * '' = ainda não configurado (o app mostra só a orientação por e-mail). */
export const SUPPORT_EMAIL = '';
