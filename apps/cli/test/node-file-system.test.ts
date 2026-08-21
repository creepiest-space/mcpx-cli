import { afterEach, describe, expect, test } from 'bun:test';
import { chmod, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NodeFileSystem } from '../src/infrastructure/node-file-system.ts';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('NodeFileSystem', () => {
  test('writes atomically and removes files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mcpx-fs-test-'));
    directories.push(directory);
    const filePath = join(directory, 'nested', 'mcp.json');
    const fileSystem = new NodeFileSystem();

    expect(await fileSystem.exists(filePath)).toBe(false);
    await fileSystem.write(filePath, 'first\n');
    await chmod(filePath, 0o644);
    await fileSystem.write(filePath, 'second\n');

    expect(await fileSystem.read(filePath)).toBe('second\n');
    if (process.platform !== 'win32') {
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    }
    expect(
      (await readdir(join(directory, 'nested'))).filter((name) => name.endsWith('.mcpx-tmp')),
    ).toEqual([]);
    expect(await fileSystem.remove(filePath)).toBe(true);
    expect(await fileSystem.remove(filePath)).toBe(false);
  });
});
