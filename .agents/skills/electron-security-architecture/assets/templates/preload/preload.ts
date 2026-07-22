// preload/preload.ts
// Única ponte renderer <-> main. Superfície mínima, objeto congelado.

import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  DownloadRequestSchema,
  DownloadResultSchema,
  DownloadProgressSchema,
  UpdateCheckResultSchema,
  type DownloadRequest,
  type DownloadResult,
  type DownloadProgress,
  type UpdateCheckResult,
} from '../shared/ipcContract';

function parseOrThrow<T>(schema: { parse: (v: unknown) => T }, value: unknown): T {
  return schema.parse(value); // lança se inválido — nunca "corrige" o dado
}

const api = Object.freeze({
  checkForUpdate: async (): Promise<UpdateCheckResult> => {
    const raw = await ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK);
    return parseOrThrow(UpdateCheckResultSchema, raw);
  },

  downloadMedia: async (request: DownloadRequest): Promise<DownloadResult> => {
    const validated = parseOrThrow(DownloadRequestSchema, request);
    const raw = await ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_START, validated);
    return parseOrThrow(DownloadResultSchema, raw);
  },

  onDownloadProgress: (cb: (p: DownloadProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      const parsed = DownloadProgressSchema.safeParse(payload);
      if (parsed.success) cb(parsed.data); // payload inválido é descartado, nunca repassado
    };
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD_PROGRESS, listener);
  },
});

export type PreloadApi = typeof api;

contextBridge.exposeInMainWorld('api', api);
