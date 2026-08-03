# Claude Code Subagents

**Summary**: Task-specific assistants defined as Markdown files with YAML frontmatter that run in isolated context windows within Claude Code sessions — supporting tool restriction, model selection, permission modes, persistent memory, and worktree isolation.
**Sources**: creating-custom-subagents.md, claude-orchestrate-of-claude-code-sessions.md, analysis-creating-custom-subagents.md, research-subagent-best-practices.md, agent-teams.md, dynamic-workflows.md, parallel-sessions-worktrees.md
**Last updated**: 2026-08-02

---

## Definition Format

```yaml
---
name: code-reviewer
description: Reviews code for bugs, security issues, and style
tools: Read, Grep, Glob
model: haiku
maxTurns: 15
---
You are a senior code reviewer. Focus on correctness, security, and maintainability.
Report only issues with >80% confidence.
```

## Frontmatter Fields

Only `name` and `description` are required (source: creating-custom-subagents.md).

| Field             | Required | Default | Description                                                            |
| ----------------- | -------- | ------- | ---------------------------------------------------------------------- |
| `name`            | Yes      | —       | Identifier                                                             |
| `description`     | Yes      | —       | When to invoke                                                         |
| `tools`           | No       | All     | Comma-separated allowlist                                              |
| `disallowedTools` | No       | None    | Denylist                                                               |
| `model`           | No       | inherit | sonnet, opus, haiku, or a full ID (e.g. `claude-opus-4-7`)             |
| `maxTurns`        | No       | —       | Cost control (15 exploration, 20 evaluation)                           |
| `permissionMode`  | No       | default | default, acceptEdits, auto, dontAsk, bypassPermissions, plan           |
| `memory`          | No       | —       | user, project, local (cross-session learning)                         |
| `isolation`       | No       | —       | `worktree` for git worktree isolation                                  |
| `background`      | No       | false   | Run asynchronously                                                     |
| `effort`          | No       | —       | low, medium, high, xhigh, max — available levels depend on the model   |
| `skills`          | No       | —       | Skills to preload — full skill content injected into context at startup |
| `mcpServers`      | No       | —       | Scoped MCP server access                                               |
| `hooks`           | No       | —       | Subagent-specific hooks                                                |
| `color`           | No       | —       | Display color in task list/transcript: red, blue, green, yellow, purple, orange, pink, cyan |
| `initialPrompt`   | No       | —       | Auto-submitted as first user turn when the agent runs as the main session agent (via `--agent` or the `agent` setting) |

All field descriptions above are sourced from `creating-custom-subagents.md`. The `model` field accepts the same values as the `--model` flag and defaults to `inherit` (source: creating-custom-subagents.md). The `auto` permission mode runs a background classifier that reviews commands and protected-directory writes (source: creating-custom-subagents.md). The `skills` field controls preloading only — without it, a subagent can still discover and invoke project, user, and plugin skills through the Skill tool (source: creating-custom-subagents.md).

## Locations (Priority Order)

When multiple subagents share the same name, the higher-priority location wins (source: creating-custom-subagents.md).

| Priority      | Location                     | Scope                   |
| ------------- | ---------------------------- | ----------------------- |
| 1 (highest)   | Managed settings             | Organization-wide       |
| 2             | `--agents` CLI flag          | Current session         |
| 3             | `.claude/agents/`            | Current project         |
| 4             | `~/.claude/agents/`          | All your projects       |
| 5 (lowest)    | Plugin's `agents/` directory | Where plugin is enabled |

Managed subagents are deployed by organization administrators via the managed settings directory and take precedence over project and user subagents with the same name (source: creating-custom-subagents.md).

## Built-in Subagents

Claude Code includes built-in subagents it uses automatically when appropriate; each inherits the parent conversation's permissions with additional tool restrictions (source: creating-custom-subagents.md).

| Name              | Model   | Tools            | Purpose                                                   |
| ----------------- | ------- | ---------------- | --------------------------------------------------------- |
| Explore           | Haiku   | Read-only        | Fast codebase search; invocation level: quick/medium/very thorough |
| Plan              | inherit | Read-only        | Codebase research during plan mode                        |
| general-purpose   | inherit | All              | Complex, multi-step tasks: exploration + action           |
| statusline-setup  | Sonnet  | —                | Configures the status line when you run `/statusline`     |
| claude-code-guide | Haiku   | —                | Answers questions about Claude Code features              |

Explore and Plan skip CLAUDE.md files and the parent session's git status to keep research fast; every other built-in and custom subagent loads both (source: creating-custom-subagents.md). Built-in subagents are always registered in interactive sessions. To block a specific built-in type, add it to `permissions.deny`. In non-interactive mode and the Agent SDK, set `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` to remove all built-in types and supply only your own.

## /agents Command UI

The `/agents` command opens a tabbed interface. The **Running** tab shows live subagents and lets you open or stop them. The **Library** tab lets you view all available subagents (built-in, user, project, plugin), create new ones with guided setup or Claude generation, edit existing configuration and tool access, and delete custom subagents (source: creating-custom-subagents.md).

## Effort Levels

The `effort` frontmatter field controls how hard the model works. It overrides the session effort level and defaults to inheriting from the session (source: creating-custom-subagents.md).

| Level    | Behavior                       | Availability                       |
| -------- | ------------------------------ | ---------------------------------- |
| `low`    | Quick, shallow analysis        | available levels depend on the model |
| `medium` | Standard depth                 | available levels depend on the model |
| `high`   | Thorough analysis              | available levels depend on the model |
| `xhigh`  | Extended-depth reasoning       | available levels depend on the model |
| `max`    | Deepest reasoning              | available levels depend on the model |

Which effort levels are accepted depends on the model in use — there is no fixed "all models" or model-specific guarantee (source: creating-custom-subagents.md).

## Session-Scoped Hooks for Subagents

[[claude-code-hooks]] can be defined directly in subagent YAML frontmatter, scoped to the subagent's lifecycle:

```yaml
---
name: secure-writer
tools: Edit, Write
hooks:
  PreToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "validate-paths.sh"
  Stop:
    - hooks:
        - type: command
          command: "run-tests.sh"
---
```

All hook events are supported. Key behaviors:

- `Stop` hooks defined in subagent frontmatter are **automatically converted** to `SubagentStop` events
- Hooks are cleaned up when the subagent finishes
- Project-level hooks for `SubagentStart`/`SubagentStop` also fire for custom subagents

## Agent Teams (Experimental)

A fixed team lead spawns independent Claude Code teammate instances — each with its own context window — that share a file-locked task list and message each other point-to-point through a mailbox, governed by three team-specific hooks (source: agent-teams.md). This is distinct from single-session subagents (which report only to their caller and never talk to each other). See the canonical page [[claude-code-agent-teams]] for architecture, communication, team hooks, sizing, and limitations.

## Fork Mode (Experimental)

A **fork** is a subagent that inherits the entire conversation so far instead of starting fresh (source: creating-custom-subagents.md). It drops the input isolation a normal subagent provides: the fork sees the same system prompt, tools, model, and message history as the main session, so a side task can be handed off without re-explaining context. The fork's own tool calls still stay out of the main conversation — only its final result returns (source: creating-custom-subagents.md).

Fork mode is experimental. It is **enabled by default** as of Claude Code v2.1.161 — you no longer need to set `CLAUDE_CODE_FORK_SUBAGENT=1` to activate it. On earlier versions (v2.1.117–v2.1.160), set `CLAUDE_CODE_FORK_SUBAGENT=1` to enable it (source: creating-custom-subagents.md).

Enabling fork mode changes three things (source: creating-custom-subagents.md):

- Claude spawns a fork whenever it would otherwise use the `general-purpose` subagent; named subagents such as Explore still spawn as before.
- Every subagent spawn runs in the background, whether a fork or a named subagent.
- The `/fork` command spawns a fork instead of aliasing `/branch`.

You can start a fork yourself with `/fork` followed by a directive (e.g. `/fork draft unit tests for the parser changes so far`); Claude Code names the fork from the first words of the directive (source: creating-custom-subagents.md). Because a fork's system prompt and tool definitions are identical to the parent, its first request reuses the parent's prompt cache, making forking cheaper than spawning a fresh subagent for tasks that need the same context (source: creating-custom-subagents.md). A fork cannot spawn further forks (source: creating-custom-subagents.md).

## Claude-Code-Specific Subagent Behavior

- **Workflow-spawned subagents**: subagents spawned by a [[claude-code-workflows]] dynamic workflow always run in `acceptEdits` mode and inherit the session tool allowlist regardless of the session's permission mode — file edits are auto-approved, though un-allowlisted shell/web/MCP calls can still prompt mid-run (source: dynamic-workflows.md).
- **Subagent worktrees**: subagent (and background-session) worktrees are auto-removed once older than the `cleanupPeriodDays` setting if they are clean (no uncommitted changes, untracked files, or unpushed commits), whereas `--worktree`-created worktrees are never swept; subagent worktrees inherit the same base branch as `--worktree` (source: parallel-sessions-worktrees.md). See [[claude-code-worktrees]].

## CLI-Defined Subagents (`--agents` flag)

Pass subagents as JSON when launching Claude Code for session-scoped definitions that are not saved to disk (source: creating-custom-subagents.md):

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  }
}'
```

The `--agents` flag accepts the same frontmatter fields as file-based subagents, with `prompt` substituting for the markdown body. Useful for automation scripts and quick testing. `--strict-mcp-config` does not filter inline servers defined here, since they are explicit caller input.

## Model Resolution Order

When Claude invokes a subagent, the model is resolved in this order (source: creating-custom-subagents.md):

1. `CLAUDE_CODE_SUBAGENT_MODEL` environment variable, if set
2. Per-invocation `model` parameter
3. Subagent definition's `model` frontmatter
4. Main conversation's model

## Agent(agent_type) Spawn Restrictions

When an agent runs as the main thread with `claude --agent`, use `Agent(worker, researcher)` syntax in the `tools` field to restrict which subagent types it can spawn — an allowlist. `Agent` without parentheses allows any subagent. Omitting `Agent` from `tools` prevents spawning any subagents. The `Agent(agent_type)` allowlist syntax applies **only** to an agent running as the main thread with `claude --agent`; in a subagent definition, listing `Agent` in `tools` lets that subagent spawn subagents of its own while the depth limit allows it, but any type list inside the parentheses is ignored (source: creating-custom-subagents.md).

## MCP Server Restrictions (v2.1.153+)

As of v2.1.153, the MCP restrictions that apply to the main session also cover servers declared in subagent `mcpServers` frontmatter: `--strict-mcp-config`, `--bare`, enterprise managed MCP configuration, and `allowedMcpServers`/`deniedMcpServers` policies. When a restriction blocks a server, Claude Code skips it and shows a warning. Managed-settings restrictions apply to every subagent regardless of definition method (source: creating-custom-subagents.md).

## Nested subagents

**A subagent can spawn subagents of its own**, by default up to three layers below the main conversation. At the depth limit Claude Code withholds the `Agent` tool from every subagent except a fork; a fork at the limit keeps `Agent` in its inherited tool list but the tool returns an error instead of spawning (source: creating-custom-subagents.md). Nested subagents suit a delegated task that itself splits into parallel subtasks — a reviewer subagent that dispatches a verifier per finding, for instance — so the intermediate output never reaches the main conversation; only the top-level subagent's summary returns (source: creating-custom-subagents.md).

As of v2.1.217 the limit is configurable through `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, set to the number of subagent layers wanted below the main conversation; `1` turns nesting off (source: creating-custom-subagents.md). Version history: v2.1.172 through v2.1.216 nested by default up to five layers and the limit could not be changed (source: creating-custom-subagents.md).

To keep one subagent from spawning while nesting is on — a reviewer that must stay read-only, say — omit `Agent` from its `tools` list or add it to `disallowedTools` (source: creating-custom-subagents.md). A nested subagent is configured the same way as a top-level one and resolves from the same scopes; every nested spawn counts toward the session-wide subagent limit (source: creating-custom-subagents.md).

**Plugin security**: Agents bundled in [[claude-code-plugins]] cannot use `hooks`, `mcpServers`, or `permissionMode` frontmatter fields — these are silently ignored when loading from a plugin context. To use these fields, copy the agent file to `.claude/agents/` or `~/.claude/agents/`.

## Related pages

- [[subagents]]
- [[claude-code-skills]]
- [[claude-code-plugins]]
- [[claude-code-hooks]]
- [[agent-workflows]]
- [[cursor-subagents]]
- [[claude-code-agent-teams]]
- [[claude-code-workflows]]
- [[claude-code-worktrees]]
- [[monorepo-large-codebase-setup]]
- [[claude-code-commands]] — `/agents`, `/tasks`, `/fork`, `/batch`, and `/background` commands control subagent management
- [[claude-code-env-vars]] — `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS`, `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS`, `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`, `TASK_MAX_OUTPUT_LENGTH`, and `CLAUDE_CODE_FORK_SUBAGENT` are documented there
- [[claude-code-tools]] — the Agent tool inheritance rules (tools/disallowedTools precedence) and foreground vs background permission behavior
