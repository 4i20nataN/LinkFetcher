// Regressão do bug "card some mas o download continua" (SM-A107M):
// o kill nativo recebia `cleanup` lido do status DENTRO do closure, mas o
// status só era ajustado depois — todo cancel viajava como pausa
// (sem cleanup, .part órfão + notificação de "pausado" no Android).
// Estes testes travam o contrato: quem chama decide o cleanup, e remover
// ativo sempre mata com cleanup=true antes de tirar da lista.
import { describe, expect, it, beforeEach } from 'vitest';
import { DownloadEngine } from './DownloadEngine';
import type { DownloadItem } from '../../types';

function fakeItem(status: DownloadItem['status']): DownloadItem {
  return {
    id: `dl_test_${Math.floor(Math.random() * 1e9)}`,
    title: 'Video',
    thumbnailUrl: '',
    platform: 'youtube',
    format: { id: 'f', ext: 'mp4', quality: '1080p', sizeEst: '', sizeBytes: 100, codec: '', type: 'video' },
    sizeTotal: 100,
    sizeDownloaded: 10,
    progress: 10,
    speed: 0,
    eta: 0,
    status,
    addedAt: new Date().toISOString(),
    url: 'https://x',
  } as DownloadItem;
}

function engineState() {
  return DownloadEngine as unknown as {
    items: DownloadItem[];
    cancelFns: Map<string, (cleanup: boolean) => void>;
  };
}

beforeEach(() => {
  const st = engineState();
  st.items = [];
  st.cancelFns.clear();
});

describe('contrato de kill nativo (regressão delete-fantasma)', () => {
  it('cancelDownload mata com cleanup=true', () => {
    const st = engineState();
    const item = fakeItem('downloading');
    st.items = [item];
    let got: boolean | null = null;
    st.cancelFns.set(item.id, (cleanup) => { got = cleanup; });
    DownloadEngine.cancelDownload(item.id, false);
    expect(st.items[0].status).toBe('cancelled');
    expect(got).toBe(true);
  });

  it('pauseDownload mata com cleanup=false (preserva .part p/ resume)', () => {
    const st = engineState();
    const item = fakeItem('downloading');
    st.items = [item];
    let got: boolean | null = null;
    st.cancelFns.set(item.id, (cleanup) => { got = cleanup; });
    DownloadEngine.pauseDownload(item.id, false);
    expect(st.items[0].status).toBe('paused');
    expect(got).toBe(false);
  });

  it('removeDownload de ativo mata com cleanup=true E tira da lista', () => {
    const st = engineState();
    const item = fakeItem('downloading');
    const other = fakeItem('completed');
    st.items = [item, other];
    let got: boolean | null = null;
    st.cancelFns.set(item.id, (cleanup) => { got = cleanup; });
    DownloadEngine.removeDownload(item.id);
    expect(got).toBe(true);
    expect(st.items.find((i) => i.id === item.id)).toBeUndefined();
    expect(st.items.find((i) => i.id === other.id)).toBeDefined();
    expect(st.cancelFns.has(item.id)).toBe(false);
  });

  it('removeDownload de pausado sem handle não deixa rastro', () => {
    const st = engineState();
    const item = fakeItem('paused');
    st.items = [item];
    // Sem cancelFn (caso reload): não pode lançar, só remover.
    DownloadEngine.removeDownload(item.id);
    expect(st.items.length).toBe(0);
  });

  it('cancel ignora status final (completed não vira cancelled)', () => {
    const st = engineState();
    const item = fakeItem('completed');
    st.items = [item];
    DownloadEngine.cancelDownload(item.id, false);
    expect(st.items[0].status).toBe('completed');
  });
});
