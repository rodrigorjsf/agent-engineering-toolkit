# Orchestrate gains a slice-executor delegation layer

**Status:** accepted (2026-08-02)

Orchestrate gains a third agent layer. A **Slice executor** subagent owns one slice
end to end — investigation, implementation, review, and the **Capability gate** — and
returns a single validated **Result envelope**. It spawns the worker roles itself,
which nested subagent spawning makes possible. The orchestrator keeps every operation
requiring git, forge, or tracker authority, plus wave ordering and the run checkpoint.

The decisive constraint on the design was not whether the layer could exist but **where
its authority stops**. The originating proposal gave the executor task ordering, loop
termination, and failure classification. Only the last of those is granted here.

## Context

The orchestrator accumulates, per slice, an investigator brief, an implementer envelope,
a capability-gate result, a reviewer envelope, and a changeset verdict. Over a
multi-wave run that growth is what fills the session and triggers the context handoff.
The proposal that opened this decision aimed at exactly that: keep the orchestrator's
context minimal by delegating a whole slice to a specialist.

Three of the proposal's premises did not survive verification, and the corrections
shaped the outcome more than the proposal did.

**Nested subagents work.** The vendor mirror in this repository stated that a subagent
cannot spawn another subagent. A probe disproved it: a subagent spawned a subagent, and
the harness recorded `parentAgentId` and `spawnDepth` in its own metadata. A second probe
confirmed the same for a subagent with a restricted `tools:` list that includes `Agent`;
a negative control confirmed that omitting `Agent` removes the tool. Upstream now
documents this as a supported pattern and describes almost this exact use — a subagent
that dispatches workers so intermediate output never reaches the main conversation. The
mirror and its two derived wiki pages were re-synced.

**`effort` is not parametrizable per spawn.** It is frontmatter-only, so varying it costs
one definition file per level. That is precisely why the `-standard`/`-deep` variant pair
already exists, and why ADR-0015 renamed `routing.json`'s legacy `effort` key to
`variant`.

**The orchestrator already avoids subagent prose.** The **Result envelope** trust chain
established that before this decision. The proposal's stated goal was therefore partly
already met, which reframed the question from *how do we stop it reading reports* to
*what per-slice state can it stop holding at all*.

**This is not a reversal of ADR-0013.** That decision evaluated four native features —
dynamic workflows, goals, agent teams, and worktrees — and adopted none. Nested subagents
were not among them and were not a documented feature when it was written. This is
adoption of a fifth capability on its own grounds, and none of ADR-0013's four
reevaluation triggers has fired.

## Decision

**Authority splits along the evidence/authority seam.** The executor owns everything up
to a verified changeset. The orchestrator owns everything that mutates shared state:
worktree lifecycle, commit, push, pull request, merge, tracker writes, wave ordering, and
the run checkpoint. The workers keep no `Agent` tool, so the tree cannot grow deeper by
accident.

**Ordering and termination stay computed.** `plan_waves` orders, wave selection gates on
blockers, and the run terminates by wave exhaustion. The executor returns a briefing for
whoever picks up the next slice; it is advice carried forward, never a selection. Making
the executor choose would have replaced a deterministic guarantee with a judgment call,
eliminated intra-wave parallelism, and made the run's scope emergent — breaking the
invariant that a resumed run never re-derives its own scope.

**Classification descends, policy stays.** The executor observes each failure and returns
a **Failure class**; the orchestrator maps that class to a triage label and writes it. The
single-writer invariant over tracker state is untouched.

**Resume granularity is preserved by a record the executor owns.** A **Slice progress
record** is written at each completed stage. The orchestrator does not read it: it passes
the path forward and a fresh executor resumes itself. When an envelope is missing or
invalid, the orchestrator recovers the record's contents through an MCP tool rather than
by reading the file — the same structured-recovery posture as the **Worktree fallback**.

**The read boundary is enforced mechanically, as defence in depth.** A plugin-level
pre-tool hook denies the orchestrator any read of slice-internal artifacts and injects a
corrective reminder, distinguishing the orchestrator from a subagent by the agent
identity the hook event carries.

**Routing, premium lane, and budgets follow existing mechanisms.** The executor joins the
`-standard`/`-deep` pair. The orchestrator still freezes **Resolved slice routing** at
slice creation, reading routing labels exactly once, and passes it in the briefing; the
executor performs the one-time **Model fallback** and records the guard in its progress
record. The executor gets the graceful incomplete self-report the implementer has, and
because two continue-in-place loops now nest, the bound applies to the **product** of
their budgets, capped at 6.

## Considered options

**A separate Claude Code process per slice** — rejected as unnecessary. It was the
leading candidate while nesting was believed impossible, and `spawn_successor` proves the
machinery works. Once the probe showed nesting is native, the process boundary bought
nothing and cost cold-start on every slice, process lifecycle management, and
envelope-over-file instead of envelope-over-return.

**A teammate in an agent team** — rejected, and it would have required relitigating
ADR-0013. Teams remain experimental behind a startup environment variable an agent cannot
set mid-run, and in-process teammates do not resume across sessions. The operator offered
to enable the variable; the probe made the offer moot.

**No new layer** — rejected, though it was a genuine contender. The envelope chain already
isolates prose, so the remaining win is per-slice state rather than always-loaded tokens.
That win is real: the orchestrator holds one envelope per slice instead of five artifacts,
and it is the growth curve that triggers handoff.

**The executor selects the next slice** — rejected; see *Decision*.

**A free-form minimal return instead of an envelope** — rejected. A truncated free-form
return is indistinguishable from a legitimate completion, which is exactly the failure the
envelope validator exists to prevent.

**A permission rule instead of a hook** for the read boundary — rejected: permission rules
apply to the whole session, so they would restrict the executor too, and they cannot carry
a corrective message back to the model.

## Consequences

- **The slice pipeline changes owner.** Its procedure moves from an orchestrator-loaded
  reference into a skill preloaded by the executor's definition. The orchestrator's
  spine loses its per-slice mechanics and keeps the wave loop, the checkpoint, and the
  forge operations.
- **Spawn budgets become a first-class concern.** A parallel wave now holds roughly twice
  as many live agents, and per-slice spawn count rises from about three to five. Wave
  width is capped up front, a concurrency-limit error is treated as backpressure rather
  than a slice failure, and the context watchdog watches the session spawn budget
  alongside tokens.
- **The terminal-spawning handoff path is retired**; the watchdog and its flag stay. Any
  replacement continuation mechanism must be proven empirically before `spawn_successor`
  is removed, because it is currently the only proven one.
- **The read guard is not available everywhere.** Enterprise policy can disable plugin
  hooks, so the prose rule in the orchestrator's own instructions stays load-bearing. A
  later refactor must not delete it on the grounds that the hook covers it.
- **The delegation path has no test coverage.** The new deterministic surface — the
  envelope role, the progress record's schema, the routing entry, the recovery tool, the
  wave-width computation — is unit-testable against the existing suite. The nested-agent
  behaviour is not, and nothing in this repository exercises it.
- **The continuation ceiling is an arbitrary starting point.** Six is chosen without run
  data. The honest risk is that a legitimately wide slice — the kind the two-axis tiering
  deliberately promotes to `complex` to buy turns — trips it and reads as a false
  negative. Revisit once real runs have exercised the counter.
- **ADR-0013 gains a forward pointer** recording that a fifth native capability arrived
  and was adopted separately, so this is never misread as a reversal.
- **ADR-0009 is superseded on intent**, resolved separately during the same session: the
  advisor tool is injected into subagents regardless of frontmatter, and subagent advisor
  use is accepted because enabling the feature is the operator's choice.
