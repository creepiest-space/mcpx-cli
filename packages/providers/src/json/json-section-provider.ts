import { ServerNameSchema } from "@mcpx/core";
import type {
  ConfigScope,
  McpServerConfig,
  Provider,
  ProviderGenerateContext,
  ProviderMetadata,
} from "@mcpx/core";
import { updateJsoncTopLevelSection } from "../jsonc/document.ts";
import { resolveProviderPath } from "../shared/paths.ts";
import { getObject, isJsonObject, parseJsonObject, type JsonObject } from "./value.ts";

export abstract class JsonSectionProvider implements Provider {
  readonly name;
  readonly displayName;
  readonly configPath;
  readonly globalConfigPath;
  readonly capabilities;

  protected constructor(
    metadata: ProviderMetadata,
    private readonly sectionKey: string,
  ) {
    this.name = metadata.name;
    this.displayName = metadata.displayName;
    this.configPath = metadata.configPath;
    this.globalConfigPath = metadata.globalConfigPath;
    this.capabilities = metadata.capabilities;
  }

  generate(
    servers: Readonly<Record<string, McpServerConfig>>,
    context: ProviderGenerateContext,
  ): string {
    const section: Record<string, unknown> = {};
    for (const [name, server] of Object.entries(servers)) {
      const encoded = this.encodeServer(server);
      if (encoded !== undefined) section[name] = encoded;
    }

    if (context.existingContent !== undefined) {
      try {
        return ensureFinalNewline(
          updateJsoncTopLevelSection(context.existingContent, this.sectionKey, section),
        );
      } catch {
        // Invalid existing provider files are replaced with a valid document.
      }
    }

    return `${JSON.stringify(this.createDocument(section), null, 2)}\n`;
  }

  parse(content: string): Record<string, McpServerConfig> {
    const root = parseJsonObject(content);
    const section = getObject(root, this.sectionKey) ?? {};
    const servers: Record<string, McpServerConfig> = {};

    for (const [name, raw] of Object.entries(section)) {
      ServerNameSchema.parse(name);
      if (!isJsonObject(raw)) throw new TypeError(`Expected server ${name} to be an object`);
      servers[name] = this.decodeServer(raw);
    }

    return servers;
  }

  resolveConfigPath(projectRoot: string, scope: ConfigScope): string {
    return resolveProviderPath(this, projectRoot, scope);
  }

  protected createDocument(section: Record<string, unknown>): JsonObject {
    return { [this.sectionKey]: section };
  }

  protected abstract encodeServer(server: McpServerConfig): JsonObject | undefined;
  protected abstract decodeServer(raw: JsonObject): McpServerConfig;
}

function ensureFinalNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
