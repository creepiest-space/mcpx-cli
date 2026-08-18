import { homedir } from "node:os";
import { resolve } from "node:path";
import * as p from "@clack/prompts";
import type { ConfigScope } from "@mcpx/core";
import type { CliContext } from "../context.ts";
import { runMainWizard } from "../wizard/main-wizard.ts";
import { BACK, handleCancel } from "../wizard/step-runner.ts";

export async function initCommand(ctx: CliContext): Promise<void> {
  const scope = ctx.scope ?? (await selectScope(ctx.projectRoot, ctx.homeDirectory));
  if (!scope) return;
  await runMainWizard({ ...ctx, scope });
}

async function selectScope(
  projectRoot: string,
  homeDirectory = homedir(),
): Promise<ConfigScope | undefined> {
  if (resolve(projectRoot) === resolve(homeDirectory)) return "global";
  const result = handleCancel(
    await p.select({
      message: "Where should MCPX store this configuration?",
      options: [
        { value: "project" as const, label: "Project", hint: ".agents/mcp.json in this folder" },
        { value: "global" as const, label: "Global", hint: "~/.agents/mcp.json for your user" },
      ],
    }),
  );
  return result === BACK ? undefined : result;
}
