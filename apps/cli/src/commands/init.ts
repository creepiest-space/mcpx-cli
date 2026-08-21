import { homedir } from 'node:os';
import { resolve } from 'node:path';

import * as p from '@clack/prompts';
import type { ConfigScope } from '@creepiest-space/mcpx-core';

import type { CliContext } from '../context.ts';
import { ExitCode, type ExitCode as CommandExitCode } from '../exit-code.ts';
import { runMainWizard } from '../wizard/main-wizard.ts';
import { BACK, handleCancel } from '../wizard/step-runner.ts';

export interface InitPrompts {
  selectScope(): Promise<ConfigScope | typeof BACK>;
}

const clackPrompts: InitPrompts = {
  async selectScope() {
    return handleCancel(
      await p.select({
        message: 'Where should MCPX store this configuration?',
        options: [
          { value: 'project' as const, label: 'Project', hint: '.agents/mcp.json in this folder' },
          { value: 'global' as const, label: 'Global', hint: '~/.agents/mcp.json for your user' },
        ],
      }),
    );
  },
};

export async function initCommand(
  ctx: CliContext,
  prompts: InitPrompts = clackPrompts,
  runWizard: (context: CliContext) => Promise<CommandExitCode> = runMainWizard,
): Promise<CommandExitCode> {
  const scope = ctx.scope ?? (await selectScope(ctx.projectRoot, ctx.homeDirectory, prompts));
  if (!scope) return ExitCode.success;
  return runWizard({ ...ctx, scope });
}

export async function selectScope(
  projectRoot: string,
  homeDirectory = homedir(),
  prompts: InitPrompts = clackPrompts,
): Promise<ConfigScope | undefined> {
  if (resolve(projectRoot) === resolve(homeDirectory)) return 'global';
  const result = await prompts.selectScope();
  return result === BACK ? undefined : result;
}
