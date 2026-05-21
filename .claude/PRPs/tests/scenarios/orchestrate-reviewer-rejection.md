# Test Scenario: Orchestrate — Reviewer Rejection

**Scenario ID**: O4
**Skill Under Test**: `orchestrate` (plus the implementer and reviewer subagents)
**Phase**: GREEN

---

## Backlog Setup

A repository with two open `ready-for-agent` issues, independent of each other,
so they share a single wave:

| Issue | Blocked by | Notes |
| --- | --- | --- |
| #401 | — | implemented and reviewed cleanly |
| #402 | — | the implemented change has a correctness defect the reviewer cannot safely fix inline |

## What to Test Against

Invoke `/orchestrate`. Slice #402's implemented code contains a blocker the
reviewer subagent identifies and judges unsafe to fix inline, so the reviewer
returns `status: "failed"`.

## Expected Behavior

Per SKILL.md section 3, step 5, and *Failure handling*:

- **#401** — implementer and reviewer pass → committed, pull request merged,
  label `ready-for-agent` → `ready-for-human`, worktree removed.
- **#402** — the reviewer returns `failed`, so the slice **FAILS**: its
  `run-state.json` `state` becomes `failed` with a `failureReason`; the issue's
  label transitions `ready-for-agent` → `needs-triage`; the slice is **not
  merged**; and its worktree is **preserved on disk** for a developer to
  inspect.
- #402's failure does **not** cancel #401 — independent slices in a wave
  proceed normally.

## Pass Criteria

| Criterion | Threshold | How to Check |
| --- | --- | --- |
| Bad slice not merged | #402 has no merged pull request | `gh pr list` |
| Failed slice state recorded | #402 `state` = `failed` with a `failureReason` | `run-state.json` |
| Failed slice relabelled | #402 → `needs-triage` | `gh issue view 402` |
| Failed worktree preserved | #402's worktree still on disk | `git worktree list` |
| Other slice unaffected | #401 `passed`, merged, `ready-for-human` | `run-state.json`, `gh issue view 401` |

## RED → GREEN

| RED — orchestrator without the skill | GREEN — the orchestrate skill |
| --- | --- |
| Merges the slice despite the defect | A `failed` review blocks the merge |
| Aborts the whole run on one failure | The wave continues; #401 still ships |
| Deletes the failed worktree, losing the evidence | The failed worktree is preserved for inspection |
| Leaves the failed issue as `ready-for-agent` | The issue is relabelled `needs-triage` for a human |
