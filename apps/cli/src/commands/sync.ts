import type { CliContext } from "../context.ts";
import { loadStore, printSyncResults, providersForScope, syncConfig } from "./shared.ts";

export async function syncCommand(ctx: CliContext): Promise<void> {
  const loaded = await loadStore(ctx);
  if (!loaded) return;
  if (providersForScope(ctx, loaded.store.scope, loaded.config.providers).length === 0) {
    ctx.output.warning("No providers configured for this scope.");
    return;
  }

  const results = await syncConfig(ctx, loaded.store, loaded.config);
  printSyncResults(ctx, results);
  const counts = new Map<string, number>();
  for (const result of results) counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
  const summary = [...counts].map(([status, count]) => `${count} ${status}`).join(", ");
  ctx.output.info(`${results.length} provider(s) processed (${summary}).`);
}
