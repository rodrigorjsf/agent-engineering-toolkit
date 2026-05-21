# Test Scenario: Orchestrate — End-to-End Smoke Test

**Scenario ID**: O8
**Skill Under Test**: `orchestrate` (the full loop — every subagent and every orchestrate-mcp tool)
**Phase**: GREEN — end-to-end

---

## Purpose

Scenarios O1–O7 each isolate one behaviour. O8 is the **full-loop smoke
test**: it runs the entire orchestrate skill against a throwaway fixture
repository and asserts the **observable outcomes** the run leaves behind.

Because the orchestrate skill is markdown driven by a model and uses the live
`gh` CLI, this scenario is a **runbook** — executed by a human or an agent
against a real fixture repository, not an automated unit test. Shipping it as
an always-green automated test would be misleading: the orchestrate-mcp tools
have their own unit suite (`plugins/orchestrate/orchestrate-mcp/test/`), but
the skill loop itself can only be verified by running it.

## Fixture Repository Setup

Create a throwaway repository — a real GitHub repository, since the skill uses
the `gh` CLI:

- A `development` branch (the integration base).
- A small `ready-for-agent` backlog — 2–3 issues, at least one blocked by
  another so wave ordering is exercised. Each issue body carries a **Blocked
  by** section and a **Parent** section naming a PRD issue.
- Committed `.orchestrate/commands.json` and `.orchestrate/routing.json`,
  copied from the plugin's `templates/`.
- A trivially implementable task behind each issue, so the implementer and
  reviewer can genuinely complete each slice.

## What to Test Against

Invoke `/orchestrate` in the fixture repository and let the full loop run to
completion.

## Observable-Outcome Assertions

| # | Observable outcome | How to Check |
| --- | --- | --- |
| 1 | Umbrella branch `orchestrate/umbrella-<runId>` created from `development` and pushed | `git branch -r` |
| 2 | One isolated worktree created per slice | run log / `run-state.json` `worktreePath` |
| 3 | Each passed slice's worktree removed; any failed slice's worktree preserved | `git worktree list` after the run |
| 4 | A slice branch and slice pull request per slice, the PR targeting the umbrella branch | `gh pr list --base orchestrate/umbrella-<runId>` |
| 5 | Each slice pull request squash-merged into the umbrella branch | `gh pr view <n> --json state,mergedAt` |
| 6 | Each slice commit carries a `Closes #N` trailer | `git log orchestrate/umbrella-<runId>` |
| 7 | Passed issues relabelled `ready-for-agent` → `ready-for-human` | `gh issue view <n>` |
| 8 | The run renders three HTML artifacts — dashboard, graph, report | `ls .orchestrate/dashboard.html .orchestrate/graph.html .orchestrate/report.html` |
| 9 | One final pull request from the umbrella branch into `development`, left **open / unmerged** | `gh pr list --base development` |
| 10 | `run-state.json` `status` = `completed` and `finalPullRequest` set | read the file |

## Note on "issues closed"

The orchestrator **does not close issues**. Each slice commit carries a
`Closes #N` trailer (assertion 6); those trailers close the issues only when a
developer merges the **final umbrella pull request** into `development` — which
the orchestrator deliberately leaves unmerged (assertion 9). The smoke test
therefore asserts the `Closes #N` trailers and the open final pull request,
**not** closed-issue state in GitHub. Issue closure is a downstream human
action, by design.

## Pass Criteria

All ten observable-outcome assertions hold after a single `/orchestrate` run
against the fixture repository. Any assertion that fails is a smoke-test
failure that must be triaged before the plugin is considered release-ready
(#167).

## RED → GREEN

| RED — orchestrator without the skill | GREEN — the orchestrate skill |
| --- | --- |
| Outcomes are ad hoc and unverifiable | Ten concrete observable outcomes, each checkable |
| "Issues closed" assumed as a direct effect of the run | Closure correctly modelled as a downstream PR-merge effect |
| The full loop is never exercised together | One run drives every subagent and every tool end to end |
