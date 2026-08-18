import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { ConfigStore, getProjectConfigPath } from "@mcpx/core";
import { createProviderRegistry } from "@mcpx/providers";
import { listCommand } from "../src/commands/list.ts";
import { statusCommand } from "../src/commands/status.ts";
import { syncCommand } from "../src/commands/sync.ts";
import { toggleCommand } from "../src/commands/toggle.ts";
import type { CliContext } from "../src/context.ts";
import { MemoryFileSystem, RecordingOutput } from "./support.ts";

const projectRoot = "/workspace/project";
const homeDirectory = "/users/test";

describe("CLI commands", () => {
  test("sync, list, toggle and status use the canonical store", async () => {
    const ctx = createContext();
    const store = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      scope: "project",
      fileSystem: ctx.fileSystem,
    });
    await store.save({
      version: 1,
      providers: ["claude-code"],
      servers: {
        github: {
          enabled: true,
          transport: "stdio",
          command: "npx",
          args: ["@modelcontextprotocol/server-github"],
        },
      },
    });

    await syncCommand(ctx);
    expect(await ctx.fileSystem.exists(resolve(projectRoot, ".mcp.json"))).toBe(true);

    await listCommand(ctx);
    expect(ctx.output.messages.some(({ message }) => message.includes("github [stdio]"))).toBe(
      true,
    );

    await toggleCommand(ctx, "github", false);
    expect((await store.load()).servers.github?.enabled).toBe(false);
    expect(
      ctx.registry
        .get("claude-code")!
        .parse(await ctx.fileSystem.read(resolve(projectRoot, ".mcp.json"))).github,
    ).toBeUndefined();

    await statusCommand(ctx);
    expect(
      ctx.output.messages.some(
        ({ level, message }) => level === "success" && message.includes("synchronized"),
      ),
    ).toBe(true);
  });

  test("reports a missing canonical configuration without writing files", async () => {
    const ctx = createContext();
    await syncCommand(ctx);

    expect(await ctx.fileSystem.exists(getProjectConfigPath(projectRoot))).toBe(false);
    expect(ctx.output.messages).toContainEqual({
      level: "warning",
      message: "No .agents/mcp.json found.",
    });
  });
});

function createContext(): CliContext & { fileSystem: MemoryFileSystem; output: RecordingOutput } {
  const fileSystem = new MemoryFileSystem();
  const output = new RecordingOutput();
  return {
    projectRoot,
    homeDirectory,
    scope: "project",
    verbose: false,
    fileSystem,
    output,
    registry: createProviderRegistry({ homeDirectory }),
  };
}
