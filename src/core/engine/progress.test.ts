import { describe, expect, it } from 'vitest';
import {
  PROGRESS_EVENT_SIGNATURE_FIELDS,
  formatActivityMessage,
  parseIpcNumber,
  progressEventSignature,
  progressThrottleMs,
  shouldNotifyProgress,
  smoothSpeed,
  withRateLimitHint,
} from './progress';

// Contrato Kotlin ↔ frontend: payload de `yt-dlp-progress` que o card usa
// para mostrar % e concluído. Se o Kotlin mudar o shape, este teste lembra
// de atualizar o dedupe (foi assim que a 1.4.0 quebrou silenciosamente).
describe('contrato de progresso (regressão v1.4.0)', () => {
  it('assinatura cobre todos os campos emitidos pelo Kotlin', () => {
    expect([...PROGRESS_EVENT_SIGNATURE_FIELDS].sort()).toEqual(
      [
        'type', 'percent', 'downloaded', 'total', 'speed', 'eta',
        'filePath', 'message', 'kind', 'current', 'text',
      ].sort(),
    );
  });

  it('duplicata do transporte duplo gera a mesma assinatura (descarta)', () => {
    const viaTrigger = { id: 'a', type: 'progress', percent: 42, downloaded: 10, total: 100, speed: 5, eta: 12 };
    const viaCustomEvent = { ...viaTrigger };
    expect(progressEventSignature(viaTrigger)).toBe(progressEventSignature(viaCustomEvent));
    expect(progressEventSignature(viaTrigger)).not.toBe('');
  });

  it('tick novo (percent mudou) gera assinatura diferente (aplica)', () => {
    const a = { type: 'progress', percent: 42 };
    const b = { type: 'progress', percent: 43 };
    expect(progressEventSignature(a)).not.toBe(progressEventSignature(b));
  });

  it('complete tem assinatura distinta de progress (nunca engolido)', () => {
    const p = { type: 'progress', percent: 99 };
    const c = { type: 'complete', filePath: '/x.mp4' };
    expect(progressEventSignature(p)).not.toBe(progressEventSignature(c));
  });

  it('payload nulo não quebra o handler', () => {
    expect(progressEventSignature(null)).toBe('');
    expect(progressEventSignature(undefined)).toBe('');
  });
});

describe('withRateLimitHint', () => {
  it('adiciona orientação em PT para 429', () => {
    expect(withRateLimitHint('HTTP Error 429', 'pt')).toContain('aguarde');
  });

  it('adiciona orientação em EN para 429', () => {
    expect(withRateLimitHint('HTTP Error 429', 'en')).toContain('wait');
  });

  it('não duplica o hint se já existe', () => {
    const once = withRateLimitHint('429', 'pt');
    expect(withRateLimitHint(once, 'pt')).toBe(once);
  });

  it('mensagem normal passa intacta', () => {
    expect(withRateLimitHint('Download failed', 'pt')).toBe('Download failed');
  });
});

describe('formatActivityMessage', () => {
  it('fragmento mostra atual/total', () => {
    expect(formatActivityMessage({ kind: 'fragment', current: 3, total: 10 }, 'pt'))
      .toBe('Fragmento 3/10');
    expect(formatActivityMessage({ kind: 'fragment', current: 3, total: 10 }, 'en'))
      .toBe('Fragment 3/10');
  });

  it('retry e texto livre', () => {
    expect(formatActivityMessage({ kind: 'retry' }, 'pt')).toBe('Tentando de novo…');
    expect(formatActivityMessage({ text: 'Muxing…' }, 'pt')).toBe('Muxing…');
  });

  it('fallback quando não há detalhe', () => {
    expect(formatActivityMessage({}, 'pt')).toBe('Trabalhando…');
    expect(formatActivityMessage({}, 'en')).toBe('Working…');
  });
});

describe('smoothSpeed', () => {
  it('suaviza com fator 0.4', () => {
    expect(smoothSpeed(10, 20)).toBeCloseTo(14);
  });

  it('zera/retoma sem rampa', () => {
    expect(smoothSpeed(10, 0)).toBe(0);
    expect(smoothSpeed(0, 20)).toBe(20);
  });
});

describe('throttle de notify', () => {
  it('500ms nas duas plataformas (corta reconciliação pela metade)', () => {
    expect(progressThrottleMs(true)).toBe(500);
    expect(progressThrottleMs(false)).toBe(500);
  });

  it('respeita o limite (borda inclusive notifica)', () => {
    expect(shouldNotifyProgress(1000, 500, true)).toBe(true);
    expect(shouldNotifyProgress(999, 500, true)).toBe(false);
    expect(shouldNotifyProgress(999, 500, false)).toBe(false);
  });
});

describe('parseIpcNumber', () => {
  it('aceita número, string e rejeita lixo', () => {
    expect(parseIpcNumber(12.5)).toBe(12.5);
    expect(parseIpcNumber('7')).toBe(7);
    expect(parseIpcNumber('abc')).toBe(0);
    expect(parseIpcNumber(undefined)).toBe(0);
  });
});
