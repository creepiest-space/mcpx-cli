import { homedir } from 'node:os';

import type { ConfigScope, FileSystem, ProviderRegistry } from '@creepiest-space/mcpx-core';
import { createProviderRegistry } from '@creepiest-space/mcpx-providers';

import { NodeFileSystem } from './infrastructure/node-file-system.ts';
import type { Output } from './output/index.ts';
import { PlainOutput } from './output/index.ts';

export interface CliContext {
  projectRoot: string;
  scope?: ConfigScope | undefined;
  verbose: boolean;
  homeDirectory: string;
  fileSystem: FileSystem;
  registry: ProviderRegistry;
  output: Output;
}

export interface CreateCliContextOptions {
  projectRoot: string;
  scope?: ConfigScope | undefined;
  verbose?: boolean | undefined;
  homeDirectory?: string | undefined;
  environment?: Readonly<Record<string, string | undefined>> | undefined;
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
