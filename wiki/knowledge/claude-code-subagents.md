# Claude Code Subagents

**Summary**: Task-specific assistants defined as Markdown files with YAML frontmatter that run in isolated context windows within Claude Code sessions — supporting tool restriction, model selection, permission modes, persistent memory, and worktree isolation.
**Sources**: creating-custom-subagents.md, claude-orchestrate-of-claude-code-sessions.md, analysis-creating-custom-subagents.md, research-subagent-best-practices.md
**Last updated**: 2026-05-21

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

| Name              | Model   | Tools            | Purpose                                            |
| ----------------- | ------- | ---------------- | -------------------------------------------------- |
| Explore           | Haiku   | Read-only        | Fast, cheap codebase search and analysis           |
| Plan              | inherit | Read-only        | Codebase research during plan mode                 |
| general-purpose   | inherit | All              | Complex, multi-step tasks: exploration + action    |
| statusline-setup  | Sonnet  | —                | Configures the status line when you run `/statusline` |
| claude-code-guide | Haiku   | —                | Answers questions about Claude Code features       |

The live "Other" tab of the built-in subagents documentation now lists only `statusline-setup` and `claude-code-guide`; the previously documented `Bash` built-in is no longer listed (source: creating-custom-subagents.md). Explore and Plan skip CLAUDE.md files and the parent session's git status to keep research fast; every other built-in and custom subagent loads both (source: creating-custom-subagents.md).

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

Multiple Claude Code instances coordinating as a team. Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Requires Claude Code v2.1.32+.

### Architecture

| Component     | Role                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| **Team lead** | Creates team, breaks work into tasks, coordinates progress, synthesizes results |
| **Teammates** | Independent Claude Code instances, each with own context window                 |
| **Task list** | Shared state — teammates claim tasks, mark complete                             |
| **Mailbox**   | Direct messaging between lead and teammates, or between teammates               |

### Task Workflow

Tasks flow through states: **pending** → **in progress** → **completed**. Task dependencies are supported — a task won't become available until its dependencies are complete. File locking prevents race conditions when teammates access shared resources.

### Communication

- **Lead ↔ Teammate**: Direct messages via task list updates and mailbox
- **Teammate ↔ Teammate**: Broadcast messages for coordination
- Display modes: **in-process** (cycle with `Shift+Down`) or **split-panes** (tmux/iTerm2)

### Team-Specific Hooks

Two hook events exist specifically for agent teams:

- `TeammateIdle` — fires when a teammate is about to go idle; block to keep it working
- `TaskCompleted` — fires when a task is marked complete; block to prevent completion

### Sizing Guidelines

| Guideline          | Recommendation                                                                  |
| ------------------ | ------------------------------------------------------------------------------- |
| Team size          | **3–5 teammates** for most workflows                                            |
| Tasks per teammate | **5–6 tasks** each keeps everyone productive                                    |
| Scaling rule       | Add teammates only when work genuinely benefits from parallelism                |
| Task granularity   | Self-contained units producing clear deliverables (function, test file, review) |

Three focused teammates often outperform five scattered ones. Token costs scale linearly with teammate count, and coordination overhead increases with team size.

### Team Use Cases

- Parallel research from different angles
- Cross-layer coordination (frontend, backend, tests simultaneously)
- Model comparison on same task
- Large PR reviews split by concern area

### Team Anti-Patterns

- Sequential, tightly-coupled tasks (use single session)
- Same-file edits across teammates (causes overwrites)
- Simple tasks that don't justify coordination overhead (higher token cost)
- Running unattended too long (increases risk of wasted effort)

### Current Limitations

- No session resumption with in-process teammates (`/resume` and `/rewind` don't restore them)
- Task status can lag — teammates sometimes fail to mark tasks complete
- One team per session; no nested teams
- Lead is fixed for the session lifetime
- All teammates start with the lead's permission mode
- Split panes require tmux or iTerm2 (not supported in VS Code terminal, Windows Terminal, or Ghostty)

## Fork Mode (Experimental)

A **fork** is a subagent that inherits the entire conversation so far instead of starting fresh (source: creating-custom-subagents.md). It drops the input isolation a normal subagent provides: the fork sees the same system prompt, tools, model, and message history as the main session, so a side task can be handed off without re-explaining context. The fork's own tool calls still stay out of the main conversation — only its final result returns (source: creating-custom-subagents.md).

Fork mode is experimental and requires Claude Code v2.1.117 or later. Enable it by setting the `CLAUDE_CODE_FORK_SUBAGENT` environment variable to `1`; the variable is honored in interactive mode and via the SDK or `claude -p` (source: creating-custom-subagents.md).

Enabling fork mode changes three things (source: creating-custom-subagents.md):

- Claude spawns a fork whenever it would otherwise use the `general-purpose` subagent; named subagents such as Explore still spawn as before.
- Every subagent spawn runs in the background, whether a fork or a named subagent.
- The `/fork` command spawns a fork instead of aliasing `/branch`.

You can start a fork yourself with `/fork` followed by a directive (e.g. `/fork draft unit tests for the parser changes so far`); Claude Code names the fork from the first words of the directive (source: creating-custom-subagents.md). Because a fork's system prompt and tool definitions are identical to the parent, its first request reuses the parent's prompt cache, making forking cheaper than spawning a fresh subagent for tasks that need the same context (source: creating-custom-subagents.md). A fork cannot spawn further forks (source: creating-custom-subagents.md).

## Key Constraint

**Subagents cannot spawn other subagents** — this prevents infinite nesting. Use the `Agent(worker, researcher)` tool syntax to restrict which named subagents can be spawned from the parent context.

**Plugin security**: Agents bundled in [[claude-code-plugins]] cannot use `hooks`, `mcpServers`, or `permissionMode` frontmatter fields — these are silently ignored when loading from a plugin context. To use these fields, copy the agent file to `.claude/agents/` or `~/.claude/agents/`.

## Related pages

- [[subagents]]
- [[claude-code-skills]]
- [[claude-code-plugins]]
- [[claude-code-hooks]]
- [[agent-workflows]]
- [[cursor-subagents]]
