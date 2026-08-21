/* oxlint-disable eslint/no-await-in-loop -- Interactive wizard actions depend on prior choices. */

import * as p from '@clack/prompts';
import {
  cleanupRemovedProviders,
  ConfigDetector,
  providerSupportsScope,
  type ConfigStore,
  type McpConfigFile,
  type McpServerConfig,
  type ProviderName,
  type SyncResult,
} from '@creepiest-space/mcpx-core';
import pc from 'picocolors';

import {
  openStore,
  printDetectionDiagnostics,
  printSyncResults,
  syncConfig,
  syncHasErrors,
} from '../commands/shared.ts';
import type { CliContext } from '../context.ts';
import { ExitCode, type ExitCode as CommandExitCode } from '../exit-code.ts';
import { mergeImportedServers } from '../import-conflicts.ts';
import { createImportConflictResolver } from './import-conflict.ts';
import { runProviderWizard } from './provider-wizard.ts';
import { runServerWizard } from './server-wizard.ts';
import { BACK, handleCancel } from './step-runner.ts';

export async function runMainWizard(ctx: CliContext): Promise<CommandExitCode> {
  const store = await openStore(ctx);
  p.intro(`${pc.bgCyan(pc.black(' MCPX '))} ${pc.bold('MCP server configuration')}`);

  if (await store.exists()) {
    return handleExistingConfig(ctx, store);
  } else {
    return handleNewConfig(ctx, store);
  }
}

async function handleExistingConfig(ctx: CliContext, store: ConfigStore): Promise<CommandExitCode> {
  const config = await store.load();
  p.log.info(
    `Configuration found: ${pc.bold(String(Object.keys(config.servers).length))} server(s), ${pc.bold(String(config.providers.length))} provider(s)`,
  );
  const action = handleCancel(
    await p.select({
      message: 'What would you like to do?',
      options: [
        { value: 'add' as const, label: 'Add server' },
        { value: 'remove' as const, label: 'Remove server' },
        { value: 'providers' as const, label: 'Change providers' },
        { value: 'sync' as const, label: 'Sync configs' },
        { value: 'exit' as const, label: 'Exit' },
      ],
    }),
  );
  if (action === BACK || action === 'exit') {
    p.outro('See you later!');
    return ExitCode.success;
  }

  if (action === 'add') {
    const result = await runServerWizard(Object.keys(config.servers));
    if (!result) {
      p.cancel('Operation canceled.');
      return ExitCode.success;
    }
    const updated = await store.addServer(result.name, result.config);
    p.log.success(`Server ${pc.cyan(`"${result.name}"`)} added.`);
    return syncAndReport(ctx, store, updated);
  }

  if (action === 'remove') {
    const names = Object.keys(config.servers);
    if (names.length === 0) {
      p.log.info('No servers to remove.');
      return ExitCode.success;
    }
    const selected = handleCancel(
      await p.select({
        message: 'Which server should be removed?',
        options: names.map((name) => ({ value: name, label: pc.cyan(name) })),
      }),
    );
    if (selected === BACK) return ExitCode.success;
    const confirmed = handleCancel(
      await p.confirm({ message: `Confirm removal of "${selected}"?`, initialValue: false }),
    );
    if (confirmed === BACK || !confirmed) return ExitCode.success;
    const updated = await store.removeServer(selected);
    p.log.success(`Server ${pc.cyan(`"${selected}"`)} removed.`);
    return syncAndReport(ctx, store, updated);
  }

  if (action === 'providers') {
    const selected = await runProviderWizard(ctx.registry, config.providers, store.scope);
    if (selected === BACK) return ExitCode.success;
    const result = await applyProviderSelection(ctx, store, config, selected);
    printSyncResults(ctx, result.cleanupResults);
    if (!result.config) {
      p.log.error('Providers were not updated because cleanup failed.');
      return ExitCode.failure;
    }
    p.log.success('Providers updated.');
    return syncAndReport(ctx, store, result.config);
  }

  return syncAndReport(ctx, store, config);
}

export async function applyProviderSelection(
  ctx: CliContext,
  store: ConfigStore,
  currentConfig: McpConfigFile,
  selected: readonly ProviderName[],
): Promise<{ config?: McpConfigFile; cleanupResults: SyncResult[] }> {
  const removed = ctx.registry
    .getByNames(currentConfig.providers.filter((name) => !selected.includes(name)))
    .filter((provider) => providerSupportsScope(provider, store.scope));
  const config = await store.setProviders(selected);
  const cleanupResults = await cleanupRemovedProviders(
    removed,
    { projectRoot: ctx.projectRoot, scope: store.scope },
    ctx.fileSystem,
  );
  if (cleanupResults.some((result) => result.status === 'error')) {
    await store.save(currentConfig);
    return { cleanupResults };
  }

  return { cleanupResults, config };
}

async function handleNewConfig(ctx: CliContext, store: ConfigStore): Promise<CommandExitCode> {
  const detector = new ConfigDetector({
    projectRoot: ctx.projectRoot,
    scope: store.scope,
    registry: ctx.registry,
    fileSystem: ctx.fileSystem,
  });
  const { detections, diagnostics } = await detector.detectAll();
  printDetectionDiagnostics(ctx, diagnostics);
  let servers: Record<string, McpServerConfig> = {};

  if (detections.length > 0) {
    p.note(
      detections
        .map((detection) => {
          const provider = ctx.registry.get(detection.provider);
          return `${pc.magenta(provider?.displayName ?? detection.provider)} - ${pc.bold(String(detection.servers.length))} server(s)`;
        })
        .join('\n'),
      'Detected MCP configurations',
    );
    const shouldImport = handleCancel(
      await p.confirm({ message: 'Import these configurations?', initialValue: true }),
    );
    if (shouldImport === BACK) {
      p.cancel('Operation canceled.');
      return ExitCode.success;
    }
    if (shouldImport) {
      for (const detection of detections) {
        const provider = ctx.registry.get(detection.provider);
        if (!provider) continue;
        try {
          const merged = await mergeImportedServers(
            servers,
            provider.parse(await ctx.fileSystem.read(detection.filePath)),
            detection.provider,
            createImportConflictResolver('ask'),
          );
          servers = merged.servers;
          if (merged.skipped.length > 0) {
            p.log.warn(
              `Skipped ${pc.magenta(provider.displayName)} conflict(s): ${merged.skipped.map(pc.cyan).join(', ')}`,
            );
          }
        } catch (error) {
          ctx.output.debug(
            `Could not import ${detection.filePath}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      p.log.success(`Imported ${pc.bold(String(Object.keys(servers).length))} server(s).`);
    }
  }

  if (Object.keys(servers).length === 0) {
    p.log.step("Let's configure your MCP servers.");
    while (true) {
      const result = await runServerWizard(Object.keys(servers));
      if (!result) {
        if (Object.keys(servers).length === 0) {
          p.cancel('Operation canceled.');
          return ExitCode.success;
        }
        break;
      }
      servers[result.name] = result.config;
      p.log.success(`Server ${pc.cyan(`"${result.name}"`)} added.`);
      const more = handleCancel(
        await p.confirm({ message: 'Add another server?', initialValue: false }),
      );
      if (more === BACK || !more) break;
    }
  }

  const providerNames = await runProviderWizard(ctx.registry, [], store.scope);
  if (providerNames === BACK) {
    p.cancel('Operation canceled.');
    return ExitCode.success;
  }
  if (providerNames.length === 0) p.log.warn('No providers selected.');

  p.note(
    `${pc.bold('Servers:')} ${Object.keys(servers).map(pc.cyan).join(', ')}\n${pc.bold('Providers:')} ${providerNames.length > 0 ? providerNames.map((name) => pc.magenta(ctx.registry.get(name)?.displayName ?? name)).join(', ') : pc.dim('none')}`,
    'Summary',
  );
  const confirmed = handleCancel(
    await p.confirm({ message: 'Confirm and generate files?', initialValue: true }),
  );
  if (confirmed === BACK || !confirmed) {
    p.cancel('Operation canceled.');
    return ExitCode.success;
  }

  const config: McpConfigFile = { version: 1, providers: providerNames, servers };
  const saved = await store.save(config);
  p.log.success(`Created: ${pc.cyan(store.getDisplayPath())}`);
  const exitCode =
    providerNames.length > 0 ? await syncAndReport(ctx, store, saved) : ExitCode.success;
  p.outro(pc.green('Configuration complete!'));
  return exitCode;
}

async function syncAndReport(
  ctx: CliContext,
  store: ConfigStore,
  config: McpConfigFile,
): Promise<CommandExitCode> {
  const results = await syncConfig(ctx, store, config);
  printSyncResults(ctx, results);
  return syncHasErrors(results) ? ExitCode.failure : ExitCode.success;
}
