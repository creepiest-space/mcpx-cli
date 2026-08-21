import type { ProviderMetadata, ProviderName } from '@creepiest-space/mcpx-core';

export const providerCatalog = [
  {
    name: 'claude-code',
    displayName: 'Claude Code',
    configPath: '.mcp.json',
    globalConfigPath: '~/.claude.json',
    capabilities: { project: true, global: true },
  },
  {
    name: 'cursor',
    displayName: 'Cursor',
    configPath: '.cursor/mcp.json',
    globalConfigPath: '~/.cursor/mcp.json',
    capabilities: { project: true, global: true },
  },
  {
    name: 'antigravity-cli',
    displayName: 'Antigravity CLI',
    configPath: '.agents/mcp_config.json',
    globalConfigPath: '~/.gemini/config/mcp_config.json',
    capabilities: { project: true, global: true },
  },
  {
    name: 'kimi-cli',
    displayName: 'Kimi CLI',
    configPath: '.kimi-code/mcp.json',
    globalConfigPath: '~/.kimi-code/mcp.json',
    capabilities: { project: true, global: true },
  },
  {
    name: 'openai-codex',
    displayName: 'OpenAI Codex',
    configPath: '.codex/config.toml',
    globalConfigPath: '~/.codex/config.toml',
    capabilities: { project: true, global: true },
  },
  {
    name: 'opencode',
    displayName: 'OpenCode',
    configPath: 'opencode.json',
    globalConfigPath: '~/.config/opencode/opencode.jsonc',
    capabilities: { project: true, global: true },
  },
  {
    name: 'copilot-cli',
    displayName: 'GitHub Copilot CLI',
    configPath: '.github/mcp.json',
    globalConfigPath: '~/.copilot/mcp-config.json',
    capabilities: { project: true, global: true },
  },
  {
    name: 'vscode',
    displayName: 'VS Code',
    configPath: '.vscode/mcp.json',
    capabilities: { project: true, global: false },
  },
  {
    name: 'intellij',
    displayName: 'IntelliJ IDEA',
    configPath: '.idea/mcp.json',
    capabilities: { project: true, global: false },
  },
] as const satisfies readonly ProviderMetadata[];

export function getProviderMetadata(name: ProviderName): ProviderMetadata {
  const metadata = providerCatalog.find((provider) => provider.name === name);
  if (!metadata) throw new Error(`Provider metadata for "${name}" not found`);
  return metadata;
}
