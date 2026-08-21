import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const releaseTag = process.env.RELEASE_TAG;
assert.ok(releaseTag, 'RELEASE_TAG must be set');

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const expectedTag = `v${packageJson.version}`;

assert.equal(
  releaseTag,
  expectedTag,
  `Release tag ${JSON.stringify(releaseTag)} does not match package version ${JSON.stringify(packageJson.version)}`,
);

console.log(`Release tag ${releaseTag} matches package version ${packageJson.version}.`);
