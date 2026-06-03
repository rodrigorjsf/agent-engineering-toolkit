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
configuration, not run state, and are shared across runs. The run's
`run-state.json` lives at `.orchestrate/runs/<runId>/run-state.json`; it is run
metadata, not source — the target project should gitignore
`.orchestrate/runs/`.

```text
.orchestrate/
├── commands.json                      # committed config (flat, shared)
├── routing.json                       # committed config (flat, shared)
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
      "updatedAt": "2026-05-21T02:05:00Z"
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
  `null` if the backlog issues name no parent. For a partitioned run it is the
  invoked `<PRD#>`, hard-set by the skill, not re-detected from the slice set.
- `startedAt` / `updatedAt` — ISO-8601 UTC timestamps.
- `waves` — the `plan_waves` output: an ordered array of waves, each an array of
  issue-id strings.
- `completedWaves` — the count of waves fully processed; resume continues here.
- `finalPullRequest` — the umbrella-to-`development` PR URL; `null` until done.
- `slices` — a map keyed by issue-id string; one entry per backlog issue.

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
  transition; `null`/absent before §3 step 4 completes. It is the **resume
  anchor** for an interrupted in-progress slice (see *Resume*). `pushed` is
  recorded **only after** `git ls-remote` confirms the branch landed; `merged`
  (slice PR squash-merged into the umbrella, step 8) precedes the slice reaching
  coarse `state: passed` (step 9).
- `sliceBranch` — the slice's branch name (`orchestrate/slice-<issue>`).
- `worktreePath` — absolute path of the slice's worktree; a `failed` slice keeps
  it on disk for inspection.
- `pullRequest` — the slice pull request URL, or `null` before it is opened.
- `failureReason` — a short explanation when `state` is `failed`/`skipped`; else `null`.
- `updatedAt` — when this slice last changed state.

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

The merge verdict is GitHub state, which the orchestrator resolves with
`gh pr view <finalPullRequest> --json state,mergedAt` and passes as a per-run
verdict map (`runId → merged | open | closed-unmerged | unknown`) to the
`clean_runs` MCP tool, itself git + filesystem only. For a `merged` run, a
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
