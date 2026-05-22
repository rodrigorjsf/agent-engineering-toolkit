# Hook Events Reference

Complete reference for Cursor's native hook events: triggers, matcher fields, and handler-type support.

---

## Contents

- Event summary table (Agent and Tab events)
- Matcher field by event type
- JSON configuration schema
- Handler type support matrix
- Common patterns (pre-validation, post-formatting, session injection)

---

## Event Summary Table

Cursor exposes two families of hook events: Agent (Cmd+K / Agent Chat) and Tab (inline completions).

### Agent events

| Event | When it fires | Can block? |
|-------|--------------|-----------|
| `sessionStart` | A new composer conversation is created | No (fire-and-forget) |
| `sessionEnd` | A composer conversation ends | No (fire-and-forget) |
| `preToolUse` | Before any tool call executes (generic — fires for all tools) | Yes (`permission: "deny"`) |
| `postToolUse` | After a tool call succeeds | No (output replacement / context injection) |
| `postToolUseFailure` | After a tool call fails, times out, or is denied | No (observation only) |
| `subagentStart` | Before a Task-tool subagent spawns | Yes (`permission: "deny"`) |
| `subagentStop` | When a subagent finishes | No (may set `followup_message`) |
| `beforeShellExecution` | Before any shell command runs | Yes (`permission: "deny"`) |
| `afterShellExecution` | After a shell command completes | No (audit/metrics only) |
| `beforeMCPExecution` | Before an MCP tool call runs | Yes (`permission: "deny"`) |
| `afterMCPExecution` | After an MCP tool call completes | No (audit only) |
| `beforeReadFile` | Before the agent reads a file | Yes (`permission: "deny"`) |
| `afterFileEdit` | After the agent edits a file | No (formatters / accounting) |
| `beforeSubmitPrompt` | After the user hits send, before backend request | Yes (`continue: false`) |
| `preCompact` | Before context-window compaction | No (observational) |
| `stop` | When the agent loop ends | No (may set `followup_message` to auto-continue) |
| `afterAgentResponse` | After the agent completes an assistant message | No |
| `afterAgentThought` | After the agent completes a thinking block | No |

### Tab events

| Event | When it fires | Can block? |
|-------|--------------|-----------|
| `beforeTabFileRead` | Before Tab reads a file for inline completions | Yes (`permission: "deny"`) |
| `afterTabFileEdit` | After Tab edits a file | No |


---

## Matcher Field by Event Type

The `matcher` is a regex string. The field it matches against depends on the event:

| Event | Matcher filters on | Example values |
|-------|-------------------|----------------|
| `preToolUse`, `postToolUse`, `postToolUseFailure` | tool type | `Shell`, `Read`, `Write`, `Grep`, `Delete`, `Task`, or `MCP:<tool_name>` |
| `subagentStart`, `subagentStop` | subagent type | `generalPurpose`, `explore`, `shell` |
| `beforeShellExecution`, `afterShellExecution` | full shell command string | `curl|wget|nc`, `rm -rf` |
| `beforeReadFile` | tool type | `TabRead`, `Read` |
| `afterFileEdit` | tool type | `TabWrite`, `Write` |
| `beforeSubmitPrompt` | the literal value documented in the Cursor hooks guide | (matched against the documented literal) |
| `stop` | the literal value documented in the Cursor hooks guide | (matched against the documented literal) |
| `afterAgentResponse` | the literal value documented in the Cursor hooks guide | (matched against the documented literal) |
| `afterAgentThought` | the literal value documented in the Cursor hooks guide | (matched against the documented literal) |
| No matcher support | always fires | `sessionStart`, `sessionEnd`, `beforeMCPExecution`, `afterMCPExecution`, `preCompact`, `beforeTabFileRead`, `afterTabFileEdit` |

For MCP tool filtering on `preToolUse`/`postToolUse`/`postToolUseFailure`, use the `MCP:<tool_name>` format.


---

## JSON Configuration Schema

Cursor hooks live in a `hooks.json` file at the project or user scope. The top level is two keys: `version` and `hooks`. Under `hooks`, each event maps to an array of hook definitions.

```json
{
  "version": 1,
  "hooks": {
    "<eventName>": [
      {
        "command": "<script-path-or-shell-string>",
        "matcher": "<regex-string>",
        "timeout": 30,
        "failClosed": false
      }
    ]
  }
}
```

**Per-script options:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `command` | string | required | Script path (relative or absolute) or inline shell command |
| `type` | `"command"` or `"prompt"` | `"command"` | Hook execution type |
| `timeout` | number | platform default | Execution timeout in seconds |
| `loop_limit` | number or `null` | `5` | Per-script auto-followup cap for `stop` and `subagentStop` |
| `failClosed` | boolean | `false` | When `true`, hook failures (crash, timeout, invalid JSON) block the action instead of failing open |
| `matcher` | string | — | Regex filter; meaning depends on the event (see table above) |

**Prompt-hook fields:** add `"type": "prompt"` and a `"prompt": "<natural-language criterion>"` field; an optional `"model"` field overrides the default fast model. The prompt receives the hook input via the auto-replaced `$ARGUMENTS` placeholder.


---

## Handler Type Support Matrix

| Handler type | Supported events | Notes |
|--------------|-----------------|-------|
| `command` | All events | Default; shell script over stdin/stdout |
| `prompt` | All events | LLM evaluates a natural-language criterion; returns `{ ok, reason }` |

Unlike some agent platforms, Cursor exposes only these two handler types — there is no separate `http` or `agent` handler. Use `command` for deterministic checks; reserve `prompt` for cases where natural-language judgment is genuinely required.


---

## Common Patterns

### Pre-validation (`beforeShellExecution` + command matcher)

Block dangerous network commands:

```json
{ "version": 1, "hooks": { "beforeShellExecution": [{ "command": ".cursor/hooks/approve-network.sh", "matcher": "curl|wget|nc" }] } }
```

Exit `2` from the script blocks the action; exit `0` allows it.

### Post-formatting (`afterFileEdit`)

Run a formatter after every agent edit:

```json
{ "version": 1, "hooks": { "afterFileEdit": [{ "command": ".cursor/hooks/format.sh" }] } }
```

`afterFileEdit` is non-blocking — its job is observation and side effects.

### Session context injection (`sessionStart`)

Inject dynamic context at session start:

```json
{ "version": 1, "hooks": { "sessionStart": [{ "command": ".cursor/hooks/inject-context.sh" }] } }
```

The script's stdout JSON may include `additional_context` to add to the conversation's initial system context.

