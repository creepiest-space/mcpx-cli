import type { CliContext } from "../context.ts";
import { runServerWizard } from "../wizard/server-wizard.ts";
import { loadStore, printSyncResults, syncConfig } from "./shared.ts";

export async function addCommand(ctx: CliContext, initialName?: string): Promise<void> {
  const loaded = await loadStore(ctx);
  if (!loaded) return;
  const result = await runServerWizard(Object.keys(loaded.config.servers), initialName);
  if (!result) {
    ctx.output.info("Operation canceled.");
    return;
  }

  const config = await loaded.store.addServer(result.name, result.config);
  ctx.output.success(`Server "${result.name}" added.`);
  printSyncResults(ctx, await syncConfig(ctx, loaded.store, config));
}
