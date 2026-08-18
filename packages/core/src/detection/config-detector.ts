import { providerSupportsScope, resolveProviderConfigPaths } from "../providers/provider.ts";
import type { ProviderRegistry } from "../providers/registry.ts";
import type { FileSystem } from "../sync/file-system.ts";
import type { ConfigScope } from "../types/canonical.ts";
import type { DetectionResult } from "../types/results.ts";

export interface ConfigDetectorOptions {
  projectRoot: string;
  scope: ConfigScope;
  registry: ProviderRegistry;
  fileSystem: FileSystem;
}

export class ConfigDetector {
  constructor(private readonly options: ConfigDetectorOptions) {}

  async detectAll(): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    for (const provider of this.options.registry.getAll()) {
      if (!providerSupportsScope(provider, this.options.scope)) continue;

      try {
        const paths = resolveProviderConfigPaths(
          provider,
          this.options.projectRoot,
          this.options.scope,
        );
        const filePath = await findExistingPath(paths, this.options.fileSystem);
        if (!filePath) continue;

        const content = await this.options.fileSystem.read(filePath);
        const servers = provider.parse(content);
        results.push({
          provider: provider.name,
          filePath,
          servers: Object.keys(servers).sort(),
        });
      } catch {
        // A malformed provider file must not prevent detection of other tools.
      }
    }

    return results;
  }
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
