import { describe, expect, test } from 'bun:test';

import { createProviderRegistry } from '@creepiest-space/mcpx-providers';

import { initCommand, selectScope, type InitPrompts } from '../src/commands/init.ts';
import type { CliContext } from '../src/context.ts';
import { BACK } from '../src/wizard/step-runner.ts';
import { MemoryFileSystem, RecordingOutput } from './support.ts';

describe('init command', () => {
  test('passes the selected scope to the main wizard', async () => {
    const ctx = createContext();
    let receivedScope: string | undefined;
    const prompts: InitPrompts = { selectScope: async () => 'global' };

    expect(
      await initCommand(ctx, prompts, async (wizardContext) => {
        receivedScope = wizardContext.scope;
        return 0;
      }),
    ).toBe(0);
    expect(receivedScope).toBe('global');
  });

  test('propagates the wizard exit code', async () => {
    const ctx = { ...createContext(), scope: 'project' as const };
    expect(await initCommand(ctx, undefined, async () => 1)).toBe(1);
  });

  test('uses global scope in the home directory and handles cancellation', async () => {
    expect(
      await selectScope('/users/test', '/users/test', {
        selectScope: async () => 'project',
      }),
    ).toBe('global');
    expect(
      await selectScope('/workspace/project', '/users/test', {
        selectScope: async () => BACK,
      }),
    ).toBeUndefined();
  });
});

function createContext(): CliContext {
  return {
    projectRoot: '/workspace/project',
    homeDirectory: '/users/test',
    scope: undefined,
    verbose: false,
    fileSystem: new MemoryFileSystem(),
    output: new RecordingOutput(),
    registry: createProviderRegistry({ homeDirectory: '/users/test' }),
  };
}
