# Claude Code Agent Teams

**Summary**: Experimental multi-session orchestration: a team lead spawns independent Claude Code teammates that share a file-locked task list, message each other point-to-point, and are governed by three team hooks.
**Sources**: agent-teams.md
**Last updated**: 2026-06-04
---

Agent teams let one Claude Code session coordinate several others working together (source: agent-teams.md). One session acts as the **team lead** — it creates the team, spawns teammates, assigns work, and synthesizes results — while each teammate runs independently in its own context window and communicates directly with the others (source: agent-teams.md). The feature is experimental and disabled by default; enable it by setting the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable to `1`, in your shell or in `settings.json` (source: agent-teams.md). It requires Claude Code v2.1.32 or later (source: agent-teams.md).

## When to use teams instead of subagents

Both agent teams and [[subagents]] parallelize work, but they differ on one decisive axis: communication (source: agent-teams.md). A [[claude-code-subagents]] worker runs in its own context and reports results only back to the caller — subagents never talk to each other, and the main agent manages all of their work (source: agent-teams.md). Agent teammates, by contrast, are fully independent Claude Code sessions that message each other directly and self-coordinate through a shared task list (source: agent-teams.md).

Use subagents when you need quick, focused workers whose result is all that matters; use agent teams when the workers need to share findings, challenge each other, and coordinate on their own (source: agent-teams.md). Teams are most effective for parallel research and review, building separate new modules or features, debugging with competing hypotheses, and cross-layer changes where each layer has a distinct owner (source: agent-teams.md). They add coordination overhead and use significantly more tokens than a single session, so for sequential tasks, same-file edits, or work with many dependencies, a single session or subagents are the better fit (source: agent-teams.md). This makes teams the concrete Claude Code realization of an orchestrator-style [[agent-workflows]] pattern, with self-coordination replacing a single managing agent.

## Architecture

An agent team has four components (source: agent-teams.md):

- **Team lead** — the main session that creates the team, spawns teammates, and coordinates work (source: agent-teams.md).
- **Teammates** — separate Claude Code instances that each work on assigned tasks (source: agent-teams.md).
- **Task list** — a shared list of work items that teammates claim and complete (source: agent-teams.md).
- **Mailbox** — the messaging system for communication between agents (source: agent-teams.md).

Claude starts a team either because you explicitly ask for one or because it proposes one for a task that benefits from parallel work and you confirm; it will not create a team without your approval (source: agent-teams.md).

## The shared task list and file-locked claiming

The shared task list coordinates work across the team: the lead creates tasks and teammates work through them (source: agent-teams.md). Each task is in one of three states — pending, in progress, or completed — and tasks can depend on other tasks, so a pending task with unresolved dependencies cannot be claimed until those dependencies complete (source: agent-teams.md). The system manages dependencies automatically: when a teammate finishes a task that others depend on, the blocked tasks unblock without manual intervention (source: agent-teams.md).

The lead can assign a task explicitly, or a teammate can self-claim the next unassigned, unblocked task after finishing its current one (source: agent-teams.md). Task claiming uses **file locking** to prevent race conditions when multiple teammates try to claim the same task simultaneously (source: agent-teams.md).

## Context and communication

Each teammate has its own context window (source: agent-teams.md). When spawned, a teammate loads the same project context as a regular session — CLAUDE.md, MCP servers, and skills — plus the spawn prompt from the lead, but the lead's conversation history does not carry over (source: agent-teams.md). Because teammates read CLAUDE.md from their working directory like any other session, [[claude-code-memory]] is the way to give project-specific guidance to every teammate at once (source: agent-teams.md).

Messaging is **point-to-point**: you send a message to one specific teammate by name, and to reach everyone you send one message per recipient — there is no broadcast primitive (source: agent-teams.md). Addressing is per-recipient, but **delivery is automatic**: when a teammate sends a message it is delivered to the recipient without the lead having to poll for updates (source: agent-teams.md). The lead assigns every teammate a name when spawning it, and any teammate can message any other by that name; tell the lead what to call each teammate to get predictable names you can reference in later prompts (source: agent-teams.md). When a teammate finishes and stops, it automatically notifies the lead, and all agents can see task status and claim available work through the shared list (source: agent-teams.md).

## Quality-gate hooks

Three [[claude-code-hooks]] events fire over a team's lifecycle, and each one **blocks by exiting with code 2** (source: agent-teams.md):

- **`TeammateIdle`** — runs when a teammate is about to go idle; exit code 2 sends feedback and keeps the teammate working (source: agent-teams.md).
- **`TaskCreated`** — runs when a task is being created; exit code 2 prevents creation and sends feedback (source: agent-teams.md).
- **`TaskCompleted`** — runs when a task is being marked complete; exit code 2 prevents completion and sends feedback (source: agent-teams.md).

## Reusing subagent definitions as teammate roles

When spawning a teammate, you can reference a subagent type from any scope — project, user, plugin, or CLI-defined — so a role like a security reviewer can be defined once and reused both as a delegated [[claude-code-subagents]] worker and as a teammate (source: agent-teams.md). The teammate honors that definition's `tools` allowlist and `model`, and the definition's body is appended to the teammate's system prompt as additional instructions rather than replacing it (source: agent-teams.md). Two caveats matter: the `skills` and `mcpServers` frontmatter fields are **not** applied when a definition runs as a teammate — teammates load [[claude-code-skills]] and MCP servers from your project and user settings like a regular session — and the team coordination tools, `SendMessage` and the task-management tools, are always available to a teammate even when `tools` restricts everything else (source: agent-teams.md).

## Plan approval for risky work

For complex or risky tasks, you can require a teammate to plan before implementing: it works in read-only plan mode until the lead approves its approach (source: agent-teams.md). When the teammate finishes planning it sends a plan-approval request to the lead, which either approves it or rejects it with feedback; on rejection the teammate stays in plan mode, revises, and resubmits, and once approved it exits plan mode and begins implementation (source: agent-teams.md). The lead makes approval decisions autonomously, so you steer its judgment by giving it criteria in your prompt, such as only approving plans that include test coverage (source: agent-teams.md).

## Permissions and display modes

Teammates start with the lead's permission settings — if the lead runs with `--dangerously-skip-permissions`, so do all teammates; you can change individual teammate modes after spawning but cannot set per-teammate modes at spawn time (source: agent-teams.md). Teams support two display modes: **in-process**, where all teammates run inside the main terminal and you cycle through them with Shift+Down to message them, and **split panes**, where each teammate gets its own pane (requiring tmux or iTerm2) (source: agent-teams.md). The default `"auto"` uses split panes inside an existing tmux session and in-process otherwise, overridable via `teammateMode` in settings or the `--teammate-mode` flag (source: agent-teams.md).

## Storage layout

Team and task state is stored locally and is machine-generated (source: agent-teams.md):

- **Team config**: `~/.claude/teams/{team-name}/config.json` (source: agent-teams.md).
- **Task list**: `~/.claude/tasks/{team-name}/` (source: agent-teams.md).

The team config holds runtime state such as session IDs and tmux pane IDs, plus a `members` array of each teammate's name, agent ID, and agent type that teammates can read to discover other members (source: agent-teams.md). Claude Code rewrites these files on every state update, so they must not be hand-edited or pre-authored — changes are overwritten (source: agent-teams.md). There is no project-level equivalent: a file like `.claude/teams/teams.json` in the project directory is not recognized as configuration and is treated as an ordinary file (source: agent-teams.md).

## Shutting down and cleaning up

To end a teammate gracefully, the lead sends it a shutdown request, which the teammate can approve (exiting gracefully) or reject with an explanation (source: agent-teams.md). When you are done, ask the lead to clean up, which removes the shared team resources; cleanup checks for active teammates and fails if any are still running, so shut them down first (source: agent-teams.md). Always run cleanup through the lead — teammates should not, because their team context may not resolve correctly and could leave resources in an inconsistent state (source: agent-teams.md).

## Sizing and best practices

Start with 3-5 teammates for most workflows to balance parallel work with manageable coordination, and aim for roughly 5-6 tasks per teammate to keep everyone productive without excessive context switching (source: agent-teams.md). Token cost scales linearly with the number of active teammates and coordination overhead grows as you add more, so three focused teammates often outperform five scattered ones (source: agent-teams.md). Give teammates enough task-specific context in the spawn prompt since they don't inherit the lead's conversation history, size tasks as self-contained units with a clear deliverable, and break work so each teammate owns a different set of files to avoid overwrite conflicts (source: agent-teams.md). If you are new to teams, start with research and review tasks that have clear boundaries and don't require writing code before attempting parallel implementation (source: agent-teams.md).

## Limitations

Agent teams are experimental, with several known limitations (source: agent-teams.md): `/resume` and `/rewind` do not restore in-process teammates, so after resuming a session the lead may try to message teammates that no longer exist; task status can lag when teammates fail to mark tasks complete, blocking dependent tasks; shutdown can be slow because teammates finish their current request before stopping; a lead can manage only one team at a time and must clean up the current one before creating another; teammates cannot spawn their own teams or teammates; and the lead is fixed for the team's lifetime — you cannot promote a teammate to lead or transfer leadership (source: agent-teams.md).

## Related pages
- [[claude-code-subagents]]
- [[subagents]]
- [[agent-workflows]]
- [[claude-code-hooks]]
- [[claude-code-memory]]
- [[claude-code-skills]]
- [[monorepo-large-codebase-setup]]
