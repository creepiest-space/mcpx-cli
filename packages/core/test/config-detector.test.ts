import { describe, expect, test } from "bun:test";
import { ConfigDetector } from "../src/detection";
import { ProviderRegistry } from "../src/providers";
import { FakeProvider } from "./support/fake-provider";
import { MemoryFileSystem } from "./support/memory-file-system";

describe("ConfigDetector", () => {
  test("detects parseable providers supported by the selected scope", async () => {
    const projectRoot = "/workspace/project";
    const fileSystem = new MemoryFileSystem();
    const projectProvider = new FakeProvider("claude-code");
    const projectOnlyProvider = new FakeProvider("vscode", { project: true, global: false });
    const registry = new ProviderRegistry().register(projectProvider).register(projectOnlyProvider);

    fileSystem.files.set(
      projectProvider.resolveConfigPath(projectRoot, "project"),
      JSON.stringify({
        servers: {
          zebra: { enabled: true, transport: "stdio", command: "z" },
          alpha: { enabled: true, transport: "stdio", command: "a" },
        },
      }),
    );
    fileSystem.files.set(
      projectOnlyProvider.resolveConfigPath(projectRoot, "project"),
      "malformed",
    );

    const detector = new ConfigDetector({ projectRoot, scope: "project", registry, fileSystem });
    expect(await detector.detectAll()).toEqual([
      {
        provider: "claude-code",
        filePath: projectProvider.resolveConfigPath(projectRoot, "project"),
        servers: ["alpha", "zebra"],
      },
    ]);
  });

  test("skips providers unsupported at global scope", async () => {
    const projectRoot = "/workspace/project";
    const fileSystem = new MemoryFileSystem();
    const provider = new FakeProvider("vscode", { project: true, global: false });
    const registry = new ProviderRegistry().register(provider);
    fileSystem.files.set(
      provider.resolveConfigPath(projectRoot, "global"),
      JSON.stringify({ servers: {} }),
    );

    const detector = new ConfigDetector({ projectRoot, scope: "global", registry, fileSystem });
    expect(await detector.detectAll()).toEqual([]);
  });

  test("detects the first existing candidate path", async () => {
    const projectRoot = "/workspace/project";
    const fileSystem = new MemoryFileSystem();
    const provider = new FakeProvider("opencode");
    const preferred = "/global/opencode.jsonc";
    const fallback = "/global/opencode.json";
    provider.resolveConfigPaths = () => [preferred, fallback];
    fileSystem.files.set(fallback, JSON.stringify({ servers: {} }));
    const registry = new ProviderRegistry().register(provider);

    const detector = new ConfigDetector({ projectRoot, scope: "global", registry, fileSystem });
    expect(await detector.detectAll()).toEqual([
      {
        provider: "opencode",
        filePath: fallback,
        servers: [],
      },
    ]);
  });
});
