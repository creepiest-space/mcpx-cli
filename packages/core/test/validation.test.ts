import { describe, expect, test } from "bun:test";
import { isValidServerName, parseMcpConfigFile, safeParseMcpConfigFile } from "../src/config";
import type { McpConfigFile } from "../src/types";

const validConfig = {
  version: 1,
  providers: ["cursor"],
  servers: {
    local: {
      enabled: true,
      transport: "stdio",
      command: "npx",
      args: ["-y", "example-server"],
      env: { TOKEN: "secret" },
    },
    remote: {
      enabled: false,
      transport: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer token" },
    },
  },
} satisfies McpConfigFile;

describe("McpConfigFileSchema", () => {
  test("parses a canonical configuration", () => {
    expect(parseMcpConfigFile(validConfig)).toEqual(validConfig);
  });

  test("reports the path of a nested invalid value", () => {
    const result = safeParseMcpConfigFile({
      ...validConfig,
      servers: {
        local: {
          ...validConfig.servers.local,
          env: { TOKEN: 42 },
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.path).toEqual(["servers", "local", "env", "TOKEN"]);
  });

  test("rejects unknown fields and non-http URLs", () => {
    expect(() => parseMcpConfigFile({ ...validConfig, extra: true })).toThrow();
    expect(() =>
      parseMcpConfigFile({
        ...validConfig,
        servers: { remote: { enabled: true, transport: "http", url: "ftp://example.com" } },
      }),
    ).toThrow();
  });
});

describe("ServerNameSchema", () => {
  test("accepts portable names", () => {
    expect(isValidServerName("github.mcp-1")).toBe(true);
  });

  test("rejects empty, spaced, and prefixed names", () => {
    expect(isValidServerName("")).toBe(false);
    expect(isValidServerName("my server")).toBe(false);
    expect(isValidServerName("-server")).toBe(false);
  });
});
