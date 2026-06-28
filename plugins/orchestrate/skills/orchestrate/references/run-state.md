# run-state.json — the orchestration checkpoint

`run-state.json` is the durable checkpoint of an orchestration run. The
orchestrator writes it after every slice state change and after every wave, and
reads it on startup to resume an interrupted run instead of restarting.

## The per-run directory

Every run keeps its ephemeral state in a **per-run directory**,
`.orchestrate/runs/<runId>/`. The `<runId>` is minted in one of two forms:
`prd<N>-<timestamp>` for a **partitioned run** scoped to one parent PRD's
children (`/orchestrate <PRD#>`), and `backlog-<timestamp>` for a **whole-backlog
run** (`/orchestrate` with no argument). That directory holds the run's
`run-state.json`, its `context-flag.json` (the context-handoff signal), and the
rendered HTML artifacts (`dashboard.html`, `graph.html`, `report.html`). Two
distinct runs never share a directory, so their ephemeral state never collides —
the per-run layout is the structural foundation for concurrent runs.

The committed config files — `commands.json`, `routing.json`, and
`handoff.json` — stay flat at the `.orchestrate/` top level; they are
configuration, not run state, and are shared across runs. `routing.json` carries
both per-tier subagent routing **and** run-wide run policy (the optional
`intraWaveConcurrency` knob — `"parallel" | "sequential"`, default `parallel`);
the run-policy keys are optional, the three tier blocks remain required. The run's
`run-state.json` lives at `.orchestrate/runs/<runId>/run-state.json`; it is run
metadata, not source — the target project should gitignore
`.orchestrate/runs/`.

```text
.orchestrate/
├── commands.json                      # committed config (flat, shared)
├── routing.json                       # committed config (flat, shared) — per-tier routing + run-wide run policy
├── handoff.json                       # committed config (flat, shared)
└── runs/
    ├── prd195-20260521-015143/         # a partitioned run (PRD #195's children)
    │   ├── run-state.json              # the run checkpoint
    │   ├── context-flag.json           # the context-handoff signal (when raised)
    │   └── dashboard.html, graph.html, report.html   # rendered artifacts
    └── backlog-20260521-022540/        # a concurrent whole-backlog run
        └── run-state.json
```

## Schema

```json
{
  "runId": "prd153-20260521-015143",
  "status": "in-progress",
  "driverSessionId": "abc123-session-uuid",
  "umbrellaBranch": "orchestrate/umbrella-prd153-20260521-015143",
  "integrationBase": "development",
  "parentIssue": 153,
  "startedAt": "2026-05-21T01:51:43Z",
  "updatedAt": "2026-05-21T02:14:09Z",
  "waves": [["157", "158"], ["159"]],
  "completedWaves": 1,
  "finalPullRequest": null,
  "slices": {
    "157": {
      "issue": 157,
      "title": "orchestrate S4: walking skeleton",
      "wave": 0,
      "tier": "standard",
      "blockedBy": ["155"],
      "state": "passed",
      "subState": "merged",
      "sliceBranch": "orchestrate/slice-157",
      "worktreePath": "/abs/path/.orchestrate-worktrees/prd153-20260521-015143/slice-157",
      "pullRequest": "https://github.com/owner/repo/pull/200",
      "failureReason": null,
      "updatedAt": "2026-05-21T02:05:00Z",
      "resolvedRouting": {
        "investigator": null,
        "implementer": { "model": "claude-sonnet-4-5", "variant": "standard" },
        "reviewer": { "model": "claude-sonnet-4-5", "variant": "standard" },
        "conflict-resolver": { "model": "claude-sonnet-4-5", "variant": "standard" },
        "fallback": { "model": "claude-opus-4-5", "maxRetries": 1 },
        "fallbackTaken": false
      }
    }
  }
}
```

### Top-level fields

- `runId` — the run's identifier, also embedded in the umbrella branch name:
  `prd<N>-<timestamp>` for a partitioned run, `backlog-<timestamp>` for a
  whole-backlog run. The `prd<N>-` / `backlog-` prefix is the match key the
  startup scan parses to decide whether a new invocation resumes this run.
- `status` — `in-progress` while waves remain, `completed` when the run finishes.
- `driverSessionId` — the Claude Code `session_id` of the session executing
  this run's orchestrator. Written on run start from `$ORCHESTRATE_SESSION_ID`
  (set by the `SessionStart` hook) and **refreshed on resume**, since a
  successor session resumes under a new `session_id`. It binds the global
  `context-watchdog` to the correct run when several runs proceed concurrently.
  May be **absent** on a legacy checkpoint or when the session identity could
  not be read; the watchdog degrades to a safe no-op rather than crashing.
- `umbrellaBranch` — the branch all slice pull requests merge into. It carries
  the `runId` (`orchestrate/umbrella-<runId>`), so two runs never collide on it.
- `integrationBase` — the branch the umbrella was cut from (always `development`).
- `parentIssue` — the parent PRD issue number the run reports progress to, or
  `null` if none. For a partitioned run it is the invoked `<PRD#>`, hard-set by
  the skill, not re-detected from the slice set.
- `startedAt` / `updatedAt` — ISO-8601 UTC timestamps.
- `waves` — the `plan_waves` output: an ordered array of waves of issue-id strings.
- `completedWaves` — the count of waves fully processed; resume continues here.
- `finalPullRequest` — the umbrella-to-`development` PR URL; `null` until done.
- `slices` — a map keyed by issue-id string; one entry per backlog issue. The
  `validate_run_state` MCP tool enforces this shape against the canonical schema
  right after the first write and on resume — an array-shaped `slices` is rejected.

### Slice fields

- `issue` — the GitHub issue number.
- `title` — the issue title.
- `wave` — the zero-based index of the wave this slice belongs to.
- `tier` — complexity tier (`trivial`/`standard`/`complex`); drives routing.
- `blockedBy` — issue-id strings this slice depends on (drives the graph view).
- `state` — see *Slice states* below.
- `subState` — fine-grained position **within** §3 processing of an
  `in-progress` slice, one of
  `implemented|verified|reviewed|pushed|pr-open|merged`, written at every §3
  transition; the key is **absent before §3 step 4 completes — omit the key
  entirely; an explicit `null` is rejected** (the schema
  `subState: subStateEnum.optional()` accepts an absent key but rejects a
  literal `null`, so `"subState": null` fails `validate_run_state`). It is
  the **resume anchor** for an interrupted in-progress slice
  (see *Resume*). `pushed` is
  recorded **only after** `git ls-remote` confirms the branch landed; `merged`
  (slice PR squash-merged into the umbrella, step 8) precedes the slice reaching
  coarse `state: passed` (step 9).
- `sliceBranch` — the slice's branch name (`orchestrate/slice-<issue>`).
- `worktreePath` — absolute path of the slice's worktree; a `failed` slice keeps
  it on disk for inspection.
- `pullRequest` — the slice pull request URL, or `null` before it is opened.
- `failureReason` — a short explanation when `state` is `failed`/`skipped`; else `null`.
- `updatedAt` — when this slice last changed state.
- `resolvedRouting` — **optional**; absent on checkpoints written before this
  field was introduced (backward-compatible). When present, it captures the
  routing that was frozen at slice creation so a resumed run routes the slice
  from the checkpoint rather than from live GitHub labels. Shape:
  - `investigator` — `{model, variant}` for the investigator role, or `null`
    when this tier skips the investigation pass.
  - `implementer` — `{model, variant}` for the implementer role.
  - `reviewer` — `{model, variant}` for the reviewer role.
  - `conflict-resolver` — `{model, variant}` for the conflict-resolver role.
  - `fallback` — **optional** `{model, maxRetries}` spec; present when a
    label override (e.g. `route:fable`) carried a fallback, absent otherwise.
  - `fallbackTaken` — boolean; `true` when the fallback was already used on a
    previous spawn attempt in this run, preventing the fallback from being
    applied again on resume. Defaults to `false`.

## Slice states

- `pending` — not yet processed.
- `in-progress` — currently being implemented or reviewed.
- `passed` — implemented, reviewed, and merged into the umbrella branch.
- `failed` — the implementer was blocked, the reviewer failed it, the merge
  conflicted, or it produced no changes; its worktree is preserved.
- `skipped` — not attempted because a blocker did not reach `passed`.

`passed`, `failed`, and `skipped` are terminal. A `pending` slice is processed
from the start on resume; an `in-progress` slice is **resumed from its
`subState`**, not re-processed from scratch (see *Resume*).

An implementer `incomplete` envelope drives an **in-session continuation loop**
(the orchestrator re-spawns the implementer in the same preserved worktree with
the `remainingWork` handoff until it returns `completed` or the continuation
budget is exhausted) and does **not** introduce a new slice `state` — the enum
stays `pending` / `in-progress` / `passed` / `failed` / `skipped`. The loop's
continuation counter and worktree fingerprint are within-session loop state,
never persisted to `run-state.json`; a mid-continuation handoff/resume rebuilds
the worktree and restarts the slice clean.

## Resume

On startup the orchestrator scans **every** `.orchestrate/runs/*/run-state.json`
whose `status` is `in-progress` and parses each run's match key from its `runId`
prefix, then matches against the current invocation: `/orchestrate <PRD#>`
matches an `in-progress` run whose `runId` starts `prd<N>-` for the invoked
`<N>`; `/orchestrate` with no argument matches one whose `runId` starts
`backlog-`. A bare-timestamp `runId` from before this scheme matches neither and
is ignored.

- **Zero matches** — a fresh run starts.
- **Exactly one match** — that run resumes. Every terminal-state slice is left
  untouched. Every `in-progress` slice **continues from its recorded
  `subState`**: its worktree and slice branch are **preserved**, its changed-file
  set is reconstructed from the worktree via `recover_changed_files`, the resume
  point is re-validated cheaply (the capability gate for pre-push subStates;
  `git ls-remote` for the push landing check), and processing resumes at the next
  uncompleted §3 step **without** re-spawning subagents whose work is already
  captured. An in-progress slice with **no `subState`** — a legacy checkpoint
  written before this scheme — instead falls back to the old discard path: remove
  its worktree, delete its slice branch, and coerce it to `pending` (the same
  graceful degradation as an absent `driverSessionId`). Resume reloads **only**
  the matched run's persisted `slices` and `waves`; it never re-fetches the
  backlog or re-derives the partition, so a resumed run never widens its scope.
- **Two or more matches** — a loud error. Two in-progress runs for the same PRD
  (or two in-progress whole-backlog runs) is never resolved by a silent pick;
  the orchestrator reports every matching `runId` and stops.

This per-PRD match keeps two concurrent runs disjoint: each owns one parent
PRD's children in its own run directory, and a re-invocation resumes the right
one instead of duplicating it.

## Cleanup lifecycle

A `completed` run still leaves a footprint on disk and in git — its run
directory, any preserved worktrees, and its umbrella and slice branches. **Run
cleanup** removes that footprint once the run has fully concluded, eligible only
when **both** conditions hold:

- Its `status` is `completed` — necessary, but not sufficient on its own.
- Its `finalPullRequest` has **merged** into the integration base
  (`development`). A non-null `finalPullRequest` means only that the pull request
  was *opened*; the gate is its **merged** state. A run whose final pull request
  is still open or was closed unmerged is left intact and only reported.

The merge verdict is GitHub state. The orchestrator fetches each run's
`gh pr view <finalPullRequest> --json state,mergedAt` facts and the **pure**
`resolve_cleanup_verdicts` MCP tool classifies them into a per-run verdict map
(`runId → merged | open | closed-unmerged | unknown`) — phase one of that tool
also applies the eligibility gate to pick which final PRs to fetch, and phase
two captures each `merged` run's passed-slice close-set. The orchestrator then
passes the verdict map to the `clean_runs` MCP tool, itself git + filesystem
only. As defense-in-depth,
`clean_runs` does **not** trust the verdict map alone: even for a `merged`
verdict it **re-reads** the run's own `run-state.json` and refuses to act unless
`status === "completed"` **and** `finalPullRequest != null` — a
tool-deterministic gate independent of the orchestrator's verdict map (per
ADR-0012). A `completed` run whose `finalPullRequest` is `null` (its final pull
request was never opened, so the run never concluded) is left strictly intact
and reported with reason `final-pr-missing`. For a `merged` run, a
`passed` slice's branch is reclaimed **incrementally at squash-merge** — remote
via `gh pr merge --squash --delete-branch`, local via `git branch -D` after
worktree removal — so `clean_runs` (which removes the `passed`-slice worktrees,
the `umbrellaBranch`, the run directory, and as a **backstop** any `sliceBranch`
surviving a mid-run crash) finds those branches already gone.

A `failed`-state slice's worktree is **preserved** by default for inspection.
Incremental reclamation fires only on `passed` / `subState: "merged"`, never on
a failed slice, so a preserved worktree's `sliceBranch` is left fully intact
(local **and** remote) for the developer; only removed worktrees' branches, plus
the `umbrellaBranch`, are deleted. The run directory is **kept** whenever any
worktree was preserved, so its `run-state.json` survives. The `--force` option
removes failed-slice worktrees too, deletes every branch, and always removes the
run directory. Cleanup runs both as a start-of-run sweep and on demand via
`/orchestrate clean`; it never touches an `in-progress` run.

`/orchestrate clean --failed <runId>` is a **distinct** override. Unlike
`--force` — which still operates *inside* the completed-and-merged status gate —
`--failed` **bypasses the status gate** for one named run, the only sanctioned
exception (ADR-0012), so a crashed run frozen at `in-progress` can be reclaimed.
It calls the `reclaim_run` MCP tool (not `clean_runs`), is scoped by construction
to `runs/<runId>/` and that runId's branches so it can never touch another run,
and removes all of that run's worktrees (passed and failed), branches, and run
directory. Its only protection is a **mandatory interactive confirmation** (no
`--yes`) that lists the exact deletion set and surfaces the run-state `updatedAt`
as a **staleness advisory** — informational, never a gate.
