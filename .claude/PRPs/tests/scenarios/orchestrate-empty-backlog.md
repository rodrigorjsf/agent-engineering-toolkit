# Test Scenario: Orchestrate — Empty Backlog

**Scenario ID**: O3
**Skill Under Test**: `orchestrate`
**Phase**: GREEN

---

## Backlog Setup

A repository with an `origin/development` branch and **no** open issues
carrying the `ready-for-agent` label. Other issues may exist with other labels
— `needs-triage`, `ready-for-human`, `needs-info`, `wontfix` — but none are
`ready-for-agent`.

## What to Test Against

Invoke `/orchestrate`.

## Expected Behavior

Per SKILL.md section 1, step 2: the backlog query
`gh issue list --label ready-for-agent --state open` returns nothing. The
orchestrator reports "no ready-for-agent issues" and stops — a clean no-op. It
creates no umbrella branch, no worktrees, and no `run-state.json`.

## Pass Criteria

| Criterion | Threshold | How to Check |
| --- | --- | --- |
| Empty backlog recognised | reported as a no-op | run output |
| No branch created | 0 `orchestrate/umbrella-*` | `git branch --list` |
| No worktrees | 0 | `git worktree list` |
| No checkpoint written | `.orchestrate/run-state.json` absent | `ls .orchestrate/` |
| Exit is clean, not an error | no failure surfaced to the user | run output |

## RED → GREEN

| RED — orchestrator without the skill | GREEN — the orchestrate skill |
| --- | --- |
| Treats an empty backlog as an error condition | A clean, explicit no-op |
| Creates an empty umbrella branch and pull request | No branch, no PR — nothing to do |
| Scans every open issue regardless of label | Only `ready-for-agent` issues are the backlog |
