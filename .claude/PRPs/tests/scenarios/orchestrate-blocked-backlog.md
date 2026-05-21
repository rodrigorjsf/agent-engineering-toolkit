# Test Scenario: Orchestrate — Fully-Blocked Backlog (Dependency Cycle)

**Scenario ID**: O2
**Skill Under Test**: `orchestrate`
**Phase**: GREEN

---

## Backlog Setup

A repository with three open `ready-for-agent` issues whose **Blocked by**
sections form a cycle:

| Issue | Blocked by |
| --- | --- |
| #301 | #302 |
| #302 | #303 |
| #303 | #301 |

No issue can be ordered before its blockers — the backlog cannot be scheduled
into waves. (Blockers *outside* the backlog are treated as already satisfied,
so the only way a backlog is fully unschedulable is a cycle within it.)

## What to Test Against

Invoke `/orchestrate`. All three issues are open and `ready-for-agent`.

## Expected Behavior

Per SKILL.md section 1, step 4: the orchestrator calls `plan_waves`, which
returns `status: "error"` with `errorCode: "CYCLE_DETECTED"`. The orchestrator
reports the cycle to the user and **stops before any branch is created** — no
umbrella branch, no worktrees, no `run-state.json` for a run that cannot
proceed.

## Pass Criteria

| Criterion | Threshold | How to Check |
| --- | --- | --- |
| Cycle detected | `plan_waves` → `CYCLE_DETECTED` | tool result |
| No umbrella branch | 0 `orchestrate/umbrella-*` branches | `git branch --list` |
| No worktrees created | 0 | `git worktree list` |
| Clear report | the cycle is named to the user | run output |
| No partial checkpoint | no `in-progress` `run-state.json` left behind | `ls .orchestrate/` |

## RED → GREEN

| RED — orchestrator without the skill | GREEN — the orchestrate skill |
| --- | --- |
| Loops forever or deadlocks resolving the cycle | `plan_waves` returns a structured `CYCLE_DETECTED` |
| Picks an arbitrary order and builds on unmet deps | Stops before creating any branch |
| Leaves half-created branches and worktrees behind | No side effects — a clean refusal |
