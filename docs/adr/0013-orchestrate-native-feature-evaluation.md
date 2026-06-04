# Native Claude Code orchestration features evaluated and not adopted for orchestrate

**Status:** accepted (2026-06-04)

The `orchestrate` plugin was evaluated for adopting four native Claude Code
features — **dynamic workflows**, **goals** (`/goal`), **agent teams**, and
**worktrees** — as an *alternative* execution path the plugin would use when the
host session has them available. A source-level evaluation against the plugin's
actual architecture (`origin/development`, v1.3.0) found each feature either
**inferior to** or **architecturally mismatched with** the bespoke machinery
orchestrate already ships — and, critically, none of them survives a session
interruption the way orchestrate's `run-state.json` + `spawn_successor` +
`reclaim_run` checkpoint/resume core does. We adopt **none** of the four. The
context-reduction goal that motivated the evaluation is instead pursued by
**decomposing the orchestrate skill body** (see Consequences).

## Context

Two goals motivated the evaluation, and they can diverge:

1. **Primary — context/token reduction.** The orchestrate `SKILL.md` is 1233
   lines (~18.9K tokens) on `origin/development` and loads in full into the
   orchestrator's always-on context the moment the skill activates, pressuring
   the high-attention "smart zone" at run start.
2. **Hypothesis — native-feature adoption.** Use the new native runtime features
   to "extract the maximum" from the plugin, ideally shedding hand-rolled
   machinery.

The plugin is **distributed** to end users on varied Claude Code versions. A
hard dependency on a version-gated or experimental native feature would break
the plugin silently for users who lack it, so "alternative, not replacement" was
treated as a distribution-correctness requirement, not a preference.

The decisive constraint is orchestrate's **irreducible durable core**: a run is
checkpointed per slice to `run-state.json`, an interrupted run resumes in a fresh
session via `spawn_successor` + `reclaim_run` + `validate_run_state`, and the
orchestrator acts only on each subagent's structured **Result envelope** —
intermediate subagent context is already isolated and never reaches the
orchestrator. None of the four native features preserves work across a session
exit; orchestrate already does.

## Decision

Adopt none of the four native features into the orchestrate execution path.
Pursue context reduction through **decomposition** under an **MCP-first**
container policy (deterministic logic → `orchestrate-mcp` tools, which incur no
Bash permission prompt; judgment-bearing procedure → on-demand `references/`;
genuine orchestration judgment stays in the body). Because nothing is adopted,
**no capability-detection / dual-path layer is built** — there is nothing to
alternate between, and the "alternative, not replacement" concern is satisfied
by construction.

## Considered options

**Worktrees** (GA; `EnterWorktree` tool + `isolation: worktree` frontmatter) —
**rejected: architectural mismatch.** Orchestrate creates **one worktree per
slice, shared and persisted** across the implementer → bounded continue-in-place
loop → reviewer → conflict-resolver spawns, and reuses the last successful
slice's worktree for the deferred per-wave integration merge (`SKILL.md` §3,
wave loop). The native primitives provide neither shape: `EnterWorktree` is
*session-scoped* (it switches the calling session's own working directory, not a
worktree provisioned for delegated subagents), and `isolation: worktree` is
*per-subagent ephemeral* (auto-removed when a subagent finishes clean). The MCP
`create_worktree`/`remove_worktree`/`recover_changed_files` tools exist precisely
because orchestrate needs a provision-for-delegated-agents-and-reuse-across-roles
primitive that no native feature offers. Adoption would also be token-neutral —
the worktree lifecycle is already lean MCP call-sites.

**Goals** (`/goal`) — **rejected: weaker than the existing convergence core, and
no clean agentic path.** A goal's evaluator judges only what has been surfaced in
the conversation; it cannot read `run-state.json`, run the capability commands,
or inspect a worktree — exactly the state orchestrate's convergence depends on.
The one agentic seam, `spawn_successor`, launches the successor with a **single
final positional `resumePrompt`** (`/orchestrate <N>`); it cannot also carry a
`/goal <condition>` without net-new design, and even then the goal would be a
redundant outer driver over a checkpoint-backed loop that is already stronger.

**Dynamic workflows** (research preview) — **rejected: redundant for
orchestrate specifically.** The orchestrator runs as a session main loop, so it
*can* call the `Workflow` tool when the feature is present — the general
context-reduction win of workflows is real. But orchestrate already realizes that
win: every subagent returns envelope-only, with intermediate context isolated.
Compressing a wave into a single workflow digest would also destroy the per-slice
branch / PR / merge state the orchestrator must act on sequentially, and a
workflow **resets on session exit**, conflicting with the durable run model.

**Agent teams** (experimental) — **rejected: cost vs. durability.** The shared
task list with dependencies maps conceptually onto `plan_waves`, but teams are
gated behind a startup env var (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) an
agent cannot set mid-run, are single-team with no nesting, and — decisively —
**do not resume in-process teammates across a session**. Depending on them would
violate the distribution-degradation requirement and forfeit durable resume.

## Consequences

- **No capability-detection / dual-path machinery is built**, and no new
  execution-time permission scope is introduced. The "alternative, not
  replacement" requirement is met by adopting zero, not by alternating paths.
- **Context reduction is delivered by decomposition.** Extracting every
  deterministic-procedure and subagent-delegable block lands the skill body near
  **~750 lines** — still above the project's 500-line `SKILL.md` cap. This
  over-cap residue is the **irreducible orchestration-judgment spine** (roles &
  safety, complexity tiering, wave-concurrency policy, failure narration,
  checkpoint/resume semantics) and is an accepted, documented exception for an
  orchestrator skill, not a defect for the quality gate to "fix."
- **Per-feature reevaluation triggers** (so this is not relitigated each Claude
  Code release):
  - *Dynamic workflows* — when a workflow gains **durable cross-session resume**
    (survives session exit) and the orchestrator can launch it programmatically.
  - *Worktrees* — when a native primitive can **provision a worktree for
    delegated subagents and reuse it across multiple spawns** (not session-scoped
    or per-subagent-ephemeral).
  - *Goals* — when an **agent-callable goal tool** exists whose evaluator can
    read external state (`run-state.json`, command output), not only the
    conversation surface.
  - *Agent teams* — when teams reach **GA with multi-team support and in-process
    teammate resumption** across sessions.
- **`CONTEXT.md`** gains glossary terms under `### Orchestrate run vocabulary`
  recording the decomposition vocabulary and this evaluation outcome (applied
  after the working tree is synced to `origin/development`, whose `CONTEXT.md` is
  ahead).
- **Open issues are reframed**, not closed: the seed issue #229 moves from "adopt
  these features" to "evaluated and rejected — decomposition is the path"; the
  bespoke continue-in-place and per-slice-capability reconciliations (#267,
  #268-A) resolve to "build the bespoke fix; no native feature would replace it."
