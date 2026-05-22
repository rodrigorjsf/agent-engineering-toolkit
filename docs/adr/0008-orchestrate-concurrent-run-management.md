# Orchestrate concurrent run management

**Status:** accepted (2026-05-21)

The `orchestrate` plugin originally supported one run per repository: a single
flat `.orchestrate/run-state.json`, a global context-watchdog keyed on it, and
no cleanup of finished runs. To let an operator run several orchestrations
concurrently in the same repository, each run now owns a **run partition** —
the child issues of one parent PRD, selected by `/orchestrate <PRD#>` — and a
per-run **run directory** at `.orchestrate/runs/<runId>/` holding all ephemeral
state, while the `commands.json` / `routing.json` / `handoff.json` config stays
committed at the `.orchestrate/` top level. The global context-watchdog binds a
run by matching the **driver session** identity recorded in run-state, and
safely no-ops — the run keeps going, only auto-handoff is lost — when it cannot
disambiguate. **Run cleanup**, a sweep at every run start plus an
`/orchestrate-clean` subcommand, removes a run's directory, worktrees, and
umbrella/slice branches once its final integration pull request has merged into
the integration base.

## Considered Options

- **Flat per-run filenames** (`run-state-<runId>.json`) instead of a
  `runs/<runId>/` directory — rejected: scatters ephemeral artifacts among the
  committed config files and makes both the `.gitignore` rule and the cleanup
  match fragile.
- **Concurrency across different repositories only** — rejected: the operator's
  real need is two runs in one repository; cross-repo concurrency already works
  because each repository has its own `.orchestrate/` directory.
- **Keeping `plan_waves`' default** (a blocker outside the input set is assumed
  satisfied) for cross-partition dependencies — rejected: a partitioned run
  could then silently build a slice on top of an unbuilt external blocker.
  Instead the orchestrator verifies the external blocker's real state and skips
  the dependent slice when that blocker is still open.
- **A lockfile granting the context-watchdog to one run per repository** —
  rejected: it degrades the second concurrent run's auto-handoff even after the
  first run has finished. Matching the driver-session identity scopes the
  watchdog per run instead.

## Consequences

- The on-disk `.orchestrate/` contract changes: MCP tools and the hook that
  read `run-state.json` or write HTML artifacts (`render_*`, `spawn_successor`,
  the `context-watchdog`) take a `runId` and resolve paths under
  `runs/<runId>/`.
- `run-state.json` gains a driver-session identity field. Whether the
  orchestrator can read its own session identity carries a verification spike;
  if that primitive is absent, the watchdog's safe-no-op fallback means a
  concurrent run loses auto-handoff but stays correct.
- The bootstrap step appends `.orchestrate/runs/` to the target repository's
  `.gitignore` idempotently; the config files stay tracked.
- This work folds into PRD #181 (orchestrate plugin hardening) — it reuses and
  extends the same modules: the config bootstrapper, the backlog partitioner,
  and the context-window / context-watchdog handling.
