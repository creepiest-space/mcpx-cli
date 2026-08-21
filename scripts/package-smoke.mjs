import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'mcpx-package-smoke-'));
const npmEnvironment = {
  ...process.env,
  npm_config_cache: join(temporaryRoot, 'npm-cache'),
};

try {
  const { stdout: packOutput } = await exec(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', temporaryRoot],
    { cwd: repositoryRoot, env: npmEnvironment },
  );
  const packResult = JSON.parse(packOutput);
  assert.equal(packResult.length, 1, 'npm pack must produce exactly one archive');
  assert.deepEqual(
    packResult[0].files.map(({ path }) => path).toSorted(),
    ['LICENSE', 'README.md', 'apps/cli/dist/index.js', 'package.json'],
    'The npm archive contains unexpected or missing files',
  );

  const archive = join(temporaryRoot, packResult[0].filename);
  const installRoot = join(temporaryRoot, 'consumer');
  await mkdir(installRoot);
  await writeFile(
    join(installRoot, 'package.json'),
    `${JSON.stringify({ name: 'mcpx-package-smoke', private: true }, null, 2)}\n`,
  );

  await exec('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', archive], {
    cwd: installRoot,
    env: npmEnvironment,
  });

  const installedPackageRoot = join(installRoot, 'node_modules', '@creepiest-space', 'mcpx-cli');
  const installedPackage = JSON.parse(
    await readFile(join(installedPackageRoot, 'package.json'), 'utf8'),
  );
  assert.equal(installedPackage.engines.node, '>=20.0.0');
  assert.equal(installedPackage.bin.mcpx, 'apps/cli/dist/index.js');

  const cliPath = join(installedPackageRoot, installedPackage.bin.mcpx);
  const { stdout } = await exec(process.execPath, [cliPath, '--version'], { cwd: installRoot });
  assert.equal(stdout.trim(), installedPackage.version);

  console.log(
    `Installed ${installedPackage.name}@${installedPackage.version} and ran it with ${process.version}.`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
