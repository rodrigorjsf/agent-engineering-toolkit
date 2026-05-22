---
name: orchestrate
description: Implement a backlog of ready-for-agent GitHub issues end to end — order them into dependency waves, run implementer and reviewer subagents in isolated worktrees, merge slice pull requests into an umbrella branch, and checkpoint progress so an interrupted run resumes. Use when the user wants to autonomously orchestrate agent-driven implementation of tracked issues, or invokes /orchestrate — including /orchestrate clean to remove the footprint of concluded runs.
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
from the issue's complexity tier (section 3, step 2). Each role is spawned by
its **namespaced** subagent type — `orchestrate:investigator-<effort>`,
`orchestrate:implementer-<effort>`, `orchestrate:reviewer-<effort>`, and
`orchestrate:conflict-resolver-<effort>`, where `<effort>` is `standard` or
`deep`. The `orchestrate:` prefix is required: the plugin registers its bundled
subagents under that namespace, so a bare, un-namespaced name fails to resolve.
All four subagents have **no Bash and no git access** — they are sandboxed to
one worktree (the investigator is read-only). Only the orchestrator touches
branches, remotes, and the tracker.

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
tolerated. If the project's capability commands need installed dependencies,
`commands.json` must also set an `install` command — `create_worktree` runs it
in every fresh worktree, which checks out only tracked files and so has no
dependency directory of its own. Without `routing.json` the `resolve_routing`
tool errors and the run falls back to the `-standard` variant of every role
with no model override.
An optional `.orchestrate/handoff.json` tunes the context-watchdog threshold
and the successor launcher; without it, built-in defaults apply (see
`references/context-handoff.md`). Installing the `ast-grep` CLI is optional —
it enables the investigator and reviewer subagents' structural code search,
which otherwise falls back to text search.

## 0. Modes — run vs. clean

This skill has two modes, selected by the invocation argument.

- **No `clean` argument** (`/orchestrate` or `/orchestrate <PRD#>`) — the normal
  orchestration run. Proceed through sections 1–4 below.
- **The `clean` argument** (`/orchestrate clean`, optionally
  `/orchestrate clean --force`) — the **`/orchestrate-clean` mode**. Run **only**
  the cleanup path described here, then **stop**. Do **not** discover or start a
  run, do not read the backlog, do not create branches.

### `/orchestrate-clean` mode

`/orchestrate clean` removes the leftover footprint of concluded runs on demand
— the same cleanup the start-of-run sweep (section 1) performs automatically.
When invoked with the `clean` argument:

1. Resolve the repository root: `git rev-parse --show-toplevel`.
2. Run the **cleanup sweep** exactly as section 1 describes it below — enumerate
   `.orchestrate/runs/*/run-state.json`, resolve each run's merge verdict with
   `gh pr view`, and call the `clean_runs` MCP tool with the verdict map. If the
   `--force` argument was passed, set `force: true` in the `clean_runs` call.
3. Report the `clean_runs` result to the user — per run, its `action`
   (`removed`, `preserved`, or `skipped`), its `reason`, and the removed or
   preserved worktrees and branches — then **stop**. `/orchestrate clean` never
   starts an orchestration run.

## 1. Start or resume the run

On startup, set a completion goal with `/goal` so the session keeps working
turn after turn and does not yield control before the run is done. Phrase it
as a checkable end-state, e.g. `/goal the orchestrate run has opened its final
integration pull request, or a successor session has been launched`. An
autonomous run must not stop mid-wave.

### Start-of-run cleanup sweep

Before discovering or starting a run, sweep away the footprint of concluded
runs so the `.orchestrate/runs/` directory does not accumulate. This same sweep
is what `/orchestrate clean` (section 0) runs on demand.

1. Enumerate every `.orchestrate/runs/*/run-state.json`. For each run whose
   `status` is `completed` and whose `finalPullRequest` is **non-null**, resolve
   the run's **merge verdict** — the gate is strictly the final pull request
   having **merged** into the integration base, not merely being open:

   ```
   gh pr view <finalPullRequest> --json state,mergedAt
   ```

   - `state` is `MERGED` and `mergedAt` is non-null → verdict `merged`.
   - `state` is `OPEN` → verdict `open`.
   - `state` is `CLOSED` and `mergedAt` is null → verdict `closed-unmerged`.
   - The command errors or the result cannot be parsed → verdict `unknown`.

   A run whose `status` is **not** `completed`, or whose `finalPullRequest` is
   `null`, is **never** swept — it has not concluded. **Never** include the
   current run, or any run still `in-progress`, in the verdict map: omitting a
   run from the map tells `clean_runs` to leave it strictly intact.
2. Call the **`clean_runs` MCP tool** with the repository root as `repoPath` and
   the per-run `verdicts` map you built. The tool removes each `merged` run's
   worktrees, its umbrella and slice branches (local and remote), and its run
   directory; it leaves every other run intact and reports it. A `failed`-slice
   worktree is preserved (and that run's directory kept) so a developer can
   still inspect it. `clean_runs` is git + filesystem only — it never shells
   `gh`; the merge verdict you resolved above is the GitHub half of the gate.
3. The sweep is best-effort and idempotent — an already-absent branch or
   worktree is success, not error. Note the result, then continue to discover
   or start the run; a cleanup hiccup never blocks the run itself.

Every run keeps its ephemeral state in a **per-run directory**,
`.orchestrate/runs/<runId>/`, holding that run's `run-state.json`,
`context-flag.json`, and rendered HTML artifacts. The committed config files
(`commands.json`, `routing.json`, `handoff.json`) stay flat at the
`.orchestrate/` top level. The run directory's schema and rationale are in
`references/run-state.md`.

**Discover the active run.** Scan `.orchestrate/runs/*/run-state.json` for a run
whose `status` is `in-progress`.

- **A run directory with an `in-progress` `run-state.json` exists** — resume it.
  Its `runId` is the directory name. First clear that run's stale handoff flag:
  if `.orchestrate/runs/<runId>/context-flag.json` exists, delete it — it is the
  predecessor's handoff trigger, now consumed, and leaving it would make this
  session hand off immediately (section 2, step 4). Then load the whole
  `run-state.json`, preserving every top-level field — `runId`,
  `umbrellaBranch`, `parentIssue`, `waves`, `completedWaves`,
  `finalPullRequest`, and `slices`. Every slice in a terminal state (`passed`,
  `failed`, `skipped`) is left untouched — completed work is never redone. Every
  slice still `in-progress` was interrupted before finishing: discard its
  partial artifacts so it re-processes cleanly — if it has a `worktreePath`,
  call `remove_worktree` (`force: true`); delete its `sliceBranch` if it exists
  (locally, and on the remote if it was pushed) — deleting the remote branch
  also auto-closes any orphaned slice pull request GitHub opened for it, so
  re-processing produces a clean branch and PR with no manual PR cleanup needed
  — then coerce that slice back to `pending`. Skip to section 2.
- **No run directory holds an `in-progress` run** — start a fresh run below.

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
   blocker issue numbers (the `- #NNN` lines), and the **Parent** section into
   a single parent issue number (`PRD #NNN` line) or `null`. Then assess its
   **complexity tier** — `trivial` (a small, localized change), `standard` (an
   ordinary feature or fix), or `complex` (broad, cross-cutting, or high-risk
   work). Base the tier on the issue's scope, the number of files it likely
   touches, and its risk. The tier drives routing in section 3.

   Once every issue is parsed, call the **`partition_backlog` MCP tool** to
   split the backlog into `slices` and `parentIssue`:

   - Pass the full backlog as the `issues` array to `partition_backlog`. It
     returns `{ slices, parentIssue }`.
   - `slices` is the subset of issues to process as implementation work — any
     issue detected as the parent PRD is automatically excluded.
   - `parentIssue` is the detected parent PRD, or `null`. The parent PRD is
     only the progress-comment target (section 2 step 6) — it is **never**
     enrolled as a slice.
   - Detection uses two signals in order: (1) a `Parent` field reference — if
     any issue names another backlog issue as its parent, that issue is the
     parent PRD; (2) the `PRD:` title heuristic — if no explicit parent
     reference exists, any issue whose title starts with `PRD:` (case-
     insensitive) is treated as the parent PRD. This ensures a decomposed PRD
     is never accidentally implemented as a slice.

   To scope a run to one parent PRD's children (e.g. `/orchestrate <PRD#>`),
   call the **`filter_to_one_parent_prd` MCP tool** first — pass the full
   backlog and the `prdNumber`; it returns only the issues whose `parent` field
   equals `prdNumber`, which you then pass to `partition_backlog`.

4. Call the `plan_waves` MCP tool with one entry per **slice** (not the full
   backlog — the parent PRD is excluded):
   (`{ id: "<number>", blockedBy: ["<number>", ...] }`). If it returns
   `status: "error"` with `errorCode: "CYCLE_DETECTED"`, report the cycle and
   stop — the backlog cannot be ordered.
5. Create the umbrella branch from the fetched integration base and push it so
   slice pull requests can target it:

   ```
   git branch orchestrate/umbrella-<runId> origin/development
   git push -u origin orchestrate/umbrella-<runId>
   ```

6. Create the run directory `.orchestrate/runs/<runId>/`, then write the initial
   `run-state.json` into it as `.orchestrate/runs/<runId>/run-state.json` with
   **every field the schema declares** (see `references/run-state.md`):
   - Top level: `runId`, `status: "in-progress"`, `umbrellaBranch`,
     `integrationBase: "development"`, `parentIssue` (the parent PRD number, or
     null), `startedAt` and `updatedAt` (current UTC time), the `waves` from
     `plan_waves`, `completedWaves: 0`, `finalPullRequest: null`.
   - One `slices` entry per issue: `issue`, `title`, `wave` (its index in
     `waves`), `tier`, `blockedBy`, `state: "pending"`, `sliceBranch:
     "orchestrate/slice-<N>"`, `worktreePath: null`, `pullRequest: null`,
     `failureReason: null`, and `updatedAt`.

## 2. The wave loop

Process waves in order, starting at index `completedWaves`. For each wave:

1. **Refresh the umbrella base.** Before creating this wave's worktrees,
   fast-forward the local umbrella ref to its remote counterpart — every prior
   wave's slices were squash-merged into `orchestrate/umbrella-<runId>` on the
   remote, and this wave's worktrees must branch from that integrated state:

   ```
   git fetch origin orchestrate/umbrella-<runId>:orchestrate/umbrella-<runId>
   ```

   The `<src>:<dst>` refspec updates the local branch ref directly without a
   checkout, and **fails loudly** (non-zero exit) when the update is not a
   fast-forward — a non-fast-forward means the umbrella history diverged, and
   the run must stop rather than branch a wave from a wrong base. This step is
   what guarantees a dependent slice is built on the slices it is blocked by;
   it does **not** rely on `create_worktree`'s internal fetch, which may be
   skipped or may fail. It runs on every wave — the first wave's fetch is a
   no-op fast-forward — and on a resumed run, since the wave loop is re-entered
   from this step.
2. **Select the processable slices.** A slice in this wave is processable when
   its state is `pending` and every id in its `blockedBy` that belongs to the
   backlog reached `passed`. If any such blocker is `failed` or `skipped`, mark
   this slice `skipped` with a `failureReason` naming the blocker, checkpoint,
   and do not process it.
3. **Process the slices.** Run section 3 for every processable slice. Slices in
   a wave are independent, so parallelize: when several slices are at the same
   subagent stage (investigation, implementation, review), spawn those
   subagents by issuing all the Agent tool calls **in a single message**. Each
   slice has its own worktree, so they never collide.
4. **Integrate sequentially.** The commit, pull-request, and merge steps
   (section 3, steps 6–9) run **one slice at a time** — merges into the
   umbrella branch must not race each other. After each slice finishes
   integrating, check for `.orchestrate/runs/<runId>/context-flag.json`: if it
   exists, the context-watchdog has signalled that this session's context is
   filling. Do not start the next slice — finish writing `run-state.json` for
   the slice just integrated, then go to section 4 (Context handoff).
5. **Checkpoint the wave.** Set `completedWaves` to this wave's index + 1 and
   write `run-state.json`.
6. **Report wave progress to the PRD.** If `parentIssue` is set, post a comment
   on it summarizing this wave's outcomes — which child issues passed, failed,
   or were skipped: `gh issue comment <parentIssue> --body "..."`.

When the last wave is done, open the **final integration pull request** — one
pull request from the umbrella branch into `development`, left **unmerged** for
a developer to review and merge:

```
gh pr create --base development --head orchestrate/umbrella-<runId> \
  --title "orchestrate run <runId>" \
  --body "<summary of the run — slices passed, failed, and skipped>"
```

Record its URL as `finalPullRequest` in `run-state.json`, set
`status: "completed"`, and checkpoint. Then render the run's HTML artifacts
from the final checkpoint — call the `render_dashboard`, `render_graph`, and
`render_report` MCP tools, each with the repository root as `repoPath` and the
run's `runId`; each tool reads `.orchestrate/runs/<runId>/run-state.json` and
writes its artifact into that same run directory — so a developer has a visual
summary of the run. If `parentIssue` is set, post a final summary comment on
it. Report to the user: the umbrella branch, the final pull request URL, the
paths of the three rendered artifacts, and — per slice — its final state and
pull request.

## 3. Processing one slice

These are the per-slice steps the wave loop invokes. Update the slice's entry in
`run-state.json` and write the file at every state change.

**The result-envelope contract.** Every subagent ends its turn with a **result
envelope** — a fenced ` ```orchestrate-envelope ` JSON block conforming to a
defined schema. The orchestrator determines a subagent's status and
changed-file set **only** from this validated envelope; it never reads the
subagent's prose. After each subagent (investigator, implementer, reviewer,
conflict-resolver) returns, call the `validate_envelope` MCP tool with the
subagent's verbatim returned text and its `role`:

- `status: "valid"` — use the parsed `envelope` as the single source of the
  subagent's outcome and `filesChanged`.
- `status: "invalid"` (truncated, malformed, or off-schema) or
  `status: "missing"` (no envelope emitted) — the subagent's result cannot be
  trusted. The slice has **FAILED** (see *Failure handling*). A truncated
  envelope is never silently accepted.

1. **Create the worktree.** Set the slice `state` to `in-progress`, write its
   `sliceBranch` (`orchestrate/slice-<N>`) and the `worktreePath` you will use
   into the slice entry, and checkpoint — so an interruption here is resumable.
   Use the `create_worktree` MCP tool: `baseRef` = `orchestrate/umbrella-<runId>`,
   `branch` = `orchestrate/slice-<N>`, `worktreePath` = an absolute path outside
   the repo (e.g. `<repo-parent>/.orchestrate-worktrees/<runId>/slice-<N>`),
   `repoPath` = the repository root. `create_worktree` also runs the configured
   `install` command in the new worktree before returning, so the capability
   tools have the dependencies they need. On `status: "error"` — including an
   `install` that failed — the slice has **FAILED** (see *Failure handling*).
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
   non-null, spawn the `orchestrate:investigator-<effort>` subagent — `<effort>`
   and the Agent `model` override both come from `routing.investigator`. Its
   prompt carries the issue and the repository root. Validate its returned text
   with `validate_envelope` (role `investigator`); a `valid` envelope is the
   research brief to keep for the implementer. An `invalid` or `missing`
   envelope is a failed investigation pass — the slice has **FAILED** (the
   investigator is read-only, so no worktree fallback applies). If
   `routing.investigator` is null, skip this step.
4. **Run the implementer.** Spawn the `orchestrate:implementer-<effort>`
   subagent — `<effort>` and the `model` override from `routing.implementer`. Its
   prompt must carry the issue number/title/body, the worktree path (every
   change goes there), the investigator's brief if one was produced, an
   instruction to verify with the capability tools using the worktree path as
   `repoPath`, and a reminder not to commit, push, or run git. Validate its
   returned text with `validate_envelope` (role `implementer`). On a `valid`
   envelope, an envelope `status` of `blocked` means the slice has **FAILED**;
   `completed` proceeds. An `invalid` or `missing` envelope also means the slice
   has **FAILED**.
5. **Run the reviewer.** Spawn the `orchestrate:reviewer-<effort>` subagent —
   `<effort>` and the `model` override from `routing.reviewer` — in the same
   worktree. Its prompt must carry the issue, the worktree path, the implementer
   envelope's `filesChanged` and `notes`, and the investigator's brief if one
   was produced. Validate its returned text with `validate_envelope` (role
   `reviewer`). On a `valid` envelope, an envelope `status` of `failed` means
   the slice has **FAILED**; `passed` proceeds. An `invalid` or `missing`
   envelope also means the slice has **FAILED**.
6. **Commit and push.** Stage only the files the subagents reported changing —
   the union of the `filesChanged` arrays from the validated implementer and
   reviewer envelopes. Never `git add -A`: the capability tools leave untracked
   build artifacts in the worktree.

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
   3. If the conflicted-file list is **EMPTY**, the umbrella merge applied
      cleanly with no conflicts to resolve — do not spawn the
      conflict-resolver. A clean textual merge is not proof of a correct one:
      Git auto-merges non-overlapping hunks that may still be semantically
      broken. Re-verify the merged worktree before integrating — run the
      `run_tests`, `run_typecheck`, `run_build`, and `run_lint` capability
      tools with the worktree path as `repoPath`. If any reports failure, the
      slice has **FAILED**. If all pass, the merge commit already exists —
      push and merge the slice PR: `git -C <worktree-path> push` then
      `gh pr merge <pr-number> --squash`.
   4. Spawn the `orchestrate:conflict-resolver-<effort>` subagent — `<effort>`
      and the `model` override from `routing.conflict-resolver`. Its prompt
      must carry the issue, the worktree path, and the list of conflicted
      files.
   5. Validate its returned text with `validate_envelope` (role
      `conflict-resolver`). An `invalid` or `missing` envelope, or a `valid`
      envelope with `status: "failed"`, means resolution failed: abort and the
      slice has **FAILED** — `git -C <worktree-path> merge --abort`.
   6. On a `valid` envelope with `status: "resolved"`, stage the resolved files
      and **confirm no conflict markers remain** — inspect
      `git -C <worktree-path> diff --cached` for leftover `<<<<<<<`, `=======`,
      or `>>>>>>>` lines. If any remain, the resolution is incomplete:
      `git -C <worktree-path> merge --abort` and the slice has **FAILED**.
      Otherwise complete the merge, push, and merge the pull request — if
      `gh pr merge` fails (the resolution did not make the pull request
      mergeable), the slice has **FAILED**; the one attempt is spent.

      ```
      git -C <worktree-path> add -- <resolved file> ...
      git -C <worktree-path> commit --no-edit
      git -C <worktree-path> push
      gh pr merge <pr-number> --squash
      ```

9. **Finish the slice.** Set the slice `state` to `passed` and transition the
   issue's tracker label — it is done and awaiting human review:
   `gh issue edit <N> --remove-label ready-for-agent --add-label ready-for-human`.
   Then remove its worktree with the `remove_worktree` MCP tool (`worktreePath`,
   `repoPath`, `force: true` — the worktree may hold untracked build artifacts).

## 4. Context handoff

A long run can fill this session's context before every wave is done. The
`context-watchdog` hook bundled with this plugin watches token usage and writes
`.orchestrate/runs/<runId>/context-flag.json` past a configurable threshold.
When the wave loop (section 2, step 4) sees that flag, hand the run off to a
fresh Claude Code session instead of continuing — the successor resumes from
the `run-state.json` checkpoint exactly as section 1 describes. See
`references/context-handoff.md` for the full mechanism.

To hand off:

1. Make sure `run-state.json` is checkpointed and its `status` is still
   `in-progress` — the successor resumes from it. Do **not** delete
   `.orchestrate/runs/<runId>/context-flag.json`; the successor deletes it on
   startup once it has consumed it.
2. Call the `spawn_successor` MCP tool with the repository root as `repoPath`.
   It launches a new interactive Claude Code session — terminal and `claude`
   flags come from `.orchestrate/handoff.json`, defaults otherwise — that
   re-invokes `/orchestrate` with Remote Control active.
   - `status: "ok"` — the successor launched. Report to the user which terminal
     opened (`terminal`) and that the run continues there, then **stop** — do
     not process any further waves in this session.
   - `status: "error"` — the launch failed. Do not retry blindly. Report the
     `errorMessage` (and the `attempts`, if any), tell the user the run is
     checkpointed and resumable by running `/orchestrate` in a new session,
     then stop.

## Failure handling

A slice **FAILS** when `create_worktree` errors, a subagent's result envelope
is invalid or missing (`validate_envelope` returns `invalid` or `missing`), a
validated implementer envelope has `status: "blocked"`, a validated reviewer
envelope has `status: "failed"`, the staged changeset is empty, or a merge
conflict the `conflict-resolver` cannot fix. The orchestrator decides FAILURE
**only** from the validated envelope and tool results — never from a subagent's
prose. An invalid or missing envelope is always a FAILED slice; it is never
treated as success.

On a FAILED slice:

- Set its `state` to `failed` with a `failureReason`, checkpoint, and
  transition the issue's tracker label:
  `gh issue edit <N> --remove-label ready-for-agent --add-label needs-triage`.
- Do **not** merge it. **Preserve its worktree** — leave it on disk for a
  developer to inspect. Do not call `remove_worktree`.
- **Recover the changed-file set when the envelope was the failure cause.** If
  the slice failed because a worker subagent's envelope was `invalid` or
  `missing` — so its `filesChanged` array is unavailable or untrustworthy — call
  the `recover_changed_files` MCP tool with the slice's `worktreePath`. It
  inspects the preserved worktree directly with `git status` and returns the
  full changed-file set (build artifacts included), so the `failureReason` can
  record what the interrupted subagent had touched for the developer's
  inspection. This fallback applies to the implementer, reviewer, and
  conflict-resolver only — the investigator is read-only and leaves no worktree
  changes to recover.
- **Continue the wave.** A failed slice never cancels the other slices in its
  wave — they are independent and proceed normally.

A slice is **SKIPPED** (state `skipped`) when one of its blockers did not reach
`passed` — it cannot be built on a missing dependency. Record the blocker in
`failureReason` and checkpoint. Its tracker label stays `ready-for-agent` so a
later run can retry it once the blocker is resolved.

Other stop conditions: an empty backlog is a clean no-op; a `plan_waves`
`CYCLE_DETECTED` result stops the run before any branch is created.

## Tracker updates

The orchestrator is the **single writer** of GitHub tracker state — the
subagents never touch issues, labels, or pull requests. Tracker writes happen
only at a slice's terminal state (see section 3 step 9 for the pass label
command and *Failure handling* for the failure label command) and as PRD
progress/summary comments (see section 2 steps 6 and the final-PR paragraph).
The parent PRD issue receives a progress comment after each wave and a final
summary when the run completes.

The orchestrator does not close issues. The `Closes #N` trailers on the slice
commits close them when a developer merges the final umbrella pull request into
`development`.

## Checkpointing

Write the run's `run-state.json` — at `.orchestrate/runs/<runId>/run-state.json`
— after every slice state change and after every wave. Every write refreshes
the top-level `updatedAt`, and a slice's own `updatedAt` whenever its entry
changes, so an artifact rendered from the file has accurate timestamps. The
checkpoint is what makes a run resumable: an interrupted run, re-invoked, skips
every terminal-state slice and continues.
