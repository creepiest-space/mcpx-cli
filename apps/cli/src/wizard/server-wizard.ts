import * as p from "@clack/prompts";
import { McpServerConfigSchema, ServerNameSchema, type McpServerConfig } from "@mcpx/core";
import pc from "picocolors";
import { BACK, handleCancel, runSteps, type Step } from "./step-runner.ts";

export interface ServerWizardResult {
  name: string;
  config: McpServerConfig;
}

interface ServerState {
  name: string;
  transport: "stdio" | "http";
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
  headers: Record<string, string>;
}

export async function runServerWizard(
  existingNames: readonly string[] = [],
  initialName?: string,
): Promise<ServerWizardResult | null> {
  const nameStep: Step<ServerState> = async () => {
    const result = handleCancel(
      await p.text({
        message: "MCP server name",
        placeholder: "github, jira, my-server",
        initialValue: initialName,
        validate(value) {
          const name = value?.trim() ?? "";
          const parsed = ServerNameSchema.safeParse(name);
          if (!parsed.success) return parsed.error.issues[0]?.message;
          if (existingNames.includes(name)) return `"${name}" already exists`;
        },
      }),
    );
    return result === BACK ? BACK : { name: result.trim() };
  };

  const transportStep: Step<ServerState> = async () => {
    const result = handleCancel(
      await p.select({
        message: "Transport type",
        options: [
          { value: "stdio" as const, label: pc.green("stdio"), hint: pc.dim("local command") },
          { value: "http" as const, label: pc.blue("http"), hint: pc.dim("remote server") },
        ],
      }),
    );
    return result === BACK ? BACK : { transport: result };
  };

  const stdioStep: Step<ServerState> = async (state) => {
    if (state.transport !== "stdio") return {};
    const command = handleCancel(
      await p.text({
        message: "Command",
        placeholder: "npx, uvx, docker",
        validate: (value) => (value?.trim() ? undefined : "Command is required"),
      }),
    );
    if (command === BACK) return BACK;
    const argumentsValue = handleCancel(
      await p.text({
        message: "Arguments",
        placeholder: "comma-separated, leave empty for none",
        initialValue: "",
      }),
    );
    if (argumentsValue === BACK) return BACK;
    return {
      command: command.trim(),
      args: argumentsValue
        .split(",")
        .map((argument) => argument.trim())
        .filter(Boolean),
    };
  };

  const stdioEnvStep: Step<ServerState> = async (state) => {
    if (state.transport !== "stdio") return {};
    return { env: await collectPairs("environment variables", "Variable name", "API_KEY") };
  };

  const httpStep: Step<ServerState> = async (state) => {
    if (state.transport !== "http") return {};
    const result = handleCancel(
      await p.text({
        message: "Server URL",
        placeholder: "https://mcp.example.com/api",
        validate(value) {
          const parsed = McpServerConfigSchema.safeParse({
            enabled: true,
            transport: "http",
            url: value,
          });
          return parsed.success ? undefined : parsed.error.issues[0]?.message;
        },
      }),
    );
    return result === BACK ? BACK : { url: result.trim() };
  };

  const httpHeadersStep: Step<ServerState> = async (state) => {
    if (state.transport !== "http") return {};
    return { headers: await collectPairs("headers", "Header name", "Authorization") };
  };

  const result = await runSteps<ServerState>([
    nameStep,
    transportStep,
    stdioStep,
    stdioEnvStep,
    httpStep,
    httpHeadersStep,
  ]);
  if (!result) return null;

  const config =
    result.transport === "stdio"
      ? McpServerConfigSchema.parse({
          enabled: true,
          transport: "stdio",
          command: result.command,
          ...(result.args.length > 0 && { args: result.args }),
          ...(Object.keys(result.env).length > 0 && { env: result.env }),
        })
      : McpServerConfigSchema.parse({
          enabled: true,
          transport: "http",
          url: result.url,
          ...(Object.keys(result.headers).length > 0 && { headers: result.headers }),
        });

  return { name: result.name, config };
}

async function collectPairs(
  kind: string,
  keyLabel: string,
  keyPlaceholder: string,
): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  const shouldAdd = handleCancel(
    await p.confirm({
      message: `Add ${kind}?`,
      initialValue: false,
    }),
  );
  if (shouldAdd === BACK || !shouldAdd) return values;

  let addMore = true;
  while (addMore) {
    const key = handleCancel(
      await p.text({
        message: keyLabel,
        placeholder: keyPlaceholder,
        validate: (value) => (value?.trim() ? undefined : `${keyLabel} is required`),
      }),
    );
    if (key === BACK) break;
    const value = handleCancel(await p.text({ message: `Value for ${key}` }));
    if (value === BACK) break;
    values[key.trim()] = value;

    const more = handleCancel(
      await p.confirm({ message: `Add another ${kind.replace(/s$/, "")}?`, initialValue: false }),
    );
    if (more === BACK) break;
    addMore = more;
  }
  return values;
}
