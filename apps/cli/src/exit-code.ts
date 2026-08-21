export const ExitCode = {
  success: 0,
  failure: 1,
  usage: 2,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export async function runWithExitCode(
  ctx: CliContext,
  action: () => Promise<ExitCode>,
): Promise<void> {
  try {
    process.exitCode = await action();
  } catch (error) {
    ctx.output.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) ctx.output.debug(error.stack);
    process.exitCode = ExitCode.failure;
  }
}
import type { CliContext } from './context.ts';
