import type { z } from 'zod';

import { McpConfigFileSchema, type McpConfigFile } from '../types/index.ts';

export function isMcpConfigFile(value: unknown): value is McpConfigFile {
  return McpConfigFileSchema.safeParse(value).success;
}

export function assertMcpConfigFile(value: unknown): asserts value is McpConfigFile {
  McpConfigFileSchema.parse(value);
}

export function parseMcpConfigFile(value: unknown): McpConfigFile {
  return McpConfigFileSchema.parse(value);
}

export function safeParseMcpConfigFile(value: unknown): z.ZodSafeParseResult<McpConfigFile> {
  return McpConfigFileSchema.safeParse(value);
}
