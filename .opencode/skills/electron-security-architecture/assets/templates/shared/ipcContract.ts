// shared/ipcContract.ts
// Registro central de canais IPC e schemas de validação.
// Importado tanto pelo main quanto pelo preload — nunca strings soltas.

import { z } from 'zod';

export const IPC_CHANNELS = {
  UPDATE_CHECK: 'update:check',
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_PROGRESS: 'download:progress', // main -> renderer, one-way
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// --- download:start -------------------------------------------------------

export const DownloadRequestSchema = z.object({
  url: z.string().url().refine((u) => new URL(u).protocol === 'https:', {
    message: 'only https is allowed',
  }),
  suggestedName: z.string().min(1).max(200).optional(),
});
export type DownloadRequest = z.infer<typeof DownloadRequestSchema>;

export const DownloadResultSchema = z.object({
  ok: z.boolean(),
  filePath: z.string().optional(),
  sha256: z.string().length(64).optional(),
  errorCode: z.string().optional(),
});
export type DownloadResult = z.infer<typeof DownloadResultSchema>;

export const DownloadProgressSchema = z.object({
  requestId: z.string(),
  receivedBytes: z.number().nonnegative(),
  totalBytes: z.number().nonnegative(),
});
export type DownloadProgress = z.infer<typeof DownloadProgressSchema>;

// --- update:check -----------------------------------------------------------

export const UpdateCheckResultSchema = z.object({
  updateAvailable: z.boolean(),
  version: z.string().optional(),
  // nunca inclua a URL de download bruta aqui sem já ter passado pela
  // verificação de assinatura descrita em references/05-update-security.md
});
export type UpdateCheckResult = z.infer<typeof UpdateCheckResultSchema>;
