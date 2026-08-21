/* oxlint-disable eslint/no-await-in-loop -- Provider and candidate-path detection preserves registry order. */

import { providerSupportsScope, resolveProviderConfigPaths } from '../providers/provider.ts';
import type { ProviderRegistry } from '../providers/registry.ts';
import type { FileSystem } from '../sync/file-system.ts';
import type { ConfigScope } from '../types/canonical.ts';
import type { DetectionDiagnostic, DetectionReport, DetectionResult } from '../types/results.ts';

export interface ConfigDetectorOptions {
  projectRoot: string;
  scope: ConfigScope;
  registry: ProviderRegistry;
  fileSystem: FileSystem;
}

export class ConfigDetector {
  constructor(private readonly options: ConfigDetectorOptions) {}

  async detectAll(): Promise<DetectionReport> {
    const detections: DetectionResult[] = [];
    const diagnostics: DetectionDiagnostic[] = [];

    for (const provider of this.options.registry.getAll()) {
      if (!providerSupportsScope(provider, this.options.scope)) continue;
      let filePath: string | undefined;

      try {
        const paths = resolveProviderConfigPaths(
          provider,
          this.options.projectRoot,
          this.options.scope,
        );
        filePath = await findExistingPath(paths, this.options.fileSystem);
        if (!filePath) continue;

        const content = await this.options.fileSystem.read(filePath);
        const servers = provider.parse(content);
        detections.push({
          provider: provider.name,
          filePath,
          servers: Object.keys(servers).toSorted(),
        });
      } catch (error) {
        diagnostics.push({
          provider: provider.name,
          ...(filePath && { filePath }),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { detections, diagnostics };
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
