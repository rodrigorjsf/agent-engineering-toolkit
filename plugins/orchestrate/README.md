# orchestrate

Autonomously drive a backlog of `ready-for-agent` GitHub issues from open to reviewed, merged slices. The orchestrator orders issues into dependency waves, runs implementer and reviewer subagents in isolated git worktrees, merges each slice's pull request into an umbrella branch, and checkpoints progress so an interrupted run resumes instead of restarting.

## Cost and Model Guidance

A single orchestrate run drives an entire backlog — for every issue it spawns an implementer and a reviewer subagent (and an investigator for complex-tier issues), each in its own context. Cost scales with the size of the backlog and how many issues route to the higher-effort `deep` variants.

**Recommended model:** Claude Opus for the orchestrator — wave planning, complexity assessment, and conflict handling are judgment-heavy. Per-role models are set per complexity tier in `routing.json` (see the configuration reference).

**Usage pattern:** run orchestrate when you have a prepared `ready-for-agent` backlog to clear — not on every session. Triage and specify the issues first; a well-specified backlog is what makes an unattended run worthwhile.

The run checkpoints after every step, so an interrupted run resumes instead of restarting — you never pay twice for completed slices.

## What It Does

Given a repository with open issues labelled `ready-for-agent`, one `/orchestrate` invocation:

1. **Reads the backlog** — every open `ready-for-agent` issue, with its **Blocked by** dependencies and an assessed complexity tier (`trivial`, `standard`, `complex`). The tier weighs two axes — conceptual difficulty and *fan-out* (the number of independent targets the slice touches) — so a wide-but-simple slice is tiered up purely for the larger turn budget and an investigation pass.
2. **Plans dependency waves** — a topological sort so every issue's blockers resolve in an earlier wave; a dependency cycle is reported and stops the run cleanly.
3. **Cuts an umbrella branch** from `development` — every slice's pull request merges into it, never directly into `development`.
4. **Processes each slice** in its own isolated worktree — routed investigator (complex tier only), implementer, then reviewer; then commit, push, open a slice pull request, and squash-merge it into the umbrella branch.
5. **Resolves merge conflicts** once per conflicting slice via a dedicated conflict-resolver subagent.
6. **Checkpoints** the run's `run-state.json` (under the per-run directory `.orchestrate/runs/<runId>/`) after every step — an interrupted run re-invoked with `/orchestrate` skips every completed slice and continues.
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

Every subagent ends its turn with a machine-checkable **result envelope** — a fenced ` ```orchestrate-envelope ` JSON block conforming to a per-role schema. The orchestrator reads a subagent's status and changed-file set only from this validated envelope (via the `validate_envelope` tool), never from its prose — so a turn that was truncated or cut short is detected, never silently accepted. When an envelope is missing or invalid, the orchestrator recovers the worktree's changed-file set by inspecting it directly with `recover_changed_files`, treating the worktree as the source of truth.

### The orchestrate MCP server

The plugin bundles `orchestrate-mcp`, a Model Context Protocol server providing the deterministic tools the orchestrator and subagents call:

| Tool | Purpose |
|------|---------|
| `bootstrap_config` | Set up a repository's `.orchestrate/` config on a first-ever run — project-aware `commands.json`, model-derived `handoff.json`, default `routing.json`, the run directory, and the `.gitignore` entry |
| `create_worktree` / `remove_worktree` | Git worktree lifecycle — isolated per-slice checkouts |
| `run_tests` / `run_typecheck` / `run_build` / `run_lint` | Run the project's configured capability commands |
| `plan_waves` | Topologically sort issues into dependency waves; detects cycles |
| `resolve_routing` | Resolve the model and effort variant for each role from a complexity tier |
| `validate_envelope` | Validate a subagent's result envelope against its role schema — distinguishes a valid, a truncated/invalid, and a missing envelope. The implementer status carries `completed`, `incomplete` (a graceful turn-budget self-report), and `blocked` |
| `recover_changed_files` | Recover a worktree's changed-file set by inspecting it directly — the orchestrator's fallback when an envelope is missing or invalid |
| `verify_changeset` | Compare a worktree's actual changeset against the file set an implementer declared — the post-implementer scope check before a `completed` envelope is trusted |
| `render_dashboard` / `render_graph` / `render_report` | Render standalone HTML artifacts from the run state |
| `spawn_successor` | Launch a fresh Claude Code session that resumes the run |
| `search_structural` | Syntax-aware (ast-grep) code search, with a text-search fallback |

Every tool returns a discriminated `status` and never throws — failures are structured results, not exceptions.

### Project capability detection

The `detect-project` module (`orchestrate-mcp/src/tools/detect-project.ts`) auto-detects a repository's project type from its top-level manifest files and emits the matching capability command map. It is pure — repository root in, command map out, no side effects.

**Detection precedence** (first match wins):

| Manifest file | Project type | Command set |
|---------------|-------------|-------------|
| `package.json` | npm | `npm test`, `npm run typecheck`, `npm run build`, `npm run lint` |
| `Cargo.toml` | Cargo | `cargo test`, `cargo check`, `cargo build`, `cargo clippy` |
| `pyproject.toml` | Python | `pytest`, `mypy .`, `python -m build`, `ruff check .` |
| `Makefile` | Make | `make test`, `make typecheck`, `make build`, `make lint` |
| _(none found)_ | none | empty map — no capability tool is wired to a failing command |

**Usage example** (TypeScript):

```typescript
import { detectCommandMap } from "./tools/detect-project.js";

// Detect from a repository root — returns the command map or {} if unrecognized.
const map = detectCommandMap("/path/to/repo");
// For a repo with package.json:
// { tests: ["npm", "test"], typecheck: ["npm", "run", "typecheck"],
//   build: ["npm", "run", "build"], lint: ["npm", "run", "lint"] }

// Or use the pure functions directly (no I/O):
import { detectProjectType, buildCommandMap } from "./tools/detect-project.js";
const type = detectProjectType(["Cargo.toml", "Makefile"]); // "cargo"
const commands = buildCommandMap(type); // cargo argv arrays
```

A manifest-less repository yields `{}` — never an npm fallback — so no capability tool is ever wired to a command guaranteed to fail.

### Config bootstrapping

The `bootstrap_config` MCP tool makes a first-ever run set up its own `.orchestrate/` configuration with no manual steps. On a fresh run — when the repository has no `.orchestrate/` directory — the orchestrator calls it before planning the backlog. It:

- Composes the **capability detector** above and writes a project-appropriate `.orchestrate/commands.json`. The shipped `templates/commands.json` is an empty `{}` safe default — the bootstrapper is the canonical source of a project-aware config. For an npm project it also sets `install: ["npm", "ci"]`; for cargo, Python, Make, or an unrecognized project it omits `install` (a wrong install command is worse than none).
- Writes `.orchestrate/handoff.json` with a context-window size **derived from the running model**, not a static 200k constant. The model id (or an explicit token count) is passed as a tool input — the MCP process cannot see the calling LLM's model. A small explicit table maps the model to its window; an unknown or absent model falls back to `200000`.
- Writes `.orchestrate/routing.json` from the shipped defaults.
- Creates `.orchestrate/runs/` and idempotently appends `.orchestrate/runs/` to the repository's `.gitignore` — exactly once, even across repeated bootstraps.

Every step is individually idempotent: a committed config file is never overwritten, the run directory `mkdir` is recursive, and the `.gitignore` line is never duplicated. Running `bootstrap_config` against an already-configured repository is a safe no-op.

**Usage example.** The orchestrate skill calls the tool on a fresh run:

```jsonc
// bootstrap_config tool input
{
  "repoPath": "/path/to/repo",
  "model": "claude-opus-4-7[1m]"   // or, e.g., "contextWindowTokens": 1000000
}
// → { "status": "ok", "projectType": "npm",
//     "contextWindowTokens": 1000000, "contextWindowSource": "model-table",
//     "files": { "commandsJson": "written", "routingJson": "written",
//                "handoffJson": "written" },
//     "runsDir": "created", "gitignore": "created-with-line" }
```

### Context handoff

A long backlog can fill the orchestrator session's context window before every wave is done. The bundled `context-watchdog` hook (a `PostToolUse` hook) estimates context usage from the session transcript and, past a configurable threshold (default 40%), writes the active run's `.orchestrate/runs/<runId>/context-flag.json`. The orchestrator finishes the current slice, checkpoints, and calls `spawn_successor` to launch a new interactive Claude Code session that resumes from `run-state.json` — then the predecessor exits. The successor clears the stale flag on startup, so there is no handoff loop.

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

The run is autonomous — it processes the whole backlog, resolves conflicts, checkpoints, hands off if its context fills, and ends by opening the final umbrella pull request. To resume an interrupted run, invoke `/orchestrate` again in the same repository: it scans `.orchestrate/runs/*/run-state.json` for an in-progress run and continues from the last checkpoint.

### Scoping a run to one parent PRD

Pass a parent-PRD issue number to scope the run to that PRD's children only:

```bash
/orchestrate 195
```

This runs just the issues whose **Parent** section names PRD #195 — the run's *partition*. Its `runId` is `prd195-<timestamp>` and its umbrella branch is `orchestrate/umbrella-prd195-<timestamp>`. A no-argument `/orchestrate` runs the whole backlog as one partition, with a `backlog-<timestamp>` runId, exactly as before.

Because each partitioned run owns a disjoint set of issues and its own run directory and umbrella branch, you can run **two orchestrations concurrently** in the same repository — one per parent PRD:

```bash
/orchestrate 195      # window A — PRD #195's children
/orchestrate 210      # window B — PRD #210's children
```

On startup the orchestrator scans every in-progress run and matches it by the `prd<N>-` / `backlog-` prefix of its `runId`. Invoking `/orchestrate 195` again while a `prd195-` run is still in progress **resumes** that run rather than starting a duplicate; the resumed run reloads only its own partition and never widens its scope. Two in-progress runs for the same PRD is reported as a loud error, never silently resolved.

When a partitioned run's child issue is blocked by an issue **outside** the partition, the orchestrator verifies that external blocker's real state on the tracker before the dependent slice runs — if the blocker is still open, the dependent slice is skipped with a reason naming it.

## Importing Into Another Project

To run orchestrate against another repository, that repository needs:

- **The `gh` CLI**, installed and authenticated (`gh auth status`) — the orchestrator uses it for every GitHub operation.
- **An `origin/development` branch** — the integration base every umbrella branch is cut from.
- **Branch protection that does not block** merges into `orchestrate/umbrella-*` and `orchestrate/slice-*` branches — the auto-merge needs them open.
- **Capability configuration** — handled automatically on the first run. When the repository has no `.orchestrate/` directory, the orchestrator calls the `bootstrap_config` MCP tool, which detects the project type and writes a project-appropriate `.orchestrate/commands.json`, `.orchestrate/routing.json`, and `.orchestrate/handoff.json`. To configure ahead of time instead, copy this plugin's `templates/` files into the target repository's `.orchestrate/` directory and fill them in — `templates/commands.json` ships as an empty `{}` starting point. A committed config is never overwritten by the bootstrapper.
- **A `ready-for-agent` backlog** — issues labelled `ready-for-agent`, each with a **Blocked by** section listing blocker issue numbers (`- #NNN`) and a **Parent** section naming the PRD issue.

Optionally, install the **`ast-grep` CLI** to enable the investigator and reviewer subagents' structural code search; without it, they fall back to text search.

The run's generated, ephemeral files must be gitignored. Every run keeps its `run-state.json`, `context-flag.json`, and rendered HTML artifacts under a per-run directory, `.orchestrate/runs/<runId>/`, so one gitignore line covers them all:

```gitignore
.orchestrate/runs/
```

`bootstrap_config` adds this line to the repository's `.gitignore` automatically — idempotently, never duplicating it — so a first-ever run needs no manual gitignore edit. The committed `.orchestrate/commands.json`, `.orchestrate/routing.json`, and `.orchestrate/handoff.json` stay flat at the `.orchestrate/` top level — they are configuration and stay tracked.

## Configuration Reference

All configuration lives in the target repository's `.orchestrate/` directory.

### `.orchestrate/commands.json`

Maps each capability verb to the **argv array** that runs it. The argv form is executed with no shell, so a command can never be word-split or glob-expanded. A missing verb is tolerated — that capability tool reports `not-configured`. On a first-ever run `bootstrap_config` writes this file project-aware; the example below shows the npm form.

```json
{
  "tests": ["npm", "test"],
  "typecheck": ["npm", "run", "typecheck"],
  "build": ["npm", "run", "build"],
  "lint": ["npm", "run", "lint"],
  "install": ["npm", "ci"]
}
```

The optional `install` verb runs once in each fresh worktree before the capability commands. `bootstrap_config` sets it to `["npm", "ci"]` for an npm project and omits it for every other project type — a wrong install command is worse than none.

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

Optional. Tunes the context-watchdog threshold and the successor-session launcher. When absent, built-in defaults apply. On a first-ever run `bootstrap_config` writes this file with `watchdog.contextWindowTokens` derived from the running model — `1000000` for a 1M-context model, `200000` otherwise.

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

### `.orchestrate/runs/<runId>/` — per-run directory

Generated, not authored. Every run keeps its ephemeral state in its own per-run directory, `.orchestrate/runs/<runId>/`, where `<runId>` is the run's timestamp id. The directory holds:

- `run-state.json` — the durable run checkpoint. The orchestrator writes it after every slice state change and every wave, and reads it on startup to resume an interrupted run.
- `context-flag.json` — the context-handoff signal, written by the watchdog when the threshold is reached.
- `dashboard.html`, `graph.html`, `report.html` — the rendered HTML artifacts.

Two distinct runs never share a directory, so their ephemeral state never collides — the per-run layout is the structural foundation for concurrent runs. The committed config files (`commands.json`, `routing.json`, `handoff.json`) stay flat at the `.orchestrate/` top level.

```text
.orchestrate/
├── commands.json                 # committed config (flat)
├── routing.json                  # committed config (flat)
├── handoff.json                  # committed config (flat)
└── runs/
    └── 20260521-015143/          # one per-run directory per run
        ├── run-state.json
        ├── context-flag.json     # present only after a handoff is signalled
        ├── dashboard.html
        ├── graph.html
        └── report.html
```

Gitignore the `.orchestrate/runs/` directory. The `run-state.json` schema is documented in `skills/orchestrate/references/run-state.md`.

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

## Contributing to orchestrate-mcp

The `orchestrate-mcp/` directory contains a TypeScript MCP server whose compiled output (`dist/`) is committed so the plugin works without a build step at install time. When you change any source file under `src/`, you **must** rebuild before committing:

```bash
cd plugins/orchestrate/orchestrate-mcp
npm ci          # if node_modules is stale
npm run build   # regenerates dist/index.js and dist/context-watchdog.js
git add dist/
```

A CI job (`orchestrate-mcp bundle check`) runs on every PR that touches any file under `plugins/orchestrate/orchestrate-mcp/`. It rebuilds the bundle from scratch and fails if `git diff -- dist/` is non-empty. This means a PR that modifies source without rebuilding — or that edits `dist/` directly — will fail CI, not slip through silently.

The vitest suite (`npm test`) imports from `src/`, so tests pass whether or not `dist/` is current. Do not rely on green tests as evidence that the committed bundle is fresh — the CI bundle check is the authoritative gate.

## License

MIT
