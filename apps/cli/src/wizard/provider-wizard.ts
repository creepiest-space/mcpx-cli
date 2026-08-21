import * as p from '@clack/prompts';
import {
  PROVIDER_NAMES,
  providerSupportsScope,
  type ConfigScope,
  type ProviderName,
  type ProviderRegistry,
} from '@creepiest-space/mcpx-core';
import pc from 'picocolors';

import { BACK, handleCancel, type BackSignal } from './step-runner.ts';

interface ProviderOption {
  value: ProviderName;
  label: string;
  hint: string;
}

export interface ProviderWizardPrompts {
  multiselect(options: {
    message: string;
    options: ProviderOption[];
    initialValues: ProviderName[];
    required: false;
  }): Promise<ProviderName[] | BackSignal>;
}

const clackPrompts: ProviderWizardPrompts = {
  async multiselect(options) {
    return handleCancel(await p.multiselect(options));
  },
};

export async function runProviderWizard(
  registry: ProviderRegistry,
  preSelected: readonly ProviderName[] = [],
  scope: ConfigScope = 'project',
  prompts: ProviderWizardPrompts = clackPrompts,
): Promise<ProviderName[] | BackSignal> {
  const names = PROVIDER_NAMES.filter((name) => {
    const provider = registry.get(name);
    return provider ? providerSupportsScope(provider, scope) : false;
  });
  const result = await prompts.multiselect({
    message: 'Select providers to generate configuration for',
    options: names.map((name) => {
      const provider = registry.get(name)!;
      const path =
        scope === 'global'
          ? (provider.globalConfigPath ?? provider.configPath)
          : provider.configPath;
      return { value: name, label: pc.magenta(provider.displayName), hint: pc.dim(path) };
    }),
    initialValues: preSelected.filter((name) => names.includes(name)),
    required: false,
  });

  return result === BACK ? BACK : [...result];
}
