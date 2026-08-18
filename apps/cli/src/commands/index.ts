import { defineCommand } from "citty";
import { createCommandContext } from "../runtime.ts";
import { addCommand } from "./add.ts";
import { importCommand } from "./import.ts";
import { initCommand } from "./init.ts";
import { listCommand } from "./list.ts";
import { removeCommand } from "./remove.ts";
import { statusCommand } from "./status.ts";
import { syncCommand } from "./sync.ts";
import { toggleCommand } from "./toggle.ts";

export const commonArgs = {
  dir: {
    type: "string" as const,
    alias: "d",
    description: "Project directory",
  },
  verbose: {
    type: "boolean" as const,
    description: "Show detailed output",
  },
  scope: {
    type: "enum" as const,
    options: ["project", "global"],
    description: "Configuration scope",
  },
};

const init = defineCommand({
  meta: { name: "init", description: "Configure MCPX interactively" },
  args: commonArgs,
  run: ({ args }) => initCommand(createCommandContext(args)),
});

const add = defineCommand({
  meta: { name: "add", description: "Add an MCP server" },
  args: {
    ...commonArgs,
    name: { type: "positional", required: false, description: "Initial server name" },
  },
  run: ({ args }) => addCommand(createCommandContext(args), args.name),
});

const remove = defineCommand({
  meta: { name: "remove", description: "Remove an MCP server" },
  args: {
    ...commonArgs,
    name: { type: "positional", required: false, description: "Server name" },
    yes: { type: "boolean", alias: "y", description: "Skip confirmation" },
  },
  run: ({ args }) => removeCommand(createCommandContext(args), args.name, args.yes ?? false),
});

function toggleRoute(enabled: boolean) {
  const name = enabled ? "enable" : "disable";
  return defineCommand({
    meta: { name, description: `${enabled ? "Enable" : "Disable"} an MCP server` },
    args: {
      ...commonArgs,
      name: { type: "positional", required: true, description: "Server name" },
    },
    run: ({ args }) => toggleCommand(createCommandContext(args), args.name as string, enabled),
  });
}

const list = defineCommand({
  meta: { name: "list", description: "List configured MCP servers" },
  args: commonArgs,
  run: ({ args }) => listCommand(createCommandContext(args)),
});

const sync = defineCommand({
  meta: { name: "sync", description: "Regenerate provider configuration files" },
  args: commonArgs,
  run: ({ args }) => syncCommand(createCommandContext(args)),
});

const importRoute = defineCommand({
  meta: { name: "import", description: "Import servers from a provider configuration" },
  args: {
    ...commonArgs,
    provider: { type: "positional", required: false, description: "Provider name" },
  },
  run: ({ args }) => importCommand(createCommandContext(args), args.provider),
});

const status = defineCommand({
  meta: { name: "status", description: "Show provider synchronization status" },
  args: commonArgs,
  run: ({ args }) => statusCommand(createCommandContext(args)),
});

export const commands = {
  init,
  add,
  remove,
  enable: toggleRoute(true),
  disable: toggleRoute(false),
  list,
  sync,
  import: importRoute,
  status,
};
