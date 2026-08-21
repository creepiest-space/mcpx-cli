import { resolve } from 'node:path';

import type { ConfigScope, McpServerConfig } from '@creepiest-space/mcpx-core';

import { getProviderMetadata } from './catalog.ts';
import { JsonSectionProvider } from './json/json-section-provider.ts';
import {
  getBoolean,
  getString,
  getStringArray,
  getStringRecord,
  parseCanonicalServer,
  type JsonObject,
} from './json/value.ts';
import { getHomeDirectory, type ProviderPathOptions } from './shared/paths.ts';

const OPEN_CODE_SCHEMA = 'https://opencode.ai/config.json';

export class OpenCodeProvider extends JsonSectionProvider {
  readonly #globalJsonPath: string;

  constructor(options: ProviderPathOptions = {}) {
    const directory = resolve(getHomeDirectory(options), '.config/opencode');
    const globalJsoncPath = resolve(directory, 'opencode.jsonc');
    super(
      {
        ...getProviderMetadata('opencode'),
        globalConfigPath: globalJsoncPath,
      },
      'mcp',
    );
    this.#globalJsonPath = resolve(directory, 'opencode.json');
  }

  resolveConfigPaths(projectRoot: string, scope: ConfigScope): readonly string[] {
    if (scope === 'project') return [this.resolveConfigPath(projectRoot, scope)];
    return [this.globalConfigPath!, this.#globalJsonPath];
  }

  protected override createDocument(section: Record<string, unknown>): JsonObject {
    return { $schema: OPEN_CODE_SCHEMA, mcp: section };
  }

  protected encodeServer(server: McpServerConfig): JsonObject {
    if (server.transport === 'stdio') {
      return {
        enabled: server.enabled,
        type: 'local',
        command: [server.command, ...(server.args ?? [])],
        ...(server.env && Object.keys(server.env).length && { environment: server.env }),
      };
    }
    return {
      enabled: server.enabled,
      type: 'remote',
      url: server.url,
      ...(server.headers && Object.keys(server.headers).length && { headers: server.headers }),
    };
  }

  protected decodeServer(raw: JsonObject): McpServerConfig {
    const type = getString(raw, 'type');
    const enabled = getBoolean(raw, 'enabled') !== false;
    if (type === 'remote') {
      const headers = getStringRecord(raw, 'headers');
      return parseCanonicalServer({
        enabled,
        transport: 'http',
        url: getString(raw, 'url'),
        ...(headers && { headers }),
      });
    }

    const command = getStringArray(raw, 'command');
    const environment = getStringRecord(raw, 'environment');
    return parseCanonicalServer({
      enabled,
      transport: 'stdio',
      command: command?.[0],
      ...(command && command.length > 1 && { args: command.slice(1) }),
      ...(environment && { env: environment }),
    });
  }
}
