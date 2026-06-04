# Modes — run vs. clean, and the `/orchestrate-clean` mode

This skill has two modes, selected by the invocation argument.

- **No `clean` argument** (`/orchestrate` or `/orchestrate <PRD#>`) — the normal
  orchestration run. Proceed through sections 1–4 of the spine.
- **The `clean` argument** (`/orchestrate clean`, optionally
  `/orchestrate clean --force`, or `/orchestrate clean --failed <runId>`) — the
  **`/orchestrate-clean` mode**. Run **only** the cleanup path described here,
  then **stop**. Do **not** discover or start a run, do not read the backlog, do
  not create branches.

## `/orchestrate-clean` mode

`/orchestrate clean` removes the leftover footprint of concluded runs on demand
— the same cleanup the start-of-run sweep (section 1) performs automatically.
When invoked with the `clean` argument:

1. Resolve the repository root: `git rev-parse --show-toplevel`.
2. Run the **cleanup sweep** exactly as section 1 describes it — enumerate
   `.orchestrate/runs/*/run-state.json`, resolve each run's merge verdict with
   `gh pr view`, and call the `clean_runs` MCP tool with the verdict map. If the
   `--force` argument was passed, set `force: true` in the `clean_runs` call.
3. Report the `clean_runs` result to the user — per run, its `action`
   (`removed`, `preserved`, or `skipped`), its `reason`, and the removed or
   preserved worktrees and branches — then **stop**. `/orchestrate clean` never
   starts an orchestration run.

### `/orchestrate clean --failed <runId>` — single-run reclaim

`/orchestrate clean --failed <runId>` reclaims **one** crashed or abandoned run.
There is no `failed` run status — a crashed run stays `in-progress` forever,
indistinguishable from a live run in another session — so reclaiming it requires
a path that **bypasses the `status === "completed"` gate by design**. This is the
one sanctioned exception to the cross-run isolation invariant (ADR-0012). It is
**distinct** from the start-of-run / `clean`/`--force` sweep above, which is
status-gated and never touches an `in-progress` run.

1. **Require the `<runId>`.** It is mandatory — **error out** if it is absent
   (`/orchestrate clean --failed` with no runId). **Never** treat a bare
   `--failed` as a sweep; this path acts on exactly one named run.
2. **Enumerate the exact deletion set.** Read
   `.orchestrate/runs/<runId>/run-state.json` and list, verbatim, everything the
   reclaim will delete: every slice's `worktreePath`, the `umbrellaBranch`, every
   slice's `sliceBranch`, and the run directory `.orchestrate/runs/<runId>/`.
3. **Surface `updatedAt` as a staleness advisory — never a gate.** Report the
   run-state `updatedAt`. A live run refreshes `updatedAt` on every checkpoint
   (see *Checkpointing*), so a frozen `updatedAt` is evidence the run crashed; a
   fresh one is a warning the run may still be live in another session. This is
   **advisory only** — it never blocks the reclaim (there is no stale-lock), it
   only informs the human's decision.
4. **Confirm interactively — the only guard.** Present the deletion set and the
   `updatedAt` advisory, then ask the user to confirm. There is **no `--yes` /
   no bypass** — the interactive confirmation is mandatory and is the sole
   protection for this gate-bypassing path. **On decline → stop, touch nothing.**
5. **On confirm**, call the **`reclaim_run` MCP tool** (NOT `clean_runs`) with
   the repository root as `repoPath` and the `<runId>`. It removes that one run's
   worktrees (passed AND failed), its umbrella and slice branches (local and
   remote), and its run directory, bypassing the status gate; it is scoped by
   construction to that single `runs/<runId>/` and can never touch another run.
   Report its single `report` (`action`, `reason`, removed worktrees/branches,
   `runDirRemoved`) to the user, then **stop**.
