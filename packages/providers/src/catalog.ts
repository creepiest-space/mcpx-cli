import type { ProviderMetadata } from "@mcpx/core";

export const providerCatalog = [
  {
    name: "claude-code",
    displayName: "Claude Code",
    configPath: ".mcp.json",
    globalConfigPath: "~/.claude.json",
    capabilities: { project: true, global: true },
  },
  {
    name: "cursor",
    displayName: "Cursor",
    configPath: ".cursor/mcp.json",
    globalConfigPath: "~/.cursor/mcp.json",
    capabilities: { project: true, global: true },
  },
  {
    name: "antigravity-cli",
    displayName: "Antigravity CLI",
    configPath: ".gemini/config/mcp_config.json",
    globalConfigPath: "~/.gemini/config/mcp_config.json",
    capabilities: { project: true, global: true },
  },
  {
    name: "kimi-cli",
    displayName: "Kimi CLI",
    configPath: ".kimi-code/mcp.json",
    globalConfigPath: "~/.kimi-code/mcp.json",
    capabilities: { project: true, global: true },
  },
  {
    name: "openai-codex",
    displayName: "OpenAI Codex",
    configPath: ".codex/config.toml",
    globalConfigPath: "~/.codex/config.toml",
    capabilities: { project: true, global: true },
  },
  {
    name: "opencode",
    displayName: "OpenCode",
    configPath: "opencode.json",
    globalConfigPath: "~/.config/opencode/opencode.jsonc",
    capabilities: { project: true, global: true },
  },
  {
    name: "copilot-cli",
    displayName: "GitHub Copilot CLI",
    configPath: ".copilot/mcp-config.json",
    globalConfigPath: "~/.copilot/mcp-config.json",
    capabilities: { project: true, global: true },
  },
  {
    name: "vscode",
    displayName: "VS Code",
    configPath: ".vscode/mcp.json",
    capabilities: { project: true, global: false },
  },
  {
    name: "intellij",
    displayName: "IntelliJ IDEA",
    configPath: ".idea/mcp.json",
    capabilities: { project: true, global: false },
  },
] as const satisfies readonly ProviderMetadata[];
