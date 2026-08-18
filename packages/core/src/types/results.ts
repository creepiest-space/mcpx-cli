import type { ProviderName } from "./canonical.ts";

export type SyncStatus = "created" | "updated" | "unchanged" | "deleted" | "error";

export interface SyncResult {
  provider: ProviderName;
  filePath: string;
  status: SyncStatus;
  error?: string;
}

export interface DetectionResult {
  provider: ProviderName;
  filePath: string;
  servers: string[];
}

export interface ImportResult {
  provider: ProviderName;
  serversFound: number;
  serversImported: string[];
}
