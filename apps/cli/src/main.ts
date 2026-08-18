import { defineCommand } from "citty";
import packageMetadata from "../../../package.json" with { type: "json" };
import { commands, commonArgs } from "./commands";
import { setRootOptions } from "./runtime.ts";

export const mainCommand = defineCommand({
  meta: {
    name: "mcpx",
    version: packageMetadata.version,
    description: "Manage MCP servers across AI development tools",
  },
  args: commonArgs,
  default: "init",
  setup({ args }) {
    setRootOptions({
      dir: args.dir,
      verbose: args.verbose,
      scope: args.scope as "project" | "global" | undefined,
    });
  },
  subCommands: commands,
});
