#!/usr/bin/env node

import { runMain } from 'citty';

import { mainCommand } from './main.ts';

await runMain(mainCommand);
