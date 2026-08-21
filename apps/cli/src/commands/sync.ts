import type { CliContext } from '../context.ts';
import { ExitCode, type ExitCode as CommandExitCode } from '../exit-code.ts';
import { loadStore, printSyncResults, syncConfig, syncHasErrors } from './shared.ts';

export async function syncCommand(ctx: CliContext): Promise<CommandExitCode> {
  const loaded = await loadStore(ctx, 'write');
  if (!loaded) return ExitCode.failure;
  if (loaded.config.providers.length === 0) {
    ctx.output.warning('No providers configured for this scope.');
    return ExitCode.success;
  }

  const results = await syncConfig(ctx, loaded.store, loaded.config);
  printSyncResults(ctx, results);
  const counts = new Map<string, number>();
  for (const result of results) counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
  const summary = [...counts].map(([status, count]) => `${count} ${status}`).join(', ');
  ctx.output.info(`${results.length} provider(s) processed (${summary}).`);
  return syncHasErrors(results) ? ExitCode.failure : ExitCode.success;
}
