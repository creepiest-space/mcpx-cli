import { describe, expect, test } from 'bun:test';

import {
  ConfigStore,
  detectConfigScope,
  getGlobalConfigPath,
  getProjectConfigPath,
} from '../src/config/index.ts';
import { MemoryFileSystem } from './support/memory-file-system.ts';

const projectRoot = '/workspace/project';
const homeDirectory = '/users/test';

describe('ConfigStore', () => {
  test('defaults to project scope and creates a normalized config', async () => {
    const fileSystem = new MemoryFileSystem();
    const store = await ConfigStore.open({ projectRoot, homeDirectory, fileSystem });

    expect(store.scope).toBe('project');
    expect(store.getPath()).toBe(getProjectConfigPath(projectRoot));

    await store.save({
      version: 1,
      providers: ['vscode', 'openai-codex', 'vscode'],
      servers: {
        zebra: { enabled: true, transport: 'stdio', command: 'z', env: { Z: '2', A: '1' } },
        alpha: { enabled: false, transport: 'http', url: 'https://example.com/mcp' },
      },
    });

    const loaded = await store.load();
    expect(loaded.providers).toEqual(['openai-codex', 'vscode']);
    expect(Object.keys(loaded.servers)).toEqual(['alpha', 'zebra']);
    expect(loaded.servers.zebra).toEqual({
      enabled: true,
      transport: 'stdio',
      command: 'z',
      env: { A: '1', Z: '2' },
    });
  });

  test('mutates servers and providers through validated writes', async () => {
    const fileSystem = new MemoryFileSystem();
    const store = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      fileSystem,
      scope: 'project',
    });
    await store.createEmpty(['vscode']);
    await store.addServer('github', { enabled: true, transport: 'stdio', command: 'npx' });
    await store.setProviders(['openai-codex']);

    expect(await store.getProviders()).toEqual(['openai-codex']);
    expect(await store.getServers()).toHaveProperty('github');

    await store.removeServer('github');
    expect(await store.getServers()).toEqual({});
  });

  test('rejects invalid server names', async () => {
    const fileSystem = new MemoryFileSystem();
    const store = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      fileSystem,
      scope: 'project',
    });
    await store.createEmpty();

    await Promise.resolve(
      expect(
        store.addServer('bad server', {
          enabled: true,
          transport: 'stdio',
          command: 'npx',
        }),
      ).rejects.toThrow(store.getPath()),
    );
  });

  test('includes the canonical path in read errors', async () => {
    const fileSystem = new MemoryFileSystem();
    const store = await ConfigStore.open({
      projectRoot,
      homeDirectory,
      fileSystem,
      scope: 'project',
    });
    fileSystem.files.set(store.getPath(), '{ malformed');

    await Promise.resolve(expect(store.load()).rejects.toThrow(store.getPath()));
  });
});

describe('detectConfigScope', () => {
  test('prefers project config, then falls back to global config', async () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set(getProjectConfigPath(projectRoot), '{}');
    fileSystem.files.set(getGlobalConfigPath(homeDirectory), '{}');
    expect(await detectConfigScope(projectRoot, fileSystem, homeDirectory)).toBe('project');

    fileSystem.files.delete(getProjectConfigPath(projectRoot));
    expect(await detectConfigScope(projectRoot, fileSystem, homeDirectory)).toBe('global');
  });

  test('always treats the home directory as global scope', async () => {
    expect(await detectConfigScope(homeDirectory, new MemoryFileSystem(), homeDirectory)).toBe(
      'global',
    );
  });
});
