import {
  applyEdits,
  modify,
  parse,
  printParseErrorCode,
  type FormattingOptions,
  type ParseError,
} from "jsonc-parser";

export class JsoncDocumentError extends SyntaxError {
  constructor(readonly errors: readonly ParseError[]) {
    super(
      errors
        .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
        .join(", "),
    );
    this.name = "JsoncDocumentError";
  }
}

export function parseJsoncDocument(content: string): unknown {
  const errors: ParseError[] = [];
  const value: unknown = parse(content, errors, {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: false,
  });

  if (errors.length > 0) throw new JsoncDocumentError(errors);
  return value;
}

export function updateJsoncTopLevelSection(content: string, key: string, value: unknown): string {
  const document = parseJsoncDocument(content);
  if (!isRecord(document)) {
    throw new TypeError("Expected a JSON object at the root of the JSONC document");
  }

  const edits = modify(content, [key], value, {
    formattingOptions: detectFormatting(content),
  });

  return applyEdits(content, edits);
}

function detectFormatting(content: string): FormattingOptions {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const indentedLine = content.split(/\r?\n/).find((line) => /^[\t ]+\S/.test(line));
  const indent = indentedLine?.match(/^[\t ]+/)?.[0] ?? "  ";

  return {
    eol,
    insertSpaces: !indent.includes("\t"),
    tabSize: indent.includes("\t") ? 1 : indent.length,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
