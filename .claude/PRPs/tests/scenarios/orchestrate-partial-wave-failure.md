# Test Scenario: Orchestrate — Partial Wave Failure and Skip Cascade

**Scenario ID**: O6
**Skill Under Test**: `orchestrate`
**Phase**: GREEN

---

## Backlog Setup

Three open `ready-for-agent` issues across two waves:

| Issue | Wave | Blocked by | Outcome |
| --- | --- | --- | --- |
| #601 | 0 | — | implements and reviews cleanly — passes |
| #602 | 0 | — | the implementer returns `blocked` — fails |
| #603 | 1 | #602 | depends on the failed slice |

## What to Test Against

Invoke `/orchestrate`. In wave 0, #601 succeeds and #602's implementer returns
`status: "blocked"`.

## Expected Behavior

Per SKILL.md section 2 (step 1) and *Failure handling*:

- **Wave 0** — #601 passes (merged, `ready-for-human`, worktree removed). #602
  **FAILS** (the implementer returned `blocked`) → `state` = `failed`, label
  `needs-triage`, worktree preserved. #602's failure does **not** cancel
  #601 — independent slices in a wave proceed normally.
- **Wave 1** — #603's blocker #602 did not reach `passed`, so #603 is
  **SKIPPED**: `state` = `skipped`, its `failureReason` names #602, and its
  label **stays `ready-for-agent`** so a later run can retry it once #602 is
  fixed.
- The run still completes: it opens the final umbrella→development pull
  request covering the slices that did pass.

## Pass Criteria

| Criterion | Threshold | How to Check |
| --- | --- | --- |
| One failure does not abort the wave | #601 still ships | `run-state.json` |
| Failed slice state and label | #602 `failed`, `needs-triage` | `run-state.json`, `gh issue view 602` |
| Dependent slice skipped | #603 `skipped`, `failureReason` names #602 | `run-state.json` |
| Skipped slice label unchanged | #603 stays `ready-for-agent` | `gh issue view 603` |
| Run still completes | final umbrella pull request opened | `gh pr list --base development` |

## RED → GREEN

| RED — orchestrator without the skill | GREEN — the orchestrate skill |
| --- | --- |
| One failure aborts the entire run | The wave continues; #601 still ships |
| Builds #603 on top of the failed #602 | #603 is skipped — never built on a missing dependency |
| Relabels the skipped issue, losing retry-ability | #603 stays `ready-for-agent` for a later run |
