import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

import { ConfigStore, getProjectConfigPath } from '@creepiest-space/mcpx-core';
import { createProviderRegistry } from '@creepiest-space/mcpx-providers';

import { addCommand } from '../src/commands/add.ts';
import { importCommand } from '../src/commands/import.ts';
import { listCommand } from '../src/commands/list.ts';
import { removeCommand } from '../src/commands/remove.ts';
import { statusCommand } from '../src/commands/status.ts';
import { syncCommand } from '../src/commands/sync.ts';
import { toggleCommand } from '../src/commands/toggle.ts';
import type { CliContext } from '../src/context.ts';
import { applyProviderSelection } from '../src/wizard/main-wizard.ts';
import type { ServerWizardPrompts } from '../src/wizard/server-wizard.ts';
import { MemoryFileSystem, RecordingOutput } from './support.ts';

const projectRoot = '/workspace/project';
const homeDirectory = '/users/test';

describe('CLI commands', () => {
  test('sync, list, toggle and status use the canonical store', async () => {
    const ctx = createContext();
    const store = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      scope: 'project',
      fileSystem: ctx.fileSystem,
    });
    await store.save({
      version: 1,
      providers: ['claude-code'],
      servers: {
        github: {
          enabled: true,
          transport: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-github'],
        },
      },
    });

    await syncCommand(ctx);
    expect(await ctx.fileSystem.exists(resolve(projectRoot, '.mcp.json'))).toBe(true);

    await listCommand(ctx);
    expect(ctx.output.messages.some(({ message }) => message.includes('github [stdio]'))).toBe(
      true,
    );

    await toggleCommand(ctx, 'github', false);
    expect((await store.load()).servers.github?.enabled).toBe(false);
    expect(
      ctx.registry
        .get('claude-code')!
        .parse(await ctx.fileSystem.read(resolve(projectRoot, '.mcp.json'))).github,
    ).toBeUndefined();

    await statusCommand(ctx);
    expect(
      ctx.output.messages.some(
        ({ level, message }) => level === 'success' && message.includes('synchronized'),
      ),
    ).toBe(true);
  });

  test('reports a missing canonical configuration without writing files', async () => {
    const ctx = createContext();
    expect(await syncCommand(ctx)).toBe(1);

    expect(await ctx.fileSystem.exists(getProjectConfigPath(projectRoot))).toBe(false);
    expect(ctx.output.messages).toContainEqual({
      level: 'warning',
      message: 'No .agents/mcp.json found.',
    });
  });

  test('does not fall back to global state for an implicit write scope', async () => {
    const ctx = { ...createContext(), scope: undefined };
    const globalStore = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      scope: 'global',
      fileSystem: ctx.fileSystem,
    });
    await globalStore.save({
      version: 1,
      providers: ['claude-code'],
      servers: {},
    });

    expect(await syncCommand(ctx)).toBe(1);
    expect(await globalStore.getProviders()).toEqual(['claude-code']);
    expect(await ctx.fileSystem.exists(resolve(homeDirectory, '.claude.json'))).toBe(false);
  });

  test('reports unsupported providers and does not partially synchronize', async () => {
    const ctx = { ...createContext(), scope: 'global' as const };
    const store = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      scope: 'global',
      fileSystem: ctx.fileSystem,
    });
    await store.save({
      version: 1,
      providers: ['vscode', 'claude-code'],
      servers: {},
    });

    expect(await syncCommand(ctx)).toBe(1);
    expect(await ctx.fileSystem.exists(resolve(homeDirectory, '.claude.json'))).toBe(false);
    expect(await statusCommand(ctx)).toBe(1);
    expect(
      ctx.output.messages.some(({ message }) => message.includes('does not support global')),
    ).toBe(true);
  });

  test('applies explicit import conflict policies', async () => {
    const ctx = createContext();
    const store = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      scope: 'project',
      fileSystem: ctx.fileSystem,
    });
    await store.save({
      version: 1,
      providers: [],
      servers: {
        github: { enabled: true, transport: 'stdio', command: 'canonical' },
      },
    });
    ctx.fileSystem.files.set(
      resolve(projectRoot, '.mcp.json'),
      JSON.stringify({ mcpServers: { github: { command: 'imported' } } }),
    );

    expect(await importCommand(ctx, 'claude-code', { all: true, conflict: 'skip' })).toBe(0);
    expect((await store.load()).servers.github).toHaveProperty('command', 'canonical');

    expect(await importCommand(ctx, 'claude-code', { all: true, conflict: 'overwrite' })).toBe(0);
    expect((await store.load()).servers.github).toHaveProperty('command', 'imported');
  });

  test('surfaces provider detection diagnostics', async () => {
    const ctx = createContext();
    ctx.fileSystem.files.set(resolve(projectRoot, '.mcp.json'), '{ malformed');

    expect(await importCommand(ctx, 'claude-code', { all: true })).toBe(1);
    expect(
      ctx.output.messages.some(
        ({ level, message }) => level === 'warning' && message.includes('could not be inspected'),
      ),
    ).toBe(true);
    expect(
      ctx.output.messages.some(
        ({ level, message }) => level === 'debug' && message.includes('claude-code'),
      ),
    ).toBe(true);
  });

  test('adds and removes a server through command orchestration', async () => {
    const ctx = createContext();
    const store = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      scope: 'project',
      fileSystem: ctx.fileSystem,
    });
    await store.createEmpty();
    const responses: Array<string | boolean> = ['server', 'stdio', 'npx', '', false];
    const prompts: ServerWizardPrompts = {
      async text() {
        return responses.shift() as string;
      },
      async transport() {
        return responses.shift() as 'stdio';
      },
      async confirm() {
        return responses.shift() as boolean;
      },
    };

    expect(await addCommand(ctx, undefined, prompts)).toBe(0);
    expect((await store.load()).servers.server).toEqual({
      enabled: true,
      transport: 'stdio',
      command: 'npx',
    });

    expect(await removeCommand(ctx, 'server', true)).toBe(0);
    expect((await store.load()).servers).toEqual({});
  });

  test('commits provider removal when section-aware cleanup succeeds', async () => {
    const ctx = createContext();
    const store = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      scope: 'project',
      fileSystem: ctx.fileSystem,
    });
    const config = await store.save({
      version: 1,
      providers: ['claude-code'],
      servers: {},
    });
    const providerPath = resolve(projectRoot, '.mcp.json');
    ctx.fileSystem.files.set(
      providerPath,
      '{\n  // keep\n  "theme": "dark",\n  "mcpServers": { "old": { "command": "npx" } }\n}\n',
    );

    const result = await applyProviderSelection(ctx, store, config, []);
    expect(result.config?.providers).toEqual([]);
    expect(result.cleanupResults[0]?.status).toBe('cleaned');
    expect(await ctx.fileSystem.read(providerPath)).toContain('"theme": "dark"');
    expect(await ctx.fileSystem.read(providerPath)).not.toContain('mcpServers');
  });

  test('keeps the canonical provider when cleanup fails', async () => {
    const ctx = createContext();
    const store = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      scope: 'project',
      fileSystem: ctx.fileSystem,
    });
    const config = await store.save({
      version: 1,
      providers: ['claude-code'],
      servers: {},
    });
    const providerPath = resolve(projectRoot, '.mcp.json');
    const malformed = '{ malformed';
    ctx.fileSystem.files.set(providerPath, malformed);

    const result = await applyProviderSelection(ctx, store, config, []);
    expect(result.config).toBeUndefined();
    expect(result.cleanupResults[0]?.status).toBe('error');
    expect((await store.load()).providers).toEqual(['claude-code']);
    expect(await ctx.fileSystem.read(providerPath)).toBe(malformed);
  });
});

function createContext(): CliContext & { fileSystem: MemoryFileSystem; output: RecordingOutput } {
  const fileSystem = new MemoryFileSystem();
  const output = new RecordingOutput();
  return {
    projectRoot,
    homeDirectory,
    scope: 'project',
    verbose: false,
    fileSystem,
    output,
    registry: createProviderRegistry({ homeDirectory }),
  };
}
