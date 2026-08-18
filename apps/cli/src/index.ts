#!/usr/bin/env bun

import { runMain } from "citty";
import { mainCommand } from "./main.ts";

await runMain(mainCommand);
