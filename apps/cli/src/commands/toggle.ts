import type { CliContext } from '../context.ts';
import { ExitCode, type ExitCode as CommandExitCode } from '../exit-code.ts';
import { loadStore, printSyncResults, syncConfig, syncHasErrors } from './shared.ts';

export async function toggleCommand(
  ctx: CliContext,
  name: string,
  enabled: boolean,
): Promise<CommandExitCode> {
  const loaded = await loadStore(ctx, 'write');
  if (!loaded) return ExitCode.failure;
  const server = loaded.config.servers[name];
  if (!server) {
    ctx.output.error(`Server "${name}" not found.`);
    return ExitCode.usage;
  }
  if (server.enabled === enabled) {
    ctx.output.info(`Server "${name}" is already ${enabled ? 'enabled' : 'disabled'}.`);
    return ExitCode.success;
  }

  server.enabled = enabled;
  const config = await loaded.store.save(loaded.config);
  ctx.output.success(`Server "${name}" ${enabled ? 'enabled' : 'disabled'}.`);
  const results = await syncConfig(ctx, loaded.store, config);
  printSyncResults(ctx, results);
  return syncHasErrors(results) ? ExitCode.failure : ExitCode.success;
}
