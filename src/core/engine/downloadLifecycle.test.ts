// Kill nativo com `cleanup` explícito: quem chama decide (pausa preserva o
// .part, cancel apaga). Remover ativo sempre mata antes de tirar da lista.
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
    applyTerminalEvent: (id: string, data: any) => boolean;
    touch: (id: string) => void;
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

describe('evento terminal no objeto vivo (regressão memo 48f01b3)', () => {
  it('complete atravessa o touch: closure obsoleta não perde a transição', () => {
    const st = engineState();
    const item = fakeItem('downloading');
    st.items = [item];
    st.cancelFns.set(item.id, () => {});
    // Simula o startDownload: o closure capturou `item`, o touch trocou a ref.
    const stale = st.items[0];
    st.touch(item.id);
    expect(st.items[0]).not.toBe(stale);

    const settled = st.applyTerminalEvent(item.id, {
      type: 'complete', filePath: '/dl/a.mp4', size: 123,
    });

    expect(settled).toBe(true);
    expect(st.items[0].status).toBe('completed');
    expect(st.items[0].progress).toBe(100);
    expect(st.items[0].filePath).toBe('/dl/a.mp4');
    expect(st.items[0].sizeTotal).toBe(123);
    // O órfão do closure não contamina a lista; mapas limpos.
    expect(stale.status).toBe('downloading');
    expect(st.cancelFns.has(item.id)).toBe(false);
  });

  it('complete em pausado/cancelado é ignorado (intenção do usuário)', () => {
    const st = engineState();
    for (const s of ['paused', 'cancelled'] as const) {
      st.items = [fakeItem(s)];
      expect(st.applyTerminalEvent(st.items[0].id, { type: 'complete' })).toBe(false);
      expect(st.items[0].status).toBe(s);
    }
  });

  it('complete duplicado é no-op', () => {
    const st = engineState();
    st.items = [fakeItem('downloading')];
    const id = st.items[0].id;
    expect(st.applyTerminalEvent(id, { type: 'complete' })).toBe(true);
    expect(st.applyTerminalEvent(id, { type: 'complete' })).toBe(false);
    expect(st.items[0].status).toBe('completed');
  });

  it('error vira failed com mensagem e hint 429', () => {
    const st = engineState();
    st.items = [fakeItem('downloading')];
    const id = st.items[0].id;
    expect(st.applyTerminalEvent(id, { type: 'error', message: 'HTTP Error 429' })).toBe(true);
    expect(st.items[0].status).toBe('failed');
    expect(st.items[0].error).toContain('429');
    expect(st.applyTerminalEvent(id, { type: 'error', message: 'x' })).toBe(false);
  });

  it('id desconhecido não quebra', () => {
    const st = engineState();
    st.items = [fakeItem('downloading')];
    expect(st.applyTerminalEvent('dl_inexistente', { type: 'complete' })).toBe(false);
    expect(st.items[0].status).toBe('downloading');
  });
});
