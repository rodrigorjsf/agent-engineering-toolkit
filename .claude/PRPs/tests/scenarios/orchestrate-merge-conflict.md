# Test Scenario: Orchestrate — Merge Conflict

**Scenario ID**: O5
**Skill Under Test**: `orchestrate` (plus the conflict-resolver subagent)
**Phase**: GREEN

---

## Backlog Setup

Two open `ready-for-agent` issues in the same wave that both modify the same
file (for example, both edit `src/config.ts`):

| Issue | Blocked by |
| --- | --- |
| #501 | — |
| #502 | — |

#501 merges into the umbrella branch first. #502's slice branch then no longer
merges cleanly — GitHub reports it `CONFLICTING`.

## What to Test Against

Invoke `/orchestrate`. Process #501 through to a merge, then attempt #502.

## Expected Behavior

Per SKILL.md section 3, steps 8 and 8a:

1. `gh pr view` reports #502's `mergeable` / `mergeStateStatus` as
   `CONFLICTING`.
2. The orchestrator does **not** fail the slice immediately. It runs step 8a
   **exactly once**: fetch and merge the umbrella branch into #502's worktree
   to surface the conflict markers, list the conflicted files, and spawn the
   `conflict-resolver` subagent with that file list.
3. If the resolver returns `resolved`, the orchestrator stages the files and
   **confirms no `<<<<<<<` / `>>>>>>>` markers remain** before completing the
   merge, pushing, and merging the pull request.
4. If the resolver returns `failed`, or markers remain, or `gh pr merge` still
   fails — the orchestrator runs `git merge --abort` and the slice **FAILS**.
   The single attempt is spent; there is no retry.

## Pass Criteria

| Criterion | Threshold | How to Check |
| --- | --- | --- |
| Conflict is not an instant failure | resolver attempted once | run output |
| Resolver spawned with the conflicted files | conflict-resolver receives the file list | spawn prompt |
| No markers in the merged result | 0 `<<<<<<<` in the merge commit | `git show` the merge |
| Resolution attempted exactly once | no second conflict-resolver spawn | run output |
| Unresolvable conflict → FAILED | `state` = `failed`, `git merge --abort` run | `run-state.json` |

## RED → GREEN

| RED — orchestrator without the skill | GREEN — the orchestrate skill |
| --- | --- |
| Force-merges, leaving conflict markers in the code | The resolver fixes the conflict; markers verified gone |
| Fails the slice on any conflict, with no attempt | One conflict-resolver attempt before failing |
| Retries resolution indefinitely | Exactly one attempt — then the slice FAILS |
