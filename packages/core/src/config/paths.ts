import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ConfigScope } from "../types";

export const PROJECT_CONFIG_DISPLAY_PATH = ".agents/mcp.json";
export const GLOBAL_CONFIG_DISPLAY_PATH = `~/${PROJECT_CONFIG_DISPLAY_PATH}`;

export function getProjectConfigPath(projectRoot: string): string {
  return resolve(projectRoot, PROJECT_CONFIG_DISPLAY_PATH);
}

export function getGlobalConfigPath(homeDirectory = homedir()): string {
  return resolve(homeDirectory, PROJECT_CONFIG_DISPLAY_PATH);
}

export function getCanonicalConfigPath(
  projectRoot: string,
  scope: ConfigScope,
  homeDirectory = homedir(),
): string {
  return scope === "global"
    ? getGlobalConfigPath(homeDirectory)
    : getProjectConfigPath(projectRoot);
}
