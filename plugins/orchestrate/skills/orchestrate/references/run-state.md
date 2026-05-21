# run-state.json — the orchestration checkpoint

`.orchestrate/run-state.json` is the durable checkpoint of an orchestration run.
The orchestrator writes it after every slice state change and after every wave,
and reads it on startup to resume an interrupted run instead of restarting.

It lives at `.orchestrate/run-state.json` in the repository root. It is run
metadata, not source — the target project should gitignore it.

## Schema

```json
{
  "runId": "20260521-015143",
  "status": "in-progress",
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

On startup the orchestrator reads `.orchestrate/run-state.json`. If it exists
and `status` is `in-progress`, the run resumes: every slice already in a
terminal state is left untouched, and processing continues — in wave order —
with the slices still `pending` or `in-progress`. A run with no state file, or
one whose `status` is `completed`, starts fresh.
