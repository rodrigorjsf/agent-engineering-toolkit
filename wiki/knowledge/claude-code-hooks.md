# Claude Code Hooks

**Summary**: Deterministic automation points in the Claude Code lifecycle that execute shell commands, HTTP requests, MCP tool calls, LLM prompts, or agent-based verification at specific events — enabling formatting, validation, auditing, and control flow without relying on the model's judgment.
**Sources**: automate-workflow-with-hooks.md, claude-hook-reference-doc.md, analysis-automate-workflow-with-hooks.md, analysis-claude-hook-reference-doc.md
**Last updated**: 2026-05-22

---

## Why Hooks

Hooks provide **deterministic control** — they run reliably regardless of the model's behavior. Use hooks to enforce rules that must always apply, not as suggestions the model might follow. For decisions requiring judgment rather than deterministic rules, use [[#Prompt-Based Hooks]] or [[#Agent-Based Hooks]].

## Hook Types

There are **five** hook handler types (source: claude-hook-reference-doc.md):

| Type         | Mechanism                                | Use Case                                   | Default Timeout |
| ------------ | ---------------------------------------- | ------------------------------------------ | --------------- |
| **Command**  | Shell script execution                   | Formatting, file protection, audit logging | 600s (10 min)   |
| **HTTP**     | POST to external endpoint                | Notifications, CI triggers, webhooks       | 600s (10 min)   |
| **MCP tool** | Call a tool on a connected MCP server    | Reuse existing MCP integrations as hooks   | 600s (10 min)   |
| **Prompt**   | Single-turn Claude evaluation            | Conditional logic, policy decisions        | 30s             |
| **Agent**    | Claude with tool access (up to 50 turns) | Complex verification, multi-step checks    | 60s             |

All timeouts are configurable per hook via the `timeout` field (in seconds). `UserPromptSubmit` lowers the `command`/`http`/`mcp_tool` default to 30s. **Agent hooks are experimental** and may change — prefer command hooks for production (source: automate-workflow-with-hooks.md).

## Complete Lifecycle Events

Every event in the Claude Code lifecycle has a corresponding hook point. Events fire at specific times during a session — some fire once, others fire repeatedly inside the agentic loop.

### Session Lifecycle Events

| Event                | Triggers When                                         | Matcher Target                                                                                       | Can Block? |
| -------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------- |
| `Setup`              | Claude Code starts with `--init-only`, or `--init`/`--maintenance` in `-p` mode — for one-time CI/script prep | CLI flag: `init`, `maintenance`                                       | No         |
| `SessionStart`       | Session begins or resumes                             | Source: `startup`, `resume`, `clear`, `compact`                                                      | No         |
| `InstructionsLoaded` | CLAUDE.md or `.claude/rules/*.md` loaded into context | Load reason: `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact`            | No         |
| `SessionEnd`         | Session terminates                                    | End reason: `clear`, `resume`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other` | No         |

`Setup` is one of the seven events added in the May 2026 upstream sync (source: automate-workflow-with-hooks.md).

### User Interaction Events

| Event                 | Triggers When                                              | Matcher Target                                                                                                          | Can Block?                                           |
| --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `UserPromptSubmit`    | User sends a prompt (before Claude processes it)           | No matcher support                                                                                                      | Yes — blocks prompt processing and erases the prompt |
| `UserPromptExpansion` | A user-typed command expands into a prompt, before Claude  | Command name (your skill/command names)                                                                                 | Yes — blocks the expansion                           |
| `Notification`        | Claude Code sends a notification                           | Type: `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`, `elicitation_complete`, `elicitation_response` | No                                             |

### Tool Execution Events

| Event                | Triggers When                                       | Matcher Target                            | Can Block?                                                |
| -------------------- | --------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `PreToolUse`         | Before tool execution                               | Tool name: `Bash`, `Edit`, `mcp__*`, etc. | Yes — blocks the tool call                                |
| `PermissionRequest`  | Permission dialog appears                           | Tool name                                 | Yes — denies the permission                               |
| `PermissionDenied`   | A tool call is denied by the auto-mode classifier   | Tool name                                 | No — denial already happened; return `{retry: true}` JSON to let the model retry |
| `PostToolUse`        | After tool succeeds                                 | Tool name                                 | No (tool already ran)                                     |
| `PostToolUseFailure` | After tool fails                                    | Tool name                                 | No (tool already failed)                                  |
| `PostToolBatch`      | After a full batch of parallel tool calls resolves, before the next model call | No matcher support             | Yes — stops the agentic loop before the next model call   |

Tool events support an optional per-handler `if` field that uses permission-rule syntax (`"Bash(git *)"`, `"Edit(*.ts)"`) to filter by tool name **and** arguments — narrower than `matcher`, which filters only by tool name (source: automate-workflow-with-hooks.md).

### Subagent and Task Events

| Event           | Triggers When                        | Matcher Target                                              | Can Block?                            |
| --------------- | ------------------------------------ | ----------------------------------------------------------- | ------------------------------------- |
| `SubagentStart` | Subagent spawned                     | Agent type: `general-purpose`, `Explore`, `Plan`, custom    | No                                    |
| `SubagentStop`  | Subagent finishes                    | Agent type (same as SubagentStart)                          | Yes — prevents subagent from stopping |
| `TaskCreated`   | A task is being created via `TaskCreate` | No matcher support                                       | Yes — rolls back the task creation    |
| `TaskCompleted` | A task is being marked as completed  | No matcher support                                          | Yes — prevents completion             |
| `TeammateIdle`  | Agent team teammate about to go idle | No matcher support                                          | Yes — keeps teammate working          |

### Completion Events

| Event         | Triggers When              | Matcher Target                                                                                                                        | Can Block?                                      |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `Stop`        | Claude finishes responding | No matcher support                                                                                                                    | Yes — prevents stopping, continues conversation |
| `StopFailure` | Turn ends due to API error | Error type: `rate_limit`, `authentication_failed`, `oauth_org_not_allowed`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, `unknown` | No (output/exit code ignored)                   |

### Context and Configuration Events

| Event          | Triggers When                             | Matcher Target                                                                             | Can Block?                     |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------ |
| `PreCompact`   | Before context compaction                 | Trigger: `manual`, `auto`                                                                  | Yes — blocks compaction        |
| `PostCompact`  | After compaction completes                | Trigger: `manual`, `auto`                                                                  | No                             |
| `ConfigChange` | Configuration file changes during session | Source: `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` | Yes (except `policy_settings`) |
| `CwdChanged`   | Working directory changes (e.g. Claude runs `cd`) — useful for reactive env management with direnv | No matcher support              | No                             |
| `FileChanged`  | A watched file changes on disk            | Literal filenames to watch, `\|`-separated (e.g. `.envrc\|.env`) — split into literal names, not regex | No             |

`CwdChanged` and `FileChanged` are part of the May 2026 sync; both pair with `SessionStart` to keep `CLAUDE_ENV_FILE` current as Claude moves between directories or watched files change (source: automate-workflow-with-hooks.md).

### Worktree Events

| Event            | Triggers When                                                | Matcher Target     | Can Block?                         |
| ---------------- | ------------------------------------------------------------ | ------------------ | ---------------------------------- |
| `WorktreeCreate` | Worktree created via `--worktree` or `isolation: "worktree"` | No matcher support | Yes — non-zero exit fails creation |
| `WorktreeRemove` | Worktree removed at session exit or subagent finish          | No matcher support | No                                 |

### MCP Elicitation Events

| Event               | Triggers When                                   | Matcher Target  | Can Block?                                     |
| ------------------- | ----------------------------------------------- | --------------- | ---------------------------------------------- |
| `Elicitation`       | MCP server requests user input during tool call | MCP server name | Yes — denies the elicitation                   |
| `ElicitationResult` | User responds to MCP elicitation                | MCP server name | Yes — blocks response (action becomes decline) |

## Configuration

Hooks are defined in JSON at multiple levels:

| Location                      | Scope                     | Shareable                 |
| ----------------------------- | ------------------------- | ------------------------- |
| `~/.claude/settings.json`     | All your projects         | No, local to machine      |
| `.claude/settings.json`       | Single project            | Yes, committable          |
| `.claude/settings.local.json` | Single project            | No, gitignored            |
| Managed policy settings       | Organization-wide         | Yes, admin-controlled     |
| Plugin `hooks/hooks.json`     | When plugin is enabled    | Yes, bundled with plugin  |
| Skill or agent frontmatter    | While component is active | Yes, defined in component |

Enterprise administrators can use `allowManagedHooksOnly` to block user, project, and plugin hooks.

### Structure

```
hooks → event name → matcher group array → hooks array → handler
```

### Handler Fields (Common)

| Field           | Required | Description                                                                                          |
| --------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `type`          | Yes      | `"command"`, `"http"`, `"mcp_tool"`, `"prompt"`, or `"agent"`                                        |
| `if`            | No       | Permission-rule filter (`"Bash(git *)"`) — tool events only                                          |
| `timeout`       | No       | Seconds before canceling (defaults: 600 command/http/mcp_tool, 30 prompt, 60 agent)                  |
| `statusMessage` | No       | Custom spinner message while hook runs                                                               |
| `once`          | No       | If `true`, runs only once per session (skill frontmatter only)                                       |

Command hooks also accept `args` (switches to exec form — no shell tokenization), `async`/`asyncRewake` (background execution), and `shell` (`"bash"` default or `"powershell"`). Exec form is preferred for any hook that references a path placeholder, since each `args` element passes as one argument with no quoting (source: claude-hook-reference-doc.md).

## Exit Code Control

| Code  | Behavior                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| `0`   | Proceed (allow). Stdout parsed for JSON output. For `UserPromptSubmit`/`SessionStart`, stdout is added as context |
| `2`   | Block with stderr feedback to Claude. JSON on stdout is ignored                                                   |
| Other | Proceed with stderr logging (visible in verbose mode via `Ctrl+O`)                                                |

For structured control, return JSON on exit 0: `{hookSpecificOutput: {hookEventName: "...", decision: {...}}}`

### Universal JSON Output Fields

| Field            | Default | Description                                                                       |
| ---------------- | ------- | --------------------------------------------------------------------------------- |
| `continue`       | `true`  | If `false`, Claude stops processing entirely (overrides event-specific decisions) |
| `stopReason`     | none    | Message shown to user when `continue` is `false`                                  |
| `suppressOutput` | `false` | If `true`, hides stdout from verbose mode                                         |
| `systemMessage`  | none    | Warning message shown to the user                                                 |

## Advanced Control Patterns

### `updatedInput` — Pre-Execution Validation

`PreToolUse` and `PermissionRequest` hooks can modify tool parameters before execution via the `updatedInput` field. Combine with `"allow"` to auto-approve with modifications, or `"ask"` to show modified input to the user:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": { "command": "npm run lint" },
    "additionalContext": "Current environment: production. Proceed with caution."
  }
}
```

### `updatedPermissions` — Programmatic Permission Control

`PermissionRequest` hooks can modify session permissions when allowing an action. Use `setMode` to change the permission mode, or `addAllowRule`/`addDenyRule` to add persistent rules:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedPermissions": [
        { "type": "setMode", "mode": "acceptEdits", "destination": "session" }
      ]
    }
  }
}
```

### `additionalContext` — Context Injection

Multiple events support injecting text into Claude's context via the `additionalContext` field in JSON output: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, and `SubagentStart`. Multiple hooks' values are concatenated. For `SessionStart`, `CLAUDE_ENV_FILE` enables persisting environment variables for all subsequent Bash commands in the session.

## Async Hooks

Set `"async": true` on command hooks to run them in the background without blocking Claude. Async hooks:

- Receive the same JSON input on stdin as synchronous hooks
- **Cannot block or control behavior** — `decision`, `permissionDecision`, and `continue` fields have no effect since the action already completed
- If the hook produces `systemMessage` or `additionalContext`, the content is delivered on the next conversation turn
- Only `type: "command"` hooks support `async` — prompt/agent/http hooks cannot run asynchronously
- Each execution creates a separate background process with no deduplication
- Use the same default 10-minute timeout as sync hooks (configurable via `timeout`)

## Matchers

How a matcher is evaluated depends on the characters it contains (source: claude-hook-reference-doc.md):

- `"*"`, `""`, or omitted — match all (fires on every occurrence)
- Only letters, digits, `_`, and `|` — exact string, or `|`-separated list of exact strings (`Bash`, `Edit|Write`)
- Contains any other character — JavaScript regular expression (`^Notebook`, `mcp__memory__.*`, `mcp__.*__write.*`)

Because `mcp__memory` contains only letters and underscores it is matched as an exact string and matches no tool — append `.*` (`mcp__memory__.*`) to match every tool from a server.

Events without matcher support (`UserPromptSubmit`, `PostToolBatch`, `Stop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`, `CwdChanged`) always fire on every occurrence. A `matcher` field on these events is silently ignored. `FileChanged` does **not** follow the rules above — its matcher value is split into literal filenames to build the watch list, not evaluated as a regex.

**Keep matchers narrow** to avoid unintended matches. Matching on `".*"` or leaving matcher empty for `PermissionRequest` would auto-approve every permission prompt.

## Security Patterns

### File Protection with Path Traversal Validation

Use `PreToolUse` hooks on `Edit|Write` to check target file paths against protected patterns. Exit 2 to block. Validate against path traversal by checking for `..` sequences and canonicalizing paths before comparison.

### Auto-Format After Writes

`PostToolUse` hooks on `Edit|Write` extract the edited file path from stdin JSON (via `jq -r '.tool_input.file_path'`) and pipe to Prettier, Black, or your formatter of choice.

### `stop_hook_active` — Infinite Loop Prevention

`Stop` and `SubagentStop` hooks receive a `stop_hook_active` boolean in their JSON input. When `true`, it means Claude Code is already continuing as a result of a prior stop hook. **Always check this field** and exit 0 early to prevent Claude from running indefinitely:

```bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi
```

## Prompt-Based Hooks

`type: "prompt"` hooks send the hook input data plus your prompt to a Claude model (Haiku by default, configurable via `model`). The model returns a yes/no decision as JSON:

- `"ok": true` — the action proceeds
- `"ok": false` — the action is blocked; `reason` is fed back to Claude

Use for decisions requiring judgment rather than deterministic rules.

## Agent-Based Hooks

`type: "agent"` hooks spawn a subagent with tool access (Read, Grep, Glob, etc.) to verify conditions against the actual state of the codebase. Same `"ok"`/`"reason"` response format as prompt hooks, but supports up to 50 tool-use turns with a longer default timeout of 60 seconds. Use `$ARGUMENTS` as a placeholder for hook input JSON in the prompt.

## Common Patterns

- **Auto-format**: PostToolUse on `Edit|Write` → `jq -r '.tool_input.file_path' | xargs npx prettier --write`
- **File protection**: PreToolUse on `Edit|Write` → check against protected paths, exit 2 to block
- **Audit logging**: PostToolUse → `jq -c '{timestamp: now | todate, source: .source, file: .file_path}' >> audit.log`
- **Notification**: Notification event → `osascript` (macOS) or `notify-send` (Linux)
- **Permission auto-approval**: PermissionRequest with narrow matcher + JSON `behavior: "allow"` decision
- **Context re-injection**: SessionStart with `compact` matcher → echo critical context back after compaction
- **Config audit**: ConfigChange → log `{timestamp, source, file_path}` to compliance log
- **Completeness check**: Stop → prompt hook asking if all tasks are complete, blocks with `reason` if not
- **Test verification**: Stop → agent hook that runs test suite before allowing completion
- **MCP tool logging**: PreToolUse on `mcp__github__.*` → log GitHub API operations
- **Environment setup**: SessionStart → write `export` statements to `$CLAUDE_ENV_FILE` for persistent env vars

## HTTP Hooks

`type: "http"` hooks POST event JSON to an endpoint. Response handling differs from command hooks:

- **2xx with empty body** → success (equivalent to exit 0 with no output)
- **2xx with JSON body** → parsed using same JSON output schema as command hooks
- **Non-2xx / connection failure / timeout** → non-blocking error, execution continues

- **2xx with plain text body** → success, the text is added as context

To block a tool call via HTTP, return a 2xx response with appropriate `hookSpecificOutput` fields. Status codes alone cannot block actions. Header values support env var interpolation via `$VAR_NAME`/`${VAR_NAME}` syntax, but only variables listed in `allowedEnvVars` are resolved.

## MCP Tool Hooks

`type: "mcp_tool"` hooks call a tool on an already-connected MCP server instead of running a shell command (source: claude-hook-reference-doc.md). Required fields are `server` and `tool`; `input` passes arguments and supports `${path}` substitution from the hook's JSON input (e.g. `"${tool_input.file_path}"`). The tool's text output is treated like command-hook stdout — parsed as a decision if it is valid JSON, shown as plain text otherwise. The server must already be connected: the hook never triggers an OAuth or connection flow, so hooks on `SessionStart`/`Setup` should expect a "not connected" error on first run.

## Windows: PowerShell Tool

On Windows, hooks run via Git Bash by default, or PowerShell when Git Bash is not installed. Set a command hook's `shell` field to `"powershell"` to run that hook through PowerShell explicitly — this does **not** require the `CLAUDE_CODE_USE_POWERSHELL_TOOL` env var, since hooks spawn PowerShell directly (source: claude-hook-reference-doc.md). The `shell` field is ignored when `args` (exec form) is set. In exec form on Windows, `command` must resolve to a real executable: the `.cmd`/`.bat` shims that npm and similar tools install cannot be spawned without a shell — invoke the underlying script with `node` directly, or use shell form to run a shim by name.

## Hooks in Skills and Agents

Hooks can be defined directly in [[claude-code-skills]] and [[claude-code-subagents]] YAML frontmatter. These hooks are scoped to the component's lifecycle and cleaned up when it finishes. All hook events are supported. For subagents, `Stop` hooks are automatically converted to `SubagentStop`.

## Related pages

- [[claude-code-plugins]]
- [[claude-code-memory]]
- [[claude-code-subagents]]
- [[cursor-hooks]]
- [[agent-workflows]]
