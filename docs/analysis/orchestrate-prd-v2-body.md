## Problem Statement

Operators run the `orchestrate` plugin for long, autonomous, multi-wave runs that
implement a backlog of `ready-for-agent` issues end to end. Real runs
(`prd19-20260530-035027`, `prd24-20260602-145053`) surfaced a cluster of defects
and gaps that, together, undermine the plugin's core promises — "an interrupted
run resumes", "no slice merges on unverified state", "concurrent runs stay
isolated", and "merged work is reflected on the tracker":

- **Self-breaking bugs.** Fresh slice worktrees lack `.orchestrate/commands.json`,
  so the capability tools silently no-op (`not-configured`) and the verification
  loop — the safety boundary — does nothing. The `slices` run-state shape is
  documented ambiguously and fails maximally late (after all expensive subagents
  run). `verify_changeset` mis-flags a correct changeset as `mismatch` when files
  land in a new directory. The context-handoff successor resumes the wrong
  partition because `resumePrompt` is a static literal.
- **Shallow verification.** Merge readiness trusts subagent self-report; there is
  no integration-test tier; clean-but-semantically-broken cross-slice merges are
  never re-verified on the umbrella; a known pre-existing red test forces per-slice
  re-judgement.
- **Fragile resilience.** Network operations have no retry and a push can report
  success without landing; slice integration is not sub-step checkpointed, so a
  resume discards expensive completed work; a large issue maps to a single
  implementer turn and tends to FAIL `incomplete`.
- **Lifecycle and hygiene gaps.** Merged issues are never closed on the tracker;
  failed-slice worktrees have no surfaced, reclaimable handle; slice branches
  accumulate until the whole-run sweep; a confident-but-wrong root-cause diagnosis
  propagates as established fact.
- **Cross-run isolation is convention, not guarantee.** A new or concurrent
  `/orchestrate` invocation must never delete or mutate another in-progress run's
  data, with a deterministic mechanism rather than prose the orchestrator LLM
  follows.

## Solution

A hardening pass — "orchestrate hardening v2" — applied in dependency order:
bugs-first as a manual pre-wave, then enhancements by the dependency DAG.

The keystone is making `.orchestrate/commands.json` resolve inside slice worktrees:
until that holds, the orchestrator-side capability gate, the known-failure
allowlist, and any self-verification are all silent no-ops. Resolution is done by
reading `commands.json` from the **main repository root** (via the worktree's
shared git common dir) while still **executing** capability commands in the
worktree — decoupling "where config is read" from "where the command runs".

On that foundation: the orchestrator runs the capability tools itself as an
independent pre-merge gate; a known-failure allowlist annotates baseline failures
so they are not re-judged each slice; a new integration tier and a tiered
post-merge umbrella re-verification catch cross-slice breakage early; a
`push_and_verify` tool plus bounded gh-retry survive transient outages; sub-step
checkpointing lets a resume continue from where it stopped instead of redoing
expensive work; an `incomplete` implementer is continued in place rather than
failed; issues are closed when their code actually lands in `development`; failed
worktrees and slice branches get deliberate reclamation; root-cause prose carries
a verified-vs-hypothesis label; and cross-run isolation becomes a deterministic,
tested invariant.

## User Stories

1. As an operator, I want a slice worktree's capability tools to find the
   project's `commands.json`, so that build/test verification actually runs
   instead of silently no-opping.
2. As an operator, I want capability commands to execute against the slice's own
   code while reading config from the project root, so that tests reflect the
   slice but configuration stays single-sourced.
3. As an operator, I want a changeset that adds files in a brand-new directory to
   verify as `matched`, so that a correct implementer result is not mis-flagged as
   `mismatch`.
4. As an operator, I want a context-handoff successor to resume the same PRD
   partition the interrupted run owned, so that automatic handoff never widens or
   mis-targets scope.
5. As an operator, I want a malformed `run-state.json` shape to fail within
   seconds of the first write, so that I do not discover it only after every
   expensive subagent has run.
6. As an operator, I want the orchestrator to independently run build and tests on
   each slice worktree before merging, so that a merge never depends solely on a
   subagent's self-report.
7. As an operator, I want a known pre-existing failing test declared once, so that
   each slice's gate does not force me (or the orchestrator) to re-judge "baseline
   or regression?".
8. As an operator, I want an integration-test tier I can configure, so that
   acceptance criteria that depend on integration tests are actually verifiable.
9. As an operator, I want the umbrella re-verified after slices land, so that a
   textually-clean but semantically-broken cross-slice merge is caught early
   rather than after the whole wave piled on top of it.
10. As an operator, I want network operations retried with bounded backoff, so
    that a transient API outage does not strand a long run.
11. As an operator, I want a push confirmed to have landed on the remote before a
    PR is opened, so that a silent push failure does not surface as a confusing
    "Head ref must be a branch" error later.
12. As an operator, I want an interrupted slice to resume from its last completed
    sub-step, so that a ~170k-token implementer turn and a deep review are not
    discarded to redo already-verified work.
13. As an operator, I want a large, well-specified issue to be continued across
    additional implementer turns in place, so that it is not systematically biased
    toward an `incomplete` FAIL.
14. As an operator, I want each issue closed when its code actually merges into
    `development`, so that the tracker reflects the real state without manual
    closing — and is never closed prematurely.
15. As an operator, I want a failed slice's preserved worktree discoverable from
    the tracker and reclaimable by a deliberate command, so that it is neither
    lost nor left lingering forever.
16. As an operator, I want a merged slice's branch reclaimed immediately after it
    integrates into the umbrella, so that dead branches do not accumulate until
    the whole-run sweep.
17. As an operator, I want a root-cause diagnosis labeled verified vs hypothesis,
    so that a confident-but-wrong environmental claim does not propagate as fact
    and cost the next session re-investigation.
18. As an operator, I want a second `/orchestrate` invocation to be unable to
    delete or mutate another in-progress run's data, guaranteed by a status check
    in the tools, so that concurrent runs are safely isolated.
19. As an operator, I want IDE/language-server diagnostics about worktree paths
    treated as non-authoritative, so that the orchestrator does not waste
    reasoning refuting false-positive diagnostics.
20. As an operator, I want `mergeStateStatus: UNSTABLE` documented as non-blocking,
    so that a mergeable PR is not subjected to needless per-slice deliberation.
21. As a developer reviewing the run, I want the final integration pull request to
    carry closing keywords for every passed slice, so that merging it into the
    default branch closes those issues natively.
22. As a maintainer, I want every resolved design decision recorded with its
    rejected alternatives, so that a future reader understands why each path was
    chosen.

## Implementation Decisions

Grouped by the dependency tier established during the grilling session. The full
rationale, rejected alternatives, and per-decision implementation surface live in
the decision ledger (`docs/analysis/orchestrate-grill-decisions.md`).

**Sequencing.** Bugs-first manual pre-wave, then enhancements by the DAG. `#237`
is the keystone — until `commands.json` resolves in worktrees, the capability gate
(#230-P1.3), known-failures (#231-P2.5) and any self-verification are silent
no-ops. `#230-P1.2` (sub-step checkpoint) unblocks `#232-A.1` (incremental
reclamation).

**Tier 0 — self-breaking bugs.**
- #237 — capability tools resolve `commands.json` from the main repository root
  (via the worktree's shared git common dir), **decoupled** from the execution
  cwd (still the worktree). Single source of truth; no commit footgun; no
  staleness.
- #236 — `verify_changeset` and `recover_changed_files` enumerate untracked files
  individually (`--untracked-files=all`) so a new untracked directory is not
  collapsed into a single entry.
- #233 — the orchestrator derives the resume invocation from its own `runId`
  prefix (`prd<N>-` → `/orchestrate <N>`; `backlog-` → `/orchestrate`) and passes
  it to `spawn_successor` as an optional input; the static `handoff.json` value is
  a fallback only.
- #238 — `SKILL.md` states `slices` is a MAP keyed by issue-id string (with an
  inline example), plus a thin run-state shape validator the orchestrator calls
  right after the first write (reusing the render tools' existing schema) so a
  mis-shape fails fast.

**Tier 1 — capability-gated (depend on #237).**
- #230-P1.3 — the orchestrator runs the capability tools itself on each slice
  worktree as a pre-merge gate, independent of any subagent envelope.
- #231-P2.5 — an optional `knownFailures` pattern list in `commands.json`; the
  gate annotates which known patterns matched a failing command's output (L1,
  best-effort, framework-agnostic; not a structured "0 new" guarantee).
- #235 — a new optional `integration` capability verb run once per wave, plus a
  tiered post-merge umbrella re-verification: unit/build re-verified per slice
  merge (early, precise attribution), integration per wave (bounded cost).

**Tier 2 — resilience/state.**
- #230-P1.1 — a new `push_and_verify` MCP tool (git push + `git ls-remote` landing
  check + bounded exponential backoff, git-only to respect the no-gh-in-MCP
  invariant); `gh` op retry stays orchestrator prose.
- #230-P1.2 — each slice gains a `subState`
  (`implemented|verified|reviewed|pushed|pr-open|merged`); resume continues from
  the recorded sub-step, reconstructing the changed-file set from the preserved
  worktree via `recover_changed_files` and re-validating the resume point, instead
  of discarding the in-progress slice.
- #232-A.1 — a slice branch is reclaimed (remote via `--delete-branch`, local
  after worktree removal) as soon as it reaches `subState: merged`.

**Tier 3 — DX/epistemic.**
- #228 — issues close on merge→`development`: closing keywords in the final
  umbrella PR body (immediate native close when the integration base is the
  default branch) plus an orchestrator backstop that `gh issue close`s passed
  slices when the cleanup sweep confirms the final PR merged.
- #234 — `incomplete` becomes continue-then-fail: the envelope carries a
  `remainingWork` handoff; the orchestrator re-spawns the implementer in the same
  preserved worktree until `completed` or a configurable continuation budget is
  exhausted, with a no-progress guard.
- #239 — the envelope gains a `rootCause` object with a
  `status: verified | hypothesis` tag (and evidence when verified) so root-cause
  prose carries its epistemic standing through every downstream hop.
- #231-P2.1 — `SKILL.md` declares worktree IDE/language-server diagnostics
  non-authoritative; the capability tools are the only build/test source of truth.
- #231-P2.4 — `SKILL.md` documents `mergeStateStatus: UNSTABLE` as non-blocking;
  the gate is the `mergeable` field.

**New — #240 (cross-run isolation).** The deterministic in-progress protection in
`clean_runs` (re-read the run's own `run-state.json`; refuse unless
`status: completed`) is elevated to an ADR-recorded, test-covered invariant,
extended to any cross-run-mutating tool, tightened to also require a non-null
`finalPullRequest`, and complemented by an assertion that no tool writes outside
its own run directory.

**Still pending (deferred to a follow-up grill; tracked in this PRD).**
- #231-P2.2 — `detect-project` sets a language-aware `install`; an implementer
  envelope `needs-dependency` signal for orchestrator fetch-and-retry of new deps.
- #231-P2.3 — an `intraWaveConcurrency: parallel | sequential` knob.
- #232-A.2 — surfaced failed-worktree pointer + an `/orchestrate clean --failed
  <runId>` reclaim mode.

## Testing Decisions

A good test exercises external behavior through a module's public interface, not
its internals; it survives a refactor that preserves behavior. Test creation
follows the project's red-green-refactor loop (`/tdd`).

The deep, isolation-testable modules introduced or modified here:

- **Config-resolution root** (capability command loading) — given a worktree path,
  resolves `commands.json` from the main working tree while executing in the
  worktree; covered with a real worktree fixture, asserting both the resolved
  config and the execution cwd.
- **`push_and_verify`** — push, landing check, and bounded-backoff retry as a
  structured result that never throws; transient-vs-permanent classification.
- **Run-state shape validator** — accepts a map-shaped `slices`, rejects an
  array-shaped one with a clear, early error (reusing the render schema).
- **Untracked-file enumeration** — files added in a new untracked directory are
  enumerated individually, so `verify_changeset` returns `matched` not `mismatch`
  (and the same for `recover_changed_files`).
- **`spawn_successor` resume override** — pure command construction: an explicit
  `resumePrompt` input wins over the static config value.
- **Known-failure annotation** — a failing command's output is annotated with the
  matched known patterns; an unmatched failure indicator is surfaced.
- **`rootCause` envelope schema** — the validator accepts and classifies a
  verified-vs-hypothesis root cause; a missing status is surfaced.
- **`subState` run-state schema** and the **`integration` verb** schema extension.
- **`clean_runs` isolation gate** — an `in-progress` run is never cleaned whatever
  the verdict says; a `completed`-but-`finalPullRequest`-null run is skipped.

Prior art: the existing MCP tool tests under `orchestrate-mcp` (the tools are
validated against their Zod schemas; `verify_changeset`/`recover_changed_files`
already share `parsePorcelainZ`; pure command-construction is already unit-tested
for `spawn_successor`). `orchestrate-mcp/dist/` is committed — rebuild after any
`src/` change.

## Out of Scope

- The three pending sub-parts (#231-P2.2, #231-P2.3, #232-A.2) are part of this
  PRD's umbrella but their design is NOT finalized — they are deferred to a
  follow-up grilling session and must not be implemented from leaning
  recommendations alone.
- Structured per-framework test-result parsing (L3 for known failures) — explicitly
  rejected for v1 in favor of the L1 pattern annotation.
- Upfront intra-issue decomposition (an ordered sub-task checklist) — deferred; v1
  uses continue-in-place. Revisit only if continue-in-place proves insufficient.
- Auto-detection of shared-file contention for the intra-wave concurrency knob.
- A per-run lock/heartbeat mechanism for isolation — rejected in favor of the
  self-cleaning status gate.
- Per-PRD configuration override layers — the config files stay shared and
  read-only during a run; the only genuinely per-run value (resumePrompt) is
  derived, not stored.
- Auto-merging the final integration PR — the human review gate stays.

## Further Notes

- Dependency DAG (prose, not encoded as `Blocked by` edges because the issues
  bundle independent sub-parts so issue-level edges would be approximate): #237 is
  the keystone for all capability-gated work; #230-P1.2 unblocks #232-A.1. When the
  work is sliced finer at orchestration time, precise `Blocked by` edges are added
  then.
- The child issues are the existing #228, #230–#240; each is linked to this PRD via
  its `Parent` field. #231 and #232 are partially locked — their per-sub-part status
  is recorded in their issue comments.
- ADR-worthy decisions to record from this work: the config-resolution-root
  decoupling (#237) and the cross-run isolation invariant (#240).
- Glossary impact: the CONTEXT.md **Implementer `incomplete` status** entry must be
  updated — `incomplete` is now bounded-continue-then-FAIL, not immediate FAIL.
- Respects ADR-0008 (concurrent run management) and ADR-0009 (subagent advisor
  policy); the no-gh-in-MCP invariant is preserved throughout.
