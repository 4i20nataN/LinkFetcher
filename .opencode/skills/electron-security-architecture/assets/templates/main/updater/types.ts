// main/updater/types.ts
import { z } from 'zod';

export const ArtifactSchema = z.object({
  platform: z.string(),
  fileName: z.string().min(1).max(200),
  sha256: z.string().length(64),
  sha512: z.string().length(128),
  sizeBytes: z.number().positive(),
  authenticodeThumbprint: z.string().optional(),
});

export const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  repository: z.string(), // comparado exatamente contra PINNED_OWNER_REPO
  version: z.string(),    // semver estrito, validado separadamente
  minimumSupportedVersion: z.string(),
  publishedAt: z.string(), // ISO 8601
  signingKeyId: z.string().optional(),
  artifacts: z.array(ArtifactSchema).min(1),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export interface LocalUpdateState {
  lastInstalledVersion: string;
  updatedAt: string;
}
