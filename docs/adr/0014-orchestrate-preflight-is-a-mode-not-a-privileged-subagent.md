# orchestrate pre-flight setup is an orchestrator mode, not a privileged subagent

**Status:** accepted (2026-06-05)

The `orchestrate` pre-flight pass — the one-time run setup (config bootstrap,
backlog fetch, partition, wave planning, umbrella branch, first validated
`run-state.json` checkpoint) that issue #286 introduces — so the operator can
review the resulting partition and wave plan at the checkpoint before committing
to the expensive wave loop — is implemented as a **third orchestrator mode**
(`/orchestrate preflight <PRD#>`, alongside the normal run and clean), driven by
the orchestrator itself.
It is explicitly **not** implemented as a subagent that performs the setup off
the main thread (issue #286's "Proposal B"). The orchestrator keeps doing every
`gh` and `git` operation, exactly as it already does for a normal run; pre-flight
only changes *when* that work happens (its own pass) and *where it stops* (before
the wave loop), not *who* is allowed to touch the tracker and remotes.

## Context

The obvious way to take setup cost off the execution session is to delegate it to
a subagent — the bootstrap work (9+ `gh issue view` reads, partition, wave plan)
is the kind of bounded task subagents exist for. A future engineer will look at
the pre-flight mode and reasonably ask, "why is the orchestrator doing this inline
instead of spawning a setup subagent?" This ADR records the answer so the mode is
not "improved" into a safety regression.

The mode's *purpose* is the staged-inspection gate — stop at a reviewable
partition + wave plan before committing the run — **not** token relocation.
Post-#293 the execution window is ~1M tokens and the bootstrap residue a delegated
setup would shed is ~2% of it, so even the one genuine advantage a subagent would
have (moving the issue-body reads off the main thread) does not serve the actual
goal. The safety cost of a privileged subagent buys nothing the feature needs.

The decisive constraint is the plugin's central safety invariant (`SKILL.md`
"Roles and the safety boundary"; ADR-0009): **all four bundled subagents —
investigator, implementer, reviewer, conflict-resolver — have no Bash, no `git`,
and no `gh` access. Only the orchestrator touches branches, remotes, and the
tracker.** A bootstrap subagent would *require* `gh issue list`/`gh issue view`
(backlog + issue bodies) and `git fetch`/`branch`/`push` (umbrella branch).

## Considered options

- **A — orchestrator mode (chosen).** Pre-flight is a mode the orchestrator runs.
  No new subagent role, no change to the safety boundary, and it reuses the
  existing exactly-one-match resume path verbatim (the bootstrap-written
  checkpoint needs no new resume semantics). It delivers the staged-inspection
  gate — a reviewable partition + wave plan checkpoint before the wave loop — with
  no new role. Any token saving for the execution session is incidental and small
  (~2% of a ~1M window post-#293), not the justification.
- **B — privileged bootstrap subagent (rejected).** A new
  `orchestrate:bootstrapper` subagent with a scoped `gh`-read + `git`
  branch/push grant. It would move the dominant read cost off the main thread —
  but it punctures the "no subagent touches git/gh" invariant that is the
  plugin's whole safety story. Every future security review would then carry the
  exception, and the puncture is hard to walk back once a shipped feature depends
  on it. The MCP-only half of B (`partition_backlog`, `plan_waves`,
  `validate_run_state` without the `gh` reads) leaves the dominant cost on the
  main thread and defeats the point.

## Consequences

- The pre-flight mode's procedure (run-lifecycle Fresh-run steps 1–6, then stop
  before the wave loop) lives in `references/preflight-mode.md`, loaded on demand;
  the always-loaded spine gains only the Section-0 dispatch branch. Deterministic
  procedure stays out of the spine, consistent with ADR-0013.
- The safety boundary (ADR-0009) is unchanged: no new privileged role exists, and
  there is still exactly one actor — the orchestrator — that touches `git`, `gh`,
  and branches.
- If a privileged setup subagent is ever genuinely warranted, it is a deliberate,
  separately-reviewed exception to ADR-0009 with its own threat model — not an
  incremental tweak to this mode.
