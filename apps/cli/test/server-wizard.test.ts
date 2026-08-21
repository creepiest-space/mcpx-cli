import { describe, expect, test } from 'bun:test';

import { runServerWizard, type ServerWizardPrompts } from '../src/wizard/server-wizard.ts';
import { BACK, type BackSignal } from '../src/wizard/step-runner.ts';

type PromptResponse = string | boolean | BackSignal;

class ScriptedPrompts implements ServerWizardPrompts {
  readonly messages: string[] = [];
  transportCalls = 0;

  constructor(private readonly responses: PromptResponse[]) {}

  async text(options: { message: string }): Promise<string | BackSignal> {
    this.messages.push(options.message);
    return this.next() as string | BackSignal;
  }

  async transport(): Promise<'stdio' | 'http' | BackSignal> {
    this.transportCalls++;
    return this.next() as 'stdio' | 'http' | BackSignal;
  }

  async confirm(): Promise<boolean | BackSignal> {
    return this.next() as boolean | BackSignal;
  }

  private next(): PromptResponse {
    const response = this.responses.shift();
    if (response === undefined) throw new Error('No scripted prompt response remains');
    return response;
  }
}

describe('server wizard navigation', () => {
  test('returns from the first HTTP step to transport selection', async () => {
    const prompts = new ScriptedPrompts([
      'server',
      'http',
      BACK,
      'stdio',
      'npx',
      '-y, example-server',
      false,
    ]);

    expect(await runServerWizard([], undefined, prompts)).toEqual({
      name: 'server',
      config: {
        enabled: true,
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'example-server'],
      },
    });
    expect(prompts.transportCalls).toBe(2);
  });

  test('propagates cancellation inside pair collection to the previous active step', async () => {
    const prompts = new ScriptedPrompts([
      'server',
      'stdio',
      'npx',
      'first-args',
      true,
      'TOKEN',
      BACK,
      'revised-args',
      false,
    ]);

    expect(await runServerWizard([], undefined, prompts)).toEqual({
      name: 'server',
      config: {
        enabled: true,
        transport: 'stdio',
        command: 'npx',
        args: ['revised-args'],
      },
    });
    expect(prompts.messages.filter((message) => message === 'Arguments')).toHaveLength(2);
  });
});
