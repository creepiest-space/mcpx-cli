import type { CliContext } from '../context.ts';
import { ExitCode, type ExitCode as CommandExitCode } from '../exit-code.ts';
import { runServerWizard, type ServerWizardPrompts } from '../wizard/server-wizard.ts';
import { loadStore, printSyncResults, syncConfig, syncHasErrors } from './shared.ts';

export async function addCommand(
  ctx: CliContext,
  initialName?: string,
  prompts?: ServerWizardPrompts,
): Promise<CommandExitCode> {
  const loaded = await loadStore(ctx, 'write');
  if (!loaded) return ExitCode.failure;
  const result = await runServerWizard(Object.keys(loaded.config.servers), initialName, prompts);
  if (!result) {
    ctx.output.info('Operation canceled.');
    return ExitCode.success;
  }

  const config = await loaded.store.addServer(result.name, result.config);
  ctx.output.success(`Server "${result.name}" added.`);
  const results = await syncConfig(ctx, loaded.store, config);
  printSyncResults(ctx, results);
  return syncHasErrors(results) ? ExitCode.failure : ExitCode.success;
}
