import pc from "picocolors";
import type { Output } from "./output.ts";

export class PlainOutput implements Output {
  constructor(private readonly verbose = false) {}

  success(message: string): void {
    console.log(`${pc.green("✓")} ${message}`);
  }

  warning(message: string): void {
    console.warn(`${pc.yellow("!")} ${message}`);
  }

  error(message: string): void {
    console.error(`${pc.red("✗")} ${message}`);
  }

  info(message: string): void {
    console.log(message);
  }

  debug(message: string): void {
    if (this.verbose) console.debug(pc.dim(message));
  }
}
