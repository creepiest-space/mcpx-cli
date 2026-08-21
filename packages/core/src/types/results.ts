import type { ProviderName } from './canonical.ts';

export type SyncStatus = 'created' | 'updated' | 'unchanged' | 'cleaned' | 'error';

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

export interface DetectionDiagnostic {
  provider: ProviderName;
  filePath?: string;
  error: string;
}

export interface DetectionReport {
  detections: DetectionResult[];
  diagnostics: DetectionDiagnostic[];
}

export interface ImportResult {
  provider: ProviderName;
  serversFound: number;
  serversImported: string[];
}
