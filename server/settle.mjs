// Transição pending→paid (webhook ou poll); idempotente e testável.
// Preço/dias vêm do registro; deps injetáveis p/ teste.
import { getPayment as defaultGetPayment } from './mp.mjs';
import { mintKeyFor as defaultMint } from './mint.mjs';
import { sendKeyEmail as defaultSend } from './email.mjs';

const priceOf = (c) => Number(c.price ?? process.env.PRICE ?? '9.99');
const daysOf = (c) => Number(c.days ?? process.env.PLAN_DAYS ?? '30');

export async function settleCheckout(db, checkout, deps = {}) {
  const {
    getPayment = defaultGetPayment,
    mintKeyFor = defaultMint,
    sendKeyEmail = defaultSend,
  } = deps;
  if (checkout.status === 'paid' && checkout.key) return checkout;
  const pay = await getPayment(checkout.mpId);
  if (!pay || pay.status !== 'approved') {
    checkout.status = pay?.status === 'rejected' || pay?.status === 'cancelled' ? pay.status : 'pending';
    checkout.updatedAt = new Date().toISOString();
    return checkout;
  }
  // Valor exato exigido: transação tem que ser R$ do REGISTRO em BRL.
  const price = priceOf(checkout);
  const amountOk = Math.abs(Number(pay.transaction_amount) - price) < 0.005 && pay.currency_id === 'BRL';
  if (!amountOk) {
    checkout.status = 'amount_mismatch';
    checkout.updatedAt = new Date().toISOString();
    return checkout;
  }
  const days = daysOf(checkout);
  checkout.key = await mintKeyFor(checkout.contactName || checkout.email, days);
  checkout.status = 'paid';
  checkout.paidAt = new Date().toISOString();
  checkout.updatedAt = checkout.paidAt;
  // E-mail leva a chave; falha não quebra a venda (poll entrega).
  if (/@/.test(checkout.email || '')) {
    const r = await sendKeyEmail({ to: checkout.email, key: checkout.key, days });
    checkout.emailSent = r.sent;
  }
  return checkout;
}
