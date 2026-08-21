import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const directories: string[] = [];
const cliPath = resolve(import.meta.dir, '../src/index.ts');

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('CLI process exit codes', () => {
  test('sync and status fail when canonical configuration is missing', async () => {
    const directory = await createDirectory();

    expect((await runCli('sync', directory)).exitCode).toBe(1);
    expect((await runCli('status', directory)).exitCode).toBe(1);
  });

  test('status succeeds for a valid synchronized empty configuration', async () => {
    const directory = await createDirectory();
    await mkdir(join(directory, '.agents'), { recursive: true });
    await writeFile(
      join(directory, '.agents/mcp.json'),
      `${JSON.stringify({ version: 1, providers: [], servers: {} }, null, 2)}\n`,
    );

    const result = await runCli('status', directory);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('All providers are synchronized.');
    expect(result.stderr).toBe('');
  });

  test('renders malformed canonical configuration without a stack trace', async () => {
    const directory = await createDirectory();
    await mkdir(join(directory, '.agents'), { recursive: true });
    await writeFile(join(directory, '.agents/mcp.json'), '{ malformed\n');

    const result = await runCli('status', directory);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Could not read canonical configuration');
    expect(result.stderr).not.toContain('at async');
    expect(result.stderr).not.toContain('apps/cli/dist/index.js:');
  });
});

async function createDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'mcpx-cli-process-'));
  directories.push(directory);
  return directory;
}

async function runCli(
  command: string,
  directory: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const child = Bun.spawn(
    [process.execPath, cliPath, command, '--dir', directory, '--scope', 'project'],
    {
      cwd: resolve(import.meta.dir, '../../..'),
      env: { ...process.env, NO_COLOR: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { exitCode, stdout, stderr };
}
