import { McpServerConfigSchema, type McpServerConfig } from '@creepiest-space/mcpx-core';

import { parseJsoncDocument } from '../jsonc/document.ts';

export type JsonObject = Record<string, unknown>;

export function parseJsonObject(content: string): JsonObject {
  const value = parseJsoncDocument(content);
  if (!isJsonObject(value)) throw new TypeError('Expected a JSON object at the document root');
  return value;
}

export function getObject(value: JsonObject, key: string): JsonObject | undefined {
  const child = value[key];
  if (child === undefined) return undefined;
  if (!isJsonObject(child)) throw new TypeError(`Expected ${key} to be an object`);
  return child;
}

export function getString(value: JsonObject, key: string): string | undefined {
  const child = value[key];
  if (child === undefined) return undefined;
  if (typeof child !== 'string') throw new TypeError(`Expected ${key} to be a string`);
  return child;
}

export function getBoolean(value: JsonObject, key: string): boolean | undefined {
  const child = value[key];
  if (child === undefined) return undefined;
  if (typeof child !== 'boolean') throw new TypeError(`Expected ${key} to be a boolean`);
  return child;
}

export function getStringArray(value: JsonObject, key: string): string[] | undefined {
  const child = value[key];
  if (child === undefined) return undefined;
  if (!Array.isArray(child) || !child.every((entry) => typeof entry === 'string')) {
    throw new TypeError(`Expected ${key} to be an array of strings`);
  }
  return [...child];
}

export function getStringRecord(
  value: JsonObject,
  key: string,
): Record<string, string> | undefined {
  const child = value[key];
  if (child === undefined) return undefined;
  if (!isJsonObject(child)) throw new TypeError(`Expected ${key} to be an object of strings`);

  const result: Record<string, string> = {};
  for (const [name, entry] of Object.entries(child)) {
    if (typeof entry !== 'string') {
      throw new TypeError(`Expected ${key} to be an object of strings`);
    }
    result[name] = entry;
  }
  return result;
}

export function parseCanonicalServer(value: unknown): McpServerConfig {
  return McpServerConfigSchema.parse(value);
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
