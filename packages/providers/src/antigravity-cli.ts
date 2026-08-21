import { resolve } from 'node:path';

import type { McpServerConfig } from '@creepiest-space/mcpx-core';

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

export class AntigravityCliProvider extends JsonSectionProvider {
  constructor(options: ProviderPathOptions = {}) {
    super(
      {
        ...getProviderMetadata('antigravity-cli'),
        globalConfigPath: resolve(getHomeDirectory(options), '.gemini/config/mcp_config.json'),
      },
      'mcpServers',
    );
  }

  protected encodeServer(server: McpServerConfig): JsonObject {
    if (server.transport === 'stdio') {
      return {
        ...(!server.enabled && { disabled: true }),
        command: server.command,
        ...(server.args?.length && { args: server.args }),
        ...(server.env && Object.keys(server.env).length && { env: server.env }),
      };
    }
    return {
      ...(!server.enabled && { disabled: true }),
      serverUrl: server.url,
      ...(server.headers && Object.keys(server.headers).length && { headers: server.headers }),
    };
  }

  protected decodeServer(raw: JsonObject): McpServerConfig {
    const serverUrl = getString(raw, 'serverUrl');
    if (serverUrl !== undefined) {
      const headers = getStringRecord(raw, 'headers');
      return parseCanonicalServer({
        enabled: getBoolean(raw, 'disabled') !== true,
        transport: 'http',
        url: serverUrl,
        ...(headers && { headers }),
      });
    }
    const args = getStringArray(raw, 'args');
    const env = getStringRecord(raw, 'env');
    return parseCanonicalServer({
      enabled: getBoolean(raw, 'disabled') !== true,
      transport: 'stdio',
      command: getString(raw, 'command'),
      ...(args && { args }),
      ...(env && { env }),
    });
  }
}
