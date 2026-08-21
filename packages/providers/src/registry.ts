import { ProviderRegistry } from '@creepiest-space/mcpx-core';

import { AntigravityCliProvider } from './antigravity-cli.ts';
import { ClaudeCodeProvider } from './claude-code.ts';
import { CopilotCliProvider } from './copilot-cli.ts';
import { CursorProvider } from './cursor.ts';
import { IntellijProvider } from './intellij.ts';
import { KimiCliProvider } from './kimi-cli.ts';
import { OpenAICodexProvider } from './openai-codex.ts';
import { OpenCodeProvider } from './opencode.ts';
import type { ProviderPathOptions } from './shared/paths.ts';
import { VscodeProvider } from './vscode.ts';

export function createProviderRegistry(options: ProviderPathOptions = {}): ProviderRegistry {
  return new ProviderRegistry()
    .register(new ClaudeCodeProvider(options))
    .register(new CursorProvider(options))
    .register(new AntigravityCliProvider(options))
    .register(new KimiCliProvider(options))
    .register(new OpenAICodexProvider(options))
    .register(new OpenCodeProvider(options))
    .register(new CopilotCliProvider(options))
    .register(new VscodeProvider())
    .register(new IntellijProvider());
}
