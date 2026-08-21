/* oxlint-disable eslint/no-await-in-loop -- Provider checks stay ordered for deterministic output. */

import { providerSupportsScope, resolveProviderConfigPaths } from '@creepiest-space/mcpx-core';
import pc from 'picocolors';

import type { CliContext } from '../context.ts';
import { ExitCode, type ExitCode as CommandExitCode } from '../exit-code.ts';
import { loadStore } from './shared.ts';

export async function statusCommand(ctx: CliContext): Promise<CommandExitCode> {
  const loaded = await loadStore(ctx);
  if (!loaded) return ExitCode.failure;
  let hasDesync = false;
  const lines: string[] = [];

  for (const name of loaded.config.providers) {
    const provider = ctx.registry.get(name);
    if (!provider) {
      lines.push(`${pc.bold(name.padEnd(18))} ${pc.red('error'.padEnd(7))} not registered`);
      hasDesync = true;
      continue;
    }
    if (!providerSupportsScope(provider, loaded.store.scope)) {
      lines.push(
        `${pc.bold(provider.displayName.padEnd(18))} ${pc.red('error'.padEnd(7))} does not support ${loaded.store.scope} configuration`,
      );
      hasDesync = true;
      continue;
    }
    const paths = resolveProviderConfigPaths(provider, ctx.projectRoot, loaded.store.scope);
    const filePath = await firstExistingPath(ctx, paths);
    if (!filePath) {
      lines.push(
        `${pc.bold(provider.displayName.padEnd(18))} ${pc.red('missing'.padEnd(7))} ${pc.dim(paths[0])}`,
      );
      hasDesync = true;
      continue;
    }

    try {
      const current = await ctx.fileSystem.read(filePath);
      const expected = provider.generate(loaded.config.servers, {
        projectRoot: ctx.projectRoot,
        scope: loaded.store.scope,
        existingContent: current,
      });
      const synchronized = current === expected;
      const status = synchronized ? 'sync' : 'desync';
      const coloredStatus = synchronized ? pc.green(status.padEnd(7)) : pc.yellow(status.padEnd(7));
      lines.push(
        `${pc.bold(provider.displayName.padEnd(18))} ${coloredStatus} ${pc.dim(filePath)}`,
      );
      if (status === 'desync') hasDesync = true;
    } catch (error) {
      lines.push(
        `${pc.bold(provider.displayName.padEnd(18))} ${pc.red('error'.padEnd(7))} ${pc.red(error instanceof Error ? error.message : String(error))}`,
      );
      hasDesync = true;
    }
  }

  ctx.output.info(
    `${pc.bold(String(Object.keys(loaded.config.servers).length))} server(s), ${pc.bold(String(loaded.config.providers.length))} provider(s)`,
  );
  for (const line of lines) ctx.output.info(line);
  if (hasDesync)
    ctx.output.warning('Some providers are out of date. Run "mcpx sync" to update them.');
  else ctx.output.success('All providers are synchronized.');
  return hasDesync ? ExitCode.failure : ExitCode.success;
}

async function firstExistingPath(
  ctx: CliContext,
  paths: readonly string[],
): Promise<string | undefined> {
  for (const path of paths) if (await ctx.fileSystem.exists(path)) return path;
  return undefined;
}
