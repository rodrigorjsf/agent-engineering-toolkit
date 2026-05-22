# Cursor Hooks

**Summary**: Lifecycle automation points in Cursor that observe, block, or modify the agent loop by running shell scripts or LLM prompts — organized into Agent, Tab, and App-lifecycle categories, configurable across four sources, and gated by exit codes or JSON permission decisions.
**Sources**: hooks-guide.md
**Last updated**: 2026-05-22

---

## How Hooks Work

Hooks are spawned processes that communicate over stdio using JSON in both directions (source: hooks-guide.md). They run before or after defined stages of the agent loop and can observe, block, or modify behavior, providing **deterministic control** independent of the model's judgment. Cursor can also load hooks from third-party tools like Claude Code.

## Hook Categories

Hooks fall into three categories based on what triggers them (source: hooks-guide.md):

### Agent Hooks (Cmd+K / Agent Chat)

Fire during an agent session.

| Event                                               | Triggers When            |
| --------------------------------------------------- | ------------------------ |
| `sessionStart` / `sessionEnd`                       | Session lifecycle        |
| `preToolUse` / `postToolUse` / `postToolUseFailure` | Tool execution lifecycle |
| `subagentStart` / `subagentStop`                    | Subagent (Task tool) lifecycle |
| `beforeShellExecution` / `afterShellExecution`      | Shell commands           |
| `beforeMCPExecution` / `afterMCPExecution`          | MCP tool calls           |
| `beforeReadFile` / `afterFileEdit`                  | File operations          |
| `beforeSubmitPrompt`                                | Prompt submission        |
| `preCompact` / `stop`                               | Context management       |
| `afterAgentResponse` / `afterAgentThought`          | Agent output             |

### Tab Hooks (inline completions)

Fire for autonomous Tab operations.

| Event               | Triggers When    |
| ------------------- | ---------------- |
| `beforeTabFileRead` | Tab reads a file |
| `afterTabFileEdit`  | Tab edits a file |

### App-Lifecycle Hooks

Fire outside any agent session.

| Event           | Triggers When                                                        |
| --------------- | -------------------------------------------------------------------- |
| `workspaceOpen` | Cursor opens a workspace, and on every workspace folder change       |

`workspaceOpen` is skipped when the window has zero workspace folders, and can return additional plugin paths to load for the current workspace via a `pluginPaths` output array (source: hooks-guide.md). Because it runs outside a session, its request omits `conversation_id`, `generation_id`, `model`, and `transcript_path`. These separate surfaces let you apply different policies to autonomous Tab operations, user-directed Agent operations, and workspace startup. Cloud agents also run repo hooks.

## Hook Types

| Type        | Mechanism                  | Use Case                            |
| ----------- | -------------------------- | ----------------------------------- |
| **Command** | Shell script (default)     | Formatting, validation, audit       |
| **Prompt**  | Single-turn LLM evaluation | Policy decisions, conditional logic |

Prompt hooks return a structured `{ ok: boolean, reason?: string }` response, use a fast model, and substitute the hook input JSON into a `$ARGUMENTS` placeholder (auto-appended if absent) (source: hooks-guide.md).

## Exit Codes

| Code  | Effect                                                  |
| ----- | ------------------------------------------------------- |
| `0`   | Hook succeeded — use the JSON output                    |
| `2`   | Block the action (equivalent to `permission: "deny"`)   |
| Other | Hook failed; action proceeds (fail-open by default)     |

## Configuration

```json
// .cursor/hooks.json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [
      { "command": ".cursor/hooks/format.sh" }
    ],
    "workspaceOpen": [
      { "command": ".cursor/hooks/register-workspace-plugins.sh" }
    ]
  }
}
```

### Config Sources and Priority

All matching hooks from every source run; when responses conflict, higher-priority sources win. Priority order (highest to lowest): **Enterprise → Team → Project → User** (source: hooks-guide.md).

1. **Enterprise** — MDM-managed, system-wide (e.g. `/etc/cursor/hooks.json` on Linux)
2. **Team** — cloud-distributed via the web dashboard (Enterprise only)
3. **Project** — `<project-root>/.cursor/hooks.json` (version-controlled, runs from project root)
4. **User** — `~/.cursor/hooks.json` (runs from `~/.cursor/`)

### Per-Script Config Fields

| Field        | Description                                                              |
| ------------ | ------------------------------------------------------------------------ |
| `command`    | Shell command, absolute path, or relative path                           |
| `type`       | `command` (default) or `prompt`                                          |
| `timeout`    | Max execution time in seconds                                            |
| `failClosed` | When `true`, hook failure blocks the action instead of failing open      |
| `matcher`    | Filter criteria; which field it matches depends on the hook              |
| `loop_limit` | Per-script loop cap for `stop`/`subagentStop` (default `5`; `null` = none) |

## Environment Variables

Hook scripts receive `CURSOR_PROJECT_DIR`, `CURSOR_VERSION`, `CURSOR_USER_EMAIL`, `CURSOR_TRANSCRIPT_PATH`, `CURSOR_CODE_REMOTE`, and `CLAUDE_PROJECT_DIR` (a Claude-compatibility alias). Session-scoped variables set by a `sessionStart` hook are passed to all subsequent hook executions in that session (source: hooks-guide.md).

## Partner Integrations

Security and governance vendors with built-in Cursor hooks support span MCP governance (MintMCP, Oasis Security, Runlayer), code security (Corridor, Semgrep), dependency security (Endor Labs), agent safety (Snyk), and secrets management (1Password) (source: hooks-guide.md).

## Related pages

- [[claude-code-hooks]]
- [[cursor-plugins]]
- [[cursor-rules]]
- [[agent-workflows]]
