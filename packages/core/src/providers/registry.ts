import type { ProviderName } from "../types/canonical.ts";
import type { Provider } from "./provider.ts";

export class ProviderRegistry {
  readonly #providers = new Map<ProviderName, Provider>();

  register(provider: Provider): this {
    this.#providers.set(provider.name, provider);
    return this;
  }

  get(name: ProviderName): Provider | undefined {
    return this.#providers.get(name);
  }

  getAll(): Provider[] {
    return [...this.#providers.values()];
  }

  getByNames(names: readonly ProviderName[]): Provider[] {
    return names.flatMap((name) => {
      const provider = this.get(name);
      return provider ? [provider] : [];
    });
  }
}
