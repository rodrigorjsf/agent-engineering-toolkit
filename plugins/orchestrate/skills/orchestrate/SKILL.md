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

IDE or language-server diagnostics about files under a worktree path —
unresolved imports, missing-module errors, or stale type errors from a checkout
that lacks generated or installed artifacts — are **non-authoritative**. The
orchestrate capability tools (`run_typecheck`, `run_build`, `run_tests`,
`run_lint`) are the only source of truth for whether a slice builds and its
tests pass; trust their result, never an editor's inline diagnostic.

## Prerequisites

Check these before starting. If one is missing, report it and stop.

- `gh` CLI is installed and authenticated (`gh auth status`).
- The repository's `origin` remote has a `development` branch — it is the
  integration base.
- The orchestrate MCP server is available (its tools are used below).
- Branch protection does not block merges into `orchestrate/umbrella-*` or
  `orchestrate/slice-*` branches — the auto-merge needs them open.

The target project's `.orchestrate/` configuration — `commands.json`,
`routing.json`, and the optional `handoff.json` — may be **bootstrapped on the
first run** by the `bootstrap_config` MCP tool (section 1, Fresh run, step 1),
or committed ahead of time from the plugin's `templates/`. Without
`commands.json` the capability tools return `not-configured`, which is
tolerated. When the project's capability commands need installed dependencies,
`commands.json` must also set an `install` command — `create_worktree` runs it
in every fresh worktree, which checks out only tracked files and so has no
dependency directory of its own; the bootstrapper sets `install` automatically
for an npm project. Without `routing.json` the `resolve_routing` tool errors
and the run falls back to the `-standard` variant of every role with no model
override.
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

   As defense-in-depth, `clean_runs` independently enforces the same
   `status === "completed" && finalPullRequest != null` gate by re-reading each
   run's own `run-state.json` (per ADR-0012), so even a misbuilt verdict map can
   never make it touch an unconcluded or `in-progress` run — such a run is
   skipped with reason `run-not-completed` or `final-pr-missing`.

   **Collect the close-set before sweeping.** For every run whose verdict
   resolves to `merged`, you already hold its `run-state.json` open (you just
   read `finalPullRequest` from it). While it is open, **collect the `issue`
   number of every slice whose `state` is `"passed"`** into a per-run
   close-set. Do this **now**, before step 2 — `clean_runs` deletes the merged
   run's directory and its `run-state.json`, the only source of those issue
   numbers, so capturing them after the sweep is impossible.
2. Call the **`clean_runs` MCP tool** with the repository root as `repoPath` and
   the per-run `verdicts` map you built. The tool removes each `merged` run's
   worktrees, its umbrella and slice branches (local and remote), and its run
   directory; it leaves every other run intact and reports it. A `failed`-slice
   worktree is preserved (and that run's directory kept) so a developer can
   still inspect it. `clean_runs` is git + filesystem only — it never shells
   `gh`; the merge verdict you resolved above is the GitHub half of the gate.
3. **Close the passed-slice issues (backstop).** After `clean_runs` returns,
   for every issue in the close-set you collected in step 1, run
   `gh issue close <N>`. This is **orchestrator** work — the `gh issue close`
   lives here in the orchestrator procedure, never inside `clean_runs` (the
   no-`gh` invariant on the MCP tool is preserved). The close is idempotent: on
   a default-branch integration base the final umbrella PR's `Closes #<N>`
   keyword already closed the issue, and `gh issue close` on an
   already-closed issue exits 0 — a no-op, not an error. This backstop is what
   closes the passed-slice issues when `development` is **not** the repository's
   default branch (where the `Closes` keywords are inert). It closes **only**
   passed slices; a failed or skipped slice has no entry in the close-set, so
   its issue stays open.
4. The sweep is best-effort and idempotent — an already-absent branch or
   worktree is success, not error. Note the result, then continue to discover
   or start the run; a cleanup hiccup never blocks the run itself.

Every run keeps its ephemeral state in a **per-run directory**,
`.orchestrate/runs/<runId>/`, holding that run's `run-state.json`,
`context-flag.json`, and rendered HTML artifacts. The committed config files
(`commands.json`, `routing.json`, `handoff.json`) stay flat at the
`.orchestrate/` top level. `routing.json` carries both per-tier subagent routing
and run-wide run policy (the optional `intraWaveConcurrency` knob — see section
2). The run directory's schema and rationale are in `references/run-state.md`.

**Read the invocation argument.** `/orchestrate` accepts an optional parent-PRD
issue number — `/orchestrate <PRD#>` scopes this run to that PRD's children
(the **run partition**); `/orchestrate` with no argument runs the whole backlog
as one partition, unchanged. The argument decides both the `runId` form and how
the run-discovery scan below matches:

- **`/orchestrate <PRD#>`** — a **partitioned run**. Its `runId` is
  `prd<N>-<timestamp>` (the invoked `<PRD#>` as `<N>`). It owns only that PRD's
  child issues.
- **`/orchestrate` with no argument** — a **whole-backlog run**. Its `runId` is
  `backlog-<timestamp>`. It owns the entire `ready-for-agent` backlog.

The `prd<N>-` / `backlog-` prefix is durable, persisted in the `runId`, and
self-documenting — it is the key the run-discovery scan parses to decide which
in-progress run a new invocation matches.

**Discover the active run.** Scan **every** `.orchestrate/runs/*/run-state.json`
whose `status` is `in-progress`. For each, parse the run's match key from its
`runId` directory name — the `prd<N>-` prefix names a partitioned run for PRD
`<N>`, the `backlog-` prefix names a whole-backlog run. Then match against the
current invocation:

- **`/orchestrate <PRD#>`** — collect every in-progress run whose `runId`
  starts `prd<N>-` for the invoked `<N>`.
- **`/orchestrate` with no argument** — collect every in-progress run whose
  `runId` starts `backlog-`.

A bare-timestamp `runId` (no `prd<N>-`/`backlog-` prefix — a legacy run from
before this scheme) matches neither and is invisible to the scan; the new
prefixes are the only match keys. Then act on the count of matches:

- **Zero matches** — no in-progress run for this invocation. Start a fresh run
  below.
- **Exactly one match** — resume it. Its `runId` is the directory name. First
  clear that run's stale handoff flag: if
  `.orchestrate/runs/<runId>/context-flag.json` exists, delete it — it is the
  predecessor's handoff trigger, now consumed, and leaving it would make this
  session hand off immediately (section 2, step 4). Then load the whole
  `run-state.json`, preserving every top-level field — `runId`,
  `umbrellaBranch`, `parentIssue`, `waves`, `completedWaves`,
  `finalPullRequest`, and `slices`. **Validate the loaded checkpoint before
  acting on it** — call the `validate_run_state` MCP tool against it; on
  `status: "invalid"` (e.g. a legacy array-shaped `slices`), **stop loudly**
  rather than resume from a malformed checkpoint. **Refresh the
  `driverSessionId` field** —
  this resuming session is a new Claude Code session with a *new* `session_id`,
  so overwrite `driverSessionId` with the current `$ORCHESTRATE_SESSION_ID`
  (or `null` if it is empty or unset — applying the same operator notice as the
  fresh-run step 6). Without this refresh the `context-watchdog` would keep
  matching the predecessor's stale identity and automatic context-handoff would
  be lost for the rest of the run. **Resume reloads only the matched run's
  partition and run directory** — the `slices` and `waves` already persisted in
  its `run-state.json` are the run's scope, fixed at fresh-run time. Do **not**
  re-fetch the backlog, do **not** re-call `filter_to_one_parent_prd` or
  `partition_backlog`: a resumed run never widens or re-derives its own scope.
  Every slice in a terminal state (`passed`, `failed`, `skipped`) is left
  untouched — completed work is never redone. Every slice still `in-progress`
  was interrupted before finishing; resume it **from its recorded `subState`**
  (section 3 writes this at every per-slice transition) rather than re-processing
  from scratch. **Preserve** its `worktreePath` and `sliceBranch`; reconstruct
  its changed-file set by calling `recover_changed_files` on the `worktreePath`;
  **re-validate** the resume point per the resume matrix below; then resume
  section 3 at the next uncompleted step, **without** re-spawning the subagents
  whose work the recorded `subState` already captures. An in-progress slice with
  **no `subState`** — a legacy checkpoint written before this scheme — instead
  uses the old discard path: if it has a `worktreePath`, call `remove_worktree`
  (`force: true`); delete its `sliceBranch` if it exists (locally, and on the
  remote if it was pushed) — deleting the remote branch also auto-closes any
  orphaned slice pull request GitHub opened for it; then coerce it back to
  `pending` (the same graceful degradation as an absent `driverSessionId`).
  Checkpoint the refreshed `run-state.json`, then skip to section 2.

  **Resume re-validate matrix** — per the recorded `subState`; the worktree is
  always preserved and the changed-file set always reconstructed via
  `recover_changed_files` (accurate under #236's `-uall` recovery):

  | Recorded `subState` | Skip these subagents | Re-validate (cheap) | Resume at |
  |---|---|---|---|
  | (absent / legacy) | — | — | discard worktree+branch, coerce to `pending`, reprocess |
  | `implemented` | investigator, implementer | run the capability gate (may have crashed mid-run) | step 5 (reviewer) after the `verified` gate |
  | `verified` | investigator, implementer | re-run the capability gate (confirms worktree intact) | step 5 (reviewer) |
  | `reviewed` | investigator, implementer, reviewer | re-run the capability gate | step 6 (commit + push) |
  | `pushed` | implementer, reviewer | `git ls-remote --heads origin orchestrate/slice-<N>` confirms the branch | step 7 (open PR) |
  | `pr-open` | implementer, reviewer | `gh pr view` confirms the PR; `git ls-remote` confirms the branch | step 8 (merge) |
  | `merged` | all subagents | — (merge already landed in umbrella) | step 9 only (label transition + `remove_worktree`) |

  On resume the implementer's *declared* `filesChanged` is gone, so the
  reconstructed `recover_changed_files` set feeds the reviewer prompt and the
  step-6 commit staging exactly as the live path uses the declared set. Do
  **not** route reconstruction through `verify_changeset` (it needs a
  `declaredFiles` argument that no longer exists on resume). For pre-push
  subStates the capability gate is the re-validate; for `pushed`/`pr-open` it is
  `git ls-remote` / `gh pr view`.
- **Two or more matches** — a **loud error**. Two in-progress runs for the same
  PRD (or two in-progress whole-backlog runs) must never be silently resolved
  by picking one. Report every matching `runId` and stop. The operator resolves
  the ambiguity — finishing or cleaning up one of the runs — before re-invoking.

### Fresh run

1. Resolve the run context:
   - Repository root: `git rev-parse --show-toplevel`.
   - **Bootstrap the configuration if this is a first-ever run.** If the
     repository has no `.orchestrate/` directory, call the `bootstrap_config`
     MCP tool with the repository root as `repoPath` and this session's model
     id as `model` (or an explicit `contextWindowTokens`). It detects the
     project type, writes a project-appropriate `commands.json`,
     `routing.json` (per-tier routing plus the run-wide `intraWaveConcurrency`
     policy, defaulting to `parallel`), and `handoff.json`, creates
     `.orchestrate/runs/`, and adds `.orchestrate/runs/` to the repository's
     `.gitignore`. Every step is
     idempotent — an existing committed config is never overwritten — so this
     is also a safe no-op on a repository already configured by hand.
   - Fetch so branch operations use current refs: `git fetch origin`.
   - Confirm the integration base: `git rev-parse --verify origin/development`.
   - Generate a `runId` by joining the invocation prefix to the current
     timestamp including seconds. For `/orchestrate <PRD#>` the prefix is
     `prd<N>-` (the invoked `<PRD#>` as `<N>`), so the `runId` is
     `prd195-20260521-015143`. For `/orchestrate` with no argument the prefix
     is `backlog-`, so the `runId` is `backlog-20260521-015143`. The prefix is
     never omitted — it is what the run-discovery scan (above) keys on.
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
   work). The tier drives routing in section 3.

   Weigh **two independent axes** when assessing the tier, and take the higher
   of the two:

   - **Conceptual difficulty** — how hard the change is to reason about: subtle
     logic, non-obvious interactions, high risk if it goes wrong.
   - **Fan-out** — the number of *independent targets* the slice touches: files,
     modules, subagent definitions, config entries, or doc surfaces that each
     need their own edit and their own verification. A slice can be
     conceptually simple yet have large fan-out — e.g. applying the same small
     change across many files, or updating a schema plus every definition,
     skill section, and doc that references it.

   A **wide-but-simple** slice — low conceptual difficulty but high fan-out — is
   legitimately tiered **up** (e.g. `standard` → `complex`) purely to buy the
   larger implementer turn budget and an investigation pass: many independent
   edits plus a capability-tool re-run after each one consume turns regardless
   of how easy any single edit is. Do not tier a slice down just because each
   target is trivial; the count of targets is itself a cost.

   Once every issue is parsed, narrow the backlog if this is a partitioned run,
   then call the **`partition_backlog` MCP tool** to split it into `slices` and
   `parentIssue`:

   - **Partitioned run (`/orchestrate <PRD#>`)** — first call the
     **`filter_to_one_parent_prd` MCP tool**: pass the full backlog as `issues`
     and the invoked `<PRD#>` as `prdNumber`. It returns only the issues whose
     `parent` field equals `<PRD#>` — the run partition. If that filtered set
     is **empty** (a wrong PRD number, or a PRD whose children are not yet
     `ready-for-agent`), report "PRD #<PRD#> has no ready-for-agent children"
     and stop — the same clean no-op as an empty backlog. Otherwise pass the
     **filtered** set as the `issues` array to `partition_backlog`.
   - **Whole-backlog run (`/orchestrate` no argument)** — pass the full backlog
     directly as the `issues` array to `partition_backlog`; no filter step.
   - `partition_backlog` returns `{ slices, parentIssue }`. `slices` is the
     subset of issues to process as implementation work — any issue detected as
     the parent PRD is automatically excluded. `parentIssue` is the detected
     parent PRD, or `null` — only the progress-comment target (section 2
     step 6), **never** enrolled as a slice.
   - Detection uses two signals in order: (1) a `Parent` field reference — if
     any issue names another backlog issue as its parent, that issue is the
     parent PRD; (2) the `PRD:` title heuristic — if no explicit parent
     reference exists, any issue whose title starts with `PRD:` (case-
     insensitive) is treated as the parent PRD. This ensures a decomposed PRD
     is never accidentally implemented as a slice.
   - **Partitioned run — hard-set `parentIssue`.** For a `/orchestrate <PRD#>`
     run, `filter_to_one_parent_prd` has already removed the parent PRD from
     the input, so the `parentIssue` `partition_backlog` returns may be `null`
     or a mis-detected child. Ignore that value and use the invoked `<PRD#>` as
     the run's `parentIssue` — write `<PRD#>` into `run-state.parentIssue`
     (step 6) regardless of what `partition_backlog` returned. For a
     whole-backlog run, keep the `parentIssue` `partition_backlog` returned.

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
   - Top level: `runId`, `status: "in-progress"`, `driverSessionId` (see the
     paragraph below), `umbrellaBranch`, `integrationBase: "development"`,
     `parentIssue`, `startedAt` and `updatedAt` (current UTC time), the `waves`
     from `plan_waves`, `completedWaves: 0`, `finalPullRequest: null`. For a
     partitioned run, `parentIssue` is the invoked `<PRD#>` (the hard-set value
     from step 3 — never the value `partition_backlog` returned on the
     already-filtered set). For a whole-backlog run, `parentIssue` is the parent
     PRD `partition_backlog` detected, or `null`.

   **Record the driver-session identity.** Read the environment variable
   `$ORCHESTRATE_SESSION_ID` — the orchestrate `SessionStart` hook captures the
   session's own `session_id` and persists it there. Write its value as
   `driverSessionId` in `run-state.json`. This binds the global
   `context-watchdog` to this run when several runs proceed concurrently in one
   repository (see section 4). If `$ORCHESTRATE_SESSION_ID` is **empty or
   unset** — the hook did not run, or the environment did not surface it — set
   `driverSessionId` to `null` and **tell the operator**: the run proceeds
   normally but **without automatic context-handoff**; should this session's
   context fill, the operator must resume the run manually by invoking
   `/orchestrate` in a new session.
   - One `slices` entry per issue: `issue`, `title`, `wave` (its index in
     `waves`), `tier`, `blockedBy`, `state: "pending"`, `sliceBranch:
     "orchestrate/slice-<N>"`, `worktreePath: null`, `pullRequest: null`,
     `failureReason: null`, and `updatedAt`.

   **`slices` is a MAP keyed by the issue-id string, not an array.**
   `partition_backlog` returns `slices` as an **array**; do **not** write that
   array straight into `run-state.json`. Transform it into a map by keying each
   slice on its issue id, e.g. `"slices": { "25": { "issue": 25, … } }`. An
   array-shaped `slices` fails the canonical run-state schema.

   **Validate the checkpoint immediately.** Right after writing this first
   `run-state.json`, call the `validate_run_state` MCP tool with the repository
   root as `repoPath` and the run's `runId`. On `status: "invalid"`, **stop
   loudly** and report the `errorMessage` before creating any worktree or
   spawning any subagent — a mis-shaped checkpoint must fail here, in seconds,
   not after expensive subagent work.

## 2. The wave loop

**Read the run-wide concurrency policy once, before any slice spawns.** Read
`.orchestrate/routing.json` and take its optional top-level
`intraWaveConcurrency` key — `"parallel" | "sequential"`, **absent ⇒
`parallel`** (apply the default here, in the orchestrator; do **not** route this
through `resolve_routing`, which is per-tier and returns only `tier` + per-tier
`routing`, never the whole config). This is a single run-wide decision that
selects how each wave processes its slices, and it does not change between waves.
`routing.json` thus carries both per-tier subagent routing **and** this run-wide
run policy.

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
   its state is `pending`, every **in-partition** blocker it depends on reached
   `passed`, and every **out-of-partition** blocker is verified resolved.

   - **In-partition blockers** — a `blockedBy` id that is itself a slice in
     this run's `slices` map. The slice is processable only when every such
     blocker reached `passed`. If any is `failed` or `skipped`, mark this slice
     `skipped` with a `failureReason` naming the blocker, checkpoint, and do not
     process it.
   - **Out-of-partition blockers** — a `blockedBy` id that is **not** a slice
     in this run's `slices` map. This happens on a partitioned run: a child
     issue may be blocked by an issue outside its parent PRD. `plan_waves` does
     not order such a blocker — it treats any id outside its input set as
     already satisfied — so the orchestrator must verify the blocker's **real**
     tracker state itself before the dependent slice runs:

     ```
     gh issue view <blocker-id> --json state
     ```

     A `state` of `CLOSED` (the issue is merged or closed) → the blocker is
     resolved; the dependent slice proceeds. A `state` of `OPEN` → the external
     blocker is unmet; mark the dependent slice `skipped` with a `failureReason`
     naming the external blocker issue (e.g. "blocked by #<id>, an issue
     outside this run's partition that is still open"), checkpoint, and do not
     process it. Never silently assume an out-of-partition blocker is done.
3. **Process the slices.** Branch on the `intraWaveConcurrency` policy read at
   the top of this section:

   - **`parallel` (the default).** Run section 3 for every processable slice.
     Slices in a wave are independent, so parallelize: when several slices are
     at the same subagent stage (investigation, implementation, review), spawn
     those subagents by issuing all the Agent tool calls **in a single
     message**. Each slice has its own worktree, so they never collide. Then
     integrate them sequentially — step 4 below.

   - **`sequential`.** Process the wave's processable slices **one at a time, in
     issue-id ascending order** — steps 3 and 4 below fuse into a per-slice
     serial loop. This imposes a deterministic order on slices the DAG says are
     independent, deciding who "wins" a shared-file region; in exchange every
     slice branches from an already-integrated base, so it is conflict-free
     without the conflict-resolver. For each slice, in ascending issue-id order:

     1. **Refresh the umbrella base** by re-running this section's step 1 fetch
        (`git fetch origin orchestrate/umbrella-<runId>:orchestrate/umbrella-<runId>`)
        so this slice branches from `base + slice1..N-1` — the integrated state
        of every earlier slice in this wave, not just the prior waves'.
     2. **Process it** — run section 3 (all stages) for this one slice.
     3. **Integrate it** — run section 3 steps 6–9 (commit, pull request, merge)
        for this one slice; merges into the umbrella must not race, and here
        they cannot, because only one slice is in flight.
     4. **Check for the context-handoff signal** — exactly as the `parallel`
        path does in step 4: if `.orchestrate/runs/<runId>/context-flag.json`
        exists, finish writing `run-state.json` for the slice just integrated,
        then go to section 4 (Context handoff) rather than starting the next
        slice.

     After the loop drains the wave's processable slices, continue at step 5.

4. **Integrate sequentially** (the `parallel` path; the `sequential` path
   already integrated each slice inline in step 3). The commit, pull-request,
   and merge steps (section 3, steps 6–9) run **one slice at a time** — merges
   into the umbrella branch must not race each other. After each slice finishes
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
  --body "<summary of the run — slices passed, failed, and skipped>

Closes #<N>
Closes #<M>"
```

The `--body` enumerates **one `Closes #<N>` line per slice** whose
`run-state.json` `state` is `"passed"` (the `#<N>`/`#<M>` placeholders above
stand for those passed-slice issue numbers — emit as many lines as there are
passed slices), in addition to the run summary. A
**failed** or **skipped** slice gets **no** `Closes` line — its code is not in
the umbrella, so its issue must stay open. Because the integration base is
`development`: when `development` is the repository's default branch these
`Closes` keywords fire a native GitHub close the instant the umbrella pull
request merges; when `development` is **not** the default branch the keywords
are inert and the §1 start-of-run sweep backstop (below) closes the passed-slice
issues instead.

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
   prompt must carry the issue number/title/body **and the slice's acceptance
   criteria explicitly named as the hard scope boundary** — the canonical per-
   slice scope established by the backlog partitioner. The investigator must
   not propose work that falls outside those acceptance criteria. Validate its
   returned text with `validate_envelope` (role `investigator`); on `valid`,
   **diff the returned brief against the acceptance criteria before forwarding
   it to the implementer**: inspect the brief's `relevantFiles`, `approach`,
   and `notes` for any work that does not trace to at least one acceptance
   criterion. If the brief includes work from a sibling or downstream slice —
   files, approaches, or recommendations that the acceptance criteria do not
   require — the brief is over-scoped: treat it as a failed investigation pass
   (the slice has **FAILED**). A brief that is correctly scoped to the
   acceptance criteria is forwarded to the implementer as the research brief.
   An `invalid` or `missing` envelope is a failed investigation pass — the
   slice has **FAILED** (the investigator is read-only, so no worktree fallback
   applies). If `routing.investigator` is null, skip this step.
4. **Run the implementer.** Spawn the `orchestrate:implementer-<effort>`
   subagent — `<effort>` and the `model` override from `routing.implementer`. Its
   prompt must carry the issue number/title/body, the worktree path (every
   change goes there), the investigator's brief if one was produced, an
   instruction to verify with the capability tools using the worktree path as
   `repoPath`, and a reminder not to commit, push, or run git. Validate its
   returned text with `validate_envelope` (role `implementer`). On a `valid`
   envelope, classify the envelope `status`:
   - `completed` — proceed to the worktree scope check in step 4a.
   - `incomplete` — the implementer's graceful turn-budget self-report: it
     foresaw it could not finish within its remaining turns and stopped cleanly
     with partial work recorded. The slice has **FAILED** — record a
     `failureReason` that names the turn-limit cutoff explicitly (e.g.
     "implementer reported `incomplete` — exhausted its turn budget; partial
     work preserved in the worktree for resumption"). See *Failure handling*.
   - `blocked` — the implementer hit an unrecoverable obstacle: the slice has
     **FAILED**.

   An `invalid` or `missing` envelope also means the slice has **FAILED** — a
   hard turn-limit cutoff that truncates the envelope mid-emission lands here as
   `invalid`, distinct from the graceful `incomplete` self-report above.
4a. **Verify the changeset against the worktree.** After a `completed`
   implementer envelope — and before trusting it — call the `verify_changeset`
   MCP tool with the slice's `worktreePath` and the implementer envelope's
   `filesChanged` as `declaredFiles`. It inspects the worktree directly with
   `git status` and compares the declared file set against what actually
   changed on disk:
   - `match: "matched"` or `"clean"` — the declared set agrees with the
     worktree; proceed to step 5.
   - `match: "empty-but-declared"` — the implementer declared files but the
     worktree is clean: its edits never landed. The slice has **FAILED**.
   - `match: "suspiciously-empty"` — the implementer declared nothing but the
     worktree HAS changes: the work was under-reported. The slice has
     **FAILED**; record the `presentButUndeclared` paths in the `failureReason`.
   - `match: "mismatch"` — the declared set and the worktree changeset diverge.
     Trust the worktree: use the **union** of the implementer's declared
     `filesChanged` and the tool's `actualFiles` as the changed-file set for the
     reviewer and the commit (step 6), and note the divergence
     (`declaredButAbsent` / `presentButUndeclared`) so the reviewer sees it.
   - `status: "error"` — the worktree could not be inspected; the slice has
     **FAILED**.

   Once the changed-file set is established (a `matched`/`clean`/`mismatch`
   verdict), set the slice's `subState` to `implemented` and checkpoint
   `run-state.json`; the completed implementer envelope also satisfies the
   pre-review gate, so set `subState` to `verified` and checkpoint again before
   spawning the reviewer. (These two adjacent checkpoints differ only in
   resume granularity — the resume matrix in section 1 re-runs the capability
   gate for both.)
5. **Run the reviewer.** Spawn the `orchestrate:reviewer-<effort>` subagent —
   `<effort>` and the `model` override from `routing.reviewer` — in the same
   worktree. Its prompt must carry the issue, the worktree path, the
   changed-file set agreed on by step 4a — the implementer envelope's
   `filesChanged` when `verify_changeset` matched, the union of declared and
   `actualFiles` on a `mismatch` — the implementer envelope's `notes`, and the
   investigator's brief if one was produced. Validate its returned text with
   `validate_envelope` (role `reviewer`). On a `valid` envelope, an envelope
   `status` of `failed` means the slice has **FAILED**; `passed` proceeds. An
   `invalid` or `missing` envelope also means the slice has **FAILED**. On a
   `passed` envelope, set the slice's `subState` to `reviewed` and checkpoint
   `run-state.json` before proceeding to step 6.
5a. **Pre-merge capability gate.** After the reviewer returns `passed` (step 5),
   and **before any commit, push, or GitHub state exists**, the orchestrator
   independently runs the correctness capability tools on the slice worktree —
   this is the pre-merge capability gate. It does **not** trust the reviewer's
   envelope `verification`: the reviewer's re-run is a subagent self-report;
   this step is the orchestrator's own deterministic check, the last link in the
   `implementer → reviewer → orchestrator` trust chain.

   Call the `run_build` and `run_tests` MCP tools with the slice's
   `<worktree-path>` as `repoPath` (the same pattern step 8a.3 uses). Each tool
   returns a `status` enum (`passed | failed | not-configured | error`); handle
   all four:
   - `passed` on **both** verbs → proceed to step 6.
   - `not-configured` (either verb) → **tolerated**, treated as a pass for that
     verb (consistent with the prerequisites note that a missing-command
     `not-configured` is tolerated). The gate must not fail a project that has
     not configured `build`/`tests`.
   - `failed` or `error` (either verb) → the slice has **FAILED** (the existing
     FAILED semantics defined throughout section 3 — no new failure handling).

   **Known-baseline-failure hint (`knownFailureMatches`).** When a capability
   tool returns `status: "failed"` and the project's `commands.json` configures a
   `knownFailures` pattern list, the result carries
   `knownFailureMatches.matched` (configured patterns that appeared in the
   failing output) and `.unmatched` (configured patterns that did not). Use it
   only as a **hint**, never as a verdict — it is a best-effort L1 annotation,
   not a deterministic "zero new failures" assertion (`run_tests` returns capped
   exit-code output, not a structured test-result list). When every failure
   indicator in the output is explained by a `matched` pattern and `unmatched`
   holds only not-present baseline cases, treat the failure as a **likely known
   baseline** and proceed per this gate's baseline handling. When the failing
   output contains indicators NOT covered by any `matched` pattern,
   **spot-check** before treating it as baseline — L1 cannot deterministically
   assert "0 new failures." A `knownFailures` entry in `commands.json` looks
   like, e.g.:

   ```json
   { "tests": ["npm", "test"], "knownFailures": ["flaky-network timeout", "ECONNRESET"] }
   ```

   The verb set is exactly `run_build` + `run_tests` — a deliberate subset:
   build+test is the correctness trust boundary, while `typecheck`/`lint` remain
   the reviewer's quality remit and are intentionally **not** re-run here. The
   step 8a.3 (post-conflict) re-verify running all four
   `run_tests`/`run_typecheck`/`run_build`/`run_lint` verbs is a **known,
   intentional asymmetry** — and is left unchanged: this pre-merge gate is
   focused correctness on a worktree the reviewer already saw, whereas the
   conflict re-verify is max-confidence on a never-before-tested merged
   combination. "Pre-merge" names what the gate controls (whether the merge
   proceeds); mechanically it runs pre-commit, on the same worktree state the
   reviewer validated.
6. **Commit and push.** Stage only the files the subagents reported changing —
   the union of the `filesChanged` arrays from the validated implementer and
   reviewer envelopes. Never `git add -A`: the capability tools leave untracked
   build artifacts in the worktree.

   ```
   git -C <worktree-path> add -- <file> <file> ...
   ```

   If `git -C <worktree-path> diff --cached --quiet` exits 0, nothing changed —
   the slice has **FAILED**. Otherwise commit (local; two `-m` flags keep a
   newline out of the shell argument), then push **with the `push_and_verify`
   MCP tool** — not a raw `git push`:

   ```
   git -C <worktree-path> commit -m "<type>(<scope>): <issue title>" -m "Closes #<N>"
   ```

   Call the **`push_and_verify` MCP tool** with `repoPath` = the slice
   `worktreePath`, `branch` = `orchestrate/slice-<N>`, `remote` = `origin`,
   `setUpstream: true`. On `status: "ok"` — and **only** then, because that
   status means `push_and_verify`'s SHA-matched `git ls-remote` has confirmed the
   branch actually landed on the remote — set the slice's `subState` to `pushed`,
   checkpoint `run-state.json`, and proceed to step 7. Never write
   `subState: pushed` on a bare `git push` exit-0; the landing check is what the
   `pushed` checkpoint attests to (and what the section-1 resume re-validates).
   On `status: "error"` (any `errorCode` — `PUSH_FAILED`, `BRANCH_NOT_ON_REMOTE`,
   `INVALID_INPUT`, `GIT_ERROR`) the slice has **FAILED**, the same wiring as
   every other MCP-tool error in this section.

   `push_and_verify` gates step 7's `gh pr create`: it pushes the branch and
   then confirms via SHA-matched `git ls-remote` that it actually landed on the
   remote. A `git push` that exits 0 but never lands is exactly the
   confusing-`gh pr create`-error site #230 reports — verifying the branch is on
   the remote *before* opening the PR removes that silent-failure mode.

7. **Open the slice pull request.**

   ```
   gh pr create --base orchestrate/umbrella-<runId> --head orchestrate/slice-<N> \
     --title "<issue title>" --body "Implements #<N>. <summary>"
   ```

   Record the pull request URL in the slice's `run-state.json` entry, set its
   `subState` to `pr-open`, and checkpoint.
8. **Merge the slice.** GitHub computes mergeability asynchronously — check it
   before merging:

   ```
   gh pr view <pr-number> --json mergeable,mergeStateStatus
   ```

   The gate is the `mergeable` field; `mergeStateStatus` is informational
   context, not a separate gate.

   - `UNKNOWN` — GitHub is still computing; wait a moment and re-check, up to a
     few attempts. If it never resolves, the slice has **FAILED**.
   - `MERGEABLE` — merge it even when `mergeStateStatus` is `UNSTABLE` (a
     non-required check is failing or still running, but no required check
     blocks the merge). Squash to one commit per slice on the umbrella branch:
     `gh pr merge <pr-number> --squash --delete-branch`. The `--delete-branch`
     flag reclaims the **remote** slice branch as part of the merge; it may
     additionally warn or no-op on the **local** branch because the slice
     worktree still has it checked out — that warning is **tolerated, not a
     slice failure**. The authoritative local reclamation is the explicit
     `git branch -D` at step 9.
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
      `gh pr merge <pr-number> --squash --delete-branch`.
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
      gh pr merge <pr-number> --squash --delete-branch
      ```

9. **Finish the slice.** Once any of step 8's `gh pr merge --squash` paths
   (`MERGEABLE`, the clean-textual-merge 8a.3 path, or the conflict-resolved
   8a.6 path) has succeeded — the slice PR is now squash-merged into the
   umbrella — set the slice's `subState` to `merged` and checkpoint
   `run-state.json` **before** the label transition and worktree removal below.
   `merged` is the integration-boundary anchor: a run resumed at
   `subState: merged` skips every subagent and re-enters here at step 9 only,
   never re-merging. Then set the slice `state` to `passed` and transition the
   issue's tracker label — it is done and awaiting human review:
   `gh issue edit <N> --remove-label ready-for-agent --add-label ready-for-human`.
   Then remove its worktree with the `remove_worktree` MCP tool (`worktreePath`,
   `repoPath`, `force: true` — the worktree may hold untracked build artifacts).
   Finally, reclaim the **local** slice branch from the repository root:

   ```
   git branch -D orchestrate/slice-<N>
   ```

   The `-D` (force) flag is mandatory: the squash-merge rewrote the commit SHA,
   so the slice branch is **not** an ancestor of umbrella and `git branch -d`
   would refuse it as "not fully merged." Run this **after** `remove_worktree` —
   while the worktree still has the branch checked out, the delete is refused.
   The delete is idempotent: on a run resumed at `subState: merged` the branch
   may already be gone (an earlier pass reclaimed it), and an already-absent
   branch is fine, not a failure. This completes incremental reclamation: the
   **remote** half was done by `--delete-branch` at step 8, the **local** half
   here. Incremental reclamation fires only on a `passed` / `subState: merged`
   slice; a failed (preserved) slice's branch is left fully intact.

## 4. Context handoff

A long run can fill this session's context before every wave is done. The
`context-watchdog` hook bundled with this plugin watches token usage and writes
`.orchestrate/runs/<runId>/context-flag.json` past a configurable threshold.
When the wave loop (section 2, step 4) sees that flag, hand the run off to a
fresh Claude Code session instead of continuing — the successor resumes from
the `run-state.json` checkpoint exactly as section 1 describes. See
`references/context-handoff.md` for the full mechanism.

The watchdog binds to the correct run by matching this session's identity:
it compares the hook event's `session_id` against each in-progress run's
`driverSessionId`, and writes the flag only under the matching run's directory.
When several runs proceed concurrently and the session cannot be disambiguated,
the watchdog writes no flag — that run stays correct and merely loses automatic
context-handoff. The same **degraded mode** applies when `driverSessionId` is
`null` because `$ORCHESTRATE_SESSION_ID` was unavailable at run start (section 1,
step 6): the run is unaffected except that it will not hand off automatically,
and the operator was already told to resume it manually if needed.

To hand off:

1. Make sure `run-state.json` is checkpointed and its `status` is still
   `in-progress` — the successor resumes from it. Do **not** delete
   `.orchestrate/runs/<runId>/context-flag.json`; the successor deletes it on
   startup once it has consumed it.
2. Derive the resume invocation from the active run's `runId` prefix and pass
   it to `spawn_successor` as `resumePrompt`. The rule is exact: if the `runId`
   starts with `prd`, strip the `prd` prefix and take the characters up to the
   first `-` as `<N>` (e.g. `prd195-20260521-015143` → `195`), pass
   `resumePrompt: "/orchestrate 195"`; if it starts with `backlog-`, pass
   `resumePrompt: "/orchestrate"`. **Always derive and pass** `resumePrompt`
   uniformly — even for a `backlog-` run, where it equals the default — so the
   static `handoff.json` `successor.resumePrompt` is purely a manual/legacy
   fallback. Then call the `spawn_successor` MCP tool with the repository root
   as `repoPath` and the derived `resumePrompt`. It launches a new interactive
   Claude Code session — terminal and `claude` flags come from
   `.orchestrate/handoff.json`, defaults otherwise — that re-invokes the
   passed `resumePrompt` (the partition-correct `/orchestrate <N>` or bare
   `/orchestrate`) with Remote Control active.
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
validated implementer envelope has `status: "blocked"` or `status: "incomplete"`,
a validated reviewer envelope has `status: "failed"`, `verify_changeset` reports
the implementer's declared file set does not match the worktree
(`empty-but-declared` or `suspiciously-empty`, or a `status: "error"`), the
staged changeset is empty, or a merge conflict the `conflict-resolver` cannot
fix. The orchestrator decides FAILURE **only** from the validated envelope and
tool results — never from a subagent's prose. An invalid or missing envelope is
always a FAILED slice; it is never treated as success.

The implementer envelope's `incomplete` status is a **distinct** failure flavor:
it is the implementer's graceful turn-budget self-report — partial, resumable
work — as opposed to `blocked` (an unrecoverable obstacle) or an `invalid`
envelope (a hard turn-limit cutoff that truncated the envelope). All three FAIL
the slice, but the `failureReason` must name the cause precisely so a developer
can tell a resumable budget exhaustion apart from a genuine blocker. An
`incomplete` slice's worktree holds usable partial work — preserve it (as every
FAILED slice's worktree is preserved) so the slice can be resumed.

On a FAILED slice:

- When the failure cause is a validated worker envelope with `status: "blocked"`
  (implementer) or `status: "failed"` (reviewer), that envelope now carries a
  validated `rootCause` (`verified` | `hypothesis` + `claim` + optional
  `evidence`) — surface it in the failure artifact alongside the `failureReason`
  so a developer reads the subagent's own labelled diagnosis.
- Set its `state` to `failed` with a `failureReason`, checkpoint, and
  transition the issue's tracker label. For a slice that failed because the
  implementer reported `incomplete` — partial, resumable work — `needs-info`
  better signals "resume me" than `needs-triage`:
  `gh issue edit <N> --remove-label ready-for-agent --add-label needs-info`.
  For every other failure cause, use `needs-triage`:
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

Other stop conditions: an empty backlog is a clean no-op, as is a
`/orchestrate <PRD#>` run whose PRD has no `ready-for-agent` children
(`filter_to_one_parent_prd` returns an empty set); a `plan_waves`
`CYCLE_DETECTED` result stops the run before any branch is created.

## Tracker updates

The orchestrator is the **single writer** of GitHub tracker state — the
subagents never touch issues, labels, or pull requests. Tracker writes happen
only at a slice's terminal state (see section 3 step 9 for the pass label
command and *Failure handling* for the failure label command), as PRD
progress/summary comments (see section 2 steps 6 and the final-PR paragraph),
and as **issue closes** on merge→development (below). The parent PRD issue
receives a progress comment after each wave and a final summary when the run
completes. Issue-closing is part of the single-writer role — alongside labels
and progress comments — and is **not** delegated to subagents.

The orchestrator closes a passed slice's issue **when its code lands in
`development`** — never on the slice→umbrella merge (the slice merely vanishes
into the umbrella branch; its code is not yet in the integration base). Two
complementary mechanisms enforce the correct semantics (issue closed ⇔ code in
`development`):

- **Native close — final umbrella PR body.** The final integration pull request
  (section 2) lists a `Closes #<N>` line for every passed slice. When
  `development` is the repository's default branch, merging that pull request
  fires GitHub's native close instantly.
- **Backstop — §1 start-of-run sweep.** When `development` is **not** the
  default branch the `Closes` keywords are inert, so the start-of-run cleanup
  sweep (section 1) covers the gap: on a `merged` verdict it collects each
  passed slice's issue number from `run-state.json` (before `clean_runs` deletes
  it) and runs `gh issue close <N>` — orchestrator work, idempotent if the
  native keyword already fired (an already-closed issue exits 0).

This is orchestrator `gh` work; `clean_runs` stays git + filesystem only and
never shells `gh` (the no-`gh` invariant). The slice-commit `Closes #<N>`
trailer (section 3 step 6) and the slice pull request's `Implements #<N>` body
(section 3) are **unchanged** — the trailer is now harmless reinforcing
redundancy, and `Implements` remains the deliberate non-closing slice→umbrella
verb; the lifecycle no longer relies on either.

**`gh`-op resilience (prose, not a tool).** Wrap every `gh` operation —
`gh pr create`, `gh pr merge`, `gh pr view`, `gh issue edit`, `gh issue
comment` — in a bounded retry that **distinguishes transient failures (network
timeout, 5xx, DNS) — retry with backoff — from permanent failures (auth,
validation, not-found) — fail immediately**. This is orchestrator prose rather
than an MCP tool **because the MCP layer never shells `gh`** (the no-`gh`
invariant): forge-op resilience is the orchestrator's responsibility. The
`push_and_verify` MCP tool covers the git-push half of the same #230 failure
mode (an exit-0 push that never lands); this note covers the `gh`-op half —
together they close #230.

## Checkpointing

Write the run's `run-state.json` — at `.orchestrate/runs/<runId>/run-state.json`
— after every slice state change and after every wave. In addition, write a
slice's `subState` at **every** section-3 per-slice transition
(`implemented` → `verified` → `reviewed` → `pushed` → `pr-open` → `merged`);
that fine-grained checkpoint is the **resume anchor** an interrupted in-progress
slice continues from (section 1), alongside the coarse-`state` and wave
checkpoints. Every write refreshes the top-level `updatedAt`, and a slice's own
`updatedAt` whenever its entry changes, so an artifact rendered from the file
has accurate timestamps. The checkpoint is what makes a run resumable: an
interrupted run, re-invoked, skips every terminal-state slice and resumes every
in-progress slice from its recorded `subState`.
