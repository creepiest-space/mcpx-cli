/* oxlint-disable eslint/no-await-in-loop -- Cleanup writes and rollback are intentionally transactional. */

import {
  providerSupportsScope,
  resolveProviderConfigPaths,
  type Provider,
} from '../providers/provider.ts';
import type { ConfigScope, McpServerConfig } from '../types/canonical.ts';
import type { SyncResult } from '../types/results.ts';
import type { FileSystem } from './file-system.ts';

export interface SyncContext {
  projectRoot: string;
  scope: ConfigScope;
}

export async function syncProvider(
  provider: Provider,
  servers: Readonly<Record<string, McpServerConfig>>,
  context: SyncContext,
  fileSystem: FileSystem,
): Promise<SyncResult> {
  let filePath = provider.configPath;

  try {
    if (!providerSupportsScope(provider, context.scope)) {
      throw new Error(`${provider.displayName} does not support ${context.scope} configuration`);
    }

    const paths = resolveProviderConfigPaths(provider, context.projectRoot, context.scope);
    filePath = (await findExistingPath(paths, fileSystem)) ?? paths[0]!;
    const exists = await fileSystem.exists(filePath);
    const existingContent = exists ? await fileSystem.read(filePath) : undefined;
    const content = provider.generate(servers, {
      ...context,
      ...(existingContent === undefined ? {} : { existingContent }),
    });

    if (existingContent === content) {
      return { provider: provider.name, filePath, status: 'unchanged' };
    }

    await fileSystem.write(filePath, content);
    return { provider: provider.name, filePath, status: exists ? 'updated' : 'created' };
  } catch (error) {
    return {
      provider: provider.name,
      filePath,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function syncAllProviders(
  providers: readonly Provider[],
  servers: Readonly<Record<string, McpServerConfig>>,
  context: SyncContext,
  fileSystem: FileSystem,
): Promise<SyncResult[]> {
  return Promise.all(
    providers.map((provider) => syncProvider(provider, servers, context, fileSystem)),
  );
}

export async function cleanupRemovedProviders(
  providers: readonly Provider[],
  context: SyncContext,
  fileSystem: FileSystem,
): Promise<SyncResult[]> {
  const plan: CleanupPlanEntry[] = [];
  const errors: SyncResult[] = [];

  for (const provider of providers) {
    let filePath = provider.configPath;

    try {
      if (!providerSupportsScope(provider, context.scope)) {
        throw new Error(`${provider.displayName} does not support ${context.scope} configuration`);
      }

      const paths = resolveProviderConfigPaths(provider, context.projectRoot, context.scope);
      for (const path of paths) {
        filePath = path;
        if (!(await fileSystem.exists(path))) continue;

        const existingContent = await fileSystem.read(path);
        const content = provider.cleanup(existingContent, context);
        plan.push({ provider, filePath: path, existingContent, content });
      }
    } catch (error) {
      errors.push({
        provider: provider.name,
        filePath,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (errors.length > 0) return errors;

  const committed: CleanupPlanEntry[] = [];
  for (const entry of plan) {
    if (entry.content === entry.existingContent) continue;

    try {
      await fileSystem.write(entry.filePath, entry.content);
      committed.push(entry);
    } catch (error) {
      const rollbackErrors = await rollbackCleanup([...committed, entry], fileSystem);
      return [
        {
          provider: entry.provider.name,
          filePath: entry.filePath,
          status: 'error',
          error: [errorMessage(error), ...rollbackErrors].join('; '),
        },
      ];
    }
  }

  return plan.map((entry) => ({
    provider: entry.provider.name,
    filePath: entry.filePath,
    status: entry.content === entry.existingContent ? 'unchanged' : 'cleaned',
  }));
}

interface CleanupPlanEntry {
  provider: Provider;
  filePath: string;
  existingContent: string;
  content: string;
}

async function rollbackCleanup(
  entries: readonly CleanupPlanEntry[],
  fileSystem: FileSystem,
): Promise<string[]> {
  const errors: string[] = [];
  for (const entry of entries.toReversed()) {
    try {
      await fileSystem.write(entry.filePath, entry.existingContent);
    } catch (error) {
      errors.push(`rollback failed for ${entry.filePath}: ${errorMessage(error)}`);
    }
  }
  return errors;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function findExistingPath(
  paths: readonly string[],
  fileSystem: FileSystem,
): Promise<string | undefined> {
  for (const path of paths) {
    if (await fileSystem.exists(path)) return path;
  }
  return undefined;
}
