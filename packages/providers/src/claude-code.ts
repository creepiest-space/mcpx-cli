import { resolve } from "node:path";
import type { McpServerConfig } from "@mcpx/core";
import { JsonSectionProvider } from "./json/json-section-provider.ts";
import {
  getString,
  getStringArray,
  getStringRecord,
  parseCanonicalServer,
  type JsonObject,
} from "./json/value.ts";
import { getHomeDirectory, type ProviderPathOptions } from "./shared/paths.ts";

export class ClaudeCodeProvider extends JsonSectionProvider {
  constructor(options: ProviderPathOptions = {}) {
    super(
      {
        name: "claude-code",
        displayName: "Claude Code",
        configPath: ".mcp.json",
        globalConfigPath: resolve(getHomeDirectory(options), ".claude.json"),
        capabilities: { project: true, global: true },
      },
      "mcpServers",
    );
  }

  protected encodeServer(server: McpServerConfig): JsonObject | undefined {
    if (!server.enabled) return undefined;
    if (server.transport === "stdio") {
      return {
        type: "stdio",
        command: server.command,
        ...(server.args?.length && { args: server.args }),
        ...(server.env && Object.keys(server.env).length && { env: server.env }),
      };
    }
    return {
      type: "http",
      url: server.url,
      ...(server.headers && Object.keys(server.headers).length && { headers: server.headers }),
    };
  }

  protected decodeServer(raw: JsonObject): McpServerConfig {
    const type = getString(raw, "type");
    if (type === "http") {
      return parseCanonicalServer({
        enabled: true,
        transport: "http",
        url: getString(raw, "url"),
        ...(getStringRecord(raw, "headers") && { headers: getStringRecord(raw, "headers") }),
      });
    }
    return parseCanonicalServer({
      enabled: true,
      transport: "stdio",
      command: getString(raw, "command"),
      ...(getStringArray(raw, "args") && { args: getStringArray(raw, "args") }),
      ...(getStringRecord(raw, "env") && { env: getStringRecord(raw, "env") }),
    });
  }
}
