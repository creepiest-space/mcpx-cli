import { resolve } from 'node:path';

import type { McpServerConfig } from '@creepiest-space/mcpx-core';

import { getProviderMetadata } from './catalog.ts';
import { JsonSectionProvider } from './json/json-section-provider.ts';
import {
  getString,
  getStringArray,
  getStringRecord,
  parseCanonicalServer,
  type JsonObject,
} from './json/value.ts';
import { getHomeDirectory, type ProviderPathOptions } from './shared/paths.ts';

export class CursorProvider extends JsonSectionProvider {
  constructor(options: ProviderPathOptions = {}) {
    super(
      {
        ...getProviderMetadata('cursor'),
        globalConfigPath: resolve(getHomeDirectory(options), '.cursor/mcp.json'),
      },
      'mcpServers',
    );
  }

  protected encodeServer(server: McpServerConfig): JsonObject | undefined {
    if (!server.enabled) return undefined;
    if (server.transport === 'stdio') {
      return {
        type: 'stdio',
        command: server.command,
        ...(server.args?.length && { args: server.args }),
        ...(server.env && Object.keys(server.env).length && { env: server.env }),
      };
    }
    return {
      url: server.url,
      ...(server.headers && Object.keys(server.headers).length && { headers: server.headers }),
    };
  }

  protected decodeServer(raw: JsonObject): McpServerConfig {
    const url = getString(raw, 'url');
    if (url !== undefined) {
      const headers = getStringRecord(raw, 'headers');
      return parseCanonicalServer({
        enabled: true,
        transport: 'http',
        url,
        ...(headers && { headers }),
      });
    }

    const args = getStringArray(raw, 'args');
    const env = getStringRecord(raw, 'env');
    return parseCanonicalServer({
      enabled: true,
      transport: 'stdio',
      command: getString(raw, 'command'),
      ...(args && { args }),
      ...(env && { env }),
    });
  }
}
