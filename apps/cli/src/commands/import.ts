import * as p from '@clack/prompts';
import { ConfigDetector, ProviderNameSchema, type ProviderName } from '@creepiest-space/mcpx-core';

import type { CliContext } from '../context.ts';
import { ExitCode, type ExitCode as CommandExitCode } from '../exit-code.ts';
import { mergeImportedServers } from '../import-conflicts.ts';
import {
  createImportConflictResolver,
  type ImportConflictPolicy,
} from '../wizard/import-conflict.ts';
import { BACK, handleCancel } from '../wizard/step-runner.ts';
import {
  openStore,
  printDetectionDiagnostics,
  printSyncResults,
  resolveProvidersForScope,
  syncConfig,
  syncHasErrors,
} from './shared.ts';

export interface ImportCommandOptions {
  all?: boolean | undefined;
  conflict?: ImportConflictPolicy | undefined;
}

export async function importCommand(
  ctx: CliContext,
  providerArgument?: string,
  options: ImportCommandOptions = {},
): Promise<CommandExitCode> {
  const store = await openStore(ctx, 'write');
  const detector = new ConfigDetector({
    projectRoot: ctx.projectRoot,
    scope: store.scope,
    registry: ctx.registry,
    fileSystem: ctx.fileSystem,
  });
  const report = await detector.detectAll();
  const { detections, diagnostics } = report;
  printDetectionDiagnostics(ctx, diagnostics);
  if (detections.length === 0) {
    ctx.output.info('No existing MCP configuration detected for this scope.');
    return diagnostics.length > 0 ? ExitCode.failure : ExitCode.success;
  }

  let providerName: ProviderName;
  if (providerArgument) {
    const parsed = ProviderNameSchema.safeParse(providerArgument);
    if (!parsed.success) {
      ctx.output.error(`Provider "${providerArgument}" not found.`);
      return ExitCode.usage;
    }
    providerName = parsed.data;
  } else {
    const selected = handleCancel(
      await p.select({
        message: 'Which provider should be imported?',
        options: detections.map((detection) => ({
          value: detection.provider,
          label: ctx.registry.get(detection.provider)?.displayName ?? detection.provider,
          hint: `${detection.servers.length} server(s)`,
        })),
      }),
    );
    if (selected === BACK) return ExitCode.success;
    providerName = selected;
  }

  const detection = detections.find((candidate) => candidate.provider === providerName);
  const provider = ctx.registry.get(providerName);
  if (!provider || !detection) {
    ctx.output.error(`No detected configuration for provider "${providerName}".`);
    return ExitCode.failure;
  }

  let parsedServers;
  try {
    parsedServers = provider.parse(await ctx.fileSystem.read(detection.filePath));
  } catch (error) {
    ctx.output.error(
      `Could not import ${detection.filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return ExitCode.failure;
  }
  const names = Object.keys(parsedServers);
  if (names.length === 0) {
    ctx.output.info('No servers found in that provider.');
    return ExitCode.success;
  }

  const selected = options.all
    ? names
    : handleCancel(
        await p.multiselect({
          message: 'Which servers should be imported?',
          options: names.map((name) => ({ value: name, label: name })),
          initialValues: names,
          required: false,
        }),
      );
  if (selected === BACK || selected.length === 0) {
    ctx.output.info('No servers selected.');
    return ExitCode.success;
  }

  const config = (await store.exists())
    ? await store.load()
    : { version: 1 as const, providers: [], servers: {} };
  const providerResolution = resolveProvidersForScope(ctx, store.scope, config.providers);
  if (providerResolution.errors.length > 0) {
    printSyncResults(ctx, providerResolution.errors);
    return ExitCode.failure;
  }
  const incoming = Object.fromEntries(selected.map((name) => [name, parsedServers[name]!]));
  const conflictPolicy = options.conflict ?? (process.stdin.isTTY ? 'ask' : 'skip');
  const merged = await mergeImportedServers(
    config.servers,
    incoming,
    providerName,
    createImportConflictResolver(conflictPolicy),
  );
  if (merged.skipped.length > 0) {
    ctx.output.warning(`Skipped conflicting server(s): ${merged.skipped.join(', ')}.`);
  }
  if (merged.imported.length === 0) {
    ctx.output.info('No servers imported.');
    return ExitCode.success;
  }

  config.servers = merged.servers;
  const saved = await store.save(config);
  ctx.output.success(
    `Imported ${merged.imported.length} server(s) from ${provider.displayName} into ${store.getDisplayPath()}.`,
  );

  if (saved.providers.length === 0) return ExitCode.success;
  const confirmed = options.all
    ? false
    : handleCancel(
        await p.confirm({ message: 'Sync configured providers now?', initialValue: true }),
      );
  if (confirmed === BACK || !confirmed) return ExitCode.success;

  const results = await syncConfig(ctx, store, saved);
  printSyncResults(ctx, results);
  return syncHasErrors(results) ? ExitCode.failure : ExitCode.success;
}
