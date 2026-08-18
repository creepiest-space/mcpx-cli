import { describe, expect, test } from "bun:test";
import { cleanupRemovedProviders, syncAllProviders, syncProvider } from "../src/sync";
import { FakeProvider } from "./support/fake-provider";
import { MemoryFileSystem } from "./support/memory-file-system";

const context = { projectRoot: "/workspace/project", scope: "project" as const };
const servers = {
  github: { enabled: true, transport: "stdio" as const, command: "npx" },
};

describe("provider sync", () => {
  test("reports created, unchanged, and updated states", async () => {
    const provider = new FakeProvider("claude-code");
    const fileSystem = new MemoryFileSystem();

    expect((await syncProvider(provider, servers, context, fileSystem)).status).toBe("created");
    expect((await syncProvider(provider, servers, context, fileSystem)).status).toBe("unchanged");
    expect(
      (
        await syncProvider(
          provider,
          {
            github: { ...servers.github, args: ["server"] },
          },
          context,
          fileSystem,
        )
      ).status,
    ).toBe("updated");
  });

  test("syncs multiple providers in registry order", async () => {
    const providers = [new FakeProvider("claude-code"), new FakeProvider("openai-codex")];
    const results = await syncAllProviders(providers, servers, context, new MemoryFileSystem());

    expect(results.map((result) => result.provider)).toEqual(["claude-code", "openai-codex"]);
    expect(results.every((result) => result.status === "created")).toBe(true);
  });

  test("returns an error for unsupported scope", async () => {
    const provider = new FakeProvider("vscode", { project: true, global: false });
    const result = await syncProvider(
      provider,
      servers,
      { ...context, scope: "global" },
      new MemoryFileSystem(),
    );

    expect(result.status).toBe("error");
    expect(result.error).toContain("does not support global");
  });

  test("removes provider files and ignores absent files", async () => {
    const provider = new FakeProvider("claude-code");
    const fileSystem = new MemoryFileSystem();
    const filePath = provider.resolveConfigPath(context.projectRoot, context.scope);
    fileSystem.files.set(filePath, "content");

    expect(await cleanupRemovedProviders([provider], context, fileSystem)).toEqual([
      {
        provider: "claude-code",
        filePath,
        status: "deleted",
      },
    ]);
    expect(await cleanupRemovedProviders([provider], context, fileSystem)).toEqual([]);
  });

  test("uses an existing fallback path and cleans all candidates", async () => {
    const provider = new FakeProvider("opencode");
    const preferred = "/global/opencode.jsonc";
    const fallback = "/global/opencode.json";
    provider.resolveConfigPaths = () => [preferred, fallback];
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set(fallback, provider.generate(servers));

    const result = await syncProvider(provider, servers, context, fileSystem);
    expect(result.filePath).toBe(fallback);
    expect(result.status).toBe("unchanged");

    fileSystem.files.set(preferred, "duplicate");
    const cleanup = await cleanupRemovedProviders([provider], context, fileSystem);
    expect(cleanup.map((entry) => entry.filePath)).toEqual([preferred, fallback]);
  });

  test("converts path resolver failures into provider errors", async () => {
    const provider = new FakeProvider("claude-code");
    provider.resolveConfigPath = () => {
      throw new Error("resolver failed");
    };

    const result = await syncProvider(provider, servers, context, new MemoryFileSystem());
    expect(result.status).toBe("error");
    expect(result.error).toBe("resolver failed");
  });
});
