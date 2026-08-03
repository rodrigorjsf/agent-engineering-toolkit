# orchestrate

Autonomously drive a backlog of `ready-for-agent` GitHub issues from open to reviewed, merged slices. The orchestrator orders issues into dependency waves, runs implementer and reviewer subagents in isolated git worktrees, merges each slice's pull request into an umbrella branch, and checkpoints progress so an interrupted run resumes instead of restarting.

## Cost and Model Guidance

A single orchestrate run drives an entire backlog — for every issue it spawns an implementer and a reviewer subagent (and an investigator for standard- and complex-tier issues), each in its own context. Cost scales with the size of the backlog and how many issues route to the `deep` routing variant.

**Recommended model:** Claude Opus for the orchestrator — wave planning, complexity assessment, and conflict handling are judgment-heavy. Per-role models are set per complexity tier in `routing.json` (see the configuration reference).

**Usage pattern:** run orchestrate when you have a prepared `ready-for-agent` backlog to clear — not on every session. Triage and specify the issues first; a well-specified backlog is what makes an unattended run worthwhile.

The run checkpoints after every step, so an interrupted run resumes instead of restarting — you never pay twice for completed slices.

## What It Does

Given a repository with open issues labelled `ready-for-agent`, one `/orchestrate` invocation:

1. **Reads the backlog** — every open `ready-for-agent` issue, with its **Blocked by** dependencies and an assessed complexity tier (`trivial`, `standard`, `complex`). The tier weighs two axes — conceptual difficulty and *fan-out* (the number of independent targets the slice touches) — so a wide-but-simple slice is tiered up purely for the larger turn budget and an investigation pass. Investigator is skipped for trivial-tier slices only.
2. **Plans dependency waves** — a topological sort so every issue's blockers resolve in an earlier wave; a dependency cycle is reported and stops the run cleanly.
3. **Cuts an umbrella branch** from `development` — every slice's pull request merges into it, never directly into `development`.
4. **Processes each slice** in its own isolated worktree — routed investigator (standard and complex tiers; skipped for trivial), implementer, then reviewer; then commit, push, open a slice pull request, and squash-merge it into the umbrella branch.
5. **Resolves merge conflicts** once per conflicting slice via a dedicated conflict-resolver subagent.
6. **Checkpoints** the run's `run-state.json` (under the per-run directory `.orchestrate/runs/<runId>/`) after every step — an interrupted run re-invoked with `/orchestrate` skips every completed slice and continues.
7. **Hands off** to a fresh Claude Code session when the orchestrator's context window fills, so a long run survives without degrading.
8. **Opens a final pull request** from the umbrella branch into `development`, left unmerged for a developer to review — and renders HTML dashboard, dependency-graph, and report artifacts from the run state.

## How It Works

### Roles and the no-Bash safety model

The orchestrate skill is the **orchestrator**. It is the single actor that touches git, GitHub, and the shell — branches, worktrees, commits, pushes, pull requests, merges, label transitions, and the `run-state.json` checkpoint. It also assesses each issue's complexity tier and routes each role accordingly.

Every other role is a **subagent**, spawned with the standard Agent tool by its namespaced type — `orchestrate:<role>-<variant>`, where `<variant>` is `standard` or `deep` (for example `orchestrate:implementer-deep`). The `orchestrate:` prefix is required; a bare name does not resolve.

| Role | Routing variant | Access |
|------|-----------------|--------|
| `investigator` | standard, deep | **Read-only.** Explores the codebase for standard- and complex-tier issues and returns a research brief. No Bash, no git, no write tools. |
| `implementer` | standard, deep | Edits code inside one worktree; verifies via the capability tools. No Bash, no git. |
| `reviewer` | standard, deep | Reviews the slice in the worktree, fixes issues inline, re-runs the capability tools, gates the merge. No Bash, no git. |
| `conflict-resolver` | standard, deep | Edits conflicted files to a correct merged state. No Bash, no git. |
| `slice-executor` | standard, deep | Owns one slice end to end — spawns the investigator, implementer, and reviewer, validates each result envelope, and runs the Capability gate. Its operating procedure is the preloaded `slice-pipeline` skill. No Bash, no git. Definitions only (ADR-0017); the orchestrator does not spawn it yet. |

This is the **no-Bash safety model**: the subagents have no shell and no git access. They are sandboxed to a single worktree, and the investigator cannot write at all. Only the orchestrator runs commands, touches branches and remotes, and writes to the issue tracker. A subagent cannot push, cannot merge, cannot edit an issue, and cannot reach outside its worktree — so the blast radius of any one subagent is one directory. The `slice-executor` is the one subagent granted the `Agent` tool, so that it can spawn the workers its slice needs; the four worker roles are granted no `Agent` tool at all, which is what keeps them leaves of the agent tree.

Every subagent ends its turn with a machine-checkable **result envelope** — a fenced ` ```orchestrate-envelope ` JSON block conforming to a per-role schema. The orchestrator reads a subagent's status and changed-file set only from this validated envelope (via the `validate_envelope` tool), never from its prose — so a turn that was truncated or cut short is detected, never silently accepted. When an envelope is missing or invalid, the orchestrator recovers the worktree's changed-file set by inspecting it directly with `recover_changed_files`, treating the worktree as the source of truth.

### The orchestrate MCP server

The plugin bundles `orchestrate-mcp`, a Model Context Protocol server providing the deterministic tools the orchestrator and subagents call:

| Tool | Purpose |
|------|---------|
| `bootstrap_config` | Complete a repository's `.orchestrate/` config — project-aware `commands.json`, model-derived `handoff.json`, default `routing.json`, the run directory, and the `.gitignore` entry — writing only whichever files are missing, and reporting `capabilities`/`falseGreenRisk` for the config's final state |
| `create_worktree` / `remove_worktree` | Git worktree lifecycle — isolated per-slice checkouts |
| `push_and_verify` | Push a slice branch and verify it actually landed on the remote (SHA-match `git ls-remote` check + bounded backoff) — fails loud when an exit-0 push never lands; git-only, never shells `gh` |
| `finalize_slice` | Land one reviewed slice's git + run-state mechanics in two phases: `commit-push` (stage exactly the named files, guard an empty changeset, commit with `Closes #<N>`, compose `push_and_verify`, checkpoint `subState: pushed`) and `post-merge` (checkpoint `subState: merged`, remove the worktree, reclaim the local branch). Forge ops and the `pr-open` checkpoint stay in the spine; git-only, never shells `gh` |
| `run_tests` / `run_typecheck` / `run_build` / `run_lint` | Run the project's configured capability commands |
| `run_wave` | A family of bracketed deterministic wave-loop operations behind one tool, selected by the `operation` discriminant — so only the higher-level policy that decides how a wave processes its slices stays the orchestrator's concern. `refresh-base` (fast-forward the local umbrella ref to its remote tip via a `git merge-base` ancestor proof, or report `diverged` and leave the ref untouched), `select-processable` (gate one slice on its in-partition and out-of-partition blocker states — consumed from state passed in, never read with `gh`), `reverify-slice` (no-op for the first merged slice; else fetch + merge the umbrella into the worktree and run the tests + build verbs, returning `passed`/`failed{which}`/`conflict` — a conflict is flagged in place, never resolved), `integration-gate` (run the per-wave integration suite → `proceed`/`halt`/`tolerate`), `plan-wave-width` (cap a wave's in-flight slices against the session's concurrent-subagent limit — two agent slots per slice, so half the limit, floored at 1 — returning `waveWidth` + a `deferredCount` that keeps its state), and `classify-spawn-outcome` (classify an observed spawn refusal as `backpressure` — requeue the slice unchanged, never fail it — or `spawn-error`, keeping a spent session spawn budget distinguishable). Git-only, run-scoped, never throws |
| `resolve_merge_conflict` | The two deterministic git operations around the conflict-resolver spawn, behind one tool selected by the `operation` discriminant — the resolver spawn, envelope validation, clean-path re-verify, and attempt-once policy stay in the spine. `prepare` (re-entrant recovery first — abort a stale in-progress merge before the fresh fetch + merge of the umbrella into the worktree, returning `clean` (auto-committed, nothing to resolve) or `conflicted{conflictedFiles}`, a rename-conflict emitting both paths) and `finalize` (stage the resolved set, scan the staged diff for residual conflict markers, complete the merge commit → `completed`, or `markers_remain` with the merge aborted leaving the worktree clean). Git-only, run-scoped, never shells `gh`, never throws |
| `plan_waves` | Topologically sort issues into dependency waves; detects cycles |
| `resolve_routing` | Resolve the model and routing variant for each role — investigator, implementer, reviewer, conflict-resolver, and slice-executor (ADR-0017, #356; schema groundwork only — no `slice-executor` subagent is spawned yet) — from a complexity tier. A routing.json predating the role still resolves: `slice-executor` defaults to the tier's own `implementer` entry, flagged with a warning |
| `validate_envelope` | Validate a subagent's result envelope against its role schema — distinguishes a valid, a truncated/invalid, and a missing envelope. The implementer status carries `completed`, `incomplete` (a graceful turn-budget self-report), and `blocked`. The schema also defines a `slice-executor` envelope shape (ADR-0017) describing a whole slice's outcome, with a `failureClass` drawn from a closed set — schema groundwork only; no `slice-executor` subagent is spawned yet |
| `recover_changed_files` | Recover a worktree's changed-file set by inspecting it directly — the orchestrator's fallback when an envelope is missing or invalid |
| `recover_slice_progress` | Read and validate one slice's progress record at `.orchestrate/runs/<runId>/slice-<issue>-progress.json` — the resume anchor a slice executor writes at each completed stage (ADR-0017), carrying the last completed stage, the investigator brief, the continuation count, the worktree fingerprint, and the once-only model-fallback guard. The orchestrator's structured recovery when a slice-executor envelope is missing or invalid: it obtains the record's contents through this tool instead of opening the file, so the data is validated and the read boundary holds. The path is derived from `runId` + `issue` — no file path is accepted — so a read can never leave the run's own directory; reports a missing record distinctly from a malformed one, and never throws. Reads only |
| `verify_changeset` | Compare a worktree's actual changeset against the file set an implementer declared — the post-implementer scope check before a `completed` envelope is trusted |
| `resolve_cleanup_verdicts` | The PURE verdict logic of the start-of-run cleanup sweep, in two phases: `enumerate` (apply the `completed && finalPullRequest != null` eligibility gate to the parsed run-states, return the deduplicated final-PR identifiers the spine fetches with `gh pr view`) and `classify` (turn the fetched `{state, mergedAt}` facts into the four-way `merged`/`open`/`closed-unmerged`/`unknown` verdict `clean_runs` consumes, capturing each merged run's passed-slice close-set in the same pass). No fs/git/`gh` — the fetch loop, `gh issue close`, and `clean_runs`' removal stay in the spine |
| `clean_runs` | Remove a concluded run's worktrees, branches, and run directory once its final pull request has merged — git + filesystem only |
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
| `pom.xml` | Maven | `mvn -B test`, `mvn -B -DskipTests compile`, `mvn -B -DskipTests package` |
| `build.gradle` / `build.gradle.kts` | Gradle | `./gradlew test`, `./gradlew classes`, `./gradlew assemble` |
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

The `bootstrap_config` MCP tool completes a repository's `.orchestrate/` configuration with no manual steps — writing whichever of its three files are missing. **The orchestrator calls it unconditionally at the start of every run, never gated on whether `.orchestrate/` already exists**: a directory that already has some files (e.g. `routing.json` and `handoff.json` from an earlier run, but no `commands.json`) is exactly the case a directory-existence gate would miss, since every write inside the tool is independently idempotent at the FILE level. It:

- Composes the **capability detector** above and writes a project-appropriate `.orchestrate/commands.json`. The shipped `templates/commands.json` is an empty `{}` safe default — the bootstrapper is the canonical source of a project-aware config. For an npm project it also sets `install: ["npm", "install"]`; for cargo, Python, Maven, Gradle, Make, or an unrecognized project it omits `install` (a wrong install command is worse than none).
- Writes `.orchestrate/handoff.json` with a context-window size **derived from the running model**, not a static 200k constant. The model id (or an explicit token count) is passed as a tool input — the MCP process cannot see the calling LLM's model. A small explicit table maps the model to its window; an unknown or absent model falls back to `200000`.
- Writes `.orchestrate/routing.json` from the shipped defaults.
- Creates `.orchestrate/runs/` and idempotently appends `.orchestrate/runs/` to the repository's `.gitignore` — exactly once, even across repeated bootstraps.

Every step is individually idempotent: a committed config file is never overwritten, the run directory `mkdir` is recursive, and the `.gitignore` line is never duplicated. Running `bootstrap_config` against an already-configured repository is a safe no-op.

**Config-completeness reporting.** Every call also reports the FINAL `commands.json`'s completeness, whether it was written by this call or was already on disk: `capabilities` names which of `tests`/`typecheck`/`build`/`lint`/`install` resolve to a configured command, and `falseGreenRisk` is `true` exactly when **both** `tests` and `build` are unconfigured — the specific conjunction that lets a slice merge green with nothing ever executed. A single missing verb (`lint`, `typecheck`, `install`) is common and not itself flagged — many projects legitimately skip a linter or need no install step. When `falseGreenRisk` is `true`, the run should report it and stop rather than proceed silently; see `references/prerequisites.md`.

**Usage example.** The orchestrate skill calls the tool at the start of every run:

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
//     "runsDir": "created", "gitignore": "created-with-line",
//     "capabilities": { "tests": true, "typecheck": true, "build": true,
//                        "lint": true, "install": true },
//     "falseGreenRisk": false, "warnings": [] }
```

### Context handoff

A long backlog can exhaust the orchestrator session before every wave is done — by filling its context window, or by spending the platform's per-session subagent-spawn budget. The bundled `context-watchdog` hook (a `PostToolUse` hook) watches both: it estimates context usage from the session transcript and counts **this session's** subagent spawns out of a per-run append-only log, and past either configurable threshold (both default 40%) writes the active run's `.orchestrate/runs/<runId>/context-flag.json`, recording in `trigger` which budget raised it. The orchestrator finishes the current slice, checkpoints, and calls `spawn_successor` to launch a new interactive Claude Code session that resumes from `run-state.json` — then the predecessor exits. The successor clears the stale flag on startup, so there is no handoff loop.

When several runs proceed concurrently in one repository, the watchdog binds to the correct run by **driver-session identity**: a companion `SessionStart` hook captures the session's `session_id` into `$ORCHESTRATE_SESSION_ID`, the orchestrator records it as `driverSessionId` in `run-state.json` (refreshed on resume), and the watchdog matches the event's `session_id` against each in-progress run — writing the flag only under the matching run's directory. If it cannot disambiguate, or the identity is unavailable, the watchdog safely writes nothing: the run stays correct and merely loses automatic handoff, remaining manually resumable with `/orchestrate`.

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

### Running a pre-flight pass before committing to a run

Before committing the full multi-wave execution, you can inspect the partition and wave plan first. The `preflight` mode runs the one-time setup — config bootstrap, backlog fetch, partition derivation, dependency-wave planning, and umbrella branch creation — then **stops before the wave loop**, leaving a resumable checkpoint:

```bash
/orchestrate preflight 195
```

The run is left `in-progress` with all slices `pending` and `completedWaves: 0`. The orchestrator writes a `.orchestrate/runs/<runId>/preflight-handoff.md` with the resume invocation and preconditions. Review the partition and wave plan there; when you are ready to execute, resume in a fresh session:

```bash
/orchestrate 195
```

The resume path is the normal exactly-one-match path — it picks up the checkpoint from step 6 and enters wave 0, with no new semantics.

**Staged-inspection gate — the value.** The pre-flight pass is a reviewable partition + wave plan checkpoint: you see which issues the run will process and in what wave order, and you decide whether to proceed before the expensive wave execution begins. Every slice is still `pending` at the stop point — no worktrees or slice branches have been created, only the umbrella branch exists.

**Detect-and-stop idempotency.** A second `/orchestrate preflight 195` while a run for PRD #195 already exists — whether `in-progress` or `completed`-but-not-yet-cleaned — is blocked. The orchestrator reports that run's `runId` and status, and stops. This prevents a duplicate run being minted from the same backlog. The block lifts once `/orchestrate clean` removes the concluded run.

### Cleaning up concluded runs

Each run leaves a footprint behind — its run directory under `.orchestrate/runs/`, its worktrees, and its umbrella and slice branches. Every `/orchestrate` invocation begins with a **start-of-run sweep** that removes the footprint of any run whose final integration pull request has already merged into `development`, so leftovers do not accumulate.

To run the same cleanup on demand without starting a run, invoke the `clean` mode:

```bash
/orchestrate clean
```

`/orchestrate clean` enumerates every run under `.orchestrate/runs/`, checks each one's final pull request, and:

- **Removes** a run whose final pull request has **merged** into `development` — its run directory, its worktrees, and its umbrella and slice branches (locally and on the remote).
- **Leaves intact and reports** a run whose final pull request is still open or was closed unmerged — cleanup is gated strictly on the merge.
- **Preserves** a failed slice's worktree (and keeps that run's directory) so you can still inspect it. Pass `--force` to remove failed-slice worktrees too:

```bash
/orchestrate clean --force
```

`/orchestrate clean` never starts an orchestration run — it cleans up and stops. The merge check is best-effort and idempotent, so re-running it is always safe.

## Importing Into Another Project

To run orchestrate against another repository, that repository needs:

- **The `gh` CLI**, installed and authenticated (`gh auth status`) — the orchestrator uses it for every GitHub operation.
- **An `origin/development` branch** — the integration base every umbrella branch is cut from.
- **Branch protection that does not block** merges into `orchestrate/umbrella-*` and `orchestrate/slice-*` branches — the auto-merge needs them open.
- **Capability configuration** — handled automatically. The orchestrator calls the `bootstrap_config` MCP tool at the start of every run, regardless of whether `.orchestrate/` already exists, which detects the project type and writes whichever of `.orchestrate/commands.json`, `.orchestrate/routing.json`, and `.orchestrate/handoff.json` are missing. To configure ahead of time instead, copy this plugin's `templates/` files into the target repository's `.orchestrate/` directory and fill them in — `templates/commands.json` ships as an empty `{}` starting point. A committed config is never overwritten by the bootstrapper.
- **A `ready-for-agent` backlog** — issues labelled `ready-for-agent`, each with a **Blocked by** section listing blocker issue numbers (`- #NNN`) and a **Parent** section naming the PRD issue.

Optionally, install the **`ast-grep` CLI** to enable the investigator and reviewer subagents' structural code search; without it, they fall back to text search.

The run's generated, ephemeral files must be gitignored. Every run keeps its `run-state.json`, `context-flag.json`, `spawn-log.jsonl`, per-slice progress records, and rendered HTML artifacts under a per-run directory, `.orchestrate/runs/<runId>/`, so one gitignore line covers them all:

```gitignore
.orchestrate/runs/
```

`bootstrap_config` adds this line to the repository's `.gitignore` automatically — idempotently, never duplicating it, on every run it is called — so no run ever needs a manual gitignore edit. The committed `.orchestrate/commands.json`, `.orchestrate/routing.json`, and `.orchestrate/handoff.json` stay flat at the `.orchestrate/` top level — they are configuration and stay tracked.

## Configuration Reference

All configuration lives in the target repository's `.orchestrate/` directory.

### `.orchestrate/commands.json`

Maps each capability verb to the **argv array** that runs it. The argv form is executed with no shell, so a command can never be word-split or glob-expanded. A missing verb is tolerated — that capability tool reports `not-configured`. `bootstrap_config` writes this file project-aware the first time it is absent (it is called, and is a safe no-op, on every run); the example below shows the npm form.

```json
{
  "tests": ["npm", "test"],
  "typecheck": ["npm", "run", "typecheck"],
  "build": ["npm", "run", "build"],
  "lint": ["npm", "run", "lint"],
  "install": ["npm", "install"]
}
```

The optional `install` verb runs once in each fresh worktree before the capability commands. `bootstrap_config` sets it to `["npm", "install"]` for an npm project and omits it for every other project type — a wrong install command is worse than none.

### `.orchestrate/routing.json`

Maps each complexity tier to the model and routing variant for each role, and configures label overrides and run policy. Schema version 2 is the current format. `investigator` may be `null` — that tier skips the investigation pass. `variant` is `standard` or `deep`. Without this file, the run falls back to the `-standard` routing variant of every role.

**v1 deprecation:** a file without a top-level `version` field (the old format) still loads via an explicit v1→v2 mapper and emits a deprecation warning. Run-policy keys in the v1 flat object (`intraWaveConcurrency`, `continuationBudget`) are preserved during migration. Upgrade by adding `"version": 2` and nesting tiers under `"tiers"`, run policy under `"run"`.

**`slice-executor` back-compat (ADR-0017, #356):** a file written before this role existed simply omits the `slice-executor` key per tier — it still loads. `resolve_routing` fills the gap from that tier's own `implementer` entry (never a hardcoded pair, so the tier's cost profile is preserved) and surfaces a warning naming the tier. Add an explicit `slice-executor` entry to each tier to silence it.

```json
{
  "version": 2,
  "tiers": {
    "trivial": {
      "investigator": null,
      "implementer": { "model": "haiku", "variant": "standard" },
      "reviewer": { "model": "sonnet", "variant": "standard" },
      "conflict-resolver": { "model": "sonnet", "variant": "standard" },
      "slice-executor": { "model": "haiku", "variant": "standard" }
    },
    "standard": {
      "investigator": { "model": "haiku", "variant": "standard" },
      "implementer": { "model": "sonnet", "variant": "standard" },
      "reviewer": { "model": "opus", "variant": "standard" },
      "conflict-resolver": { "model": "opus", "variant": "standard" },
      "slice-executor": { "model": "sonnet", "variant": "standard" }
    },
    "complex": {
      "investigator": { "model": "opus", "variant": "deep" },
      "implementer": { "model": "opus", "variant": "deep" },
      "reviewer": { "model": "opus", "variant": "deep" },
      "conflict-resolver": { "model": "opus", "variant": "deep" },
      "slice-executor": { "model": "opus", "variant": "deep" }
    }
  },
  "labels": {
    "route:fable": {
      "roles": ["implementer"],
      "set": { "model": "fable", "variant": "deep" },
      "fallback": { "model": "opus", "maxRetries": 1 }
    }
  },
  "run": {
    "intraWaveConcurrency": "parallel",
    "continuationBudget": 2
  }
}
```

**Tier matrix defaults.** The trivial tier applies a deliberate cross-model gate: haiku implements, sonnet reviews — a cost-effective quality check. The standard tier adds an investigator (haiku/standard) that was absent in v1. The complex tier routes all roles to opus/deep unchanged. `slice-executor` mirrors its tier's `implementer` at every tier (ADR-0017, #356) — the same value the back-compat default resolves to for a file that omits the key.

**`route:fable` label lane.** When a GitHub issue carries the `route:fable` label, the implementer role is patched to `fable/deep`, overriding the tier's default model. A one-shot opus fallback (`maxRetries: 1`) re-spawns the implementer on the fallback model if the premium spawn fails. The reviewer and conflict-resolver retain their tier defaults. **Security exclusion:** Fable's safety classifiers refuse benign security and cyber-research work — do NOT apply `route:fable` to issues involving vulnerability research, penetration testing, or security tooling. Those issues should remain on the standard tier-routed model.

**Routing labels: suggest, never apply.** The orchestrator reads routing labels from the issue tracker but never writes them — label assignment is a human decision. The orchestrator surfaces a suggestion when a heuristic indicates a label would improve quality, and stops there.

**Model fallback.** When a premium-model spawn fails (network error or capacity rejection), the orchestrator makes one re-spawn attempt on the tier's fallback model, outside the `continuationBudget`. If the fallback spawn also fails, the slice is marked failed and the run continues with the remaining slices.

### `.orchestrate/handoff.json`

Optional. Tunes the context-watchdog's two thresholds and the successor-session launcher. When absent, built-in defaults apply — every field carries one, so a config written before a field existed still resolves. Note that a key the schema did not recognize used to be silently stripped; once it becomes a real field it is validated, so an off-schema value now sends the whole file down the defaults-plus-warning path. `bootstrap_config` writes this file the first time it is absent, with `watchdog.contextWindowTokens` derived from the running model — `1000000` for a 1M-context model, `200000` otherwise.

```json
{
  "watchdog": {
    "thresholdPercent": 40,
    "contextWindowTokens": 200000,
    "spawnThresholdPercent": 40,
    "sessionSpawnBudget": 200
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
| `watchdog.spawnThresholdPercent` | `40` | Raise the handoff flag at this percentage of the session spawn budget. Mirrors `thresholdPercent`. |
| `watchdog.sessionSpawnBudget` | `200` | Total subagent spawns the session may make — the platform's own per-session default, changed by `CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION`. Nested and background subagents count toward it, and a finished subagent still counts. |
| `successor.claudeArgs` | Remote Control + auto mode | Flags for the successor's `claude` CLI invocation. |
| `successor.resumePrompt` | `/orchestrate` | The successor's initial prompt — appended last, as a positional argument. |
| `successor.terminals` | Windows Terminal, then Warp | Ordered terminal fallback chain. `{claudeCommand}` and `{repoPath}` are substituted into each argv. |

The default terminal chain targets a WSL2 environment. On another host, replace the `terminals` entries with your terminal's new-window invocation. See `skills/orchestrate/references/context-handoff.md` for the full mechanism.

### `.orchestrate/runs/<runId>/` — per-run directory

Generated, not authored. Every run keeps its ephemeral state in its own per-run directory, `.orchestrate/runs/<runId>/`, where `<runId>` is the run's timestamp id. The directory holds:

- `run-state.json` — the durable run checkpoint. The orchestrator writes it after every slice state change and every wave, and reads it on startup to resume an interrupted run.
- `context-flag.json` — the context-handoff signal, written by the watchdog when either threshold is reached.
- `spawn-log.jsonl` — the watchdog's append-only spawn record, one line per subagent spawn observed while the run is in progress, each tagged with the session that made it. It is stored per run but **counted per session**: the platform's cap resets in a new session while the log survives a handoff, so only the current session's lines count toward the budget.
- `slice-<issue>-progress.json` — one **slice progress record** per slice, written by the slice executor at each completed stage and read back through the `recover_slice_progress` MCP tool. The filename carries the issue number so the concurrent slices of one wave never clobber each other's resume anchor.
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
        ├── spawn-log.jsonl       # one line per subagent spawn (the spawn budget)
        ├── slice-157-progress.json   # one slice progress record per slice
        ├── slice-158-progress.json
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
│   └── hooks.json               # context-watchdog (PostToolUse) +
│                                #   session-start (SessionStart) hooks
├── skills/
│   ├── orchestrate/
│   │   ├── SKILL.md             # The orchestrator judgment spine
│   │   └── references/          # phase-loaded references:
│   │                            #   prerequisites, clean-mode, run-lifecycle,
│   │                            #   wave-loop, slice-pipeline, failure-handling,
│   │                            #   run-state, context-handoff
│   └── slice-pipeline/
│       └── SKILL.md             # The per-slice procedure the slice-executor
│                                #   subagent loads
├── agents/                      # 10 subagents — {investigator,implementer,
│                                #   reviewer,conflict-resolver,
│                                #   slice-executor}-{standard,deep}
├── templates/                   # commands.json, routing.json, handoff.json
└── orchestrate-mcp/             # The MCP server (TypeScript)
    ├── src/                     # Tool implementations
    ├── test/                    # Unit suite
    └── dist/                    # Bundled server + context-watchdog +
                                 #   session-start hooks
```

## Contributing to orchestrate-mcp

The `orchestrate-mcp/` directory contains a TypeScript MCP server whose compiled output (`dist/`) is committed so the plugin works without a build step at install time. When you change any source file under `src/`, you **must** rebuild before committing:

```bash
cd plugins/orchestrate/orchestrate-mcp
npm ci          # if node_modules is stale
npm run build   # regenerates dist/index.js, dist/context-watchdog.js, dist/session-start.js
git add dist/
```

A CI job (`orchestrate-mcp bundle check`) runs on every PR that touches any file under `plugins/orchestrate/orchestrate-mcp/`. It rebuilds the bundle from scratch and fails if `git diff -- dist/` is non-empty. This means a PR that modifies source without rebuilding — or that edits `dist/` directly — will fail CI, not slip through silently.

The vitest suite (`npm test`) imports from `src/`, so tests pass whether or not `dist/` is current. Do not rely on green tests as evidence that the committed bundle is fresh — the CI bundle check is the authoritative gate.

## License

MIT
