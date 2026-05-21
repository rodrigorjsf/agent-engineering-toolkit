# Test Scenario: Orchestrate — Context Handoff

**Scenario ID**: O7
**Skill Under Test**: `orchestrate` (plus the `context-watchdog` hook and the `spawn_successor` tool)
**Phase**: GREEN

---

## Backlog Setup

A backlog large enough that the orchestrator session's context window fills
before every wave is processed — several waves of `ready-for-agent` issues. The
`context-watchdog` PostToolUse hook ships with the plugin and is active.

## What to Test Against

Invoke `/orchestrate`. Partway through the run, the `context-watchdog` hook
estimates context usage past the configured threshold (default 40%) and writes
`.orchestrate/context-flag.json`.

## Expected Behavior

Per SKILL.md section 2 (step 3) and section 4:

1. The watchdog raises the flag; it does not interrupt the in-flight slice.
2. After the **current slice finishes integrating**, the wave loop sees
   `.orchestrate/context-flag.json` and does **not** start the next slice.
3. The orchestrator confirms `run-state.json` is checkpointed with `status`
   still `in-progress`, then calls `spawn_successor`.
4. `spawn_successor` launches a new interactive Claude Code session
   (`--remote-control`, never print mode) that re-invokes `/orchestrate`.
5. The predecessor **stops** — it processes no further waves.
6. The successor, on startup (section 1), deletes the stale
   `.orchestrate/context-flag.json` and resumes from the `run-state.json`
   checkpoint.

## Pass Criteria

| Criterion | Threshold | How to Check |
| --- | --- | --- |
| Current slice finished before handoff | the in-flight slice reaches a terminal state | `run-state.json` |
| Run still resumable at handoff | `status` = `in-progress` when `spawn_successor` runs | `run-state.json` |
| Successor launched | `spawn_successor` → `status: "ok"` | tool result |
| Predecessor stops | no waves processed after the handoff | run output |
| Successor clears the stale flag | `context-flag.json` deleted on resume | `ls .orchestrate/` after resume |
| No infinite handoff loop | the successor does not immediately hand off again | run output |

## RED → GREEN

| RED — orchestrator without the skill | GREEN — the orchestrate skill |
| --- | --- |
| Runs until context is exhausted, then degrades | Hands off cleanly at the threshold |
| Hands off mid-slice, leaving partial work | Finishes the current slice first |
| The successor re-reads a stale flag and re-hands-off | The stale flag is cleared on startup — no loop |
