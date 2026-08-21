import { describe, expect, test } from 'bun:test';

import { BACK, runBranchSteps, runSteps, type Step } from '../src/wizard/step-runner.ts';

describe('runSteps', () => {
  test('returns to the previous step without keeping later state', async () => {
    let firstRuns = 0;
    let secondRuns = 0;
    const first: Step<{ name: string; value: number }> = async () => ({
      name: `run-${++firstRuns}`,
    });
    const second: Step<{ name: string; value: number }> = async () =>
      ++secondRuns === 1 ? BACK : { value: 2 };

    expect(await runSteps([first, second])).toEqual({ name: 'run-2', value: 2 });
  });

  test('cancels when navigating back from the first step', async () => {
    expect(await runSteps([async () => BACK])).toBeNull();
  });

  test('bubbles back from the first step of a branch', async () => {
    expect(await runBranchSteps([async () => BACK], { name: 'server' })).toBe(BACK);
  });
});
