import * as p from "@clack/prompts";
import {
  PROVIDER_NAMES,
  providerSupportsScope,
  type ConfigScope,
  type ProviderName,
  type ProviderRegistry,
} from "@mcpx/core";
import pc from "picocolors";
import { BACK, handleCancel, type BackSignal } from "./step-runner.ts";

export async function runProviderWizard(
  registry: ProviderRegistry,
  preSelected: readonly ProviderName[] = [],
  scope: ConfigScope = "project",
): Promise<ProviderName[] | BackSignal> {
  const names = PROVIDER_NAMES.filter((name) => {
    const provider = registry.get(name);
    return provider ? providerSupportsScope(provider, scope) : false;
  });
  const result = handleCancel(
    await p.multiselect({
      message: "Select providers to generate configuration for",
      options: names.map((name) => {
        const provider = registry.get(name)!;
        const path =
          scope === "global"
            ? (provider.globalConfigPath ?? provider.configPath)
            : provider.configPath;
        return { value: name, label: pc.magenta(provider.displayName), hint: pc.dim(path) };
      }),
      initialValues: preSelected.filter((name) => names.includes(name)),
      required: false,
    }),
  );

  return result === BACK ? BACK : [...result];
}
