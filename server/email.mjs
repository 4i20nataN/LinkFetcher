// Entrega da chave por e-mail (SMTP). Transporte injetável p/ teste; em
// produção usa nodemailer (lazy — dependência só do servidor).
// Falha de envio NUNCA quebra a venda: a chave segue disponível no poll.
export function buildKeyEmail({ to, key, days }) {
  const where = `LF1 (cole em Ativar PRO → Já tenho uma chave)`;
  return {
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    to,
    subject: 'Sua chave LinkFetcher PRO',
    text: [
      'Pagamento confirmado. Sua chave PRO:',
      '',
      key,
      '',
      `Validade: ${days} dias. Como ativar:`,
      `1. Abra o LinkFetcher → Download Personalizado → Ativar PRO`,
      `2. ${where}`,
      '',
      'Guarde este e-mail.',
    ].join('\n'),
  };
}

export async function sendKeyEmail({ to, key, days, mailer = null }) {
  const msg = buildKeyEmail({ to, key, days });
  const send = mailer || (await defaultMailer());
  if (!send) return { sent: false, reason: 'smtp-not-configured' };
  try {
    await send(msg);
    return { sent: true };
  } catch (err) {
    console.error('email falhou:', err?.message || err);
    return { sent: false, reason: 'send-failed' };
  }
}

let cachedTransport = null;
async function defaultMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!cachedTransport) {
    const { default: nodemailer } = await import('nodemailer');
    const t = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    cachedTransport = (msg) => t.sendMail(msg);
  }
  return cachedTransport;
}
