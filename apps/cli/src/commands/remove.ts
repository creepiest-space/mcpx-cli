import * as p from "@clack/prompts";
import type { CliContext } from "../context.ts";
import { BACK, handleCancel } from "../wizard/step-runner.ts";
import { loadStore, printSyncResults, syncConfig } from "./shared.ts";

export async function removeCommand(
  ctx: CliContext,
  requestedName?: string,
  skipConfirmation = false,
): Promise<void> {
  const loaded = await loadStore(ctx);
  if (!loaded) return;
  const names = Object.keys(loaded.config.servers);
  if (names.length === 0) {
    ctx.output.info("No servers to remove.");
    return;
  }

  let name = requestedName;
  if (name && !loaded.config.servers[name]) {
    ctx.output.error(`Server "${name}" not found.`);
    return;
  }
  if (!name) {
    const selected = handleCancel(
      await p.select({
        message: "Which server should be removed?",
        options: names.map((candidate) => ({ value: candidate, label: candidate })),
      }),
    );
    if (selected === BACK) return;
    name = selected;
  }

  if (!skipConfirmation) {
    const confirmed = handleCancel(
      await p.confirm({ message: `Confirm removal of "${name}"?`, initialValue: false }),
    );
    if (confirmed === BACK || !confirmed) return;
  }

  const config = await loaded.store.removeServer(name);
  ctx.output.success(`Server "${name}" removed.`);
  printSyncResults(ctx, await syncConfig(ctx, loaded.store, config));
}
