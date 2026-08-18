import { isCancel } from "@clack/prompts";

export const BACK = Symbol("BACK");
export type BackSignal = typeof BACK;

export function handleCancel<T>(value: T | symbol): T | BackSignal {
  return isCancel(value) ? BACK : (value as T);
}

export type Step<State> = (state: Partial<State>) => Promise<Partial<State> | BackSignal | null>;

export async function runSteps<State>(
  steps: readonly Step<State>[],
  initialState: Partial<State> = {},
): Promise<State | null> {
  const history: Partial<State>[] = [{ ...initialState }];
  let index = 0;

  while (index < steps.length) {
    const current = { ...history[index] };
    const result = await steps[index]!(current);

    if (result === BACK) {
      if (index === 0) return null;
      index--;
      continue;
    }
    if (result === null) return null;

    history[index + 1] = { ...current, ...result };
    index++;
  }

  return history[index] as State;
}
