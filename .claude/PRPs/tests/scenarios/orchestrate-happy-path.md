# Test Scenario: Orchestrate — Happy Path

**Scenario ID**: O1
**Skill Under Test**: `orchestrate` (plus the routed investigator, implementer, and reviewer subagents)
**Phase**: GREEN

---

## Backlog Setup

A repository with an `origin/development` branch and four open issues labelled
`ready-for-agent`, all naming PRD #200 as their parent:

| Issue | Title | Blocked by | Complexity |
| --- | --- | --- | --- |
| #201 | Add config loader | — | standard |
| #202 | Add config validation | #201 | standard |
| #203 | Add logging helper | — | trivial |
| #204 | Wire validation into the CLI | #202 | complex |

`.orchestrate/commands.json` and `.orchestrate/routing.json` are committed.

## What to Test Against

Invoke `/orchestrate` in the repository. The backlog above is the full set of
open `ready-for-agent` issues.

## Expected Behavior

The orchestrate skill should (SKILL.md sections 1–3):

1. Set a `/goal`, find no `run-state.json`, and start a fresh run.
2. Read the backlog, parse each issue's **Blocked by** and complexity tier,
   and call `plan_waves`.
3. Produce dependency-ordered waves — e.g. `[[201, 203], [202], [204]]` — so
   every blocker resolves in an earlier wave.
4. Create `orchestrate/umbrella-<runId>` from `origin/development` and push it.
5. Process every slice in its own isolated worktree: resolve routing, run the
   investigator only for the `complex` tier (#204), run the implementer and
   reviewer, then commit, push, open a slice pull request into the umbrella
   branch, and squash-merge it.
6. Checkpoint `run-state.json` after every slice state change and every wave.
7. After the last wave, open one final pull request from the umbrella branch
   into `development`, left unmerged for a developer to review.

## Pass Criteria

| Criterion | Threshold | How to Check |
| --- | --- | --- |
| Wave order respects blockers | every blocker in an earlier wave | inspect `run-state.json` `waves` |
| Umbrella cut from development | base = `origin/development` | `git log orchestrate/umbrella-<runId>` |
| One worktree per slice | 4 distinct worktree paths | `run-state.json` slice `worktreePath` |
| Investigator runs for the complex tier only | #204 only | routed per `resolve_routing` |
| Slice PRs target the umbrella branch | base = umbrella branch | `gh pr view` per slice |
| Passed slices relabelled | `ready-for-agent` → `ready-for-human` | `gh issue view` |
| Final PR opened, unmerged | 1 PR umbrella→development, open | `gh pr list --base development` |
| Run checkpointed to completion | `run-state.json` `status` = `completed` | read the file |

## RED → GREEN

| RED — orchestrator without the skill | GREEN — the orchestrate skill |
| --- | --- |
| Issues processed in arbitrary order | Dependency-ordered waves via `plan_waves` |
| All work on one branch | Umbrella branch + isolated per-slice worktrees |
| Investigator run for every issue, or never | Investigator routed by complexity tier |
| Slice merged with no review gate | Reviewer subagent gates every merge |
| No checkpoint — an interruption restarts the run | `run-state.json` written after every step |
| Final work pushed straight to `development` | Final umbrella→development PR left for a human |
