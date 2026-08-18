import { resolve } from "node:path";
import { parse as parseToml, stringify as stringifyToml, type TomlTable } from "smol-toml";
import { ServerNameSchema } from "@mcpx/core";
import type { ConfigScope, McpServerConfig, Provider, ProviderGenerateContext } from "@mcpx/core";
import {
  getObject,
  getString,
  getStringArray,
  getStringRecord,
  isJsonObject,
  parseCanonicalServer,
} from "./json/value.ts";
import { getHomeDirectory, resolveProviderPath, type ProviderPathOptions } from "./shared/paths.ts";

export class OpenAICodexProvider implements Provider {
  readonly name = "openai-codex" as const;
  readonly displayName = "OpenAI Codex";
  readonly configPath = ".codex/config.toml";
  readonly globalConfigPath: string;
  readonly capabilities = { project: true, global: true } as const;

  constructor(options: ProviderPathOptions = {}) {
    this.globalConfigPath = resolve(getHomeDirectory(options), ".codex/config.toml");
  }

  generate(
    servers: Readonly<Record<string, McpServerConfig>>,
    context: ProviderGenerateContext,
  ): string {
    const mcpServers: TomlTable = {};
    for (const [name, server] of Object.entries(servers)) {
      if (!server.enabled) continue;
      if (server.transport === "stdio") {
        mcpServers[name] = {
          command: server.command,
          ...(server.args?.length && { args: server.args }),
          ...(server.env && Object.keys(server.env).length && { env: server.env }),
        };
      } else {
        mcpServers[name] = {
          url: server.url,
          ...(server.headers &&
            Object.keys(server.headers).length && { http_headers: server.headers }),
        };
      }
    }

    if (context.existingContent !== undefined) {
      try {
        const existing = parseToml(context.existingContent);
        if (!isJsonObject(existing)) throw new TypeError("Expected TOML root to be an object");
        existing["mcp_servers"] = mcpServers;
        return withFinalNewline(stringifyToml(existing));
      } catch {
        // Invalid existing TOML is replaced with a valid MCP-only document.
      }
    }

    return withFinalNewline(stringifyToml({ mcp_servers: mcpServers }));
  }

  parse(content: string): Record<string, McpServerConfig> {
    const root = parseToml(content);
    if (!isJsonObject(root)) throw new TypeError("Expected TOML root to be an object");
    const section = getObject(root, "mcp_servers") ?? {};
    const servers: Record<string, McpServerConfig> = {};

    for (const [name, value] of Object.entries(section)) {
      ServerNameSchema.parse(name);
      if (!isJsonObject(value)) throw new TypeError(`Expected server ${name} to be an object`);
      const url = getString(value, "url");
      if (url !== undefined) {
        const headers = getStringRecord(value, "http_headers");
        servers[name] = parseCanonicalServer({
          enabled: true,
          transport: "http",
          url,
          ...(headers && { headers }),
        });
      } else {
        const args = getStringArray(value, "args");
        const env = getStringRecord(value, "env");
        servers[name] = parseCanonicalServer({
          enabled: true,
          transport: "stdio",
          command: getString(value, "command"),
          ...(args && { args }),
          ...(env && { env }),
        });
      }
    }

    return servers;
  }

  resolveConfigPath(projectRoot: string, scope: ConfigScope): string {
    return resolveProviderPath(this, projectRoot, scope);
  }
}

function withFinalNewline(content: string): string {
  return `${content.trimEnd()}\n`;
}
