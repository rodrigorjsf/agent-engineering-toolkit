# Orchestrate cross-run isolation is a status-gated invariant

**Status:** accepted (2026-06-02)

Invoking a second `/orchestrate` while another run is in progress must never
delete or mutate the other run's data — a deterministic guarantee, not a prose
convention. The guarantee already holds today through two independent gates in
`clean_runs`: a run absent from the orchestrator's verdict map is left strictly
intact, and even a `merged` verdict is refused unless the run's own
`run-state.json` reports `status: "completed"` — an `in-progress` run is never
cleaned, and `completed` is set only when the final integration pull request
opens. This ADR **elevates that from a defense-in-depth code comment to a
recorded, test-covered invariant**: (1) the status re-check extends to any tool
that could delete or mutate cross-run data, not just `clean_runs`; (2) cleanup
additionally requires a non-null `finalPullRequest`; (3) no tool writes outside
its own `runs/<runId>/`, asserted by construction and by test.

The **one sanctioned exception** is `/orchestrate clean --failed <runId>`. There
is no `failed` run status — the run-level `status` enum is only `in-progress` |
`completed` — so a crashed or abandoned run stays `in-progress` forever,
indistinguishable from a live run in another session. Reclaiming it therefore
requires a tool that **bypasses the status gate by design**, scoped by
construction to the single named `runs/<runId>/` and the branches embedding that
runId, and protected only by a **mandatory interactive confirmation** that lists
the exact deletion set and surfaces the run-state `updatedAt` staleness as an
advisory signal. Automatic sweeps are status-gated; `--failed` is the human-gated
single-run override. This exception is implemented as the `reclaim_run` MCP tool
(non-interactive, gate-bypassing execution) plus the `/orchestrate clean --failed`
skill path (the mandatory interactive confirmation, deletion-set preview, and
`updatedAt` advisory) — and its gate-bypassing, cross-run-isolation, and
idempotency behaviors are pinned by the `reclaimRun` test suite.

## Considered Options

- **Per-run lock / heartbeat** — rejected: it introduces stale-lock reclamation,
  where a crashed run leaves an orphan lock that *blocks* legitimate cleanup —
  the opposite of the goal. The `status` field is self-cleaning: a crashed run
  stays `in-progress`, is correctly protected, and is reclaimed via the resume or
  `--failed` path.
- **Status-gate plus a heartbeat backstop** — rejected: carries the lock
  lifecycle cost for protection the status-gate already provides for the
  in-progress case.
- **A status-gated `--failed`** — rejected as impossible: a crashed run is
  `in-progress` forever, so a status gate could never permit its reclamation,
  defeating the purpose of the flag.

## Consequences

- Cleanup now requires verdict = `merged` **and** `status` = `completed` **and**
  `finalPullRequest != null`.
- `--failed` carries a **residual risk** — a genuinely-live run in another
  session reclaimed by a developer's misjudgement — accepted deliberately,
  because the lock/heartbeat that would be the only deterministic guard was
  rejected above. Confirmation, the `updatedAt` staleness signal, and the
  post-triage framing (a `--failed` reclaim follows the failed child issue's
  triage comment) are the mitigations.
- The shared status re-check is factored into one guard reused by every
  cross-run-mutating tool.
