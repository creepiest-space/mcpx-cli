import { describe, expect, test } from 'bun:test';

import type { McpServerConfig } from '@creepiest-space/mcpx-core';

import { mergeImportedServers } from '../src/import-conflicts.ts';

const existing: McpServerConfig = {
  enabled: true,
  transport: 'stdio',
  command: 'existing',
};
const incoming: McpServerConfig = {
  enabled: true,
  transport: 'stdio',
  command: 'incoming',
};

describe('import conflict merging', () => {
  test('skips conflicts without mutating canonical servers', async () => {
    const result = await mergeImportedServers(
      { github: existing },
      { github: incoming },
      'claude-code',
      async () => ({ action: 'skip' }),
    );

    expect(result.servers.github).toEqual(existing);
    expect(result.imported).toEqual([]);
    expect(result.skipped).toEqual(['github']);
  });

  test('overwrites conflicts only when explicitly requested', async () => {
    const result = await mergeImportedServers(
      { github: existing },
      { github: incoming },
      'claude-code',
      async () => ({ action: 'overwrite' }),
    );

    expect(result.servers.github).toEqual(incoming);
    expect(result.imported).toEqual(['github']);
  });

  test('renames conflicts deterministically', async () => {
    const result = await mergeImportedServers(
      { github: existing },
      { github: incoming },
      'claude-code',
      async (conflict) => {
        expect(conflict.source).toBe('claude-code');
        expect(conflict.occupiedNames).toEqual(['github']);
        return { action: 'rename', name: 'github-claude' };
      },
    );

    expect(result.servers).toEqual({ github: existing, 'github-claude': incoming });
    expect(result.imported).toEqual(['github-claude']);
  });
});
