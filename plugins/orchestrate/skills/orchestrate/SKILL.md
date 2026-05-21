---
name: orchestrate
description: Implement a backlog of ready-for-agent GitHub issues end to end — order them into dependency waves, run implementer and reviewer subagents in isolated worktrees, merge slice pull requests into an umbrella branch, and checkpoint progress so an interrupted run resumes. Use when the user wants to autonomously orchestrate agent-driven implementation of tracked issues, or invokes /orchestrate.
---

# Orchestrate

Drive a backlog of `ready-for-agent` GitHub issues from open to reviewed, merged
slices — ordered by dependency, processed wave by wave, with no human in the
loop. The run checkpoints after every step, so an interruption resumes instead
of restarting.

## Roles and the safety boundary

- **Orchestrator** — you, running this skill. You own every git, GitHub, and
  shell operation: branches, worktrees, commits, pushes, pull requests, merges,
  and the `run-state.json` checkpoint. You also assess each issue's complexity
  tier and route each role accordingly.
- **Investigator** — the `investigator` subagent. For higher-complexity issues
  only, it explores the codebase read-only and returns a research brief the
  implementer builds on.
- **Implementer** — the `implementer` subagent. It edits code in an isolated
  worktree and verifies it through the orchestrate capability tools.
- **Reviewer** — the `reviewer` subagent. It reviews the implemented slice in
  the same worktree, fixes issues inline, re-runs the capability tools, and
  gates the auto-merge.
- **Conflict-resolver** — the `conflict-resolver` subagent. When a slice
  conflicts with the umbrella branch, it edits the conflicted files to a
  correct merged state. It is spawned once per conflicting slice.

Every role except the orchestrator exists in two effort variants — `-standard`
and `-deep`. The `resolve_routing` tool picks the variant and model per role
from the issue's complexity tier (section 3, step 2). All four subagents have
**no Bash and no git access** — they are sandboxed to one worktree (the
investigator is read-only). Only the orchestrator touches branches, remotes,
and the tracker.

## Prerequisites

Check these before starting. If one is missing, report it and stop.

- `gh` CLI is installed and authenticated (`gh auth status`).
- The repository's `origin` remote has a `development` branch — it is the
  integration base.
- The orchestrate MCP server is available (its tools are used below).
- Branch protection does not block merges into `orchestrate/umbrella-*` or
  `orchestrate/slice-*` branches — the auto-merge needs them open.

The target project should also have committed `.orchestrate/commands.json` and
`.orchestrate/routing.json` (see the plugin's `templates/`). Without
`commands.json` the capability tools return `not-configured`, which is
tolerated. Without `routing.json` the `resolve_routing` tool errors and the run
falls back to the `-standard` variant of every role with no model override.

## 1. Start or resume the run

On startup, check for `.orchestrate/run-state.json` (its schema is in
`references/run-state.md`).

- **It exists and `status` is `in-progress`** — resume. Load it; keep its
  `runId`, `umbrellaBranch`, `waves`, and `slices`. Every slice in a terminal
  state (`passed`, `failed`, `skipped`) is left untouched — completed work is
  never redone. Every slice still `in-progress` was interrupted before
  finishing: discard its partial artifacts so it re-processes cleanly — if it
  has a `worktreePath`, call `remove_worktree` (`force: true`); delete its
  `sliceBranch` if it exists (locally, and on the remote if it was pushed) —
  then coerce that slice back to `pending`. Skip to section 2.
- **It is absent, or `status` is `completed`** — start a fresh run below.

### Fresh run

1. Resolve the run context:
   - Repository root: `git rev-parse --show-toplevel`.
   - Fetch so branch operations use current refs: `git fetch origin`.
   - Confirm the integration base: `git rev-parse --verify origin/development`.
   - Generate a `runId` from the current timestamp including seconds, e.g.
     `20260521-015143`.
2. Read the whole backlog — every open issue with the `ready-for-agent` label.
   Always use `--json`; plain `gh issue view` can fail on the projectCards
   deprecation:

   ```
   gh issue list --label ready-for-agent --state open --json number,title --limit 200
   gh issue view <N> --json number,title,body,labels,state   # for each issue
   ```

   If the backlog is empty, report "no ready-for-agent issues" and stop — a
   clean no-op.
3. For each issue, parse the **Blocked by** section of its body into a list of
   blocker issue numbers (the `- #NNN` lines), and assess its **complexity
   tier** — `trivial` (a small, localized change), `standard` (an ordinary
   feature or fix), or `complex` (broad, cross-cutting, or high-risk work).
   Base the tier on the issue's scope, the number of files it likely touches,
   and its risk. The tier drives routing in section 3.
4. Call the `plan_waves` MCP tool with one entry per issue
   (`{ id: "<number>", blockedBy: ["<number>", ...] }`). If it returns
   `status: "error"` with `errorCode: "CYCLE_DETECTED"`, report the cycle and
   stop — the backlog cannot be ordered.
5. Create the umbrella branch from the fetched integration base and push it so
   slice pull requests can target it:

   ```
   git branch orchestrate/umbrella-<runId> origin/development
   git push -u origin orchestrate/umbrella-<runId>
   ```

6. Write the initial `.orchestrate/run-state.json` with **every field the
   schema declares** (see `references/run-state.md`):
   - Top level: `runId`, `status: "in-progress"`, `umbrellaBranch`,
     `integrationBase: "development"`, `startedAt` and `updatedAt` (current UTC
     time), the `waves` from `plan_waves`, `completedWaves: 0`,
     `finalPullRequest: null`.
   - One `slices` entry per issue: `issue`, `title`, `wave` (its index in
     `waves`), `tier`, `blockedBy`, `state: "pending"`, `sliceBranch:
     "orchestrate/slice-<N>"`, `worktreePath: null`, `pullRequest: null`,
     `failureReason: null`, and `updatedAt`.

## 2. The wave loop

Process waves in order, starting at index `completedWaves`. For each wave:

1. **Select the processable slices.** A slice in this wave is processable when
   its state is `pending` and every id in its `blockedBy` that belongs to the
   backlog reached `passed`. If any such blocker is `failed` or `skipped`, mark
   this slice `skipped` with a `failureReason` naming the blocker, checkpoint,
   and do not process it.
2. **Process the slices.** Run section 3 for every processable slice. Slices in
   a wave are independent, so parallelize: when several slices are at the same
   subagent stage (investigation, implementation, review), spawn those
   subagents by issuing all the Agent tool calls **in a single message**. Each
   slice has its own worktree, so they never collide.
3. **Integrate sequentially.** The commit, pull-request, and merge steps
   (section 3, steps 6–9) run **one slice at a time** — merges into the
   umbrella branch must not race each other.
4. **Checkpoint the wave.** Set `completedWaves` to this wave's index + 1 and
   write `run-state.json`.

When the last wave is done, open the **final integration pull request** — one
pull request from the umbrella branch into `development`, left **unmerged** for
a developer to review and merge:

```
gh pr create --base development --head orchestrate/umbrella-<runId> \
  --title "orchestrate run <runId>" \
  --body "<summary of the run — slices passed, failed, and skipped>"
```

Record its URL as `finalPullRequest` in `run-state.json`, set
`status: "completed"`, checkpoint, and report to the user: the umbrella branch,
the final pull request URL, and — per slice — its final state and pull request.

## 3. Processing one slice

These are the per-slice steps the wave loop invokes. Update the slice's entry in
`run-state.json` and write the file at every state change.

1. **Create the worktree.** Set the slice `state` to `in-progress`, write its
   `sliceBranch` (`orchestrate/slice-<N>`) and the `worktreePath` you will use
   into the slice entry, and checkpoint — so an interruption here is resumable.
   Use the `create_worktree` MCP tool: `baseRef` = `orchestrate/umbrella-<runId>`,
   `branch` = `orchestrate/slice-<N>`, `worktreePath` = an absolute path outside
   the repo (e.g. `<repo-parent>/.orchestrate-worktrees/<runId>/slice-<N>`),
   `repoPath` = the repository root. On `status: "error"`, the slice has
   **FAILED** (see *Failure handling*).
2. **Resolve routing.** Call the `resolve_routing` MCP tool with the slice's
   `tier` and the repository root as `repoPath`. It returns, per role, the
   `model` and effort variant to spawn:
   - `status: "ok"` — use the returned `routing`.
   - `errorCode: "CONFIG_NOT_FOUND"` — no routing is configured; fall back to
     the `-standard` variant of every role with no `model` override (each
     subagent's frontmatter model applies), and skip the investigator.
   - `errorCode: "CONFIG_INVALID"` — the routing config is broken; the slice
     has **FAILED**.
3. **Run the investigator (higher tiers only).** If `routing.investigator` is
   non-null, spawn the `investigator-<effort>` subagent — `<effort>` and the
   Agent `model` override both come from `routing.investigator`. Its prompt
   carries the issue and the repository root; keep its returned brief for the
   implementer. If `routing.investigator` is null, skip this step.
4. **Run the implementer.** Spawn the `implementer-<effort>` subagent —
   `<effort>` and the `model` override from `routing.implementer`. Its prompt
   must carry the issue number/title/body, the worktree path (every change goes
   there), the investigator's brief if one was produced, an instruction to
   verify with the capability tools using the worktree path as `repoPath`, and
   a reminder not to commit, push, or run git. If it returns `blocked`, the
   slice has **FAILED**.
5. **Run the reviewer.** Spawn the `reviewer-<effort>` subagent — `<effort>`
   and the `model` override from `routing.reviewer` — in the same worktree. Its
   prompt must carry the issue, the worktree path, the implementer's
   `filesChanged` list and `notes`, and the investigator's brief if one was
   produced. If it returns `failed`, the slice has **FAILED**.
6. **Commit and push.** Stage only the files the subagents reported changing —
   the union of the implementer's and reviewer's `filesChanged` lists. Never
   `git add -A`: the capability tools leave untracked build artifacts in the
   worktree.

   ```
   git -C <worktree-path> add -- <file> <file> ...
   ```

   If `git -C <worktree-path> diff --cached --quiet` exits 0, nothing changed —
   the slice has **FAILED**. Otherwise commit and push (two `-m` flags keep a
   newline out of the shell argument):

   ```
   git -C <worktree-path> commit -m "<type>(<scope>): <issue title>" -m "Closes #<N>"
   git -C <worktree-path> push -u origin orchestrate/slice-<N>
   ```

7. **Open the slice pull request.**

   ```
   gh pr create --base orchestrate/umbrella-<runId> --head orchestrate/slice-<N> \
     --title "<issue title>" --body "Implements #<N>. <summary>"
   ```

   Record the pull request URL in the slice's `run-state.json` entry.
8. **Merge the slice.** GitHub computes mergeability asynchronously — check it
   before merging:

   ```
   gh pr view <pr-number> --json mergeable,mergeStateStatus
   ```

   - `UNKNOWN` — GitHub is still computing; wait a moment and re-check, up to a
     few attempts. If it never resolves, the slice has **FAILED**.
   - `MERGEABLE` — merge it, squashing to one commit per slice on the umbrella
     branch: `gh pr merge <pr-number> --squash`.
   - `CONFLICTING` — resolve the conflict once, per step 8a. Do not FAIL a
     slice on a conflict without attempting resolution.

8a. **Resolve a merge conflict (once).** Attempt resolution exactly once — a
   conflict the resolver cannot fix is a FAILED slice.

   1. In the slice's worktree, fetch and merge the current umbrella branch so
      the conflict markers surface in the files:

      ```
      git -C <worktree-path> fetch origin orchestrate/umbrella-<runId>
      git -C <worktree-path> merge origin/orchestrate/umbrella-<runId>
      ```

   2. List the conflicted files:
      `git -C <worktree-path> diff --name-only --diff-filter=U`.
   3. Spawn the `conflict-resolver-<effort>` subagent — `<effort>` and the
      `model` override from `routing.conflict-resolver`. Its prompt must carry
      the issue, the worktree path, and the list of conflicted files.
   4. If it returns `failed`, abort and the slice has **FAILED**:
      `git -C <worktree-path> merge --abort`.
   5. If it returns `resolved`, stage the resolved files and **confirm no
      conflict markers remain** — inspect `git -C <worktree-path> diff --cached`
      for leftover `<<<<<<<` or `>>>>>>>` lines. If any remain, the resolution
      is incomplete: `git -C <worktree-path> merge --abort` and the slice has
      **FAILED**. Otherwise complete the merge, push, and merge the pull
      request — if `gh pr merge` fails (the resolution did not make the pull
      request mergeable), the slice has **FAILED**; the one attempt is spent.

      ```
      git -C <worktree-path> add -- <resolved file> ...
      git -C <worktree-path> commit --no-edit
      git -C <worktree-path> push
      gh pr merge <pr-number> --squash
      ```

9. **Finish the slice.** Set the slice `state` to `passed`, then remove its
   worktree with the `remove_worktree` MCP tool (`worktreePath`, `repoPath`,
   `force: true` — the worktree may hold untracked build artifacts).

## Failure handling

A slice **FAILS** when `create_worktree` errors, the implementer returns
`blocked`, the reviewer returns `failed`, the staged changeset is empty, or a
merge conflict the `conflict-resolver` cannot fix. On a FAILED slice:

- Set its `state` to `failed` with a `failureReason`, and checkpoint.
- Do **not** merge it. **Preserve its worktree** — leave it on disk for a
  developer to inspect. Do not call `remove_worktree`.
- **Continue the wave.** A failed slice never cancels the other slices in its
  wave — they are independent and proceed normally.

A slice is **SKIPPED** (state `skipped`) when one of its blockers did not reach
`passed` — it cannot be built on a missing dependency. Record the blocker in
`failureReason` and checkpoint.

Other stop conditions: an empty backlog is a clean no-op; a `plan_waves`
`CYCLE_DETECTED` result stops the run before any branch is created.

## Checkpointing

Write `.orchestrate/run-state.json` after every slice state change and after
every wave. Every write refreshes the top-level `updatedAt`, and a slice's own
`updatedAt` whenever its entry changes, so an artifact rendered from the file
has accurate timestamps. The checkpoint is what makes a run resumable: an
interrupted run, re-invoked, skips every terminal-state slice and continues.
