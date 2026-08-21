import { resolve } from 'node:path';

import { ServerNameSchema } from '@creepiest-space/mcpx-core';
import type {
  ConfigScope,
  McpServerConfig,
  Provider,
  ProviderGenerateContext,
} from '@creepiest-space/mcpx-core';
import { parse as parseToml, stringify as stringifyToml, type TomlTable } from 'smol-toml';

import { getProviderMetadata } from './catalog.ts';
import {
  getObject,
  getString,
  getStringArray,
  getStringRecord,
  isJsonObject,
  parseCanonicalServer,
} from './json/value.ts';
import { getHomeDirectory, resolveProviderPath, type ProviderPathOptions } from './shared/paths.ts';
import { removeTomlTopLevelSection, updateTomlTopLevelSection } from './toml/document.ts';

const CODEX_METADATA = getProviderMetadata('openai-codex');

export class OpenAICodexProvider implements Provider {
  readonly name = CODEX_METADATA.name;
  readonly displayName = CODEX_METADATA.displayName;
  readonly configPath = CODEX_METADATA.configPath;
  readonly globalConfigPath: string;
  readonly capabilities = CODEX_METADATA.capabilities;

  constructor(options: ProviderPathOptions = {}) {
    this.globalConfigPath = resolve(getHomeDirectory(options), '.codex/config.toml');
  }

  generate(
    servers: Readonly<Record<string, McpServerConfig>>,
    context: ProviderGenerateContext,
  ): string {
    const mcpServers: TomlTable = {};
    for (const [name, server] of Object.entries(servers)) {
      if (!server.enabled) continue;
      if (server.transport === 'stdio') {
        mcpServers[name] = {
          command: server.command,
          ...(server.args?.length && { args: server.args }),
          ...(server.env && Object.keys(server.env).length && { env: server.env }),
        };
      } else {
        mcpServers[name] = {
          url: server.url,
          ...(server.headers &&
            Object.keys(server.headers).length && { http_headers: server.headers }),
        };
      }
    }

    if (context.existingContent !== undefined) {
      return updateTomlTopLevelSection(
        context.existingContent,
        'mcp_servers',
        withFinalNewline(stringifyToml({ mcp_servers: mcpServers })),
      );
    }

    return withFinalNewline(stringifyToml({ mcp_servers: mcpServers }));
  }

  cleanup(existingContent: string, _context: ProviderGenerateContext): string {
    return removeTomlTopLevelSection(existingContent, 'mcp_servers');
  }

  parse(content: string): Record<string, McpServerConfig> {
    const root = parseToml(content);
    if (!isJsonObject(root)) throw new TypeError('Expected TOML root to be an object');
    const section = getObject(root, 'mcp_servers') ?? {};
    const servers: Record<string, McpServerConfig> = {};

    for (const [name, value] of Object.entries(section)) {
      ServerNameSchema.parse(name);
      if (!isJsonObject(value)) throw new TypeError(`Expected server ${name} to be an object`);
      const url = getString(value, 'url');
      if (url !== undefined) {
        const headers = getStringRecord(value, 'http_headers');
        servers[name] = parseCanonicalServer({
          enabled: true,
          transport: 'http',
          url,
          ...(headers && { headers }),
        });
      } else {
        const args = getStringArray(value, 'args');
        const env = getStringRecord(value, 'env');
        servers[name] = parseCanonicalServer({
          enabled: true,
          transport: 'stdio',
          command: getString(value, 'command'),
          ...(args && { args }),
          ...(env && { env }),
        });
      }
    }

    return servers;
  }

  resolveConfigPath(projectRoot: string, scope: ConfigScope): string {
    return resolveProviderPath(this, projectRoot, scope);
  }
}

function withFinalNewline(content: string): string {
  return `${content.trimEnd()}\n`;
}
