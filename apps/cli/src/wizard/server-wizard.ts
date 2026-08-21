/* oxlint-disable eslint/no-await-in-loop -- Interactive prompts must run sequentially. */

import * as p from '@clack/prompts';
import {
  McpServerConfigSchema,
  ServerNameSchema,
  type McpServerConfig,
} from '@creepiest-space/mcpx-core';
import pc from 'picocolors';

import {
  BACK,
  handleCancel,
  runBranchSteps,
  runSteps,
  type BackSignal,
  type Step,
} from './step-runner.ts';

export interface ServerWizardResult {
  name: string;
  config: McpServerConfig;
}

interface TextPromptOptions {
  message: string;
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string | undefined) => string | undefined;
}

interface ConfirmPromptOptions {
  message: string;
  initialValue: boolean;
}

export interface ServerWizardPrompts {
  text(options: TextPromptOptions): Promise<string | BackSignal>;
  transport(): Promise<'stdio' | 'http' | BackSignal>;
  confirm(options: ConfirmPromptOptions): Promise<boolean | BackSignal>;
}

interface ServerState {
  name: string;
  transport: 'stdio' | 'http';
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
  headers: Record<string, string>;
}

const clackPrompts: ServerWizardPrompts = {
  async text(options) {
    return handleCancel(await p.text(options));
  },
  async transport() {
    return handleCancel(
      await p.select({
        message: 'Transport type',
        options: [
          { value: 'stdio' as const, label: pc.green('stdio'), hint: pc.dim('local command') },
          { value: 'http' as const, label: pc.blue('http'), hint: pc.dim('remote server') },
        ],
      }),
    );
  },
  async confirm(options) {
    return handleCancel(await p.confirm(options));
  },
};

export async function runServerWizard(
  existingNames: readonly string[] = [],
  initialName?: string,
  prompts: ServerWizardPrompts = clackPrompts,
): Promise<ServerWizardResult | null> {
  const nameStep: Step<ServerState> = async (state) => {
    const initialValue = state.name || initialName;
    const result = await prompts.text({
      message: 'MCP server name',
      placeholder: 'github, jira, my-server',
      ...(initialValue === undefined ? {} : { initialValue }),
      validate(value) {
        const name = value?.trim() ?? '';
        const parsed = ServerNameSchema.safeParse(name);
        if (!parsed.success) return parsed.error.issues[0]?.message;
        if (existingNames.includes(name)) return `"${name}" already exists`;
        return undefined;
      },
    });
    return result === BACK ? BACK : { name: result.trim() };
  };

  const transportStep: Step<ServerState> = async () => {
    const result = await prompts.transport();
    return result === BACK ? BACK : { transport: result };
  };

  const commandStep: Step<ServerState> = async () => {
    const result = await prompts.text({
      message: 'Command',
      placeholder: 'npx, uvx, docker',
      validate: (value) => (value?.trim() ? undefined : 'Command is required'),
    });
    return result === BACK ? BACK : { command: result.trim() };
  };

  const argumentsStep: Step<ServerState> = async () => {
    const result = await prompts.text({
      message: 'Arguments',
      placeholder: 'comma-separated, leave empty for none',
      initialValue: '',
    });
    if (result === BACK) return BACK;
    return {
      args: result
        .split(',')
        .map((argument) => argument.trim())
        .filter(Boolean),
    };
  };

  const environmentStep: Step<ServerState> = async () => {
    const env = await collectPairs(prompts, 'environment variables', 'Variable name', 'API_KEY');
    return env === BACK ? BACK : { env };
  };

  const urlStep: Step<ServerState> = async () => {
    const result = await prompts.text({
      message: 'Server URL',
      placeholder: 'https://mcp.example.com/api',
      validate(value) {
        const parsed = McpServerConfigSchema.safeParse({
          enabled: true,
          transport: 'http',
          url: value,
        });
        return parsed.success ? undefined : parsed.error.issues[0]?.message;
      },
    });
    return result === BACK ? BACK : { url: result.trim() };
  };

  const headersStep: Step<ServerState> = async () => {
    const headers = await collectPairs(prompts, 'headers', 'Header name', 'Authorization');
    return headers === BACK ? BACK : { headers };
  };

  let nameState = await runSteps<ServerState>([nameStep]);
  while (nameState) {
    const transportState = await runBranchSteps<ServerState>([transportStep], nameState);
    if (transportState === null) return null;
    if (transportState === BACK) {
      nameState = await runSteps<ServerState>([nameStep], nameState);
      continue;
    }

    const steps =
      transportState.transport === 'stdio'
        ? [commandStep, argumentsStep, environmentStep]
        : [urlStep, headersStep];
    const result = await runBranchSteps<ServerState>(steps, transportState);
    if (result === null) return null;
    if (result === BACK) continue;

    const config =
      result.transport === 'stdio'
        ? McpServerConfigSchema.parse({
            enabled: true,
            transport: 'stdio',
            command: result.command,
            ...(result.args.length > 0 && { args: result.args }),
            ...(Object.keys(result.env).length > 0 && { env: result.env }),
          })
        : McpServerConfigSchema.parse({
            enabled: true,
            transport: 'http',
            url: result.url,
            ...(Object.keys(result.headers).length > 0 && { headers: result.headers }),
          });

    return { name: result.name, config };
  }

  return null;
}

async function collectPairs(
  prompts: ServerWizardPrompts,
  kind: string,
  keyLabel: string,
  keyPlaceholder: string,
): Promise<Record<string, string> | BackSignal> {
  const values: Record<string, string> = {};
  const shouldAdd = await prompts.confirm({
    message: `Add ${kind}?`,
    initialValue: false,
  });
  if (shouldAdd === BACK) return BACK;
  if (!shouldAdd) return values;

  while (true) {
    const key = await prompts.text({
      message: keyLabel,
      placeholder: keyPlaceholder,
      validate: (value) => (value?.trim() ? undefined : `${keyLabel} is required`),
    });
    if (key === BACK) return BACK;

    const value = await prompts.text({ message: `Value for ${key}` });
    if (value === BACK) return BACK;
    values[key.trim()] = value;

    const more = await prompts.confirm({
      message: `Add another ${kind.replace(/s$/, '')}?`,
      initialValue: false,
    });
    if (more === BACK) return BACK;
    if (!more) return values;
  }
}
