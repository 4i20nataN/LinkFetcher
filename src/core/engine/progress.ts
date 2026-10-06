// Helpers puros do caminho de progresso (Kotlin → engine → card).
//
// Extraídos do DownloadEngine para serem testáveis sem WebView/Tauri:
// toda a decisão (dedupe, texto de atividade, smoothing, throttle) mora
// aqui; o engine só aplica. Se o payload do Kotlin mudar, o teste de
// contrato em `progress.test.ts` quebra de propósito.

/** Campos do payload que compõem a assinatura de dedupe. Contrato com o
 *  `emitOnUi("yt-dlp-progress")` do YtDlpPlugin.kt: ao adicionar um campo
 *  novo no Kotlin, adicione aqui (e no teste) ou o dedupe ignora a mudança. */
export const PROGRESS_EVENT_SIGNATURE_FIELDS = [
  'type',
  'percent',
  'downloaded',
  'total',
  'speed',
  'eta',
  'filePath',
  'message',
  'kind',
  'current',
  'text',
] as const;

/** Assinatura de dedupe: eventos push duplicados (transporte duplo
 *  trigger + CustomEvent) geram a mesma string e são descartados. */
export function progressEventSignature(data: any): string {
  if (!data || typeof data !== 'object') return '';
  return PROGRESS_EVENT_SIGNATURE_FIELDS.map((f) => String(data[f])).join('|');
}

// 429 = YouTube limitou o ritmo do IP (transitório): orienta espera em vez
// de retry imediato em loop. Puro UI, sem tocar no argv canônico.
export function withRateLimitHint(msg: string, lang: string): string {
  if (/429|too many requests/i.test(msg) && !/429.*aguarde|wait.*429/i.test(msg)) {
    return lang === 'en'
      ? `${msg} · YouTube rate-limited this IP (429): wait a few minutes and retry`
      : `${msg} · YouTube limitou o ritmo (429): aguarde alguns minutos e tente de novo`;
  }
  return msg;
}

// Texto da atividade sem % (fragmento/retry/aviso do extrator): prova de
// vida enquanto o yt-dlp não imprime progresso — sem isso a UI congela em
// 0% e parece bugada num stall real. Limpa no próximo progresso.
export function formatActivityMessage(data: any, lang: string): string {
  const en = lang === 'en';
  if (data.kind === 'fragment' && typeof data.current === 'number' && typeof data.total === 'number') {
    return en ? `Fragment ${data.current}/${data.total}` : `Fragmento ${data.current}/${data.total}`;
  }
  if (data.kind === 'retry') return en ? 'Retrying…' : 'Tentando de novo…';
  if (typeof data.text === 'string' && data.text) return data.text;
  return en ? 'Working…' : 'Trabalhando…';
}

/** Suavização exponencial da velocidade exibida (fator 0.4): evita o número
 *  pulando a cada tick. Zera/retoma sem rampa quando um dos lados é ≤ 0. */
export function smoothSpeed(prev: number, raw: number): number {
  if (raw <= 0 || prev <= 0) return raw;
  return prev + 0.4 * (raw - prev);
}

/** Throttle de notify por tick de progresso: no Android a lista re-renderiza
 *  cards animados (motion) a cada notify — 500ms é indistinguível no olho e
 *  corta os renders pela metade; desktop mantém 250ms. */
export function progressThrottleMs(isAndroid: boolean): number {
  return isAndroid ? 500 : 250;
}

export function shouldNotifyProgress(now: number, last: number, isAndroid: boolean): boolean {
  return now - last >= progressThrottleMs(isAndroid);
}

/** Parse tolerante de número vindo do IPC (Kotlin pode mandar string). */
export function parseIpcNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}
