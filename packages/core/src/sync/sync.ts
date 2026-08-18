import type { ConfigScope, McpServerConfig } from "../types/canonical.ts";
import {
  providerSupportsScope,
  resolveProviderConfigPaths,
  type Provider,
} from "../providers/provider.ts";
import type { SyncResult } from "../types/results.ts";
import type { FileSystem } from "./file-system.ts";

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
    const content = provider.generate(servers, { ...context, existingContent });

    if (existingContent === content) {
      return { provider: provider.name, filePath, status: "unchanged" };
    }

    await fileSystem.write(filePath, content);
    return { provider: provider.name, filePath, status: exists ? "updated" : "created" };
  } catch (error) {
    return {
      provider: provider.name,
      filePath,
      status: "error",
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
  const results: SyncResult[] = [];

  for (const provider of providers) {
    let filePath = provider.configPath;

    try {
      if (!providerSupportsScope(provider, context.scope)) {
        throw new Error(`${provider.displayName} does not support ${context.scope} configuration`);
      }

      const paths = resolveProviderConfigPaths(provider, context.projectRoot, context.scope);
      for (const path of paths) {
        filePath = path;
        if (await fileSystem.remove(path)) {
          results.push({ provider: provider.name, filePath: path, status: "deleted" });
        }
      }
    } catch (error) {
      results.push({
        provider: provider.name,
        filePath,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
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
