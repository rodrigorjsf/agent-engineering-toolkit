# Run lifecycle — start, cleanup sweep, run discovery, fresh run

These are the procedural mechanics of section 1 (Start or resume the run). The
spine retains the checkpoint/resume semantics narration and the resume
re-validate matrix table; everything else — the start-of-run cleanup sweep, the
run-discovery scan, and the fresh-run steps 1–6 — lives here.

On startup, set a completion goal with `/goal` so the session keeps working
turn after turn and does not yield control before the run is done. Phrase it
as a checkable end-state, e.g. `/goal the orchestrate run has opened its final
integration pull request, or a successor session has been launched`. An
autonomous run must not stop mid-wave.

## Start-of-run cleanup sweep

Before discovering or starting a run, sweep away the footprint of concluded
runs so the `.orchestrate/runs/` directory does not accumulate. This same sweep
is what `/orchestrate clean` (section 0) runs on demand.

1. Enumerate every `.orchestrate/runs/*/run-state.json` and parse each into
   `{ runId, status, finalPullRequest, slices }` (normalize `slices` to an array
   of `{ issue, state }`). Then resolve the **merge verdicts** across the two
   pure phases of the **`resolve_cleanup_verdicts` MCP tool** — the gate is
   strictly the final pull request having **merged** into the integration base,
   not merely being open:

   **Phase one — `resolve_cleanup_verdicts` with `phase: "enumerate"`** and the
   parsed `runs` array. The tool applies the eligibility gate
   (`status === "completed" && finalPullRequest != null`) — omitting every run
   that is **not** `completed` or whose `finalPullRequest` is `null`, since such
   a run has not concluded — and returns the **deduplicated** `finalPullRequests`
   identifiers to look up, plus `eligibleRuns` (each run paired with its final
   PR). **Never** include the current run, or any run still `in-progress`, in the
   parsed `runs`: an ineligible run is omitted from the verdict map, which tells
   `clean_runs` to leave it strictly intact.

   **Fetch the merge facts (orchestrator `gh` work — stays in the spine).** For
   each identifier in the returned `finalPullRequests`, run:

   ```
   gh pr view <finalPullRequest> --json state,mergedAt
   ```

   The fetch loop is **orchestrator** work — `resolve_cleanup_verdicts` is pure
   and never shells `gh`. Build one `facts` entry per `eligibleRuns` row,
   carrying that run's `runId`, its `finalPullRequest`, the fetched
   `state`/`mergedAt` (use `null`/omit when the command errors or cannot be
   parsed), and that run's `slices` from step-1 parsing.

   **Phase two — `resolve_cleanup_verdicts` with `phase: "classify"`** and the
   `facts` array. The tool classifies every `{ state, mergedAt }` into the
   four-way verdict — `MERGED` + non-null `mergedAt` → `merged`; `OPEN` → `open`;
   `CLOSED` + null `mergedAt` → `closed-unmerged`; any malformed/missing/
   unexpected fact → `unknown` — and, in the same pass, captures each `merged`
   run's `closeSetIssues` (the issue numbers of exactly its `passed` slices).
   Collapse the returned `verdicts` into the `Record<runId, verdict>` map
   `clean_runs` ingests, and keep each merged run's `closeSetIssues` as that
   run's **close-set** for step 3. This is why slices flow through phase two:
   `clean_runs` deletes the merged run's directory and its `run-state.json`, the
   only source of those issue numbers, so the close-set must be captured **now**.

   As defense-in-depth, `clean_runs` independently enforces the same
   `status === "completed" && finalPullRequest != null` gate by re-reading each
   run's own `run-state.json` (per ADR-0012), so even a misbuilt verdict map can
   never make it touch an unconcluded or `in-progress` run — such a run is
   skipped with reason `run-not-completed` or `final-pr-missing`.
2. Call the **`clean_runs` MCP tool** with the repository root as `repoPath` and
   the per-run `verdicts` map you collapsed from phase two. The tool removes each
   `merged` run's worktrees, its umbrella and slice branches (local and remote),
   and its run directory; it leaves every other run intact and reports it. A
   `failed`-slice worktree is preserved (and that run's directory kept) so a
   developer can still inspect it. `clean_runs` is git + filesystem only — it
   never shells `gh`; the merge verdicts you resolved above are the GitHub half
   of the gate.
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
`context-flag.json`, one `slice-<issue>-progress.json` slice progress record per
slice, and rendered HTML artifacts. The committed config files
(`commands.json`, `routing.json`, `handoff.json`) stay flat at the
`.orchestrate/` top level. `routing.json` carries both per-tier subagent routing
and run-wide run policy (the optional `intraWaveConcurrency` knob — see section
2). The run directory's schema and rationale are in `references/run-state.md`.

## Run-discovery scan

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
- **Exactly one match** — resume it, per the checkpoint/resume semantics and the
  resume re-validate matrix retained in the spine (section 1). Its `runId` is
  the directory name. First clear that run's stale handoff flag: if
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
  **re-validate** the resume point per the resume matrix in the spine; then
  resume section 3 at the next uncompleted step, **without** re-spawning the
  subagents whose work the recorded `subState` already captures. An in-progress
  slice with **no `subState`** — a legacy checkpoint written before this scheme —
  instead uses the old discard path: if it has a `worktreePath`, call
  `remove_worktree` (`force: true`); delete its `sliceBranch` if it exists
  (locally, and on the remote if it was pushed) — deleting the remote branch also
  auto-closes any orphaned slice pull request GitHub opened for it; then coerce
  it back to `pending` (the same graceful degradation as an absent
  `driverSessionId`). Checkpoint the refreshed `run-state.json`, then skip to
  section 2.
- **Two or more matches** — a **loud error**. Two in-progress runs for the same
  PRD (or two in-progress whole-backlog runs) must never be silently resolved
  by picking one. Report every matching `runId` and stop. The operator resolves
  the ambiguity — finishing or cleaning up one of the runs — before re-invoking.

## Fresh run

1. Resolve the run context:
   - Repository root: `git rev-parse --show-toplevel`.
   - **Bootstrap the configuration if this is a first-ever run** with the
     `bootstrap_config` MCP tool — see `references/prerequisites.md` for the
     full bootstrap detail.
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
   work) — per the two-axis tiering judgment retained in the spine (section 1).
   The tier drives routing in section 3.

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
