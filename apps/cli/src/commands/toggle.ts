import type { CliContext } from "../context.ts";
import { loadStore, printSyncResults, syncConfig } from "./shared.ts";

export async function toggleCommand(
  ctx: CliContext,
  name: string,
  enabled: boolean,
): Promise<void> {
  const loaded = await loadStore(ctx);
  if (!loaded) return;
  const server = loaded.config.servers[name];
  if (!server) {
    ctx.output.error(`Server "${name}" not found.`);
    return;
  }
  if (server.enabled === enabled) {
    ctx.output.info(`Server "${name}" is already ${enabled ? "enabled" : "disabled"}.`);
    return;
  }

  server.enabled = enabled;
  const config = await loaded.store.save(loaded.config);
  ctx.output.success(`Server "${name}" ${enabled ? "enabled" : "disabled"}.`);
  printSyncResults(ctx, await syncConfig(ctx, loaded.store, config));
}
