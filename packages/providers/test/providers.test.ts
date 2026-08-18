import { describe, expect, test } from "bun:test";
import type { McpServerConfig, Provider, ProviderGenerateContext } from "@mcpx/core";
import {
  AntigravityCliProvider,
  ClaudeCodeProvider,
  CopilotCliProvider,
  createProviderRegistry,
  CursorProvider,
  IntellijProvider,
  KimiCliProvider,
  OpenAICodexProvider,
  OpenCodeProvider,
  VscodeProvider,
} from "../src";
import { parseJsoncDocument } from "../src/jsonc/document";

const projectRoot = "/workspace/project";
const homeDirectory = "/users/test";
const context: ProviderGenerateContext = { projectRoot, scope: "project" };

const servers: Record<string, McpServerConfig> = {
  local: {
    enabled: true,
    transport: "stdio",
    command: "npx",
    args: ["-y", "example-server"],
    env: { TOKEN: "secret" },
  },
  remote: {
    enabled: true,
    transport: "http",
    url: "https://example.com/mcp",
    headers: { Authorization: "Bearer token" },
  },
};

function generate(
  provider: Provider,
  input: Readonly<Record<string, McpServerConfig>> = servers,
  existingContent?: string,
  scope: "project" | "global" = "project",
): string {
  return provider.generate(input, { ...context, scope, existingContent });
}

describe("provider registry", () => {
  test("registers all canonical providers in stable order", () => {
    const registry = createProviderRegistry({ homeDirectory, environment: {} });
    expect(registry.getAll().map((provider) => provider.name)).toEqual([
      "claude-code",
      "cursor",
      "antigravity-cli",
      "kimi-cli",
      "openai-codex",
      "opencode",
      "copilot-cli",
      "vscode",
      "intellij",
    ]);
  });
});

describe("JSON provider paths", () => {
  test("resolves injected project and global paths", () => {
    const providers = [
      new ClaudeCodeProvider({ homeDirectory }),
      new CursorProvider({ homeDirectory }),
      new AntigravityCliProvider({ homeDirectory }),
      new KimiCliProvider({ homeDirectory, environment: {} }),
      new CopilotCliProvider({ homeDirectory }),
    ];

    for (const provider of providers) {
      expect(provider.resolveConfigPath(projectRoot, "project")).toStartWith(projectRoot);
      expect(provider.resolveConfigPath(projectRoot, "global")).toStartWith(homeDirectory);
    }
  });

  test("honors KIMI_CODE_HOME", () => {
    const provider = new KimiCliProvider({
      homeDirectory,
      environment: { KIMI_CODE_HOME: "/custom/kimi" },
    });
    expect(provider.resolveConfigPath(projectRoot, "global")).toBe("/custom/kimi/mcp.json");
  });
});

describe("Claude Code", () => {
  const provider = new ClaudeCodeProvider({ homeDirectory });

  test("maps stdio and HTTP servers and roundtrips", () => {
    const output = generate(provider);
    const raw = parseJsoncDocument(output) as { mcpServers: Record<string, unknown> };
    expect(raw.mcpServers.local).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "example-server"],
      env: { TOKEN: "secret" },
    });
    expect(raw.mcpServers.remote).toEqual({
      type: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer token" },
    });
    expect(provider.parse(output)).toEqual(servers);
  });

  test("preserves JSONC comments and unrelated global settings", () => {
    const existing = `{
  // user preference
  "theme": "dark",
  "projects": { "/tmp/demo": { "mcpServers": { "old": {} } } },
  "mcpServers": { "old": { "command": "old" } },
}
`;
    const output = generate(provider, servers, existing, "global");
    expect(output).toContain("// user preference");
    const parsed = parseJsoncDocument(output) as Record<string, unknown>;
    expect(parsed.theme).toBe("dark");
    expect(parsed.projects).toBeDefined();
    expect((parsed.mcpServers as Record<string, unknown>).old).toBeUndefined();
  });
});

describe("Cursor", () => {
  const provider = new CursorProvider({ homeDirectory });

  test("maps stdio and HTTP servers and roundtrips", () => {
    const output = generate(provider);
    const raw = parseJsoncDocument(output) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(raw.mcpServers.local).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "example-server"],
      env: { TOKEN: "secret" },
    });
    expect(raw.mcpServers.remote).toEqual({
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer token" },
    });
    expect(provider.parse(output)).toEqual(servers);
  });

  test("preserves unrelated JSONC settings and omits disabled servers", () => {
    const existing = `{
  // keep user settings
  "theme": "dark",
  "mcpServers": { "old": { "command": "old" } },
}
`;
    const output = generate(
      provider,
      {
        local: servers.local!,
        disabled: { enabled: false, transport: "stdio", command: "bunx" },
      },
      existing,
      "global",
    );
    expect(output).toContain("// keep user settings");
    const raw = parseJsoncDocument(output) as Record<string, unknown>;
    expect(raw.theme).toBe("dark");
    expect((raw.mcpServers as Record<string, unknown>).disabled).toBeUndefined();
    expect((raw.mcpServers as Record<string, unknown>).old).toBeUndefined();
    expect(provider.resolveConfigPath(projectRoot, "project")).toBe(
      "/workspace/project/.cursor/mcp.json",
    );
    expect(provider.resolveConfigPath(projectRoot, "global")).toBe("/users/test/.cursor/mcp.json");
  });
});

describe("provider-specific JSON mappings", () => {
  test("Antigravity uses serverUrl and preserves disabled servers", () => {
    const provider = new AntigravityCliProvider({ homeDirectory });
    const output = generate(provider, {
      disabled: { enabled: false, transport: "http", url: "https://example.com/mcp" },
    });
    const parsed = JSON.parse(output) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers.disabled).toEqual({
      disabled: true,
      serverUrl: "https://example.com/mcp",
    });
    expect(provider.parse(output).disabled?.enabled).toBe(false);
  });

  test("Kimi omits disabled servers", () => {
    const provider = new KimiCliProvider({ homeDirectory, environment: {} });
    const output = generate(provider, {
      disabled: { enabled: false, transport: "stdio", command: "npx" },
    });
    expect(provider.parse(output)).toEqual({});
  });

  test("Copilot emits type and tools", () => {
    const provider = new CopilotCliProvider({ homeDirectory });
    const output = generate(provider, { local: servers.local! });
    const parsed = JSON.parse(output) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers.local).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "example-server"],
      env: { TOKEN: "secret" },
      tools: ["*"],
    });
  });

  test("VS Code maps HTTP to sse and rejects global scope", () => {
    const provider = new VscodeProvider();
    const output = generate(provider, { remote: servers.remote! });
    const parsed = JSON.parse(output) as { servers: Record<string, { type: string }> };
    expect(parsed.servers.remote?.type).toBe("sse");
    expect(provider.parse(output).remote?.transport).toBe("http");
    expect(() => provider.resolveConfigPath(projectRoot, "global")).toThrow();
  });

  test("IntelliJ infers transport without a type field", () => {
    const provider = new IntellijProvider();
    const output = generate(provider);
    const parsed = JSON.parse(output) as { mcpServers: Record<string, Record<string, unknown>> };
    expect(parsed.mcpServers.local?.type).toBeUndefined();
    expect(provider.parse(output)).toEqual(servers);
  });
});

describe("OpenCode", () => {
  const provider = new OpenCodeProvider({ homeDirectory });

  test("maps command arrays, environment, remote type, and disabled state", () => {
    const output = generate(provider, {
      ...servers,
      disabled: { enabled: false, transport: "stdio", command: "bunx", args: ["server"] },
    });
    const raw = JSON.parse(output) as { mcp: Record<string, Record<string, unknown>> };
    expect(raw.mcp.local?.command).toEqual(["npx", "-y", "example-server"]);
    expect(raw.mcp.local?.environment).toEqual({ TOKEN: "secret" });
    expect(raw.mcp.remote?.type).toBe("remote");
    expect(raw.mcp.disabled?.enabled).toBe(false);
    expect(provider.parse(output).disabled?.enabled).toBe(false);
  });

  test("preserves existing JSONC settings and comments", () => {
    const existing = `{
  // keep
  "$schema": "https://opencode.ai/config.json",
  "theme": "dark",
  "mcp": { "old": { "type": "local", "command": ["old"] } },
}
`;
    const output = generate(provider, servers, existing);
    expect(output).toContain("// keep");
    const parsed = parseJsoncDocument(output) as Record<string, unknown>;
    expect(parsed.theme).toBe("dark");
    expect((parsed.mcp as Record<string, unknown>).old).toBeUndefined();
  });

  test("exposes JSONC and JSON global candidates", () => {
    expect(provider.resolveConfigPaths(projectRoot, "global")).toEqual([
      "/users/test/.config/opencode/opencode.jsonc",
      "/users/test/.config/opencode/opencode.json",
    ]);
  });
});

describe("OpenAI Codex", () => {
  const provider = new OpenAICodexProvider({ homeDirectory });

  test("generates and parses stdio and HTTP TOML", () => {
    const output = generate(provider);
    expect(output).toContain("[mcp_servers.local]");
    expect(output).toContain('command = "npx"');
    expect(output).toContain("[mcp_servers.remote.http_headers]");
    expect(provider.parse(output)).toEqual(servers);
  });

  test("preserves unrelated settings while replacing mcp_servers", () => {
    const existing = `model = "o4-mini"

[mcp_servers.old]
command = "old"
`;
    const output = generate(provider, { local: servers.local! }, existing);
    expect(output).toContain('model = "o4-mini"');
    expect(output).toContain("[mcp_servers.local]");
    expect(output).not.toContain("mcp_servers.old");
  });

  test("falls back to a fresh document for invalid TOML", () => {
    const output = generate(provider, { local: servers.local! }, "invalid {{{");
    expect(output).toContain("[mcp_servers.local]");
  });
});

describe("provider parsing validation", () => {
  test("rejects malformed server structures", () => {
    const provider = new ClaudeCodeProvider({ homeDirectory });
    expect(() => provider.parse('{ "mcpServers": { "bad": { "type": "stdio" } } }')).toThrow();
  });

  test("rejects non-canonical server names", () => {
    const provider = new ClaudeCodeProvider({ homeDirectory });
    expect(() =>
      provider.parse('{ "mcpServers": { "bad server": { "command": "npx" } } }'),
    ).toThrow();
  });
});
