# run-state.json — the orchestration checkpoint

`run-state.json` is the durable checkpoint of an orchestration run. The
orchestrator writes it after every slice state change and after every wave, and
reads it on startup to resume an interrupted run instead of restarting.

## The per-run directory

Every run keeps its ephemeral state in a **per-run directory**,
`.orchestrate/runs/<runId>/`, where `<runId>` is the run's timestamp id. That
directory holds the run's `run-state.json`, its `context-flag.json` (the
context-handoff signal), and the rendered HTML artifacts (`dashboard.html`,
`graph.html`, `report.html`). Two distinct runs never share a directory, so
their ephemeral state never collides — the per-run layout is the structural
foundation for concurrent runs.

The committed config files — `commands.json`, `routing.json`, and
`handoff.json` — stay flat at the `.orchestrate/` top level; they are
configuration, not run state, and are shared across runs.

The run's `run-state.json` therefore lives at
`.orchestrate/runs/<runId>/run-state.json`. It is run metadata, not source —
the target project should gitignore the `.orchestrate/runs/` directory.

```text
.orchestrate/
├── commands.json                 # committed config (flat, shared)
├── routing.json                  # committed config (flat, shared)
├── handoff.json                  # committed config (flat, shared)
└── runs/
    └── 20260521-015143/          # one per-run directory per run
        ├── run-state.json        # the run checkpoint
        ├── context-flag.json     # the context-handoff signal (when raised)
        ├── dashboard.html        # rendered artifact
        ├── graph.html            # rendered artifact
        └── report.html           # rendered artifact
```

## Schema

```json
{
  "runId": "20260521-015143",
  "status": "in-progress",
  "driverSessionId": "abc123-session-uuid",
  "umbrellaBranch": "orchestrate/umbrella-20260521-015143",
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
      "worktreePath": "/abs/path/.orchestrate-worktrees/20260521-015143/slice-157",
      "pullRequest": "https://github.com/owner/repo/pull/200",
      "failureReason": null,
      "updatedAt": "2026-05-21T02:05:00Z"
    }
  }
}
```

### Top-level fields

- `runId` — the run's timestamp id, also embedded in the umbrella branch name.
- `status` — `in-progress` while waves remain, `completed` when the run finishes.
- `driverSessionId` — the Claude Code `session_id` of the session executing
  this run's orchestrator. Written on run start from `$ORCHESTRATE_SESSION_ID`
  (set by the `SessionStart` hook) and **refreshed on resume** — a successor
  session resumes under a new `session_id`, so the field is overwritten when
  the run is picked up. It binds the global `context-watchdog` to the correct
  run when several runs proceed concurrently. May be **absent** on a legacy
  checkpoint or when the orchestrator could not read its own session identity;
  the watchdog degrades to a safe no-op rather than crashing when it is missing.
- `umbrellaBranch` — the branch all slice pull requests merge into.
- `integrationBase` — the branch the umbrella was cut from (always `development`).
- `parentIssue` — the parent PRD issue number the run reports progress to, or
  `null` if the backlog issues name no parent.
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

On startup the orchestrator scans `.orchestrate/runs/*/run-state.json` for a run
whose `status` is `in-progress`. If one is found, the run resumes: every slice
already in a terminal state is left untouched; every `in-progress` slice has its
partial artifacts discarded (worktree removed, slice branch deleted) and is
coerced back to `pending` before re-processing — it is not merely continued.
When no run directory holds an `in-progress` run — none exist, or every run's
`status` is `completed` — a fresh run starts.
