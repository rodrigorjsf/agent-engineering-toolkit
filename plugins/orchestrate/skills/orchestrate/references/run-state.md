# run-state.json — the orchestration checkpoint

`run-state.json` is the durable checkpoint of an orchestration run. The
orchestrator writes it after every slice state change and after every wave, and
reads it on startup to resume an interrupted run instead of restarting.

## The per-run directory

Every run keeps its ephemeral state in a **per-run directory**,
`.orchestrate/runs/<runId>/`. The `<runId>` is the run's identifier in one of
two minted forms: `prd<N>-<timestamp>` for a **partitioned run** scoped to one
parent PRD's children (`/orchestrate <PRD#>`), and `backlog-<timestamp>` for a
**whole-backlog run** (`/orchestrate` with no argument). That directory holds
the run's `run-state.json`, its `context-flag.json` (the context-handoff
signal), and the rendered HTML artifacts (`dashboard.html`, `graph.html`,
`report.html`). Two distinct runs never share a directory, so their ephemeral
state never collides — the per-run layout is the structural foundation for
concurrent runs.

The committed config files — `commands.json`, `routing.json`, and
`handoff.json` — stay flat at the `.orchestrate/` top level; they are
configuration, not run state, and are shared across runs.

The run's `run-state.json` therefore lives at
`.orchestrate/runs/<runId>/run-state.json`. It is run metadata, not source —
the target project should gitignore the `.orchestrate/runs/` directory.

```text
.orchestrate/
├── commands.json                      # committed config (flat, shared)
├── routing.json                       # committed config (flat, shared)
├── handoff.json                       # committed config (flat, shared)
└── runs/
    ├── prd195-20260521-015143/         # a partitioned run (PRD #195's children)
    │   ├── run-state.json              # the run checkpoint
    │   ├── context-flag.json           # the context-handoff signal (when raised)
    │   ├── dashboard.html              # rendered artifact
    │   ├── graph.html                  # rendered artifact
    │   └── report.html                 # rendered artifact
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

- `runId` — the run's identifier, also embedded in the umbrella branch name. It
  is `prd<N>-<timestamp>` for a partitioned run (`/orchestrate <PRD#>`) and
  `backlog-<timestamp>` for a whole-backlog run (`/orchestrate` with no
  argument). The `prd<N>-` / `backlog-` prefix is the match key the startup
  scan parses to decide whether a new invocation resumes this run.
- `status` — `in-progress` while waves remain, `completed` when the run finishes.
- `driverSessionId` — the Claude Code `session_id` of the session executing
  this run's orchestrator. Written on run start from `$ORCHESTRATE_SESSION_ID`
  (set by the `SessionStart` hook) and **refreshed on resume** — a successor
  session resumes under a new `session_id`, so the field is overwritten when
  the run is picked up. It binds the global `context-watchdog` to the correct
  run when several runs proceed concurrently. May be **absent** on a legacy
  checkpoint or when the orchestrator could not read its own session identity;
  the watchdog degrades to a safe no-op rather than crashing when it is missing.
- `umbrellaBranch` — the branch all slice pull requests merge into. It carries
  the `runId` (`orchestrate/umbrella-<runId>`), so two concurrent runs never
  collide on a branch name.
- `integrationBase` — the branch the umbrella was cut from (always `development`).
- `parentIssue` — the parent PRD issue number the run reports progress to, or
  `null` if the backlog issues name no parent. For a partitioned run it is the
  invoked `<PRD#>`, hard-set by the skill rather than re-detected from the
  already-filtered slice set.
- `startedAt` / `updatedAt` — ISO-8601 UTC timestamps.
- `waves` — the `plan_waves` output: an ordered array of waves, each an array of
  issue-id strings.
- `completedWaves` — the count of waves fully processed; resume continues from
  this index.
- `finalPullRequest` — the umbrella-to-`development` pull request URL, set when
  the run completes; `null` until then.
- `slices` — a map keyed by issue-id string; one entry per backlog issue.

### Slice fields

- `issue` — the GitHub issue number.
- `title` — the issue title.
- `wave` — the zero-based index of the wave this slice belongs to.
- `tier` — the assessed complexity tier (`trivial`, `standard`, or `complex`),
  which drives per-role subagent routing.
- `blockedBy` — issue-id strings this slice depends on (drives the graph view).
- `state` — see *Slice states* below.
- `sliceBranch` — the slice's branch name (`orchestrate/slice-<issue>`).
- `worktreePath` — absolute path of the slice's worktree; a `failed` slice keeps
  its worktree on disk for inspection.
- `pullRequest` — the slice pull request URL, or `null` before it is opened.
- `failureReason` — a short explanation when `state` is `failed` or `skipped`;
  `null` otherwise.
- `updatedAt` — when this slice last changed state.

## Slice states

- `pending` — not yet processed.
- `in-progress` — currently being implemented or reviewed.
- `passed` — implemented, reviewed, and merged into the umbrella branch.
- `failed` — the implementer was blocked, the reviewer failed it, the merge
  conflicted, or it produced no changes. Its worktree is preserved.
- `skipped` — not attempted because one of its blockers did not reach `passed`.

`passed`, `failed`, and `skipped` are terminal. `pending` and `in-progress` are
re-processed on resume.

## Resume

On startup the orchestrator scans **every** `.orchestrate/runs/*/run-state.json`
whose `status` is `in-progress` and parses each run's match key from its `runId`
prefix — `prd<N>-` names a partitioned run for PRD `<N>`, `backlog-` names a
whole-backlog run. It then matches against the current invocation:
`/orchestrate <PRD#>` matches in-progress runs whose `runId` starts `prd<N>-`
for the invoked `<N>`; `/orchestrate` with no argument matches in-progress runs
whose `runId` starts `backlog-`. A bare-timestamp `runId` from before this
scheme matches neither and is ignored.

- **Zero matches** — a fresh run starts.
- **Exactly one match** — that run resumes. Every slice already in a terminal
  state is left untouched; every `in-progress` slice has its partial artifacts
  discarded (worktree removed, slice branch deleted) and is coerced back to
  `pending` before re-processing — it is not merely continued. Resume reloads
  **only** the matched run's persisted `slices` and `waves`; it never re-fetches
  the backlog or re-derives the partition, so a resumed run never widens its own
  scope.
- **Two or more matches** — a loud error. Two in-progress runs for the same PRD
  (or two in-progress whole-backlog runs) is never resolved by a silent pick;
  the orchestrator reports every matching `runId` and stops.

This per-PRD match is what keeps two concurrent runs disjoint: each owns one
parent PRD's children, recorded in its own run directory, and a re-invocation
resumes the right one instead of duplicating it.

## Cleanup lifecycle

A `completed` run still leaves a footprint on disk and in git — its run
directory, any preserved worktrees, and its umbrella and slice branches. **Run
cleanup** removes that footprint once the run has fully concluded.

A run is eligible for cleanup only when **both** conditions hold:

- Its `status` is `completed` — necessary, but not sufficient on its own.
- Its `finalPullRequest` has **merged** into the integration base
  (`development`). A non-null `finalPullRequest` means only that the pull
  request was *opened*; the gate is its **merged** state. A run whose final pull
  request is still open or was closed unmerged is left intact and only reported.

The merge verdict is GitHub state. The orchestrator resolves it with
`gh pr view <finalPullRequest> --json state,mergedAt` and passes a per-run
verdict map (`runId → merged | open | closed-unmerged | unknown`) to the
`clean_runs` MCP tool, which is itself git + filesystem only. For a `merged`
run, `clean_runs` removes its `passed`-slice worktrees, deletes its
`umbrellaBranch` and every `sliceBranch` (local and remote), and removes the run
directory.

A `failed`-state slice's worktree is **preserved** by default — a developer may
still need to inspect it. When a slice worktree is preserved, its `sliceBranch`
is left fully intact too (local **and** remote), so the developer can still
check it out and push from the preserved worktree; only the branches of removed
worktrees, plus the `umbrellaBranch`, are deleted. The run directory is **kept**
whenever any worktree was preserved, so the preserved worktree's `run-state.json`
survives. The `--force` option removes failed-slice worktrees too, deletes every
branch, and always removes the run directory. Cleanup runs both as a sweep at the
start of every run and on demand via `/orchestrate clean`; it never touches an
`in-progress` run.
