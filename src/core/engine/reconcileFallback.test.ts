// Botão Verificar Lista: cura pausado com arquivo final em disco mesmo com
// `destination` obsoleto (merge trocou o container, retry renomeou).
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { DownloadEngine } from './DownloadEngine';
import type { DownloadItem } from '../../types';

const invokeMock = invoke as unknown as ReturnType<typeof vi.fn>;

function fakeItem(partial: Partial<DownloadItem> & { status: DownloadItem['status'] }): DownloadItem {
  return {
    id: `dl_reconcile_${Math.floor(Math.random() * 1e9)}`,
    title: 'Show',
    thumbnailUrl: '',
    platform: 'youtube',
    format: { id: 'f', ext: 'mp4', quality: '1080p', sizeEst: '', sizeBytes: 100, codec: '', type: 'video' },
    filePath: '/dl/show.mp4',
    sizeTotal: 100,
    sizeDownloaded: 10,
    progress: 10,
    speed: 0,
    eta: 0,
    addedAt: new Date().toISOString(),
    url: 'https://x',
    ...partial,
  } as DownloadItem;
}

function engineState() {
  return DownloadEngine as unknown as { items: DownloadItem[] };
}

beforeEach(() => {
  engineState().items = [];
  invokeMock.mockReset();
  // Padrão: caminho exato ausente; eleição responde por teste.
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'fs_file_stat') return { exists: false, size: 0 };
    return null;
  });
});

describe('Verificar Lista com destination obsoleto', () => {
  it('caminho exato intacto cura como antes', async () => {
    engineState().items = [fakeItem({ status: 'paused' })];
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'fs_file_stat') return { exists: true, size: 100 };
      return null;
    });
    expect(await DownloadEngine.reconcileUnfinished()).toBe(1);
    expect(engineState().items[0].status).toBe('completed');
    expect(invokeMock).not.toHaveBeenCalledWith('fs_elect_finished', expect.anything());
  });

  it('container trocado (.mp4 → .mkv) cura pelo eleito e atualiza filePath', async () => {
    engineState().items = [fakeItem({ status: 'paused' })];
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'fs_file_stat') return { exists: false, size: 0 };
      if (cmd === 'fs_elect_finished') return { path: '/dl/show.mkv', size: 100, hasPart: false };
      return null;
    });
    expect(await DownloadEngine.reconcileUnfinished()).toBe(1);
    expect(engineState().items[0].status).toBe('completed');
    expect(engineState().items[0].filePath).toBe('/dl/show.mkv');
  });

  it('parcial em voo (hasPart) nunca cura — retoma depois', async () => {
    engineState().items = [fakeItem({ status: 'paused' })];
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'fs_file_stat') return { exists: false, size: 0 };
      if (cmd === 'fs_elect_finished') return { path: '/dl/show.mkv', size: 100, hasPart: true };
      return null;
    });
    expect(await DownloadEngine.reconcileUnfinished()).toBe(0);
    expect(engineState().items[0].status).toBe('paused');
  });

  it('sem eleito continua pausado', async () => {
    engineState().items = [fakeItem({ status: 'paused' })];
    expect(await DownloadEngine.reconcileUnfinished()).toBe(0);
    expect(engineState().items[0].status).toBe('paused');
  });

  it('pós-processado com tamanho >= total cura (merge concluiu)', async () => {
    engineState().items = [fakeItem({ status: 'paused', mergeOutputFormat: 'mkv' })];
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'fs_file_stat') return { exists: false, size: 0 };
      if (cmd === 'fs_elect_finished') return { path: '/dl/show.mkv', size: 120, hasPart: false };
      return null;
    });
    expect(await DownloadEngine.reconcileUnfinished()).toBe(1);
    expect(engineState().items[0].status).toBe('completed');
  });

  it('pós-processado menor que o total não cura (recorte/parcial)', async () => {
    engineState().items = [fakeItem({ status: 'paused', downloadSections: '*00:00-00:10' })];
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'fs_file_stat') return { exists: false, size: 0 };
      if (cmd === 'fs_elect_finished') return { path: '/dl/show.mp4', size: 40, hasPart: false };
      return null;
    });
    expect(await DownloadEngine.reconcileUnfinished()).toBe(0);
    expect(engineState().items[0].status).toBe('paused');
  });

  it('pós-processado no caminho exato continua sem curar (guarda antiga)', async () => {
    engineState().items = [fakeItem({ status: 'paused', audioOnly: true })];
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'fs_file_stat') return { exists: true, size: 100 };
      return null;
    });
    expect(await DownloadEngine.reconcileUnfinished()).toBe(0);
    expect(engineState().items[0].status).toBe('paused');
  });
});
