// Integridade da persistência da fila: payload corrupto nunca é apagado por
// um save seguinte (`.corrupt` + `.bak` forçado), repair via `.bak` no boot,
// backup rotativo 1x a cada 10 escritas, e addMany = 1 save por lote.
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DownloadEngine } from './DownloadEngine';
import type { DownloadItem, MediaFormat, MediaInfo } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';

const KEY = 'universal_downloader_items';
const BAK = 'universal_downloader_items.bak';
const CORRUPT = 'universal_downloader_items.corrupt';

function installStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  const setItem = vi.fn((k: string, v: string) => { store.set(k, v); });
  const getItem = vi.fn((k: string) => (store.has(k) ? store.get(k) as string : null));
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem, setItem, removeItem: vi.fn(), clear: vi.fn() },
    configurable: true,
    writable: true,
  });
  return { store, setItem, getItem };
}

type EngineInternals = {
  items: DownloadItem[];
  loadState: () => void;
  saveState: (force?: boolean) => void;
  corruptBackupPending: boolean;
  writesSinceBackup: number;
  lastPersistedAt: number;
};

function st(): EngineInternals {
  return DownloadEngine as unknown as EngineInternals;
}

function fakeItem(over: Partial<DownloadItem> = {}): DownloadItem {
  return {
    id: `dl_p_${Math.floor(Math.random() * 1e9)}`,
    title: 'Video',
    thumbnailUrl: '',
    platform: 'youtube',
    format: { id: 'f', ext: 'mp4', quality: '1080p', sizeEst: '', sizeBytes: 100, codec: '', type: 'video' },
    sizeTotal: 100,
    sizeDownloaded: 0,
    progress: 0,
    speed: 0,
    eta: 0,
    status: 'queued',
    addedAt: new Date().toISOString(),
    url: 'https://x',
    ...over,
  } as DownloadItem;
}

function req(url: string, opts: Record<string, unknown> = {}) {
  const media = {
    originalUrl: url, title: 'T', thumbnailUrl: '', platform: 'youtube', durationSeconds: 0,
  } as MediaInfo;
  const format = {
    id: 'f', ext: 'mp4', quality: '', sizeEst: '', sizeBytes: 10, codec: '', type: 'video',
  } as MediaFormat;
  return { media, format, formatOptions: { playlistName: 'P', ...opts } as never };
}

beforeEach(() => {
  installStorage();
  const e = st();
  e.items = [];
  e.corruptBackupPending = false;
  e.writesSinceBackup = 0;
  e.lastPersistedAt = 0;
});

describe('FIX 1 — payload corrupto preservado (nunca clobber silencioso)', () => {
  it('parse falho: snapshot timestampado em `.corrupt` e flag de guarda ativa', () => {
    const { store } = installStorage({ [KEY]: '{truncado###' });
    st().loadState();
    expect(st().items).toEqual([]);
    const snap = JSON.parse(store.get(CORRUPT) as string);
    expect(snap.raw).toBe('{truncado###');
    expect(typeof snap.corruptedAt).toBe('string');
    expect(st().corruptBackupPending).toBe(true);
  });

  it('primeira gravação após corrupção copia o valor cru para `.bak` ANTES do overwrite', () => {
    const { store } = installStorage({ [KEY]: '{truncado###' });
    st().loadState();
    st().saveState(true);
    expect(store.get(BAK)).toBe('{truncado###');
    expect(JSON.parse(store.get(KEY) as string)).toEqual([]);
    expect(st().corruptBackupPending).toBe(false);
  });

  it('snapshot `.corrupt` é do primeiro incidente (não é sobrescrito)', () => {
    const prevIncident = JSON.stringify({ corruptedAt: '2020-01-01T00:00:00.000Z', raw: 'older-bad' });
    const { store } = installStorage({ [KEY]: 'novo-bad', [CORRUPT]: prevIncident });
    st().loadState();
    expect(store.get(CORRUPT)).toBe(prevIncident);
  });
});

describe('FIX 2 — repair via `.bak` e backup rotativo', () => {
  it('main corrupto + `.bak` válido: fila restaurada do backup', () => {
    const good = JSON.stringify([
      { id: 'dl_9', status: 'downloading', addedAt: '2026-01-01T00:00:00.000Z', url: 'u', format: { ext: 'mp4' } },
    ]);
    const { store } = installStorage({ [KEY]: 'nao-e-json{{{', [BAK]: good });
    st().loadState();
    expect(st().items.map(i => i.id)).toEqual(['dl_9']);
    // 'downloading' no repouso vira paused (regra antiga preservada no repair).
    expect(st().items[0].status).toBe('paused');
    // O corrupto continua snapshotado para inspeção.
    expect(JSON.parse(store.get(CORRUPT) as string).raw).toBe('nao-e-json{{{');
  });

  it('`.bak` é regravado no máximo 1x a cada 10 escritas', () => {
    const { store, setItem } = installStorage();
    const bakWrites = () => setItem.mock.calls.filter(c => c[0] === BAK).length;
    for (let i = 1; i <= 9; i++) st().saveState(true);
    expect(store.has(BAK)).toBe(false);
    expect(bakWrites()).toBe(0);
    st().saveState(true); // 10ª escrita: backup da cópia anterior
    expect(store.get(BAK)).toBe('[]');
    expect(store.has(KEY)).toBe(true);
    st().saveState(true); // 11ª não re-gera `.bak`
    expect(bakWrites()).toBe(1);
  });
});

describe('FIX 4 — addMany: 1 save por lote, semântica idêntica ao loop', () => {
  it('n requests = exatamente 1 setItem no key principal', () => {
    const { setItem } = installStorage();
    // Saturar vagas: processQueue não inicia downloads (senão cada
    // startDownload notifica e grava de novo).
    st().items = Array.from({ length: DEFAULT_SETTINGS.maxConcurrent }, () => fakeItem({ status: 'downloading' }));

    DownloadEngine.addMany([req('u1'), req('u2'), req('u3')]);

    const mainWrites = setItem.mock.calls.filter(c => c[0] === KEY).length;
    expect(mainWrites).toBe(1);
    const persisted = JSON.parse(setItem.mock.calls.find(c => c[0] === KEY)![1] as string);
    expect(persisted).toHaveLength(DEFAULT_SETTINGS.maxConcurrent + 3);
  });

  it('ordem visível igual ao loop de addDownload (último adicionado primeiro)', () => {
    st().items = Array.from({ length: DEFAULT_SETTINGS.maxConcurrent }, () => fakeItem({ status: 'downloading' }));
    DownloadEngine.addMany([req('u1'), req('u2'), req('u3')]);
    expect(st().items.slice(0, 3).map(i => i.url)).toEqual(['u3', 'u2', 'u1']);
  });

  it('sufixo de repetidos igual ao loop: (1), (2)… contando o lote', () => {
    st().items = Array.from({ length: DEFAULT_SETTINGS.maxConcurrent }, () => fakeItem({ status: 'downloading' }));
    DownloadEngine.addMany([req('same'), req('same'), req('same')]);
    // Loop antigo: 1º do lote (mesma família, nada repetido) fica sem sufixo;
    // os seguintes herdam a contagem acumulada — mesma regra aqui.
    const [third, second, first] = st().items.slice(0, 3);
    expect(first.customFilename).toBeUndefined();
    expect(second.customFilename).toBe('%(title)s (1)');
    expect(third.customFilename).toBe('%(title)s (2)');
  });

  it('addedAt monotônico no lote (ordem de início FIFO preservada)', () => {
    st().items = Array.from({ length: DEFAULT_SETTINGS.maxConcurrent }, () => fakeItem({ status: 'downloading' }));
    DownloadEngine.addMany([req('m1'), req('m2'), req('m3')]);
    const times = st().items.slice(0, 3).map(i => Date.parse(i.addedAt)); // [m3,m2,m1]
    expect(times[2]).toBeLessThanOrEqual(times[1]);
    expect(times[1]).toBeLessThanOrEqual(times[0]);
  });

  it('addDownload unitário continua gravando e entrando na fila (contrato antigo)', () => {
    const { setItem } = installStorage();
    // Slots cheios: sem startDownload no caminho (cada início notifica/grava).
    st().items = Array.from({ length: DEFAULT_SETTINGS.maxConcurrent }, () => fakeItem({ status: 'downloading' }));
    const r = req('solo');
    DownloadEngine.addDownload(r.media, r.format, r.formatOptions);
    expect(st().items[0].url).toBe('solo');
    expect(setItem.mock.calls.filter(c => c[0] === KEY).length).toBe(1);
  });
});
