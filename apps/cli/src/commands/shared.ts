import {
  ConfigStore,
  syncAllProviders,
  type McpConfigFile,
  type Provider,
  type SyncResult,
} from "@mcpx/core";
import type { CliContext } from "../context.ts";

export async function openStore(ctx: CliContext): Promise<ConfigStore> {
  return ConfigStore.open({
    projectRoot: ctx.projectRoot,
    scope: ctx.scope,
    homeDirectory: ctx.homeDirectory,
    fileSystem: ctx.fileSystem,
  });
}

export async function loadStore(
  ctx: CliContext,
): Promise<{ store: ConfigStore; config: McpConfigFile } | undefined> {
  const store = await openStore(ctx);
  if (!(await store.exists())) {
    ctx.output.warning(`No ${store.getDisplayPath()} found.`);
    ctx.output.info('Run "mcpx init" to create a configuration.');
    return undefined;
  }

  return { store, config: await store.load() };
}

export function providersForScope(
  ctx: CliContext,
  scope: "project" | "global",
  names: McpConfigFile["providers"],
): Provider[] {
  return ctx.registry.getByNames(names).filter((provider) => provider.capabilities[scope]);
}

export async function syncConfig(
  ctx: CliContext,
  store: ConfigStore,
  config: McpConfigFile,
): Promise<SyncResult[]> {
  return syncAllProviders(
    providersForScope(ctx, store.scope, config.providers),
    config.servers,
    { projectRoot: ctx.projectRoot, scope: store.scope },
    ctx.fileSystem,
  );
}

export function printSyncResults(ctx: CliContext, results: readonly SyncResult[]): void {
  for (const result of results) {
    switch (result.status) {
      case "created":
        ctx.output.success(`${result.filePath} (created)`);
        break;
      case "updated":
        ctx.output.success(`${result.filePath} (updated)`);
        break;
      case "unchanged":
        ctx.output.info(`${result.filePath} (unchanged)`);
        break;
      case "deleted":
        ctx.output.warning(`${result.filePath} (removed)`);
        break;
      case "error":
        ctx.output.error(`${result.filePath}: ${result.error ?? "unknown error"}`);
        break;
    }
  }
}
