# Hook Authoring Guide

Evidence-based guidance for creating Cursor hooks that enforce deterministic behavior.

---

## Contents

- When to use hooks (vs rules, skills, subagents)
- Hook configuration structure (`version` + `hooks` map)
- Two handler types and when to use each
- Matcher patterns and event-field mapping
- Hook locations and scope
- Exit codes, communication protocol, and `failClosed`
- Security considerations and best practices

---

## When to Use Hooks

Hooks provide **deterministic control** — they always fire, regardless of model judgment. Use hooks when you need guaranteed enforcement, not best-effort compliance.

| Use hooks when | Use rules when | Use skills when |
|----------------|---------------|----------------|
| Action must ALWAYS happen | Behavior guidance is sufficient | Complex workflow orchestration |
| Side effects must be prevented | Contextual judgment acceptable | Multi-step instruction execution |
| Consistency across all sessions | Occasional exception is OK | On-demand user-triggered action |
| External system integration | Content is knowledge, not enforcement | |

Examples: auto-formatting after edits, blocking destructive shell commands, sending notifications, auditing config changes, redacting secrets before file reads.


---

## Hook Configuration Structure

Cursor hooks live in `hooks.json` with two top-level keys:

```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      {
        "command": ".cursor/hooks/approve-network.sh",
        "matcher": "curl|wget|nc",
        "timeout": 30
      }
    ]
  }
}
```

Level 1: **`hooks` map** — keys are event names, values are arrays of hook definitions
Level 2: **Hook definition** — at minimum a `command`; optionally `type`, `matcher`, `timeout`, `failClosed`, `loop_limit`

Omit `matcher` to fire on every occurrence of the event.


---

## Two Handler Types

| Type | Mechanism | Best for |
|------|-----------|----------|
| `command` (default) | Shell script (stdin → stdout) | Formatting, validation, logging |
| `prompt` | LLM single-turn evaluation | Decisions requiring natural-language judgment |

**Use `command`** for deterministic checks (regex patterns, file existence, format enforcement). It is the implicit default when `type` is omitted.

**Use `prompt`** when a natural-language criterion is genuinely required:

```json
{
  "type": "prompt",
  "prompt": "Does this command look safe to execute? Only allow read-only operations.",
  "timeout": 10
}
```

Prompt hooks return a structured `{ ok: boolean, reason?: string }` response. The `$ARGUMENTS` placeholder in the prompt is auto-replaced with the hook input JSON.


---

## Matcher Patterns

The `matcher` field is a **regex string**. Which field it filters depends on the event:

| Event | Matcher filters | Example values |
|-------|-----------------|----------------|
| `preToolUse`, `postToolUse`, `postToolUseFailure` | tool type | `Shell`, `Read`, `Write`, `Grep`, `Delete`, `Task`, `MCP:<tool_name>` |
| `subagentStart`, `subagentStop` | subagent type | `generalPurpose`, `explore`, `shell` |
| `beforeShellExecution`, `afterShellExecution` | full shell command string | `curl|wget|nc`, `rm -rf` |
| `beforeReadFile` | tool type | `TabRead`, `Read` |
| `afterFileEdit` | tool type | `TabWrite`, `Write` |
| No matcher support | always fires | `sessionStart`, `sessionEnd`, `beforeMCPExecution`, `afterMCPExecution`, `preCompact`, `beforeTabFileRead`, `afterTabFileEdit` |

Matchers on `beforeSubmitPrompt`, `stop`, `afterAgentResponse`, and `afterAgentThought` are matched against fixed literal values documented in the Cursor hooks guide; in practice these matchers add no filtering value and may be omitted.


---

## Hook Locations

| Location | Scope | Working directory | Shareable |
|----------|-------|-------------------|-----------|
| `<project-root>/.cursor/hooks.json` | This project | Project root | Yes (commit to repo) |
| `~/.cursor/hooks.json` | All your projects | `~/.cursor/` | No (local only) |
| Enterprise system-wide config | Org-wide | Enterprise config dir | Yes, admin-controlled |
| Team cloud config | Team-wide | Managed hooks dir | Yes, dashboard-controlled |

Priority order (highest to lowest): Enterprise → Team → Project → User. All matching hooks from every source run; merge conflicts resolve toward the higher-priority source.

For project hooks, write paths relative to the project root (e.g., `.cursor/hooks/script.sh`). For user hooks, write paths relative to `~/.cursor/` (e.g., `./hooks/script.sh`).


---

## Exit Codes and Communication Protocol

For **command** hooks:

- Input: JSON event data on **stdin**
- Output: JSON decision on **stdout**
- Errors/messages: **stderr**

| Exit code | Effect |
|-----------|--------|
| `0` | Hook succeeded; stdout JSON is consumed (e.g., `permission`, `additional_context`, `updated_input`) |
| `2` | Action blocked (equivalent to returning `permission: "deny"`) |
| Other | Hook failed; action proceeds (fail-open by default) |

To make a security-critical hook **fail closed** instead, set `"failClosed": true` on the hook definition. With `failClosed: true`, a crash, timeout, or invalid-JSON response blocks the action.

For **prompt** hooks: the LLM returns `{ ok: boolean, reason?: string }`. When `ok: false`, the action is denied and `reason` is surfaced to the user.


---

## Security Considerations

- **Validate and sanitize stdin input** — never trust event data blindly; parse the JSON, then check fields.
- **Always quote shell variables** — write `"$VAR"`, never bare `$VAR`, to avoid command injection from values containing spaces or special characters.
- **Block path traversal** — when a hook receives a `file_path`, reject inputs containing `..` segments before using them.
- **Use `CURSOR_PROJECT_DIR`** — anchor file paths to the workspace root via this environment variable rather than hardcoding paths.
- **Skip sensitive files** — `beforeReadFile` is the right place to redact or deny reads of `.env`, key files, and `.git/` internals.
- **Never log secrets** — `afterShellExecution` and `afterMCPExecution` see full outputs; redact credentials before forwarding to external systems.
- **Set `failClosed: true` for security-critical hooks** — `beforeMCPExecution`, `beforeShellExecution`, and `beforeReadFile` should fail closed when a denial is the safer outcome.

Use the Hooks tab in Cursor Settings to confirm hooks are loaded and to inspect execution traces.

