import { homedir } from 'node:os';
import { resolve } from 'node:path';

import type { ConfigScope, ProviderMetadata } from '@creepiest-space/mcpx-core';

export interface ProviderPathOptions {
  homeDirectory?: string | undefined;
  environment?: Readonly<Record<string, string | undefined>> | undefined;
}

export function getHomeDirectory(options: ProviderPathOptions): string {
  return options.homeDirectory ?? homedir();
}

export function resolveProviderPath(
  metadata: ProviderMetadata,
  projectRoot: string,
  scope: ConfigScope,
): string {
  if (!metadata.capabilities[scope]) {
    throw new Error(`${metadata.displayName} does not support ${scope} configuration`);
  }

  if (scope === 'global') {
    if (!metadata.globalConfigPath) {
      throw new Error(`${metadata.displayName} does not define a global configuration path`);
    }
    return metadata.globalConfigPath;
  }

  return resolve(projectRoot, metadata.configPath);
}
