// Venda PRO via Pix automático (license server em Cloudflare Workers).
// Contato da compra é sempre e-mail: a chave chega no poll do app e por
// e-mail. Suporte responde pelo e-mail onde a chave foi entregue.
// Geração de chaves: node scripts/mint-key.mjs "contato-curto" 30.

export interface ProPlan {
  id: string;
  label: string;
  labelEn: string;
  days: number;
  price: number;
  /** selo de destaque no seletor (ex. 'mais popular', '-33%') */
  tag?: string;
}

/** Catálogo de planos (espelho do servidor — fonte da verdade é o Worker). */
export const PLANS: ProPlan[] = [
  { id: 'semanal', label: '7 dias', labelEn: '7 days', days: 7, price: 5 },
  { id: 'mensal', label: '1 mês', labelEn: '1 month', days: 30, price: 9.99, tag: 'mais popular' },
  { id: 'trimestral', label: '3 meses', labelEn: '3 months', days: 90, price: 24.99, tag: '-17%' },
  { id: 'semestral', label: '6 meses', labelEn: '6 months', days: 180, price: 44.99, tag: '-25%' },
  { id: 'anual', label: '1 ano', labelEn: '1 year', days: 365, price: 79.99, tag: '-33%' },
];

/** Plano padrão (Mensal). */
export const PRO_PLAN = {
  label: 'PRO mensal',
  price: 9.99,
  days: 30,
} as const;

export function planById(id: string): ProPlan {
  return PLANS.find((p) => p.id === id) ?? PLANS[1];
}

export function formatBRL(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

/** E-mail válido (único contato aceito na compra). */
export function validEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}
