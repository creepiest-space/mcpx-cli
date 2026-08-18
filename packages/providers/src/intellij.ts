import type { McpServerConfig } from "@mcpx/core";
import { JsonSectionProvider } from "./json/json-section-provider.ts";
import {
  getString,
  getStringArray,
  getStringRecord,
  parseCanonicalServer,
  type JsonObject,
} from "./json/value.ts";

export class IntellijProvider extends JsonSectionProvider {
  constructor() {
    super(
      {
        name: "intellij",
        displayName: "IntelliJ IDEA",
        configPath: ".idea/mcp.json",
        capabilities: { project: true, global: false },
      },
      "mcpServers",
    );
  }

  protected encodeServer(server: McpServerConfig): JsonObject | undefined {
    if (!server.enabled) return undefined;
    if (server.transport === "stdio") {
      return {
        command: server.command,
        ...(server.args?.length && { args: server.args }),
        ...(server.env && Object.keys(server.env).length && { env: server.env }),
      };
    }
    return {
      url: server.url,
      ...(server.headers && Object.keys(server.headers).length && { headers: server.headers }),
    };
  }

  protected decodeServer(raw: JsonObject): McpServerConfig {
    const url = getString(raw, "url");
    if (url !== undefined) {
      const headers = getStringRecord(raw, "headers");
      return parseCanonicalServer({
        enabled: true,
        transport: "http",
        url,
        ...(headers && { headers }),
      });
    }
    const args = getStringArray(raw, "args");
    const env = getStringRecord(raw, "env");
    return parseCanonicalServer({
      enabled: true,
      transport: "stdio",
      command: getString(raw, "command"),
      ...(args && { args }),
      ...(env && { env }),
    });
  }
}
