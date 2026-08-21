/* oxlint-disable eslint/no-await-in-loop -- Conflict resolution prompts must run in input order. */

import { isDeepStrictEqual } from 'node:util';

import {
  ServerNameSchema,
  type McpServerConfig,
  type ProviderName,
} from '@creepiest-space/mcpx-core';

export type ImportConflictAction =
  | { action: 'skip' }
  | { action: 'overwrite' }
  | { action: 'rename'; name: string };

export interface ImportConflict {
  name: string;
  source: ProviderName;
  existing: McpServerConfig;
  incoming: McpServerConfig;
  occupiedNames: readonly string[];
}

export type ImportConflictResolver = (conflict: ImportConflict) => Promise<ImportConflictAction>;

export interface ImportMergeResult {
  servers: Record<string, McpServerConfig>;
  imported: string[];
  skipped: string[];
}

export async function mergeImportedServers(
  current: Readonly<Record<string, McpServerConfig>>,
  incoming: Readonly<Record<string, McpServerConfig>>,
  source: ProviderName,
  resolveConflict: ImportConflictResolver,
): Promise<ImportMergeResult> {
  const servers = { ...current };
  const imported: string[] = [];
  const skipped: string[] = [];

  for (const [name, server] of Object.entries(incoming)) {
    const existing = servers[name];
    if (!existing) {
      servers[name] = server;
      imported.push(name);
      continue;
    }
    if (isDeepStrictEqual(existing, server)) {
      skipped.push(name);
      continue;
    }

    const resolution = await resolveConflict({
      name,
      source,
      existing,
      incoming: server,
      occupiedNames: Object.keys(servers),
    });
    if (resolution.action === 'skip') {
      skipped.push(name);
      continue;
    }
    if (resolution.action === 'overwrite') {
      servers[name] = server;
      imported.push(name);
      continue;
    }

    const renamed = ServerNameSchema.parse(resolution.name);
    if (servers[renamed]) throw new Error(`Server "${renamed}" already exists`);
    servers[renamed] = server;
    imported.push(renamed);
  }

  return { servers, imported, skipped };
}
