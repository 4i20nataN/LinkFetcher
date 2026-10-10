// Contrato do caminho quente: campos quentes (DOM) vs transições (re-render).
import { describe, expect, it } from 'vitest';
import { isCardStaticEqual } from './DownloadCard';
import { listSignature } from './DownloadList';
import type { DownloadItem } from '../../../types';

function base(): DownloadItem {
  return {
    id: 'dl_1',
    title: 'Video',
    thumbnailUrl: 'https://x/y.jpg',
    platform: 'youtube',
    // `format` compara por identidade (o engine nunca troca a ref).
    format: sharedFormat,
    sizeTotal: 100,
    sizeDownloaded: 10,
    progress: 10,
    speed: 1024,
    eta: 30,
    status: 'downloading',
    addedAt: '2026-01-01',
    url: 'https://x',
  } as DownloadItem;
}

const sharedFormat = {
  id: 'f', ext: 'mp4', quality: '1080p', sizeEst: '', sizeBytes: 100, codec: '', type: 'video',
} as const;

describe('isCardStaticEqual (contrato do memo)', () => {
  it('ignora os 4 campos quentes (caminho imperativo cobre)', () => {
    const a = base();
    const b = { ...a, progress: 55, sizeDownloaded: 55, speed: 2048, eta: 12 };
    expect(isCardStaticEqual(a, b)).toBe(true);
  });

  it('re-renderiza em transição de status', () => {
    expect(isCardStaticEqual(base(), { ...base(), status: 'completed' })).toBe(false);
    expect(isCardStaticEqual(base(), { ...base(), status: 'paused' })).toBe(false);
  });

  it('re-renderiza ao cruzar 0→>0 (indeterminado vira barra)', () => {
    const a = { ...base(), progress: 0 };
    const b = { ...base(), progress: 3 };
    expect(isCardStaticEqual(a, b)).toBe(false);
  });

  it('NÃO re-renderiza entre dois progressos >0', () => {
    const shared = base();
    const a = { ...shared, progress: 3 };
    const b = { ...shared, progress: 40 };
    expect(isCardStaticEqual(a, b)).toBe(true);
  });

  it('re-renderiza em activity/processing/erro/tamanho final', () => {
    expect(isCardStaticEqual(base(), { ...base(), activity: 'Fragmento 1/2' })).toBe(false);
    expect(isCardStaticEqual(base(), { ...base(), processing: true })).toBe(false);
    expect(isCardStaticEqual({ ...base(), status: 'failed' }, { ...base(), status: 'failed', error: 'x' })).toBe(false);
    expect(isCardStaticEqual(base(), { ...base(), sizeTotal: 200 })).toBe(false);
  });

  it('re-renderiza em metadados (título, arquivo, flags)', () => {
    expect(isCardStaticEqual(base(), { ...base(), title: 'Outro' })).toBe(false);
    expect(isCardStaticEqual(base(), { ...base(), filePath: '/a.mp4' })).toBe(false);
    expect(isCardStaticEqual(base(), { ...base(), audioOnly: true })).toBe(false);
  });
});

describe('listSignature (contrato da lista)', () => {
  it('estável entre ticks de progresso (lista pula reconciliação)', () => {
    const a = [base(), { ...base(), id: 'dl_2', progress: 5 }];
    const b = a.map((i) => ({ ...i, progress: i.progress + 7, speed: 9999 }));
    expect(listSignature(a)).toBe(listSignature(b));
  });

  it('muda em transição de status, entrada e saída', () => {
    const a = [base()];
    expect(listSignature(a)).not.toBe(listSignature([{ ...base(), status: 'completed' }]));
    expect(listSignature(a)).not.toBe(listSignature([...a, { ...base(), id: 'dl_9' }]));
    expect(listSignature(a)).not.toBe(listSignature([]));
  });
});
