import { homedir } from "node:os";
import type { ConfigScope, FileSystem, ProviderRegistry } from "@mcpx/core";
import { createProviderRegistry } from "@mcpx/providers";
import { NodeFileSystem } from "./infrastructure/node-file-system.ts";
import type { Output } from "./output";
import { PlainOutput } from "./output";

export interface CliContext {
  projectRoot: string;
  scope?: ConfigScope;
  verbose: boolean;
  homeDirectory: string;
  fileSystem: FileSystem;
  registry: ProviderRegistry;
  output: Output;
}

export interface CreateCliContextOptions {
  projectRoot: string;
  scope?: ConfigScope;
  verbose?: boolean;
  homeDirectory?: string;
  environment?: Readonly<Record<string, string | undefined>>;
}

export function createCliContext(options: CreateCliContextOptions): CliContext {
  const verbose = options.verbose ?? false;
  const homeDirectory = options.homeDirectory ?? homedir();

  return {
    projectRoot: options.projectRoot,
    scope: options.scope,
    verbose,
    homeDirectory,
    fileSystem: new NodeFileSystem(),
    registry: createProviderRegistry({ homeDirectory, environment: options.environment }),
    output: new PlainOutput(verbose),
  };
}
