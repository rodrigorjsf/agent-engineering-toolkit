# Hook Events Reference

Complete reference for all 22 Claude Code hook events: triggers, matcher fields, and input/output schemas.

---

## Contents

- Event summary table (all 22 events)
- Matcher field by event type
- JSON configuration schema
- Handler type support matrix
- Common patterns (pre-validation, post-formatting, session injection)

---

## Event Summary Table

| Event | When it fires | Can block? |
|-------|--------------|-----------|
| `SessionStart` | Session begins or resumes | No |
| `SessionEnd` | Session terminates | No |
| `UserPromptSubmit` | Before Claude processes your prompt | Yes |
| `PreToolUse` | Before any tool call executes | Yes |
| `PermissionRequest` | When a permission dialog would appear | Yes (auto-approve) |
| `PostToolUse` | After a tool call succeeds | Yes (feedback) |
| `PostToolUseFailure` | After a tool call fails | No (context only) |
| `Notification` | When Claude sends a notification | No |
| `SubagentStart` | When a subagent spawns | No (inject context) |
| `SubagentStop` | When a subagent finishes | Yes |
| `Stop` | When Claude finishes responding | Yes (force continue) |
| `StopFailure` | When turn ends due to API error | No |
| `TeammateIdle` | When team agent goes idle | No |
| `TaskCompleted` | When a task is marked complete | Yes |
| `InstructionsLoaded` | When CLAUDE.md or rules load | No |
| `ConfigChange` | When a config file changes | Yes (except policy) |
| `WorktreeCreate` | When a worktree is being created | Replaces behavior |
| `WorktreeRemove` | When a worktree is being removed | No |
| `PreCompact` | Before context compaction | No |
| `PostCompact` | After context compaction | No |
| `Elicitation` | When MCP server requests input | Yes |
| `ElicitationResult` | After user responds to MCP elicitation | Yes |


---

## Matcher Field by Event Type

| Event | Matcher filters on | Example values |
|-------|-------------------|----------------|
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest` | `tool_name` | `Bash`, `Edit\|Write`, `mcp__.*` |
| `SessionStart` | start reason | `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | end reason | `clear`, `resume`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other` |
| `SubagentStart`, `SubagentStop` | agent type | `Bash`, `Explore`, `Plan`, custom agent names |
| `Notification` | notification type | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog` |
| `PreCompact`, `PostCompact` | trigger | `manual`, `auto` |
| `ConfigChange` | config source | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` |
| `StopFailure` | error type | `rate_limit`, `billing_error`, `server_error`, `unknown`, `authentication_failed`, `invalid_request`, `max_output_tokens` |
| `InstructionsLoaded` | load reason | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact` |
| `Elicitation`, `ElicitationResult` | MCP server name | your configured server names |
| No matcher | always fires | `UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove` |


---

## JSON Configuration Schema

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<regex-string>",
        "hooks": [
          {
            "type": "command",
            "command": "<shell-command-or-path>",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

**Common fields** (all handler types):

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `"command"`, `"http"`, `"prompt"`, or `"agent"` |
| `timeout` | No | Seconds before canceling (defaults: 600 command, 30 http/prompt, 60 agent) |
| `statusMessage` | No | Custom spinner message displayed while the hook runs |
| `once` | No | If `true`, runs once per session then removed; skills only, not agents |

**Command-specific fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `command` | Yes | Shell command to execute |
| `async` | No | If `true`, runs in background without blocking |

**HTTP-specific fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `url` | Yes | URL to POST to |
| `headers` | No | Additional HTTP headers as key-value pairs; supports `$VAR_NAME` interpolation |
| `allowedEnvVars` | No | Env var names allowed for interpolation in `headers` |

**Prompt-specific fields:** `type`, `prompt` (required), `model` (optional, default Haiku), `timeout`

**Agent-specific fields:** `type`, `prompt` (required), `timeout` (optional, default 60s)


---

## Handler Type Support Matrix

| Handler type | Session events | Agentic loop events | Notes |
|-------------|---------------|--------------------|----|
| `command` | All 22 events | All 22 events | Universal; default choice |
| `http` | No | 8 agentic loop events only | Requires external endpoint |
| `prompt` | No | 8 agentic loop events only | Uses Claude Haiku by default |
| `agent` | No | 8 agentic loop events only | Up to 50 tool-use turns |

The 8 agentic loop events that support all handler types:
`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `TaskCompleted`


---

## Common Patterns

### Pre-validation (PreToolUse + Bash)

Intercept Bash tool calls to block dangerous commands:

```json
{ "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": ".claude/hooks/validate.sh" }] }] } }
```

Exit 2 with stderr message to block; exit 0 to allow.

### Post-formatting (PostToolUse + Edit|Write)

Auto-format after file writes:

```json
{ "hooks": { "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": ".claude/hooks/format.sh" }] }] } }
```

### Session injection (SessionStart + startup)

Inject dynamic context at session start:

```json
{ "hooks": { "SessionStart": [{ "matcher": "startup", "hooks": [{ "type": "command", "command": ".claude/hooks/inject-context.sh" }] }] } }
```

Stdout from the hook is injected as additional context.

