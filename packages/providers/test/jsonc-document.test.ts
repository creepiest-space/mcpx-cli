import { describe, expect, test } from 'bun:test';

import {
  JsoncDocumentError,
  parseJsoncDocument,
  removeJsoncTopLevelSection,
  updateJsoncTopLevelSection,
} from '../src/jsonc/document.ts';

describe('JSONC document', () => {
  test('parses comments and trailing commas', () => {
    expect(parseJsoncDocument('{\n  // comment\n  "enabled": true,\n}\n')).toEqual({
      enabled: true,
    });
  });

  test('updates one section while preserving comments and unrelated settings', () => {
    const original = `{
  // Keep this comment.
  "theme": "dark",
  "mcp": {
    "old": true,
  },
}
`;
    const updated = updateJsoncTopLevelSection(original, 'mcp', { server: { enabled: true } });

    expect(updated).toContain('// Keep this comment.');
    expect(updated).toContain('"theme": "dark"');
    expect(parseJsoncDocument(updated)).toEqual({
      theme: 'dark',
      mcp: { server: { enabled: true } },
    });
  });

  test('rejects malformed documents', () => {
    expect(() => parseJsoncDocument('{ "mcp": }')).toThrow(JsoncDocumentError);
  });

  test('removes one section while preserving comments and unrelated settings', () => {
    const content = `{
  // keep this
  "theme": "dark",
  "mcp": { "old": {} },
}
`;
    const output = removeJsoncTopLevelSection(content, 'mcp');
    expect(output).toContain('// keep this');
    expect(parseJsoncDocument(output)).toEqual({ theme: 'dark' });
    expect(removeJsoncTopLevelSection(output, 'mcp')).toBe(output);
  });
});
