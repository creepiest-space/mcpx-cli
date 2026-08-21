import { z } from 'zod';

export const PROVIDER_NAMES = [
  'claude-code',
  'cursor',
  'antigravity-cli',
  'kimi-cli',
  'openai-codex',
  'opencode',
  'copilot-cli',
  'vscode',
  'intellij',
] as const;

export const ProviderNameSchema = z.enum(PROVIDER_NAMES);
export const ConfigScopeSchema = z.enum(['project', 'global']);
export const ServerNameSchema = z
  .string()
  .min(1, 'server name cannot be empty')
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'server name contains unsupported characters');

const StringMapSchema = z.record(z.string(), z.string());
const HttpUrlSchema = z.url('http server URL must be valid').refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, 'http server URL must use http or https');

export const StdioServerConfigSchema = z.strictObject({
  enabled: z.boolean(),
  transport: z.literal('stdio'),
  command: z.string().trim().min(1, 'stdio server command cannot be empty'),
  args: z.array(z.string()).optional(),
  env: StringMapSchema.optional(),
});

export const HttpServerConfigSchema = z.strictObject({
  enabled: z.boolean(),
  transport: z.literal('http'),
  url: HttpUrlSchema,
  headers: StringMapSchema.optional(),
});

export const McpServerConfigSchema = z.discriminatedUnion('transport', [
  StdioServerConfigSchema,
  HttpServerConfigSchema,
]);

export const McpConfigFileSchema = z.strictObject({
  version: z.literal(1),
  providers: z.array(ProviderNameSchema),
  servers: z.record(ServerNameSchema, McpServerConfigSchema),
});

export type ProviderName = z.infer<typeof ProviderNameSchema>;
export type ConfigScope = z.infer<typeof ConfigScopeSchema>;
export type ServerName = z.infer<typeof ServerNameSchema>;
export type StdioServerConfig = z.infer<typeof StdioServerConfigSchema>;
export type HttpServerConfig = z.infer<typeof HttpServerConfigSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type McpConfigFile = z.infer<typeof McpConfigFileSchema>;
