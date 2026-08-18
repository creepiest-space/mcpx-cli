# MCPX CLI

MCPX manages one canonical MCP server configuration and synchronizes it with multiple AI development
tools. It provides an interactive wizard as well as commands suitable for day-to-day maintenance.

> [!WARNING]
> MCPX is under active development. Back up important provider configuration files before using
> `sync` or removing providers. The current safety and migration findings are documented in
> [`docs/audit.md`](docs/audit.md).

## Features

- One validated configuration for local `stdio` and remote HTTP MCP servers
- Project and global configuration scopes
- Interactive setup, add, remove, enable, disable, import, sync, and status flows
- Adapters for JSON, JSONC, and TOML provider formats
- Zod validation at canonical and provider boundaries
- Deterministic canonical output and atomic filesystem writes

## Requirements

- [Bun](https://bun.sh/) 1.3 or newer

## Installation

Once the package is published:

```bash
bun add --global @zerodi/mcpx-cli
mcpx --help
```

To run the current source checkout:

```bash
bun install
bun run build
bun link
mcpx --help
```

## Quick start

Run the wizard in a project directory:

```bash
mcpx init
```

Then inspect and synchronize the configuration:

```bash
mcpx list
mcpx status
mcpx sync
```

Use an explicit scope when changing global configuration:

```bash
mcpx init --scope global
mcpx add context7 --scope global
```

Without `--scope`, MCPX uses the project configuration when it exists, otherwise an existing global
configuration, and otherwise creates a project configuration. Pass `--scope project` or
`--scope global` to avoid ambiguity.

## Commands

| Command                  | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `mcpx init`              | Configure MCPX interactively                     |
| `mcpx add [name]`        | Add an MCP server                                |
| `mcpx remove [name]`     | Remove an MCP server (`-y` skips confirmation)   |
| `mcpx enable <name>`     | Enable a canonical server                        |
| `mcpx disable <name>`    | Disable a canonical server                       |
| `mcpx list`              | List canonical servers                           |
| `mcpx import [provider]` | Import servers from an existing provider config  |
| `mcpx sync`              | Regenerate selected provider configuration files |
| `mcpx status`            | Show provider synchronization status             |

Common options:

- `-d, --dir <path>` selects the project directory.
- `--scope project|global` selects the canonical configuration scope.
- `--verbose` shows detailed output.

Run `mcpx <command> --help` for command-specific usage.

## Canonical configuration

Project configuration lives at `.agents/mcp.json`; global configuration lives at
`~/.agents/mcp.json`. The version 1 format contains the selected providers and explicitly enabled
`stdio` or HTTP servers:

```json
{
  "version": 1,
  "providers": ["claude-code", "openai-codex"],
  "servers": {
    "filesystem": {
      "enabled": true,
      "transport": "stdio",
      "command": "bunx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "context7": {
      "enabled": true,
      "transport": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

Server names may contain letters, digits, `.`, `_`, and `-`, and must start with a letter or digit.
HTTP URLs must use `http` or `https`.

## Supported providers

| Provider           | Identifier        | Project path                     | Global path                            |
| ------------------ | ----------------- | -------------------------------- | -------------------------------------- |
| Claude Code        | `claude-code`     | `.mcp.json`                      | `~/.claude.json`                       |
| Cursor             | `cursor`          | `.cursor/mcp.json`               | `~/.cursor/mcp.json`                   |
| Antigravity CLI    | `antigravity-cli` | `.gemini/config/mcp_config.json` | `~/.gemini/config/mcp_config.json`     |
| Kimi CLI           | `kimi-cli`        | `.kimi-code/mcp.json`            | `$KIMI_CODE_HOME/mcp.json` or fallback |
| OpenAI Codex       | `openai-codex`    | `.codex/config.toml`             | `~/.codex/config.toml`                 |
| OpenCode           | `opencode`        | `opencode.json`                  | `~/.config/opencode/opencode.jsonc`    |
| GitHub Copilot CLI | `copilot-cli`     | `.copilot/mcp-config.json`       | `~/.copilot/mcp-config.json`           |
| VS Code            | `vscode`          | `.vscode/mcp.json`               | Not supported                          |
| IntelliJ IDEA      | `intellij`        | `.idea/mcp.json`                 | Not supported                          |

Kimi falls back to `~/.kimi-code/mcp.json` when `KIMI_CODE_HOME` is not set. OpenCode also detects
`~/.config/opencode/opencode.json` as a global candidate.

## Repository layout

```text
apps/
  cli/                    # Citty commands, output, and Clack wizard
packages/
  core/                   # Zod model, persistence, provider contracts, and sync engine
  providers/              # JSON, JSONC, and TOML provider adapters
tmp/
  mcpx-david/             # Read-only reference implementation
  mcpx-thoroc/            # Read-only reference implementation
```

The dependency direction is `apps/cli -> packages/providers -> packages/core`, with the CLI also
depending directly on core. The `tmp/` repositories are references and are not part of the build or
published package.

## Development

```bash
bun install
bun run format
bun run check
bun run test
bun run build
bun run index.ts --help
```

`bun run check` runs Oxlint, verifies Oxfmt output, and type-checks every workspace package.

To inspect the exact package contents before publishing:

```bash
bun pm pack --dry-run
```

Publishing runs the complete check, test, and build pipeline through the `prepack` script:

```bash
bun publish
```

## Acknowledgements

This work is inspired by:

- [gustavodiasdev/mcpx-cli](https://github.com/gustavodiasdev/mcpx-cli)
- [davidpastorvicente/mcpx-cli](https://github.com/davidpastorvicente/mcpx-cli) and
- [thoroc/mcpx-cli](https://github.com/thoroc/mcpx-cli).

## License

[MIT](LICENSE)
