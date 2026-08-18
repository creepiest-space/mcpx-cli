import * as p from "@clack/prompts";
import {
  cleanupRemovedProviders,
  ConfigDetector,
  type ConfigStore,
  type McpConfigFile,
  type McpServerConfig,
} from "@mcpx/core";
import pc from "picocolors";
import type { CliContext } from "../context.ts";
import { openStore, printSyncResults, syncConfig } from "../commands/shared.ts";
import { runProviderWizard } from "./provider-wizard.ts";
import { runServerWizard } from "./server-wizard.ts";
import { BACK, handleCancel } from "./step-runner.ts";

export async function runMainWizard(ctx: CliContext): Promise<void> {
  const store = await openStore(ctx);
  p.intro(`${pc.bgCyan(pc.black(" MCPX "))} ${pc.bold("MCP server configuration")}`);

  if (await store.exists()) {
    await handleExistingConfig(ctx, store);
  } else {
    await handleNewConfig(ctx, store);
  }
}

async function handleExistingConfig(ctx: CliContext, store: ConfigStore): Promise<void> {
  const config = await store.load();
  p.log.info(
    `Configuration found: ${pc.bold(String(Object.keys(config.servers).length))} server(s), ${pc.bold(String(config.providers.length))} provider(s)`,
  );
  const action = handleCancel(
    await p.select({
      message: "What would you like to do?",
      options: [
        { value: "add" as const, label: "Add server" },
        { value: "remove" as const, label: "Remove server" },
        { value: "providers" as const, label: "Change providers" },
        { value: "sync" as const, label: "Sync configs" },
        { value: "exit" as const, label: "Exit" },
      ],
    }),
  );
  if (action === BACK || action === "exit") {
    p.outro("See you later!");
    return;
  }

  if (action === "add") {
    const result = await runServerWizard(Object.keys(config.servers));
    if (!result) return p.cancel("Operation canceled.");
    const updated = await store.addServer(result.name, result.config);
    p.log.success(`Server ${pc.cyan(`"${result.name}"`)} added.`);
    printSyncResults(ctx, await syncConfig(ctx, store, updated));
    return;
  }

  if (action === "remove") {
    const names = Object.keys(config.servers);
    if (names.length === 0) return p.log.info("No servers to remove.");
    const selected = handleCancel(
      await p.select({
        message: "Which server should be removed?",
        options: names.map((name) => ({ value: name, label: pc.cyan(name) })),
      }),
    );
    if (selected === BACK) return;
    const confirmed = handleCancel(
      await p.confirm({ message: `Confirm removal of "${selected}"?`, initialValue: false }),
    );
    if (confirmed === BACK || !confirmed) return;
    const updated = await store.removeServer(selected);
    p.log.success(`Server ${pc.cyan(`"${selected}"`)} removed.`);
    printSyncResults(ctx, await syncConfig(ctx, store, updated));
    return;
  }

  if (action === "providers") {
    const selected = await runProviderWizard(ctx.registry, config.providers, store.scope);
    if (selected === BACK) return;
    const removed = ctx.registry.getByNames(
      config.providers.filter((name) => !selected.includes(name)),
    );
    const updated = await store.setProviders(selected);
    p.log.success("Providers updated.");
    if (removed.length > 0) {
      printSyncResults(
        ctx,
        await cleanupRemovedProviders(
          removed,
          { projectRoot: ctx.projectRoot, scope: store.scope },
          ctx.fileSystem,
        ),
      );
    }
    printSyncResults(ctx, await syncConfig(ctx, store, updated));
    return;
  }

  printSyncResults(ctx, await syncConfig(ctx, store, config));
}

async function handleNewConfig(ctx: CliContext, store: ConfigStore): Promise<void> {
  const detector = new ConfigDetector({
    projectRoot: ctx.projectRoot,
    scope: store.scope,
    registry: ctx.registry,
    fileSystem: ctx.fileSystem,
  });
  const detections = await detector.detectAll();
  let servers: Record<string, McpServerConfig> = {};

  if (detections.length > 0) {
    p.note(
      detections
        .map((detection) => {
          const provider = ctx.registry.get(detection.provider);
          return `${pc.magenta(provider?.displayName ?? detection.provider)} - ${pc.bold(String(detection.servers.length))} server(s)`;
        })
        .join("\n"),
      "Detected MCP configurations",
    );
    const shouldImport = handleCancel(
      await p.confirm({ message: "Import these configurations?", initialValue: true }),
    );
    if (shouldImport === BACK) return p.cancel("Operation canceled.");
    if (shouldImport) {
      for (const detection of detections) {
        const provider = ctx.registry.get(detection.provider);
        if (!provider) continue;
        try {
          servers = {
            ...servers,
            ...provider.parse(await ctx.fileSystem.read(detection.filePath)),
          };
        } catch (error) {
          ctx.output.debug(
            `Could not import ${detection.filePath}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      p.log.success(`Imported ${pc.bold(String(Object.keys(servers).length))} server(s).`);
    }
  }

  if (Object.keys(servers).length === 0) {
    p.log.step("Let's configure your MCP servers.");
    while (true) {
      const result = await runServerWizard(Object.keys(servers));
      if (!result) {
        if (Object.keys(servers).length === 0) {
          p.cancel("Operation canceled.");
          return;
        }
        break;
      }
      servers[result.name] = result.config;
      p.log.success(`Server ${pc.cyan(`"${result.name}"`)} added.`);
      const more = handleCancel(
        await p.confirm({ message: "Add another server?", initialValue: false }),
      );
      if (more === BACK || !more) break;
    }
  }

  const providerNames = await runProviderWizard(ctx.registry, [], store.scope);
  if (providerNames === BACK) return p.cancel("Operation canceled.");
  if (providerNames.length === 0) p.log.warn("No providers selected.");

  p.note(
    `${pc.bold("Servers:")} ${Object.keys(servers).map(pc.cyan).join(", ")}\n${pc.bold("Providers:")} ${providerNames.length > 0 ? providerNames.map((name) => pc.magenta(ctx.registry.get(name)?.displayName ?? name)).join(", ") : pc.dim("none")}`,
    "Summary",
  );
  const confirmed = handleCancel(
    await p.confirm({ message: "Confirm and generate files?", initialValue: true }),
  );
  if (confirmed === BACK || !confirmed) return p.cancel("Operation canceled.");

  const config: McpConfigFile = { version: 1, providers: providerNames, servers };
  const saved = await store.save(config);
  p.log.success(`Created: ${pc.cyan(store.getDisplayPath())}`);
  if (providerNames.length > 0) printSyncResults(ctx, await syncConfig(ctx, store, saved));
  p.outro(pc.green("Configuration complete!"));
}
