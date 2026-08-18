import { resolve } from "node:path";
import { createCliContext, type CliContext } from "./context.ts";

interface RuntimeOptions {
  dir?: string;
  verbose?: boolean;
  scope?: string;
}

let rootOptions: RuntimeOptions = {};

export function setRootOptions(options: RuntimeOptions): void {
  rootOptions = options;
}

export function createCommandContext(options: RuntimeOptions): CliContext {
  return createCliContext({
    projectRoot: resolve(options.dir ?? rootOptions.dir ?? process.cwd()),
    verbose: options.verbose ?? rootOptions.verbose ?? false,
    scope: normalizeScope(options.scope ?? rootOptions.scope),
    environment: process.env,
  });
}

function normalizeScope(scope: string | undefined): "project" | "global" | undefined {
  return scope === "project" || scope === "global" ? scope : undefined;
}
