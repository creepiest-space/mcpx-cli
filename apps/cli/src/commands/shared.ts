import { resolve } from 'node:path';

import {
  ConfigStore,
  providerSupportsScope,
  syncAllProviders,
  type ConfigScope,
  type DetectionDiagnostic,
  type McpConfigFile,
  type Provider,
  type SyncResult,
} from '@creepiest-space/mcpx-core';

import type { CliContext } from '../context.ts';

export type StoreAccess = 'read' | 'write';

export async function openStore(
  ctx: CliContext,
  access: StoreAccess = 'read',
): Promise<ConfigStore> {
  return ConfigStore.open({
    projectRoot: ctx.projectRoot,
    scope: resolveStoreScope(ctx, access),
    homeDirectory: ctx.homeDirectory,
    fileSystem: ctx.fileSystem,
  });
}

export async function loadStore(
  ctx: CliContext,
  access: StoreAccess = 'read',
): Promise<{ store: ConfigStore; config: McpConfigFile } | undefined> {
  const store = await openStore(ctx, access);
  if (!(await store.exists())) {
    ctx.output.warning(`No ${store.getDisplayPath()} found.`);
    ctx.output.info('Run "mcpx init" to create a configuration.');
    return undefined;
  }

  const config = await store.load();
  if (access === 'write') {
    const resolution = resolveProvidersForScope(ctx, store.scope, config.providers);
    if (resolution.errors.length > 0) {
      printSyncResults(ctx, resolution.errors);
      return undefined;
    }
  }

  return { store, config };
}

export function resolveProvidersForScope(
  ctx: CliContext,
  scope: 'project' | 'global',
  names: McpConfigFile['providers'],
): { providers: Provider[]; errors: SyncResult[] } {
  const providers: Provider[] = [];
  const errors: SyncResult[] = [];

  for (const name of names) {
    const provider = ctx.registry.get(name);
    if (!provider) {
      errors.push({ provider: name, filePath: name, status: 'error', error: 'not registered' });
      continue;
    }
    if (!providerSupportsScope(provider, scope)) {
      errors.push({
        provider: name,
        filePath: provider.globalConfigPath ?? provider.configPath,
        status: 'error',
        error: `${provider.displayName} does not support ${scope} configuration`,
      });
      continue;
    }
    providers.push(provider);
  }

  return { providers, errors };
}

export async function syncConfig(
  ctx: CliContext,
  store: ConfigStore,
  config: McpConfigFile,
): Promise<SyncResult[]> {
  const resolution = resolveProvidersForScope(ctx, store.scope, config.providers);
  if (resolution.errors.length > 0) return resolution.errors;
  return syncAllProviders(
    resolution.providers,
    config.servers,
    { projectRoot: ctx.projectRoot, scope: store.scope },
    ctx.fileSystem,
  );
}

export function syncHasErrors(results: readonly SyncResult[]): boolean {
  return results.some((result) => result.status === 'error');
}

export function printDetectionDiagnostics(
  ctx: CliContext,
  diagnostics: readonly DetectionDiagnostic[],
): void {
  if (diagnostics.length === 0) return;
  ctx.output.warning(
    `${diagnostics.length} provider configuration(s) could not be inspected. Use --verbose for details.`,
  );
  for (const diagnostic of diagnostics) {
    ctx.output.debug(
      `${diagnostic.provider}${diagnostic.filePath ? ` (${diagnostic.filePath})` : ''}: ${diagnostic.error}`,
    );
  }
}

function resolveStoreScope(ctx: CliContext, access: StoreAccess): ConfigScope | undefined {
  if (ctx.scope) return ctx.scope;
  if (access === 'read') return undefined;
  return resolve(ctx.projectRoot) === resolve(ctx.homeDirectory) ? 'global' : 'project';
}

export function printSyncResults(ctx: CliContext, results: readonly SyncResult[]): void {
  for (const result of results) {
    switch (result.status) {
      case 'created':
        ctx.output.success(`${result.filePath} (created)`);
        break;
      case 'updated':
        ctx.output.success(`${result.filePath} (updated)`);
        break;
      case 'unchanged':
        ctx.output.info(`${result.filePath} (unchanged)`);
        break;
      case 'cleaned':
        ctx.output.warning(`${result.filePath} (managed MCP configuration removed)`);
        break;
      case 'error':
        ctx.output.error(`${result.filePath}: ${result.error ?? 'unknown error'}`);
        break;
    }
  }
}
