import { homedir } from 'node:os';
import { resolve } from 'node:path';

import type { FileSystem } from '../sync/index.ts';
import {
  type ConfigScope,
  McpConfigFileSchema,
  type McpConfigFile,
  type McpServerConfig,
  type ProviderName,
} from '../types/index.ts';
import {
  GLOBAL_CONFIG_DISPLAY_PATH,
  getCanonicalConfigPath,
  getGlobalConfigPath,
  getProjectConfigPath,
  PROJECT_CONFIG_DISPLAY_PATH,
} from './paths.ts';

export interface ConfigStoreOptions {
  projectRoot: string;
  fileSystem: FileSystem;
  scope?: ConfigScope | undefined;
  homeDirectory?: string | undefined;
}

interface ResolvedConfigStoreOptions extends ConfigStoreOptions {
  scope: ConfigScope;
  homeDirectory: string;
}

export class ConfigStore {
  readonly scope: ConfigScope;
  readonly #fileSystem: FileSystem;
  readonly #configPath: string;

  private constructor(options: ResolvedConfigStoreOptions) {
    this.scope = options.scope;
    this.#fileSystem = options.fileSystem;
    this.#configPath = getCanonicalConfigPath(
      options.projectRoot,
      options.scope,
      options.homeDirectory,
    );
  }

  static async open(options: ConfigStoreOptions): Promise<ConfigStore> {
    const homeDirectory = options.homeDirectory ?? homedir();
    const scope =
      options.scope ??
      (await detectConfigScope(options.projectRoot, options.fileSystem, homeDirectory));
    return new ConfigStore({ ...options, homeDirectory, scope });
  }

  exists(): Promise<boolean> {
    return this.#fileSystem.exists(this.#configPath);
  }

  getPath(): string {
    return this.#configPath;
  }

  getDisplayPath(): string {
    return this.scope === 'global' ? GLOBAL_CONFIG_DISPLAY_PATH : PROJECT_CONFIG_DISPLAY_PATH;
  }

  async load(): Promise<McpConfigFile> {
    try {
      const content = await this.#fileSystem.read(this.#configPath);
      return McpConfigFileSchema.parse(JSON.parse(content) as unknown);
    } catch (error) {
      throw new ConfigFileError(this.#configPath, 'read', error);
    }
  }

  async save(config: McpConfigFile): Promise<McpConfigFile> {
    try {
      const validated = McpConfigFileSchema.parse(config);
      const normalized = normalizeConfig(validated);
      await this.#fileSystem.write(this.#configPath, `${JSON.stringify(normalized, null, 2)}\n`);
      return normalized;
    } catch (error) {
      throw new ConfigFileError(this.#configPath, 'write', error);
    }
  }

  async createEmpty(providers: readonly ProviderName[] = []): Promise<McpConfigFile> {
    return this.save({ version: 1, providers: [...providers], servers: {} });
  }

  async addServer(name: string, server: McpServerConfig): Promise<McpConfigFile> {
    const config = await this.load();
    config.servers[name] = server;
    return this.save(config);
  }

  async removeServer(name: string): Promise<McpConfigFile> {
    const config = await this.load();
    delete config.servers[name];
    return this.save(config);
  }

  async setProviders(providers: readonly ProviderName[]): Promise<McpConfigFile> {
    const config = await this.load();
    config.providers = [...providers];
    return this.save(config);
  }

  async getServers(): Promise<Record<string, McpServerConfig>> {
    return (await this.load()).servers;
  }

  async getProviders(): Promise<ProviderName[]> {
    return (await this.load()).providers;
  }
}

export class ConfigFileError extends Error {
  constructor(
    readonly filePath: string,
    operation: 'read' | 'write',
    override readonly cause: unknown,
  ) {
    super(`Could not ${operation} canonical configuration ${filePath}: ${errorMessage(cause)}`, {
      cause,
    });
    this.name = 'ConfigFileError';
  }
}

export async function detectConfigScope(
  projectRoot: string,
  fileSystem: FileSystem,
  homeDirectory = homedir(),
): Promise<ConfigScope> {
  if (resolve(projectRoot) === resolve(homeDirectory)) return 'global';
  if (await fileSystem.exists(getProjectConfigPath(projectRoot))) return 'project';
  if (await fileSystem.exists(getGlobalConfigPath(homeDirectory))) return 'global';
  return 'project';
}

export function normalizeConfig(config: McpConfigFile): McpConfigFile {
  const providers = [...new Set(config.providers)].toSorted();
  const servers = Object.fromEntries(
    Object.entries(config.servers)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([name, server]) => [name, normalizeServer(server)]),
  );

  return { version: 1, providers, servers };
}

function normalizeServer(server: McpServerConfig): McpServerConfig {
  if (server.transport === 'stdio') {
    return {
      enabled: server.enabled,
      transport: 'stdio',
      command: server.command,
      ...(server.args !== undefined && { args: [...server.args] }),
      ...(server.env !== undefined && { env: sortRecord(server.env) }),
    };
  }

  return {
    enabled: server.enabled,
    transport: 'http',
    url: server.url,
    ...(server.headers !== undefined && { headers: sortRecord(server.headers) }),
  };
}

function sortRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).toSorted(([left], [right]) => left.localeCompare(right)),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
