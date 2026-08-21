import { describe, expect, test } from 'bun:test';

import type { ProviderName } from '@creepiest-space/mcpx-core';
import { createProviderRegistry } from '@creepiest-space/mcpx-providers';

import { runProviderWizard, type ProviderWizardPrompts } from '../src/wizard/provider-wizard.ts';
import { BACK } from '../src/wizard/step-runner.ts';

describe('provider wizard', () => {
  test('filters unsupported providers and preselected values by scope', async () => {
    let offered: ProviderName[] = [];
    let initial: ProviderName[] = [];
    const prompts: ProviderWizardPrompts = {
      async multiselect(options) {
        offered = options.options.map(({ value }) => value);
        initial = options.initialValues;
        return options.initialValues;
      },
    };

    const result = await runProviderWizard(
      createProviderRegistry({ homeDirectory: '/users/test' }),
      ['claude-code', 'vscode'],
      'global',
      prompts,
    );

    expect(result).toEqual(['claude-code']);
    expect(initial).toEqual(['claude-code']);
    expect(offered).not.toContain('vscode');
    expect(offered).not.toContain('intellij');
  });

  test('propagates cancellation', async () => {
    const prompts: ProviderWizardPrompts = {
      async multiselect() {
        return BACK;
      },
    };
    expect(
      await runProviderWizard(
        createProviderRegistry({ homeDirectory: '/users/test' }),
        [],
        'project',
        prompts,
      ),
    ).toBe(BACK);
  });
});
