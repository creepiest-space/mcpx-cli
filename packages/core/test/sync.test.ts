import { describe, expect, test } from 'bun:test';

import { cleanupRemovedProviders, syncAllProviders, syncProvider } from '../src/sync/index.ts';
import { FakeProvider } from './support/fake-provider.ts';
import { MemoryFileSystem } from './support/memory-file-system.ts';

const context = { projectRoot: '/workspace/project', scope: 'project' as const };
const servers = {
  github: { enabled: true, transport: 'stdio' as const, command: 'npx' },
};

describe('provider sync', () => {
  test('reports created, unchanged, and updated states', async () => {
    const provider = new FakeProvider('claude-code');
    const fileSystem = new MemoryFileSystem();

    expect((await syncProvider(provider, servers, context, fileSystem)).status).toBe('created');
    expect((await syncProvider(provider, servers, context, fileSystem)).status).toBe('unchanged');
    expect(
      (
        await syncProvider(
          provider,
          {
            github: { ...servers.github, args: ['server'] },
          },
          context,
          fileSystem,
        )
      ).status,
    ).toBe('updated');
  });

  test('syncs multiple providers in registry order', async () => {
    const providers = [new FakeProvider('claude-code'), new FakeProvider('openai-codex')];
    const results = await syncAllProviders(providers, servers, context, new MemoryFileSystem());

    expect(results.map((result) => result.provider)).toEqual(['claude-code', 'openai-codex']);
    expect(results.every((result) => result.status === 'created')).toBe(true);
  });

  test('returns an error for unsupported scope', async () => {
    const provider = new FakeProvider('vscode', { project: true, global: false });
    const result = await syncProvider(
      provider,
      servers,
      { ...context, scope: 'global' },
      new MemoryFileSystem(),
    );

    expect(result.status).toBe('error');
    expect(result.error).toContain('does not support global');
  });

  test('cleans managed content without deleting provider files', async () => {
    const provider = new FakeProvider('claude-code');
    const fileSystem = new MemoryFileSystem();
    const filePath = provider.resolveConfigPath(context.projectRoot, context.scope);
    fileSystem.files.set(filePath, provider.generate(servers));

    expect(await cleanupRemovedProviders([provider], context, fileSystem)).toEqual([
      {
        provider: 'claude-code',
        filePath,
        status: 'cleaned',
      },
    ]);
    expect(fileSystem.files.get(filePath)).toBe('{}\n');
    expect(await cleanupRemovedProviders([provider], context, fileSystem)).toEqual([
      {
        provider: 'claude-code',
        filePath,
        status: 'unchanged',
      },
    ]);
  });

  test('uses an existing fallback path and cleans all candidates', async () => {
    const provider = new FakeProvider('opencode');
    const preferred = '/global/opencode.jsonc';
    const fallback = '/global/opencode.json';
    provider.resolveConfigPaths = () => [preferred, fallback];
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set(fallback, provider.generate(servers));

    const result = await syncProvider(provider, servers, context, fileSystem);
    expect(result.filePath).toBe(fallback);
    expect(result.status).toBe('unchanged');

    fileSystem.files.set(preferred, provider.generate(servers));
    const cleanup = await cleanupRemovedProviders([provider], context, fileSystem);
    expect(cleanup.map((entry) => entry.filePath)).toEqual([preferred, fallback]);
    expect(cleanup.every((entry) => entry.status === 'cleaned')).toBe(true);
    expect(fileSystem.files.has(preferred)).toBe(true);
    expect(fileSystem.files.has(fallback)).toBe(true);
  });

  test('leaves existing content unchanged when generation or cleanup fails', async () => {
    const provider = new FakeProvider('claude-code');
    const fileSystem = new MemoryFileSystem();
    const filePath = provider.resolveConfigPath(context.projectRoot, context.scope);
    const malformed = '{ malformed';
    fileSystem.files.set(filePath, malformed);

    provider.generate = () => {
      throw new SyntaxError('invalid provider config');
    };
    const sync = await syncProvider(provider, servers, context, fileSystem);
    expect(sync.status).toBe('error');
    expect(fileSystem.files.get(filePath)).toBe(malformed);

    const cleanup = await cleanupRemovedProviders([provider], context, fileSystem);
    expect(cleanup).toEqual([
      {
        provider: 'claude-code',
        filePath,
        status: 'error',
        error: expect.stringContaining('JSON'),
      },
    ]);
    expect(fileSystem.files.get(filePath)).toBe(malformed);
  });

  test('preflights every provider before writing cleanup changes', async () => {
    const first = new FakeProvider('claude-code');
    const second = new FakeProvider('openai-codex');
    const fileSystem = new MemoryFileSystem();
    const firstPath = first.resolveConfigPath(context.projectRoot, context.scope);
    const secondPath = second.resolveConfigPath(context.projectRoot, context.scope);
    const firstContent = first.generate(servers);
    const malformed = '{ malformed';
    fileSystem.files.set(firstPath, firstContent);
    fileSystem.files.set(secondPath, malformed);

    const result = await cleanupRemovedProviders([first, second], context, fileSystem);

    expect(result).toEqual([
      {
        provider: 'openai-codex',
        filePath: secondPath,
        status: 'error',
        error: expect.stringContaining('JSON'),
      },
    ]);
    expect(fileSystem.files.get(firstPath)).toBe(firstContent);
    expect(fileSystem.files.get(secondPath)).toBe(malformed);
  });

  test('rolls back earlier cleanup writes when a later write fails', async () => {
    const first = new FakeProvider('claude-code');
    const second = new FakeProvider('openai-codex');
    const fileSystem = new MemoryFileSystem();
    const firstPath = first.resolveConfigPath(context.projectRoot, context.scope);
    const secondPath = second.resolveConfigPath(context.projectRoot, context.scope);
    const firstContent = first.generate(servers);
    const secondContent = second.generate(servers);
    fileSystem.files.set(firstPath, firstContent);
    fileSystem.files.set(secondPath, secondContent);
    const write = fileSystem.write.bind(fileSystem);
    let failed = false;
    fileSystem.write = async (path, content) => {
      if (path === secondPath && !failed) {
        failed = true;
        throw new Error('disk full');
      }
      await write(path, content);
    };

    const result = await cleanupRemovedProviders([first, second], context, fileSystem);

    expect(result).toEqual([
      {
        provider: 'openai-codex',
        filePath: secondPath,
        status: 'error',
        error: 'disk full',
      },
    ]);
    expect(fileSystem.files.get(firstPath)).toBe(firstContent);
    expect(fileSystem.files.get(secondPath)).toBe(secondContent);
  });

  test('converts path resolver failures into provider errors', async () => {
    const provider = new FakeProvider('claude-code');
    provider.resolveConfigPath = () => {
      throw new Error('resolver failed');
    };

    const result = await syncProvider(provider, servers, context, new MemoryFileSystem());
    expect(result.status).toBe('error');
    expect(result.error).toBe('resolver failed');
  });
});
