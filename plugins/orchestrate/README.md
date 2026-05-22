# orchestrate

Autonomously drive a backlog of `ready-for-agent` GitHub issues from open to reviewed, merged slices. The orchestrator orders issues into dependency waves, runs implementer and reviewer subagents in isolated git worktrees, merges each slice's pull request into an umbrella branch, and checkpoints progress so an interrupted run resumes instead of restarting.

## Cost and Model Guidance

A single orchestrate run drives an entire backlog — for every issue it spawns an implementer and a reviewer subagent (and an investigator for complex-tier issues), each in its own context. Cost scales with the size of the backlog and how many issues route to the higher-effort `deep` variants.

**Recommended model:** Claude Opus for the orchestrator — wave planning, complexity assessment, and conflict handling are judgment-heavy. Per-role models are set per complexity tier in `routing.json` (see the configuration reference).

**Usage pattern:** run orchestrate when you have a prepared `ready-for-agent` backlog to clear — not on every session. Triage and specify the issues first; a well-specified backlog is what makes an unattended run worthwhile.

The run checkpoints after every step, so an interrupted run resumes instead of restarting — you never pay twice for completed slices.

## What It Does

Given a repository with open issues labelled `ready-for-agent`, one `/orchestrate` invocation:

1. **Reads the backlog** — every open `ready-for-agent` issue, with its **Blocked by** dependencies and an assessed complexity tier (`trivial`, `standard`, `complex`).
2. **Plans dependency waves** — a topological sort so every issue's blockers resolve in an earlier wave; a dependency cycle is reported and stops the run cleanly.
3. **Cuts an umbrella branch** from `development` — every slice's pull request merges into it, never directly into `development`.
4. **Processes each slice** in its own isolated worktree — routed investigator (complex tier only), implementer, then reviewer; then commit, push, open a slice pull request, and squash-merge it into the umbrella branch.
5. **Resolves merge conflicts** once per conflicting slice via a dedicated conflict-resolver subagent.
6. **Checkpoints** `.orchestrate/run-state.json` after every step — an interrupted run re-invoked with `/orchestrate` skips every completed slice and continues.
7. **Hands off** to a fresh Claude Code session when the orchestrator's context window fills, so a long run survives without degrading.
8. **Opens a final pull request** from the umbrella branch into `development`, left unmerged for a developer to review — and renders HTML dashboard, dependency-graph, and report artifacts from the run state.

## How It Works

### Roles and the no-Bash safety model

The orchestrate skill is the **orchestrator**. It is the single actor that touches git, GitHub, and the shell — branches, worktrees, commits, pushes, pull requests, merges, label transitions, and the `run-state.json` checkpoint. It also assesses each issue's complexity tier and routes each role accordingly.

Every other role is a **subagent**, spawned with the standard Agent tool by its namespaced type — `orchestrate:<role>-<effort>`, where `<effort>` is `standard` or `deep` (for example `orchestrate:implementer-deep`). The `orchestrate:` prefix is required; a bare name does not resolve.

| Role | Effort variants | Access |
|------|-----------------|--------|
| `investigator` | standard, deep | **Read-only.** Explores the codebase for complex-tier issues and returns a research brief. No Bash, no git, no write tools. |
| `implementer` | standard, deep | Edits code inside one worktree; verifies via the capability tools. No Bash, no git. |
| `reviewer` | standard, deep | Reviews the slice in the worktree, fixes issues inline, re-runs the capability tools, gates the merge. No Bash, no git. |
| `conflict-resolver` | standard, deep | Edits conflicted files to a correct merged state. No Bash, no git. |

This is the **no-Bash safety model**: the subagents have no shell and no git access. They are sandboxed to a single worktree, and the investigator cannot write at all. Only the orchestrator runs commands, touches branches and remotes, and writes to the issue tracker. A subagent cannot push, cannot merge, cannot edit an issue, and cannot reach outside its worktree — so the blast radius of any one subagent is one directory.

### The orchestrate MCP server

The plugin bundles `orchestrate-mcp`, a Model Context Protocol server providing the deterministic tools the orchestrator and subagents call:

| Tool | Purpose |
|------|---------|
| `create_worktree` / `remove_worktree` | Git worktree lifecycle — isolated per-slice checkouts |
| `run_tests` / `run_typecheck` / `run_build` / `run_lint` | Run the project's configured capability commands |
| `plan_waves` | Topologically sort issues into dependency waves; detects cycles |
| `resolve_routing` | Resolve the model and effort variant for each role from a complexity tier |
| `render_dashboard` / `render_graph` / `render_report` | Render standalone HTML artifacts from the run state |
| `spawn_successor` | Launch a fresh Claude Code session that resumes the run |
| `search_structural` | Syntax-aware (ast-grep) code search, with a text-search fallback |

Every tool returns a discriminated `status` and never throws — failures are structured results, not exceptions.

### Context handoff

A long backlog can fill the orchestrator session's context window before every wave is done. The bundled `context-watchdog` hook (a `PostToolUse` hook) estimates context usage from the session transcript and, past a configurable threshold (default 40%), writes `.orchestrate/context-flag.json`. The orchestrator finishes the current slice, checkpoints, and calls `spawn_successor` to launch a new interactive Claude Code session that resumes from `run-state.json` — then the predecessor exits. The successor clears the stale flag on startup, so there is no handoff loop.

## Installation

```bash
# Step 1: Add the marketplace (one-time setup)
/plugin marketplace add rodrigorjsf/agent-engineering-toolkit

# Step 2: Install the plugin
/plugin install orchestrate@agent-engineering-toolkit
```

Or via the Claude Code CLI:

```bash
claude plugin install orchestrate@agent-engineering-toolkit
```

## Usage

Invoke the skill in a repository that has a `ready-for-agent` backlog:

```bash
/orchestrate:orchestrate
```

If the plugin is installed at user scope (the default), the namespace prefix is optional:

```bash
/orchestrate
```

The run is autonomous — it processes the whole backlog, resolves conflicts, checkpoints, hands off if its context fills, and ends by opening the final umbrella pull request. To resume an interrupted run, invoke `/orchestrate` again in the same repository: it detects `.orchestrate/run-state.json` and continues from the last checkpoint.

## Importing Into Another Project

To run orchestrate against another repository, that repository needs:

- **The `gh` CLI**, installed and authenticated (`gh auth status`) — the orchestrator uses it for every GitHub operation.
- **An `origin/development` branch** — the integration base every umbrella branch is cut from.
- **Branch protection that does not block** merges into `orchestrate/umbrella-*` and `orchestrate/slice-*` branches — the auto-merge needs them open.
- **Capability configuration** — copy this plugin's `templates/commands.json` and `templates/routing.json` into the target repository's `.orchestrate/` directory and fill them in. Optionally copy `templates/handoff.json` to tune the context-handoff behavior.
- **A `ready-for-agent` backlog** — issues labelled `ready-for-agent`, each with a **Blocked by** section listing blocker issue numbers (`- #NNN`) and a **Parent** section naming the PRD issue.

Optionally, install the **`ast-grep` CLI** to enable the investigator and reviewer subagents' structural code search; without it, they fall back to text search.

Add the run's generated, ephemeral files to the target repository's `.gitignore`:

```gitignore
.orchestrate/run-state.json
.orchestrate/context-flag.json
.orchestrate/*.html
```

The committed `.orchestrate/commands.json`, `.orchestrate/routing.json`, and `.orchestrate/handoff.json` are configuration and stay tracked.

## Configuration Reference

All configuration lives in the target repository's `.orchestrate/` directory.

### `.orchestrate/commands.json`

Maps each capability verb to the **argv array** that runs it. The argv form is executed with no shell, so a command can never be word-split or glob-expanded. A missing verb is tolerated — that capability tool reports `not-configured`.

```json
{
  "tests": ["npm", "test"],
  "typecheck": ["npm", "run", "typecheck"],
  "build": ["npm", "run", "build"],
  "lint": ["npm", "run", "lint"]
}
```

### `.orchestrate/routing.json`

Maps each complexity tier to the model and effort variant for each role. `investigator` may be `null` — that tier skips the investigation pass. `effort` is `standard` or `deep`. Without this file, the run falls back to the `-standard` variant of every role and skips the investigator.

```json
{
  "trivial": {
    "investigator": null,
    "implementer": { "model": "sonnet", "effort": "standard" },
    "reviewer": { "model": "sonnet", "effort": "standard" },
    "conflict-resolver": { "model": "sonnet", "effort": "standard" }
  },
  "standard": {
    "investigator": null,
    "implementer": { "model": "sonnet", "effort": "standard" },
    "reviewer": { "model": "opus", "effort": "standard" },
    "conflict-resolver": { "model": "opus", "effort": "standard" }
  },
  "complex": {
    "investigator": { "model": "opus", "effort": "deep" },
    "implementer": { "model": "opus", "effort": "deep" },
    "reviewer": { "model": "opus", "effort": "deep" },
    "conflict-resolver": { "model": "opus", "effort": "deep" }
  }
}
```

### `.orchestrate/handoff.json`

Optional. Tunes the context-watchdog threshold and the successor-session launcher. When absent, built-in defaults apply.

```json
{
  "watchdog": {
    "thresholdPercent": 40,
    "contextWindowTokens": 200000
  },
  "successor": {
    "claudeArgs": ["--remote-control", "orchestrate-successor", "--permission-mode", "auto"],
    "resumePrompt": "/orchestrate",
    "terminals": [
      {
        "name": "windows-terminal",
        "argv": ["wt.exe", "new-tab", "--title", "orchestrate-successor", "wsl.exe", "--", "bash", "-lc", "{claudeCommand}"]
      },
      {
        "name": "warp",
        "argv": ["warp-terminal", "--", "bash", "-lc", "{claudeCommand}"]
      }
    ]
  }
}
```

| Field | Default | Meaning |
|-------|---------|---------|
| `watchdog.thresholdPercent` | `40` | Raise the handoff flag at this percentage of the context window. |
| `watchdog.contextWindowTokens` | `200000` | The window the percentage measures against. Set to `1000000` for a 1M-context session. |
| `successor.claudeArgs` | Remote Control + auto mode | Flags for the successor's `claude` CLI invocation. |
| `successor.resumePrompt` | `/orchestrate` | The successor's initial prompt — appended last, as a positional argument. |
| `successor.terminals` | Windows Terminal, then Warp | Ordered terminal fallback chain. `{claudeCommand}` and `{repoPath}` are substituted into each argv. |

The default terminal chain targets a WSL2 environment. On another host, replace the `terminals` entries with your terminal's new-window invocation. See `skills/orchestrate/references/context-handoff.md` for the full mechanism.

### `.orchestrate/run-state.json`

Generated, not authored — the durable run checkpoint. The orchestrator writes it after every slice state change and every wave, and reads it on startup to resume an interrupted run. Gitignore it. Its schema is documented in `skills/orchestrate/references/run-state.md`.

## Optional: Agent Teams

orchestrate spawns its subagents with the standard Agent tool, and the full loop **does not depend on agent teams**. The experimental [agent teams](https://docs.anthropic.com/en/docs/claude-code/sub-agents) feature — enabled by setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` in your Claude Code settings — lets parallel workers coordinate through a shared task list and communicate directly, rather than only reporting back to the orchestrator. It is an **optional enhancement**: orchestrate works fully without it, and enabling it does not change the plugin's behavior or requirements. Leave it off unless you are already using agent teams elsewhere.

## Repository Structure

```text
plugins/orchestrate/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── .mcp.json                    # Registers the orchestrate-mcp server
├── README.md                    # This file
├── hooks/
│   └── hooks.json               # The context-watchdog PostToolUse hook
├── skills/
│   └── orchestrate/
│       ├── SKILL.md             # The orchestrator skill
│       └── references/          # run-state and context-handoff references
├── agents/                      # 8 subagents — {investigator,implementer,
│                                #   reviewer,conflict-resolver}-{standard,deep}
├── templates/                   # commands.json, routing.json, handoff.json
└── orchestrate-mcp/             # The MCP server (TypeScript)
    ├── src/                     # Tool implementations
    ├── test/                    # Unit suite
    └── dist/                    # Bundled server + context-watchdog hook
```

## License

MIT
