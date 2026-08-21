import * as p from '@clack/prompts';

import type { CliContext } from '../context.ts';
import { ExitCode, type ExitCode as CommandExitCode } from '../exit-code.ts';
import { BACK, handleCancel } from '../wizard/step-runner.ts';
import { loadStore, printSyncResults, syncConfig, syncHasErrors } from './shared.ts';

export async function removeCommand(
  ctx: CliContext,
  requestedName?: string,
  skipConfirmation = false,
): Promise<CommandExitCode> {
  const loaded = await loadStore(ctx, 'write');
  if (!loaded) return ExitCode.failure;
  const names = Object.keys(loaded.config.servers);
  if (names.length === 0) {
    ctx.output.info('No servers to remove.');
    return ExitCode.success;
  }

  let name = requestedName;
  if (name && !loaded.config.servers[name]) {
    ctx.output.error(`Server "${name}" not found.`);
    return ExitCode.usage;
  }
  if (!name) {
    const selected = handleCancel(
      await p.select({
        message: 'Which server should be removed?',
        options: names.map((candidate) => ({ value: candidate, label: candidate })),
      }),
    );
    if (selected === BACK) return ExitCode.success;
    name = selected;
  }

  if (!skipConfirmation) {
    const confirmed = handleCancel(
      await p.confirm({ message: `Confirm removal of "${name}"?`, initialValue: false }),
    );
    if (confirmed === BACK || !confirmed) return ExitCode.success;
  }

  const config = await loaded.store.removeServer(name);
  ctx.output.success(`Server "${name}" removed.`);
  const results = await syncConfig(ctx, loaded.store, config);
  printSyncResults(ctx, results);
  return syncHasErrors(results) ? ExitCode.failure : ExitCode.success;
}
