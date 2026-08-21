# MCPX CLI

Keep your MCP servers in sync across AI development tools.

MCPX stores your server definitions in one canonical configuration and generates the native files
used by Claude Code, Cursor, Codex, OpenCode, VS Code, IntelliJ IDEA, and other supported tools.
Use the interactive wizard for setup or individual commands for automation.

## Why MCPX?

- Configure an MCP server once and reuse it across multiple tools.
- Manage project-specific and global configurations separately.
- Import existing tool configurations instead of starting over.
- Preserve unrelated settings and comments in shared configuration files.
- Detect missing, invalid, or out-of-date generated configurations.
- Use local `stdio` servers and remote HTTP servers.

## Requirements

- Node.js 20 or newer
- npm, included with Node.js

## Install

```bash
npm install --global @creepiest-space/mcpx-cli
```

Confirm the installation:

```bash
mcpx --version
mcpx --help
```

## Quick start

Open a project directory and start the setup wizard:

```bash
cd my-project
mcpx init
```

The wizard lets you select tools, create MCP servers, import detected configurations, and generate
the required files.

After setup, use these commands for day-to-day work:

```bash
mcpx list
mcpx status
mcpx sync
```

## Common workflows

### Add a server

```bash
mcpx add context7
```

MCPX asks for the transport and connection details, updates the canonical configuration, and offers
to synchronize the selected tools.

### Import existing servers

Detect an existing tool configuration and choose which servers to import:

```bash
mcpx import
```

Import every detected server from a specific tool without selection prompts:

```bash
mcpx import cursor --all
```

When a server name already exists, choose a conflict policy:

```bash
mcpx import cursor --all --conflict skip
mcpx import cursor --all --conflict overwrite
mcpx import cursor --all --conflict rename
```

### Enable or disable a server

```bash
mcpx disable filesystem
mcpx enable filesystem
```

Disabled servers remain in the canonical configuration but are omitted or marked disabled according
to each tool's native format.

### Remove a server

```bash
mcpx remove filesystem
```

Skip the confirmation prompt when scripting:

```bash
mcpx remove filesystem --yes
```

### Check and repair generated configurations

```bash
mcpx status
mcpx sync
```

`status` reports missing, invalid, or out-of-date tool configurations. `sync` regenerates them from
the canonical configuration.

### Work with another directory

You do not need to change the current working directory:

```bash
mcpx status --dir ../another-project
mcpx sync --dir ../another-project
```

## Project and global configurations

MCPX supports two independent scopes:

| Scope   | Canonical file       | Use it for                                      |
| ------- | -------------------- | ----------------------------------------------- |
| Project | `.agents/mcp.json`   | Servers and tools used by one repository        |
| Global  | `~/.agents/mcp.json` | Servers and tools available across your machine |

Use `--scope global` when you want to modify global configuration:

```bash
mcpx init --scope global
mcpx add context7 --scope global
mcpx sync --scope global
```

Without an explicit scope:

- `list` and `status` use project configuration when it exists, then fall back to global
  configuration.
- Commands that make changes use project scope and never silently modify global configuration.
- Commands run against your home directory use global scope.

## Commands

| Command                  | Description                             |
| ------------------------ | --------------------------------------- |
| `mcpx init`              | Run the interactive setup wizard        |
| `mcpx add [name]`        | Add an MCP server                       |
| `mcpx remove [name]`     | Remove an MCP server                    |
| `mcpx enable <name>`     | Enable a server                         |
| `mcpx disable <name>`    | Disable a server                        |
| `mcpx list`              | List canonical servers                  |
| `mcpx import [provider]` | Import servers from an existing tool    |
| `mcpx status`            | Check generated tool configurations     |
| `mcpx sync`              | Regenerate selected tool configurations |

Options available to every command:

| Option                    | Description                              |
| ------------------------- | ---------------------------------------- |
| `-d, --dir <path>`        | Use a different project directory        |
| `--scope project\|global` | Select project or global configuration   |
| `--verbose`               | Show diagnostics and detailed error data |
| `--help`                  | Show command-specific help               |

Run `mcpx <command> --help` to see arguments specific to a command.

## Supported tools

| Tool               | Provider ID       | Project | Global |
| ------------------ | ----------------- | :-----: | :----: |
| Claude Code        | `claude-code`     |    ✓    |   ✓    |
| Cursor             | `cursor`          |    ✓    |   ✓    |
| Antigravity CLI    | `antigravity-cli` |    ✓    |   ✓    |
| Kimi CLI           | `kimi-cli`        |    ✓    |   ✓    |
| OpenAI Codex       | `openai-codex`    |    ✓    |   ✓    |
| OpenCode           | `opencode`        |    ✓    |   ✓    |
| GitHub Copilot CLI | `copilot-cli`     |    ✓    |   ✓    |
| VS Code            | `vscode`          |    ✓    |   —    |
| IntelliJ IDEA      | `intellij`        |    ✓    |   —    |

MCPX respects `KIMI_CODE_HOME` and `COPILOT_HOME` when resolving global configurations. OpenCode
global detection supports both `opencode.jsonc` and `opencode.json`.

## Canonical configuration

Most users can manage configuration entirely through the CLI. If you need to inspect or edit it,
the canonical format looks like this:

```json
{
  "version": 1,
  "providers": ["claude-code", "openai-codex"],
  "servers": {
    "filesystem": {
      "enabled": true,
      "transport": "stdio",
      "command": "npx",
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

Server names may contain letters, numbers, `.`, `_`, and `-`, and must start with a letter or number.
HTTP server URLs must use `http` or `https`.

After editing the file manually, validate and apply it with:

```bash
mcpx status
mcpx sync
```

## Safe synchronization

MCPX updates only the MCP sections it manages. It preserves unrelated settings in shared JSON,
JSONC, and TOML files, including JSONC and Codex TOML comments outside generated values. Invalid
existing files are reported and left unchanged. Writes are atomic and generated configuration files
use restrictive permissions.

## Automation and exit codes

Commands return stable exit codes for scripts and CI:

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| `0`  | Success, no change required, or interactive cancellation        |
| `1`  | Missing or out-of-date configuration, or an operational failure |
| `2`  | Invalid arguments or an unknown requested resource              |

For example, use `mcpx status` in CI to fail when generated configurations need synchronization.

## Troubleshooting

Show detailed provider-detection diagnostics and error information:

```bash
mcpx status --verbose
mcpx sync --verbose
```

If MCPX cannot find a canonical configuration, run `mcpx init` in the project or explicitly select
the global scope with `--scope global`.

## Update or uninstall

```bash
npm install --global @creepiest-space/mcpx-cli@latest
npm uninstall --global @creepiest-space/mcpx-cli
```

## License

[MIT](LICENSE)
