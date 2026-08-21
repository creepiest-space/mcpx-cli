import { resolve } from 'node:path';

import type {
  ConfigScope,
  McpServerConfig,
  Provider,
  ProviderCapabilities,
  ProviderName,
} from '../../src/index.ts';

export class FakeProvider implements Provider {
  readonly displayName: string;
  readonly configPath: string;
  readonly globalConfigPath?: string;
  resolveConfigPaths?: (projectRoot: string, scope: ConfigScope) => readonly string[];

  constructor(
    readonly name: ProviderName,
    readonly capabilities: ProviderCapabilities = { project: true, global: true },
  ) {
    this.displayName = name;
    this.configPath = `.${name}/mcp.json`;
    this.globalConfigPath = `/global/${name}/mcp.json`;
  }

  generate(servers: Readonly<Record<string, McpServerConfig>>): string {
    return `${JSON.stringify({ servers }, null, 2)}\n`;
  }

  cleanup(content: string): string {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (!('servers' in parsed)) return content;
    delete parsed.servers;
    return `${JSON.stringify(parsed, null, 2)}\n`;
  }

  parse(content: string): Record<string, McpServerConfig> {
    const parsed = JSON.parse(content) as { servers?: Record<string, McpServerConfig> };
    if (!parsed.servers) throw new TypeError('missing servers');
    return parsed.servers;
  }

  resolveConfigPath(projectRoot: string, scope: ConfigScope): string {
    return scope === 'global' ? this.globalConfigPath! : resolve(projectRoot, this.configPath);
  }
}
