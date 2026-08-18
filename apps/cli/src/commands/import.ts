import * as p from "@clack/prompts";
import { ConfigDetector, ProviderNameSchema, type ProviderName } from "@mcpx/core";
import type { CliContext } from "../context.ts";
import { BACK, handleCancel } from "../wizard/step-runner.ts";
import { openStore, printSyncResults, syncConfig } from "./shared.ts";

export async function importCommand(ctx: CliContext, providerArgument?: string): Promise<void> {
  const store = await openStore(ctx);
  const detector = new ConfigDetector({
    projectRoot: ctx.projectRoot,
    scope: store.scope,
    registry: ctx.registry,
    fileSystem: ctx.fileSystem,
  });
  const detections = await detector.detectAll();
  if (detections.length === 0) {
    ctx.output.info("No existing MCP configuration detected for this scope.");
    return;
  }

  let providerName: ProviderName;
  if (providerArgument) {
    const parsed = ProviderNameSchema.safeParse(providerArgument);
    if (!parsed.success) {
      ctx.output.error(`Provider "${providerArgument}" not found.`);
      return;
    }
    providerName = parsed.data;
  } else {
    const selected = handleCancel(
      await p.select({
        message: "Which provider should be imported?",
        options: detections.map((detection) => ({
          value: detection.provider,
          label: ctx.registry.get(detection.provider)?.displayName ?? detection.provider,
          hint: `${detection.servers.length} server(s)`,
        })),
      }),
    );
    if (selected === BACK) return;
    providerName = selected;
  }

  const detection = detections.find((candidate) => candidate.provider === providerName);
  const provider = ctx.registry.get(providerName);
  if (!provider || !detection) {
    ctx.output.error(`No detected configuration for provider "${providerName}".`);
    return;
  }
  const parsedServers = provider.parse(await ctx.fileSystem.read(detection.filePath));
  const names = Object.keys(parsedServers);
  if (names.length === 0) {
    ctx.output.info("No servers found in that provider.");
    return;
  }

  const selected = handleCancel(
    await p.multiselect({
      message: "Which servers should be imported?",
      options: names.map((name) => ({ value: name, label: name })),
      initialValues: names,
      required: false,
    }),
  );
  if (selected === BACK || selected.length === 0) {
    ctx.output.info("No servers selected.");
    return;
  }

  const config = (await store.exists())
    ? await store.load()
    : { version: 1 as const, providers: [], servers: {} };
  for (const name of selected) config.servers[name] = parsedServers[name]!;
  const saved = await store.save(config);
  ctx.output.success(`Imported ${selected.length} server(s) into ${store.getDisplayPath()}.`);

  if (saved.providers.length > 0) {
    const confirmed = handleCancel(
      await p.confirm({ message: "Sync configured providers now?", initialValue: true }),
    );
    if (confirmed !== BACK && confirmed) printSyncResults(ctx, await syncConfig(ctx, store, saved));
  }
}
