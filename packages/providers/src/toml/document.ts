import { parse as parseToml } from 'smol-toml';

export function updateTomlTopLevelSection(
  content: string,
  key: string,
  replacement: string,
): string {
  const document = parseDocument(content);
  const edited = editSection(content, key, replacement, key in document);
  parseDocument(edited);
  return edited;
}

export function removeTomlTopLevelSection(content: string, key: string): string {
  const document = parseDocument(content);
  if (!(key in document)) return content;

  const edited = editSection(content, key, undefined, true);
  parseDocument(edited);
  return edited;
}

function editSection(
  content: string,
  key: string,
  replacement: string | undefined,
  sectionExists: boolean,
): string {
  const lines = splitLines(content);
  const removed = new Set<number>();
  const comments: string[] = [];
  const headerPattern = new RegExp(
    `^\\s*\\[{1,2}\\s*(?:${escapeRegExp(key)}|"${escapeRegExp(key)}"|'${escapeRegExp(key)}')\\s*(?:\\.|\\]{1,2})`,
  );
  const assignmentPattern = new RegExp(
    `^\\s*(?:${escapeRegExp(key)}|"${escapeRegExp(key)}"|'${escapeRegExp(key)}')\\s*=`,
  );
  const anyHeaderPattern = /^\s*\[{1,2}/;
  let firstRemoved: number | undefined;
  let inManagedSection = false;
  let atRoot = true;

  for (const [index, line] of lines.entries()) {
    if (headerPattern.test(line)) {
      inManagedSection = true;
      atRoot = false;
    } else if (anyHeaderPattern.test(line)) {
      inManagedSection = false;
      atRoot = false;
    }

    const managedAssignment = atRoot && assignmentPattern.test(line);
    if (!inManagedSection && !managedAssignment) continue;

    firstRemoved ??= index;
    removed.add(index);
    if (/^\s*#/.test(line)) comments.push(line);
  }

  if (sectionExists && firstRemoved === undefined) {
    throw new SyntaxError(`Unsupported TOML representation for top-level section "${key}"`);
  }

  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const insertion = [
    ...comments,
    ...(replacement === undefined ? [] : splitLines(replacement.replaceAll('\n', eol))),
  ];

  if (firstRemoved === undefined) return appendSection(content, insertion.join(''), eol);

  const output: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (index === firstRemoved) output.push(...insertion);
    if (!removed.has(index)) output.push(line);
  }
  return ensureFinalNewline(output.join(''), eol);
}

function parseDocument(content: string): Record<string, unknown> {
  const value: unknown = parseToml(content);
  if (!isRecord(value)) {
    throw new TypeError('Expected TOML root to be an object');
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function appendSection(content: string, section: string, eol: string): string {
  if (section.length === 0) return content;
  if (content.length === 0) return ensureFinalNewline(section, eol);
  const base = ensureFinalNewline(content, eol);
  const separator = base.endsWith(`${eol}${eol}`) ? '' : eol;
  return `${base}${separator}${ensureFinalNewline(section, eol)}`;
}

function ensureFinalNewline(content: string, eol: string): string {
  return content.endsWith('\n') ? content : `${content}${eol}`;
}

function splitLines(content: string): string[] {
  return content.match(/[^\r\n]*(?:\r\n|\n|$)/g)?.filter((line) => line.length > 0) ?? [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
