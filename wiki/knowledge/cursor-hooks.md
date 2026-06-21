# Cursor Hooks

**Summary**: Lifecycle automation points in Cursor that observe, block, or modify the agent loop by running shell scripts or LLM prompts — organized into Agent, Tab, and App-lifecycle categories, configurable across four sources, and gated by exit codes or JSON permission decisions.
**Sources**: hooks-guide.md; Cursor forum thread 158452 (sessionStart additional_context); Cursor forum thread 156065 (afterFileEdit reliability)
**Last updated**: 2026-06-21

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

## Known Issues and Caveats

### `sessionStart` — `additional_context` is documented but currently broken

The official docs describe a `sessionStart` hook output field `additional_context` that should inject text into the agent's initial system context. **This field is silently dropped.** Cursor staff confirmed a timing race: the hook executes before the composer handle is created, so the injected text has nowhere to land. The `env` output field works correctly and its variables are available to subsequent hooks. There is no fix as of 2026-06-21. Even when this is eventually fixed it will only fire once at session start, not per-turn. Source: https://forum.cursor.com/t/sessionstart-hook-additional-context-is-never-injected-into-agents-initial-system-context/158452

**Contradiction with documented behavior**: the official hooks-guide describes `additional_context` as a supported output; in practice it has no effect.

### `afterFileEdit` — side-effect-only, and fires only for the first file in a batch edit

`afterFileEdit` fires after the agent edits a file; its canonical use is a formatter or linter, so the hook *script* **can** modify the just-edited file on disk. What it cannot do: block or undo the edit (it runs after the fact), or feed anything back into the agent's context (unlike `postToolUse`, it has no `additional_context` channel). It also has a reliability bug: when the agent edits multiple files in one tool call, the hook fires only for the first file; subsequent files are silently skipped. Because it cannot return guidance to the model — and a blind formatter script cannot author meaningful documentation — it cannot drive model-authored doc enforcement; for reliable after-the-fact signals across multi-file edits, prefer `postToolUse`. Source: https://forum.cursor.com/t/afterfileedit-hook-not-firing-reliably-missing-events-on-batch-edits-and-mid-session/156065

### `beforeSubmitPrompt` — fires per-turn but cannot inject context

`beforeSubmitPrompt` runs before each user prompt submission and can block it (by returning `{ "continue": false }`), or prepend a `user_message`. Cursor ignores any other JSON output — it cannot inject guidance into the system prompt. Two open feature requests ask to add `additional_context` support (forum threads 150707, Feb 2026; 157231, Apr 2026), both unimplemented as of 2026-06-21.

**NET takeaway**: no Cursor hook reliably injects per-turn guidance into the system prompt. [[cursor-rules]] with `alwaysApply: true` are the only always-on, every-turn injection surface.

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
