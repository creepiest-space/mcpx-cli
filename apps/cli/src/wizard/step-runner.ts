/* oxlint-disable eslint/no-await-in-loop -- Wizard steps depend on the preceding user response. */

import { isCancel } from '@clack/prompts';

export const BACK = Symbol('BACK');
export type BackSignal = typeof BACK;

export function handleCancel<T>(value: T | symbol): T | BackSignal {
  return isCancel(value) ? BACK : value;
}

export type Step<State> = (state: Partial<State>) => Promise<Partial<State> | BackSignal | null>;

export async function runSteps<State>(
  steps: readonly Step<State>[],
  initialState: Partial<State> = {},
): Promise<State | null> {
  const result = await runStepSequence(steps, initialState, false);
  return result === BACK ? null : result;
}

export function runBranchSteps<State>(
  steps: readonly Step<State>[],
  initialState: Partial<State> = {},
): Promise<State | BackSignal | null> {
  return runStepSequence(steps, initialState, true);
}

async function runStepSequence<State>(
  steps: readonly Step<State>[],
  initialState: Partial<State>,
  bubbleBack: boolean,
): Promise<State | BackSignal | null> {
  const history: Partial<State>[] = [{ ...initialState }];
  let index = 0;

  while (index < steps.length) {
    const current = { ...history[index] };
    const result = await steps[index]!(current);

    if (result === BACK) {
      if (index === 0) return bubbleBack ? BACK : null;
      index--;
      continue;
    }
    if (result === null) return null;

    history[index + 1] = { ...current, ...result };
    index++;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Completing every registered step establishes the full state.
  return history[index] as State;
}
