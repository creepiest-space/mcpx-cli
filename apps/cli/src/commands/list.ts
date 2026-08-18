import pc from "picocolors";
import type { CliContext } from "../context.ts";
import { loadStore } from "./shared.ts";

export async function listCommand(ctx: CliContext): Promise<void> {
  const loaded = await loadStore(ctx);
  if (!loaded) return;
  const entries = Object.entries(loaded.config.servers);
  if (entries.length === 0) {
    ctx.output.info("No MCP servers configured.");
  } else {
    ctx.output.info(`${pc.bold(String(entries.length))} server(s):`);
    for (const [name, server] of entries) {
      const endpoint =
        server.transport === "stdio"
          ? [server.command, ...(server.args ?? [])].join(" ")
          : server.url;
      const state = server.enabled ? pc.green("●") : pc.dim("○");
      const transport = pc.dim(`[${server.transport}]`);
      ctx.output.info(`  ${state} ${pc.bold(name)} ${transport} ${pc.cyan(endpoint)}`);
    }
  }

  const providers = loaded.config.providers.map(
    (name) => ctx.registry.get(name)?.displayName ?? name,
  );
  ctx.output.info(
    `${pc.bold("Providers:")} ${providers.length > 0 ? providers.map(pc.magenta).join(", ") : pc.dim("none")}`,
  );
}
