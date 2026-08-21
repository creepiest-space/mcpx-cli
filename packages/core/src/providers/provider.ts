import type { ConfigScope, McpServerConfig, ProviderName } from '../types/canonical.ts';

export interface ProviderCapabilities {
  project: boolean;
  global: boolean;
}

export interface ProviderMetadata {
  name: ProviderName;
  displayName: string;
  configPath: string;
  globalConfigPath?: string;
  capabilities: ProviderCapabilities;
}

export interface ProviderGenerateContext {
  scope: ConfigScope;
  projectRoot: string;
  existingContent?: string;
}

export interface Provider extends ProviderMetadata {
  generate(
    servers: Readonly<Record<string, McpServerConfig>>,
    context: ProviderGenerateContext,
  ): string;
  cleanup(existingContent: string, context: ProviderGenerateContext): string;
  parse(content: string): Record<string, McpServerConfig>;
  resolveConfigPath(projectRoot: string, scope: ConfigScope): string;
  resolveConfigPaths?(projectRoot: string, scope: ConfigScope): readonly string[];
}

export function providerSupportsScope(provider: ProviderMetadata, scope: ConfigScope): boolean {
  return provider.capabilities[scope];
}

export function resolveProviderConfigPaths(
  provider: Provider,
  projectRoot: string,
  scope: ConfigScope,
): readonly string[] {
  const paths = provider.resolveConfigPaths?.(projectRoot, scope) ?? [
    provider.resolveConfigPath(projectRoot, scope),
  ];

  if (paths.length === 0) {
    throw new Error(`${provider.displayName} did not provide a configuration path`);
  }

  return [...new Set(paths)];
}
