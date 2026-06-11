# Claude Code MCP

**Summary**: Full reference for connecting Claude Code to external tools, databases, and APIs through the Model Context Protocol (MCP) — covering four transport types, three installation scopes, OAuth authentication, plugin-bundled servers, tool search deferred loading, and elicitation.
**Sources**: claude-code-with-mcp.md
**Last updated**: 2026-06-11

---

## Why MCP

Claude Code connects to MCP servers to avoid the copy-paste workflow of pasting data from external tools into chat. Once connected, Claude can read from and act on those systems directly. Common use cases include: implementing features from JIRA or GitHub issues, querying production databases, analyzing Sentry errors, integrating Figma designs, and automating Gmail drafts (source: claude-code-with-mcp.md).

Browse reviewed connectors in the [Anthropic Directory](https://claude.ai/directory). Any remote server listed there can be added with `claude mcp add`. MCP servers can also be scaffolded interactively via the `mcp-server-dev` plugin (`/plugin install mcp-server-dev@claude-plugins-official`) (source: claude-code-with-mcp.md).

> **Security**: Verify trust before connecting any server. Servers that fetch external content can expose you to prompt injection risk (source: claude-code-with-mcp.md).

See [[agent-protocols]] for MCP protocol background and how MCP relates to A2A.

---

## Transport Types

Claude Code supports four transports. HTTP is recommended for new remote servers; stdio for local processes.

### HTTP (recommended for remote servers)

```bash
# Basic
claude mcp add --transport http <name> <url>

# With Bearer token
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"
```

In `.mcp.json` and `claude mcp add-json`, `type: "streamable-http"` is accepted as an alias for `"http"` (matching the MCP specification name) (source: claude-code-with-mcp.md).

### SSE (deprecated)

SSE transport is deprecated. Use HTTP servers instead where available (source: claude-code-with-mcp.md).

```bash
claude mcp add --transport sse <name> <url>
```

### stdio (local processes)

Stdio servers run as local processes. Use for tools needing direct system access or custom scripts.

```bash
claude mcp add --env AIRTABLE_API_KEY=YOUR_KEY --transport stdio airtable \
  -- npx -y airtable-mcp-server
```

The `--` separator is required: everything after it is passed to the server unchanged, avoiding flag conflicts. `--env` accepts multiple `KEY=value` pairs but must not be placed immediately before the server name (source: claude-code-with-mcp.md).

Claude Code sets `CLAUDE_PROJECT_DIR` in the spawned server's environment (the project root). Read it as `process.env.CLAUDE_PROJECT_DIR` (Node) or `os.environ["CLAUDE_PROJECT_DIR"]` (Python). In `.mcp.json` `command`/`args` expansion, use `${CLAUDE_PROJECT_DIR:-.}` as a default since the variable is in the server's environment, not Claude Code's own environment (source: claude-code-with-mcp.md).

### WebSocket (persistent bidirectional)

WebSocket suits servers that push events unprompted. Prefer HTTP when the server only responds to requests. Configure via `claude mcp add-json`:

```bash
claude mcp add-json events-server \
  '{"type":"ws","url":"wss://mcp.example.com/socket","headers":{"Authorization":"Bearer YOUR_TOKEN"}}'
```

The `claude mcp add --transport` flag does not accept `ws` (source: claude-code-with-mcp.md).

### Managing servers

```bash
claude mcp list         # List all configured servers
claude mcp get <name>   # Get details for a server
claude mcp remove <name>
# In Claude Code:
/mcp                    # Check server status, tool counts, auth
```

Pending-approval servers from `.mcp.json` show as `⏸ Pending approval` in `claude mcp list`. Run `claude` interactively to review and approve them (source: claude-code-with-mcp.md).

The server name `workspace` is reserved — Claude Code skips any server with that name at load time and shows a warning (source: claude-code-with-mcp.md).

### Dynamic tool updates and reconnection

MCP servers can send `list_changed` notifications; Claude Code automatically refreshes available tools, prompts, and resources without disconnection (source: claude-code-with-mcp.md).

HTTP and SSE servers that disconnect mid-session reconnect automatically with exponential backoff: up to five attempts, starting at 1 second, doubling each time. After five failures the server is marked as failed. Stdio servers are local processes and are not reconnected automatically (source: claude-code-with-mcp.md).

---

## Installation Scopes

| Scope | Loads in | Shared with team | Stored in |
|---|---|---|---|
| `local` | Current project only | No | `~/.claude.json` |
| `project` | Current project only | Yes, via version control | `.mcp.json` in project root |
| `user` | All your projects | No | `~/.claude.json` |

Use `--scope <scope>` on any `claude mcp add` command. Default is `local` (source: claude-code-with-mcp.md).

> Note: MCP `local`-scoped servers are stored in `~/.claude.json` (home directory), not `.claude/settings.local.json` (project directory) — different from general "local settings" (source: claude-code-with-mcp.md).

Project-scoped `.mcp.json` files are designed for version control. Claude Code prompts for approval before using them. Reset approval choices with `claude mcp reset-project-choices` (source: claude-code-with-mcp.md).

### Scope hierarchy and precedence

When the same server name appears in multiple sources, Claude Code connects to it once using the highest-precedence definition (source: claude-code-with-mcp.md):

1. Local scope
2. Project scope
3. User scope
4. Plugin-provided servers
5. Claude.ai connectors

The three scopes match by **name**; plugins and connectors match by **endpoint**.

### Environment variable expansion in `.mcp.json`

Supported syntax:
- `${VAR}` — value of environment variable `VAR`
- `${VAR:-default}` — `VAR` if set, otherwise `default`

Variables can be expanded in `command`, `args`, `env`, `url`, and `headers`. If a required variable is unset with no default, Claude Code fails to parse the config (source: claude-code-with-mcp.md).

---

## Authentication

### OAuth 2.0

Claude Code marks a server as needing authentication when it returns `401` or `403`. Run `/mcp` in Claude Code to complete the OAuth flow. Authentication tokens are stored securely and refreshed automatically (source: claude-code-with-mcp.md).

If `headers.Authorization` is configured and the server rejects that header, Claude Code reports the connection as failed (no OAuth fallback) (source: claude-code-with-mcp.md).

**Fixed callback port** — some servers require a pre-registered redirect URI:

```bash
claude mcp add --transport http --callback-port 8080 my-server https://mcp.example.com/mcp
```

**Pre-configured OAuth credentials** — for servers that don't support dynamic client registration:

```bash
claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp
```

Set the secret via environment variable to skip the interactive prompt: `MCP_CLIENT_SECRET=your-secret claude mcp add ...` (source: claude-code-with-mcp.md).

**Restrict OAuth scopes** — pin scopes to a security-team-approved subset:

```json
{
  "mcpServers": {
    "slack": {
      "type": "http",
      "url": "https://mcp.slack.com/mcp",
      "oauth": { "scopes": "channels:read chat:write search:read" }
    }
  }
}
```

`oauth.scopes` takes precedence over scopes discovered at `/.well-known`. If the server later returns `403 insufficient_scope`, widen the scope pin (source: claude-code-with-mcp.md).

**Override OAuth metadata discovery** — set `authServerMetadataUrl` in the `oauth` object to bypass the default discovery chain (RFC 9728 → RFC 8414 fallback). Requires Claude Code v2.1.64+ (source: claude-code-with-mcp.md).

### Dynamic headers (`headersHelper`)

For non-OAuth authentication (Kerberos, short-lived tokens, internal SSO), use `headersHelper` to generate request headers at connection time:

```json
{
  "mcpServers": {
    "internal-api": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headersHelper": "/opt/bin/get-mcp-auth-headers.sh"
    }
  }
}
```

The command must write a JSON object of string key-value pairs to stdout; it runs in a shell with a 10-second timeout, fresh on each connection with no caching. Claude Code sets `CLAUDE_CODE_MCP_SERVER_NAME` and `CLAUDE_CODE_MCP_SERVER_URL` environment variables so a single helper script can serve multiple servers (source: claude-code-with-mcp.md).

`headersHelper` executes arbitrary shell commands — it only runs after you accept the workspace trust dialog when defined at project or local scope (source: claude-code-with-mcp.md).

---

## Plugin-Provided MCP Servers

[[claude-code-plugins]] can bundle MCP servers that auto-connect when the plugin is enabled. Plugin MCP servers work identically to user-configured servers and appear in `/mcp` with plugin indicators (source: claude-code-with-mcp.md).

Define in `.mcp.json` at the plugin root or inline in `plugin.json`:

```json
{
  "mcpServers": {
    "database-tools": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": { "DB_URL": "${DB_URL}" }
    }
  }
}
```

Available environment variables in plugin MCP configs:
- `${CLAUDE_PLUGIN_ROOT}` — plugin installation directory (for bundled files)
- `${CLAUDE_PLUGIN_DATA}` — persistent data directory that survives plugin updates
- `${CLAUDE_PROJECT_DIR}` — stable project root

After enabling or disabling a plugin during a session, run `/reload-plugins` to connect or disconnect its MCP servers (source: claude-code-with-mcp.md).

---

## MCP Tool Search (Deferred Loading)

Tool search reduces context usage by deferring MCP tool schema loading until Claude needs those tools. Only tool names and server instructions load at session start (source: claude-code-with-mcp.md).

Control via the `ENABLE_TOOL_SEARCH` environment variable:

| Value | Behavior |
|---|---|
| (unset) | All MCP tools deferred on demand. Falls back to loading upfront on Vertex AI or when `ANTHROPIC_BASE_URL` is a non-first-party host |
| `true` | All MCP tools deferred, sends beta header even on Vertex AI |
| `auto` | Threshold mode: load upfront if schemas fit within 10% of context window |
| `auto:N` | Custom threshold percentage (0–100) |
| `false` | All MCP tools loaded upfront, no deferral |

Tool search requires a model that supports `tool_reference` blocks. Haiku models do not support it. On Vertex AI, requires Claude Sonnet 4.5 or later (source: claude-code-with-mcp.md).

### Exempt a server from deferral

Set `alwaysLoad: true` in the server's `.mcp.json` entry to always load its tools into context at session start:

```json
{
  "mcpServers": {
    "core-tools": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "alwaysLoad": true
    }
  }
}
```

`alwaysLoad` also blocks startup until the server connects (capped at the standard 5-second connect timeout). Individual tools can also set `"anthropic/alwaysLoad": true` in their `_meta` object. Requires Claude Code v2.1.121+ (source: claude-code-with-mcp.md).

### MCP server instructions

With tool search enabled, server instructions help Claude understand when to search for your tools. Keep them under 2KB; Claude Code truncates tool descriptions and server instructions at 2KB each (source: claude-code-with-mcp.md).

---

## MCP Output Limits

| Setting | Default | Description |
|---|---|---|
| Warning threshold | 10,000 tokens | Claude Code warns when tool output exceeds this |
| Maximum output (`MAX_MCP_OUTPUT_TOKENS`) | 25,000 tokens | Increase with `export MAX_MCP_OUTPUT_TOKENS=50000` |

Tools that don't declare their own limit use `MAX_MCP_OUTPUT_TOKENS`. Tools that set `_meta["anthropic/maxResultSizeChars"]` in their `tools/list` response use that value for text content (up to 500,000 characters maximum). Image data is always subject to `MAX_MCP_OUTPUT_TOKENS` regardless of the annotation (source: claude-code-with-mcp.md).

Per-server tool execution timeout: set `"timeout": <ms>` in the server's `.mcp.json` entry. Values below 1000 are ignored. Requires Claude Code v2.1.162+ (source: claude-code-with-mcp.md).

---

## MCP Elicitation

MCP servers can request structured input from you mid-task. Claude Code displays an interactive dialog and passes your response back to the server. No configuration required (source: claude-code-with-mcp.md).

- **Form mode**: dialog with form fields defined by the server
- **URL mode**: opens a browser URL for authentication or approval

To auto-respond without a dialog, use the `Elicitation` [[claude-code-hooks|hook]]. The hook can return `action` (`accept`/`decline`/`cancel`) and `content` (form field values) in `hookSpecificOutput` (source: claude-code-with-mcp.md).

---

## MCP Resources

MCP servers can expose resources referenceable via `@` mentions, similar to files:

```text
@github:issue://123
@docs:file://api/authentication
@postgres:schema://users
```

Type `@` to see available resources from all connected MCP servers in the autocomplete menu. Resources are automatically fetched and included as attachments when referenced (source: claude-code-with-mcp.md).

---

## MCP Prompts as Commands

MCP server prompts surface as slash commands in Claude Code using the format `/mcp__servername__promptname`. Execute with or without arguments:

```text
/mcp__github__list_prs
/mcp__github__pr_review 456
/mcp__jira__create_issue "Bug in login flow" high
```

Prompt results are injected directly into the conversation. Server and prompt names are normalized (spaces become underscores) (source: claude-code-with-mcp.md).

---

## Push Channels

An MCP server can push messages directly into your session so Claude reacts to external events (CI results, monitoring alerts, Telegram messages, Discord chats, webhook events). The server declares the `claude/channel` capability and you opt in with the `--channels` flag at startup (source: claude-code-with-mcp.md).

---

## Claude.ai Connectors

If you're logged into Claude Code with a Claude.ai account, MCP servers you've added at `claude.ai/customize/connectors` are automatically available in Claude Code. They appear in `/mcp` with Claude.ai indicators (source: claude-code-with-mcp.md).

Claude.ai connectors only load when your active authentication method is your Claude.ai subscription — not when `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `apiKeyHelper`, or a third-party provider (Bedrock, Vertex) is active.

Disable claude.ai MCP servers: `ENABLE_CLAUDEAI_MCP_SERVERS=false claude` (source: claude-code-with-mcp.md).

Some Anthropic-hosted connectors (Microsoft 365, Gmail, Google Calendar) do not support local OAuth from Claude Code. Connect these at Settings → Connectors on claude.ai; they appear in Claude Code automatically once connected there (source: claude-code-with-mcp.md).

---

## Claude Code as an MCP Server

Run Claude Code itself as an MCP server for other applications to connect to:

```bash
claude mcp serve
```

In Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "claude-code": {
      "type": "stdio",
      "command": "claude",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

If `claude` is not in PATH, use the full path from `which claude`. The server exposes Claude's tools (View, Edit, LS, etc.). The MCP client is responsible for implementing user confirmation for individual tool calls (source: claude-code-with-mcp.md).

---

## Managed MCP Configuration

For organizations needing centralized control, managed configuration deploys a fixed server set with `managed-mcp.json` and restricts servers with `allowedMcpServers` and `deniedMcpServers` (source: claude-code-with-mcp.md).

---

## Quick Reference: `claude mcp` Commands

| Command | Description |
|---|---|
| `claude mcp add --transport http <name> <url>` | Add remote HTTP server |
| `claude mcp add --transport sse <name> <url>` | Add remote SSE server (deprecated) |
| `claude mcp add [options] <name> -- <cmd>` | Add local stdio server |
| `claude mcp add-json <name> '<json>'` | Add server from JSON config |
| `claude mcp add-from-claude-desktop` | Import servers from Claude Desktop (macOS/WSL only) |
| `claude mcp list` | List all configured servers |
| `claude mcp get <name>` | Show details for a server |
| `claude mcp remove <name>` | Remove a server |
| `claude mcp reset-project-choices` | Reset project-scope approval choices |
| `claude mcp serve` | Run Claude Code itself as an MCP server |
| `/mcp` (in session) | Check server status, tool counts, trigger OAuth |

---

## Related pages

- [[claude-code-plugins]]
- [[claude-code-hooks]]
- [[agent-protocols]]
- [[cursor-mcp]]
- [[claude-code-skills]]
- [[claude-code-subagents]]
- [[claude-code-env-vars]]
- [[agent-workflows]]
