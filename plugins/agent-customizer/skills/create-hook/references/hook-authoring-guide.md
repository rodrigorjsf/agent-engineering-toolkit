# Hook Authoring Guide

Evidence-based guidance for creating Claude Code hooks that enforce deterministic behavior.
Source: hooks/automate-workflow-with-hooks.md, hooks/claude-hook-reference-doc.md

---

## Contents

- When to use hooks (vs rules, skills, subagents)
- Hook configuration structure (three-level nesting)
- Four hook types and when to use each
- Matcher patterns and event-field mapping
- Hook locations and scope
- Exit codes and communication protocol
- Security considerations and best practices

---

## When to Use Hooks

Hooks provide **deterministic control** — they always fire, regardless of LLM judgment. Use hooks when you need guaranteed enforcement, not best-effort compliance.

| Use hooks when | Use rules when | Use skills when |
|----------------|---------------|----------------|
| Action must ALWAYS happen | Behavior guidance is sufficient | Complex workflow orchestration |
| Side effects must be prevented | Contextual judgment acceptable | Multi-step instruction execution |
| Consistency across all sessions | Occasional exception is OK | On-demand user-triggered action |
| External system integration | Content is knowledge, not enforcement | |

Examples: auto-formatting after edits, blocking destructive commands, sending notifications, auditing config changes.

*Source: hooks/automate-workflow-with-hooks.md lines 1-13*

---

## Hook Configuration Structure

Three-level nesting in JSON settings files:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/validate.sh"
          }
        ]
      }
    ]
  }
}
```

Level 1: **Event** — which lifecycle point to intercept
Level 2: **Matcher group** — regex filter on an event-specific field
Level 3: **Handler** — what to run when matched

Omit `matcher` or use `""` / `"*"` to match all occurrences.

*Source: hooks/claude-hook-reference-doc.md lines 132-141*

---

## Four Hook Types

| Type | Mechanism | Best for | Default timeout |
|------|-----------|----------|----------------|
| `command` | Shell script (stdin → stdout) | Formatting, validation, logging | 600s |
| `http` | POST to HTTP endpoint | Centralized audit, external services | 30s |
| `prompt` | LLM single-turn evaluation | Decisions requiring judgment | 30s |
| `agent` | Subagent with tool access | Verification requiring file inspection | 60s |

**Use `command`** for deterministic checks (regex patterns, file existence, format enforcement).

**Use `prompt`** for "did Claude complete all tasks?" type checks where judgment is needed.

**Use `agent`** for "do all tests pass?" type checks where tool use is needed.

**Use `http`** for centralizing audit trails across projects or sending to external services.

*Source: hooks/automate-workflow-with-hooks.md lines 569-625; hooks/claude-hook-reference-doc.md lines 249-257*

---

## Matcher Patterns

The `matcher` field is a **regex string** filtering on different fields per event:

| Event | Matcher filters | Example values |
|-------|----------------|----------------|
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest` | tool name | `Bash`, `Edit\|Write`, `mcp__.*` |
| `SessionStart` | session start reason | `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | session end reason | `clear`, `resume`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other` |
| `SubagentStart`, `SubagentStop` | agent type | `Explore`, `Plan`, custom names |
| `Notification` | notification type | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog` |
| `PreCompact`, `PostCompact` | compaction trigger | `manual`, `auto` |
| `ConfigChange` | config source | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` |
| `StopFailure` | error type | `rate_limit`, `billing_error`, `server_error`, `unknown`, `authentication_failed`, `invalid_request`, `max_output_tokens` |
| `InstructionsLoaded` | load reason | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact` |
| `Elicitation`, `ElicitationResult` | MCP server name | your configured server names |
| No matcher support | always fires | `UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove` |

MCP tools follow pattern `mcp__<server>__<tool>` — use `mcp__server__.*` to match all tools from a server.

*Source: hooks/claude-hook-reference-doc.md lines 162-203*

---

## Hook Locations

| Location | Scope | Shareable |
|----------|-------|-----------|
| `~/.claude/settings.json` | All your projects | No (local only) |
| `.claude/settings.json` | This project | Yes (commit to repo) |
| `.claude/settings.local.json` | This project | No (gitignored) |
| Plugin `hooks/hooks.json` | When plugin enabled | Yes (bundled) |
| Skill/agent frontmatter | While component active | Yes |
| Managed policy settings | Organization-wide | Yes, admin-controlled |

*Source: hooks/automate-workflow-with-hooks.md lines 552-565*

---

## Exit Codes and Communication Protocol

For **command** hooks:

- Input: JSON event data on **stdin**
- Output: JSON decision on **stdout**
- Errors/messages: **stderr** (shown to user or Claude depending on exit code)

| Exit code | Effect |
|-----------|--------|
| `0` | Action proceeds; stdout parsed as JSON decision or injected as context |
| `2` | Action blocked; stderr shown to Claude as feedback |
| Other | Action proceeds; stderr shown in verbose mode only |

For **prompt/agent** hooks — return JSON `{"ok": true/false, "reason": "..."}`. When `ok: false`, Claude receives `reason` as its next instruction.

*Source: hooks/automate-workflow-with-hooks.md lines ~393-420; hooks/claude-hook-reference-doc.md lines 80-88*

### Hook Output Discipline

**Golden rule of hook output: success silent, failure verbose.** Stdout/stderr from hooks is injected into Claude's context. A passing typecheck or 4,000-line test log on every PostToolUse pushes the smart zone into the dumb zone. Emit nothing on success; emit specific error traces only on failure.

*Source: harness-engineering.md*

---

## Security Considerations

- **Validate and sanitize inputs**: never trust input data blindly
- **Always quote shell variables**: use `"$VAR"` not `$VAR`
- **Block path traversal**: check for `..` in file paths
- **Use absolute paths**: specify full paths for scripts, using `"$CLAUDE_PROJECT_DIR"` for the project root
- **Skip sensitive files**: avoid `.env`, `.git/`, keys, etc.

Test with `--debug` to see hook execution details, including which hooks matched, exit codes, and output.

*Source: hooks/claude-hook-reference-doc.md lines 2050-2065*
