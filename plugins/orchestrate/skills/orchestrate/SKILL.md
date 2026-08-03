---
name: orchestrate
description: Implement a backlog of ready-for-agent GitHub issues end to end — order them into dependency waves, run implementer and reviewer subagents in isolated worktrees, merge slice pull requests into an umbrella branch, and checkpoint progress so an interrupted run resumes. Use when the user wants to autonomously orchestrate agent-driven implementation of tracked issues, or invokes /orchestrate in one of its three modes — a normal run (/orchestrate or /orchestrate <PRD#>); /orchestrate clean (including --force, or --failed <runId>) to remove the footprint of concluded or crashed runs; or /orchestrate preflight <PRD#>, the pre-flight pass that stages and inspects a run's setup before the wave loop.
---

# Orchestrate

Drive a backlog of `ready-for-agent` GitHub issues from open to reviewed, merged
slices — ordered by dependency, processed wave by wave, with no human in the
loop. The run checkpoints after every step, so an interruption resumes instead
of restarting.

This `SKILL.md` body is the **Orchestrator judgment spine** — the non-mechanizable
orchestration judgment that cannot be extracted to an `orchestrate-mcp` tool or a
subagent. Deterministic procedure lives in the MCP tools; the step-by-step
operational mechanics of each phase live in on-demand `references/*.md`, loaded
only when that phase runs. Read the spine top-to-bottom for the decision
narrative; follow each pointer into its reference for the mechanics. (The spine
is the irreducible judgment residue; after the #275 procedural-prose relocation
it lands near ~425 lines, **within** the project's 500-line `SKILL.md` cap. A
documented over-cap exception for this spine remains on record — see `CONTEXT.md`
and ADR-0013 — so the spine is never flagged as bloat should its judgment grow
back over the cap; do **not** generalize that exception to any other skill.)

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

Every role except the orchestrator exists in two variants — `-standard`
and `-deep`. The `resolve_routing` tool picks the variant and model per role
from the issue's complexity tier **and its routing labels** (section 3, step 2).
Each role is spawned by
its **namespaced** subagent type — `orchestrate:investigator-<variant>`,
`orchestrate:implementer-<variant>`, `orchestrate:reviewer-<variant>`, and
`orchestrate:conflict-resolver-<variant>`, where `<variant>` is `standard` or
`deep`. The `orchestrate:` prefix is required: the plugin registers its bundled
subagents under that namespace, so a bare, un-namespaced name fails to resolve.
All four subagents have **no Bash and no git access** — they are sandboxed to
one worktree (the investigator is read-only). Only the orchestrator touches
branches, remotes, and the tracker.

**Routing labels — read once, frozen, suggested never applied.** A slice issue
may carry a `route:*` label that patches its routing (e.g. `route:fable`, the
label-gated implementer-only premium lane). `resolve_routing` reads those labels
**exactly once**, at slice creation (section 3, step 2): the orchestrator passes
the issue's labels to the tool and **freezes** the returned `{model, variant,
optional fallback}` into the slice's `resolvedRouting` checkpoint field. A
resumed run routes from that frozen checkpoint, **never** from live GitHub
labels — relabelling an issue mid-run changes nothing. The orchestrator may
**suggest** a `route:*` label for a slice in its report but **never applies one
itself** — the same self-promotion guard that forbids it from re-tiering a slice
upward by writing a label (it routes; it does not relabel). The label semantics,
the configured-vs-unconfigured outcomes, and the Fable lane's security exclusion
are in `references/prerequisites.md`, co-located with the `routing.json` schema.

IDE or language-server diagnostics about files under a worktree path —
unresolved imports, missing-module errors, or stale type errors from a checkout
that lacks generated or installed artifacts — are **non-authoritative**. The
orchestrate capability tools (`run_typecheck`, `run_build`, `run_tests`,
`run_lint`) are the only source of truth for whether a slice builds and its
tests pass; trust their result, never an editor's inline diagnostic.

## Prerequisites

Check the prerequisites (`gh` authenticated, an `origin/development` integration
base, the MCP server available, branch protection open on the orchestrate
branches) before starting; if one is missing, report it and stop. The target
project's `.orchestrate/` config is completed on every run by `bootstrap_config`
(called unconditionally, never gated on whether the directory already exists)
or may be committed ahead of time; a `falseGreenRisk` result is itself a
"report it and stop" condition. See `references/prerequisites.md`.

## 0. Modes — run, clean, preflight

This skill has three modes, selected by the invocation argument.

- **No `clean`/`preflight` argument** (`/orchestrate` or `/orchestrate <PRD#>`) —
  the normal orchestration run. Proceed through sections 1–4 below.
- **The `clean` argument** (`/orchestrate clean`, optionally
  `/orchestrate clean --force`, or `/orchestrate clean --failed <runId>`) — the
  **`/orchestrate-clean` mode**. Run **only** the cleanup path, then **stop**.
  Do **not** discover or start a run, do not read the backlog, do not create
  branches. The on-demand sweep, `--force`, and the single-run
  `--failed <runId>` gate-bypassing reclaim are in `references/clean-mode.md`.
- **The `preflight` argument** (`/orchestrate preflight <PRD#>`) — the
  **pre-flight pass** mode: the staged-inspection gate (not token relocation).
  **Detect-and-stop guard, evaluated here before section 1:** scan every
  `.orchestrate/runs/*/run-state.json` for any run whose `runId` starts
  `prd<N>-` for the invoked `<N>` (the trailing dash is load-bearing — `prd2-`
  must not match `prd29-`), **regardless of status** (this scan is broader than
  section 1's `in-progress`-only run-discovery — a concluded-but-uncleaned run
  still counts). If any match exists → report that run and **stop**; never fall
  through to section 1. On **zero matches**, run **only** `references/preflight-mode.md`
  (fresh-run steps 1–6, the resumable checkpoint, then the **capability probe** —
  which executes the configured verbs once in a throwaway dependency-free
  checkout and reports, per verb, what the gate will actually verify), then
  **stop before the wave loop** — no slice branch and no slice worktree is
  created, do not enter section 2. A failing probe is a loud report, never a
  stop: the checkpoint is already written and the operator decides whether to
  resume. `bootstrap_config`'s `falseGreenRisk` stop (Prerequisites, above) is
  unchanged and fires earlier.

## 1. Start or resume the run

On startup, set a completion goal with `/goal` so the session keeps working turn
after turn and does not yield control before the run is done; an autonomous run
must not stop mid-wave. Before discovering or starting a run, run the
**start-of-run cleanup sweep** (the same sweep `/orchestrate clean` performs),
then **discover the active run** by scanning every in-progress
`run-state.json` and matching this invocation's `prd<N>-`/`backlog-` partition
key. The sweep mechanics, the run-discovery scan, and the fresh-run steps 1–6
are in `references/run-lifecycle.md`. The run-discovery scan resolves to one of
three outcomes — **zero matches** (start a fresh run), **exactly one match**
(resume it, per the checkpoint/resume semantics and the resume re-validate
matrix below), or **two or more matches** (a loud error: never silently pick
one; report every matching `runId` and stop for the operator to resolve).

### Complexity tiering — the judgment that drives routing

When the fresh run parses each issue (`references/run-lifecycle.md`, step 3), it
assesses the issue's **complexity tier** — `trivial` (a small, localized
change), `standard` (an ordinary feature or fix), or `complex` (broad,
cross-cutting, or high-risk work). The tier drives routing in section 3.

Weigh **two independent axes** when assessing the tier, and take the higher of
the two:

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

### Checkpoint / resume semantics

On **exactly one match**, resume that run. Its `runId` is the directory name.
First clear that run's stale handoff flag: if
`.orchestrate/runs/<runId>/context-flag.json` exists, delete it — it is the
predecessor's handoff trigger, now consumed, and leaving it would make this
session hand off immediately (section 2, step 4). Then load the whole
`run-state.json`, preserving every top-level field. **Validate the loaded
checkpoint before acting on it** — call `validate_run_state`; on
`status: "invalid"` (e.g. a legacy array-shaped `slices`), **stop loudly**
rather than resume from a malformed checkpoint. **Refresh the
`driverSessionId`** to this new session's `$ORCHESTRATE_SESSION_ID` (or `null`
if empty/unset), or the `context-watchdog` keeps matching the predecessor's
stale identity and automatic context-handoff is lost.

**Resume reloads only the matched run's partition and run directory** — the
`slices` and `waves` already persisted are the run's scope, fixed at fresh-run
time. Do **not** re-fetch the backlog, re-call `filter_to_one_parent_prd`, or
re-call `partition_backlog`: a resumed run never widens or re-derives its own
scope. Every slice in a terminal state (`passed`, `failed`, `skipped`) is left
untouched — completed work is never redone. Every slice still `in-progress` was
interrupted before finishing; resume it **from its recorded `subState`**
(section 3 writes this at every per-slice transition) rather than re-processing
from scratch: **preserve** its `worktreePath` and `sliceBranch`, reconstruct its
changed-file set with `recover_changed_files`, **re-validate** the resume point
per the matrix below, then resume section 3 at the next uncompleted step
**without** re-spawning the subagents whose work the recorded `subState` already
captures. An in-progress slice with **no `subState`** (a legacy checkpoint) uses
the old discard path instead — discard its worktree+branch and coerce it back to
`pending`. The full discard mechanics and the run-discovery scan live in
`references/run-lifecycle.md`. Checkpoint the refreshed `run-state.json`, then
skip to section 2.

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

**Resume routing is frozen, not re-derived (the fallback-aware dimension).**
Orthogonal to the `subState` row above: when a resumed in-progress slice
**re-spawns** any subagent (the rows that do not skip the implementer/reviewer),
it routes **only** from the slice's frozen `resolvedRouting` checkpoint — its
recorded `model`, `variant`, and `fallback` — never from live GitHub labels and
never by re-calling `resolve_routing`. A slice whose `resolvedRouting.fallbackTaken`
is `true` (a premium-spawned implementer that already failed over to the fallback
model in the prior session, section 3) resumes on that **frozen fallback model**
— the premium lane is **not** re-applied and the one-time fallback is **not**
re-armed. This keeps routing deterministic across a handoff: the label was read
once at slice creation, and the checkpoint — not the issue's current labels — is
the source of truth for every re-spawn.

On resume the implementer's *declared* `filesChanged` is gone, so the
reconstructed `recover_changed_files` set feeds the reviewer prompt and the
step-6 commit staging exactly as the live path uses the declared set. Do
**not** route reconstruction through `verify_changeset` (it needs a
`declaredFiles` argument that no longer exists on resume). For pre-push
subStates the capability gate is the re-validate; for `pushed`/`pr-open` it is
`git ls-remote` / `gh pr view`.

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

**The wave-concurrency policy — the decision rationale.** The two settings buy
different guarantees, and the choice is a deliberate judgment:

- **`parallel` (the default)** processes a wave's independent slices
  concurrently — each in its own worktree, spawned in a single message at each
  shared subagent stage — then integrates them **sequentially** (merges into the
  umbrella must not race). Because every slice branches from the wave's
  *starting* umbrella, a parallel wave needs the per-slice post-merge unit
  re-verify and may need the conflict-resolver when two slices touch the same
  region. How many of a wave's slices run at once is **capped**, not unbounded:
  each in-flight slice holds two live agents (its executor plus the one worker
  that executor is running), so the wave's width is planned against the
  session's concurrent-subagent limit (`run_wave` `plan-wave-width`) and the
  remainder is deferred, keeping its state. A refusal that slips through anyway
  is **backpressure, never a slice failure** — the slice returns to the queue
  unchanged (`run_wave` `classify-spawn-outcome`). Both are in
  `references/wave-loop.md` step 3.
- **`sequential`** processes the wave's slices **one at a time, in issue-id
  ascending order**, each branching from `base + slice1..N-1` — the integrated
  state of every earlier slice in the wave. This imposes a deterministic order
  on slices the DAG calls independent (deciding who "wins" a shared-file region)
  and in exchange is conflict-free without the conflict-resolver, at the cost of
  intra-wave parallelism.

Process waves in order, starting at index `completedWaves`. For each wave, refresh
the umbrella base (`run_wave` `refresh-base`), select the processable slices
(`run_wave` `select-processable`, gating on in-partition and out-of-partition
blockers), process them per the concurrency policy above, integrate sequentially
with the per-slice post-merge unit re-verify and the per-wave integration suite
(`run_wave` `integration-gate`), then checkpoint the wave and report progress to
the PRD. When the last wave is done, open the **final integration pull request**
(umbrella → `development`, left unmerged, one `Closes #<N>` per passed slice).
The full per-wave mechanics, the `run_wave` operations, and the final-PR
mechanics are in `references/wave-loop.md`. After each slice integrates, and at
the matching point on the `sequential` path, check for
`.orchestrate/runs/<runId>/context-flag.json`: if it exists, finish the current
slice's `run-state.json` write and go to section 4 (Context handoff) rather than
starting the next slice.

## 3. Processing one slice

These are the per-slice steps the wave loop invokes. Update the slice's entry in
`run-state.json` and write the file at every state change. The step-by-step
procedure — create worktree, resolve routing, the investigator/implementer/
reviewer spawn mechanics, the changeset scope check, the pre-merge capability
gate, commit+push via `finalize_slice`, the slice PR, merge, conflict resolution
via `resolve_merge_conflict`, and finishing via `finalize_slice` `post-merge` —
is in `references/slice-pipeline.md`.

**The result-envelope trust chain.** Every subagent ends its turn with a **result
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

This validated-envelope chain extends through the whole pipeline: the implementer
envelope is cross-checked against the worktree by `verify_changeset` (step 4a),
and after the reviewer returns `passed` the orchestrator runs its **own**
deterministic pre-merge capability gate (step 5a) rather than trusting the
reviewer's self-reported `verification` — the last link in the
`implementer → reviewer → orchestrator` trust chain. Each link's mechanics are
in `references/slice-pipeline.md`.

## 4. Context handoff

A long run can exhaust this session before every wave is done — by filling its
context **or** by spending its subagent-spawn budget. The `context-watchdog`
hook bundled with this plugin watches **both**: token usage against the context
window, and **this session's** recorded spawn count against the session spawn
budget (default 200, at roughly five spawns per slice — the spawn log is kept
per run but counted per session, so a successor starts from a fresh budget). It writes
`.orchestrate/runs/<runId>/context-flag.json` past whichever threshold is
reached first — at most once per run either way — recording which one in the
flag's `trigger` field. When the wave loop (section 2, step 4) sees that flag,
hand the run off to a fresh Claude Code session instead of continuing — the
successor resumes from the `run-state.json` checkpoint exactly as section 1
describes. See `references/context-handoff.md` for the full mechanism.

The watchdog binds to the correct run by matching this session's identity:
it compares the hook event's `session_id` against each in-progress run's
`driverSessionId`, and writes the flag only under the matching run's directory.
When exactly one run is in-progress, the watchdog flags that run even without
a matching identity — with a single run there is no wrong run to flag, so
`driverSessionId: null` (because `$ORCHESTRATE_SESSION_ID` was unavailable at
run start) does **not** suppress handoff. **Degraded mode** — no automatic
context-handoff for that invocation — applies only when several runs proceed
concurrently and the session cannot be disambiguated; the watchdog writes no flag
rather than risk flagging the wrong run, and the run stays correct.

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
validated implementer envelope has `status: "blocked"` — or `status: "incomplete"`
**after** the continue-in-place loop exhausts the continuation budget or trips
the no-progress guard (a single `incomplete` no longer FAILs immediately; see
§3 step 4) — a validated reviewer envelope has `status: "failed"`,
`verify_changeset` reports
the implementer's declared file set does not match the worktree
(`empty-but-declared` or `suspiciously-empty`, or a `status: "error"`), the
staged changeset is empty, or a merge conflict the `conflict-resolver` cannot
fix. The orchestrator decides FAILURE **only** from the validated envelope and
tool results — never from a subagent's prose. An invalid or missing envelope is
always a FAILED slice; it is never treated as success.

**Model fallback — one premium-spawn interception before FAILED.** A
**premium-spawned** implementer (one whose `resolvedRouting` carried a `fallback`
because a `route:*` label patched it — e.g. `route:fable`) gets **one** rescue
before the slice is declared FAILED. When such an implementer fails in a way the
fallback covers — a model **refusal**, a retention/safety **400**, or an
**invalid/missing envelope** — and the slice's `resolvedRouting.fallbackTaken` is
not yet set, the orchestrator **re-spawns it exactly once on the fallback model**
(`resolvedRouting.fallback.model`, e.g. `opus`) in the **same** worktree, sets
`resolvedRouting.fallbackTaken: true`, and narrates the swap in the final report
("fable declined → served by opus"). This swap is a **model exchange**, distinct
from the same-model continue-in-place loop: it does **not** consume or increment
`continuationBudget`, and `fallbackTaken` is a **persisted slice-level** once-only
guard (set in the checkpoint, surviving a handoff) — so the fallback fires at most
once across the initial spawn and every continuation. A fallback that is absent
(no premium label), already spent (`fallbackTaken` already `true`), or that does
not apply (a *valid* `blocked` envelope is a genuine obstacle the fallback model
would not fix) leaves the ordinary FAILED taxonomy above unchanged. The mechanics
— where the re-spawn runs and how the checkpoint is written — are in
`references/slice-pipeline.md` (the model-fallback step adjacent to step 4).

The implementer envelope's `incomplete` status is the implementer's graceful
turn-budget self-report — partial, resumable work, carrying a `remainingWork`
handoff — as opposed to `blocked` (an unrecoverable obstacle) or an `invalid`
envelope (a hard turn-limit cutoff that truncated the envelope). Unlike `blocked`
and `invalid`, a single `incomplete` does **not** FAIL the slice: it drives the
bounded continue-in-place loop (§3 step 4), where the orchestrator re-spawns the
implementer in the same preserved worktree with the `remainingWork` until it
returns `completed` or the loop terminates. An `incomplete` slice FAILs **only**
when one of two terminal causes is reached:

- **Budget exhausted** (resumable) — `continuationsUsed === continuationBudget`
  and the last envelope is still `incomplete`. The `failureReason` names the
  budget exhaustion ("implementer reported `incomplete` after exhausting the
  continuation budget of N; partial work preserved in the worktree for
  resumption"); label `needs-info`.
- **No progress** — a continuation returned `incomplete` whose worktree
  content-fingerprint equals the prior one (the re-spawn changed nothing). The
  `failureReason` names the no-progress stall; label `needs-triage`.

In both terminal cases the `failureReason` must name the cause precisely so a
developer can tell a resumable budget exhaustion apart from a genuine stall. An
`incomplete` slice's worktree holds usable partial work — preserve it (as every
FAILED slice's worktree is preserved) so the slice can be resumed.

Once the taxonomy above has classified a slice as FAILED, the orchestrator's
mechanical actions on it — surfacing the envelope's `rootCause`, setting `state`
to `failed` with a `failureReason` and the right `needs-info`/`needs-triage`
label, preserving the worktree, recovering the changed-file set via
`recover_changed_files` when the envelope was the failure cause, posting the
triage comment, and continuing the wave — are in `references/failure-handling.md`.

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
only at a slice's terminal state (see `references/slice-pipeline.md` step 9 for
the pass label command and *Failure handling* for the failure label command), as
PRD progress/summary comments (see `references/wave-loop.md` step 6 and the
final-PR paragraph), and as **issue closes** on merge→development (below). The
parent PRD issue receives a progress comment after each wave and a final summary
when the run completes. Issue-closing is part of the single-writer role —
alongside labels and progress comments — and is **not** delegated to subagents.

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
  sweep (section 1, `references/run-lifecycle.md`) covers the gap: on a `merged`
  verdict it collects each passed slice's issue number from `run-state.json`
  (before `clean_runs` deletes it) and runs `gh issue close <N>` — orchestrator
  work, idempotent if the native keyword already fired (an already-closed issue
  exits 0).

This is orchestrator `gh` work; `clean_runs` stays git + filesystem only and
never shells `gh` (the no-`gh` invariant). The slice-commit `Closes #<N>`
trailer (`references/slice-pipeline.md` step 6) and the slice pull request's
`Implements #<N>` body are **unchanged** — the trailer is now harmless
reinforcing redundancy, and `Implements` remains the deliberate non-closing
slice→umbrella verb; the lifecycle no longer relies on either.

**`gh`-op resilience (prose, not a tool).** Wrap every `gh` operation —
`gh pr create`, `gh pr merge`, `gh pr view`, `gh issue edit`, `gh issue
comment` — in a bounded retry that **distinguishes transient failures (network
timeout, 5xx, DNS) — retry with backoff — from permanent failures (auth,
validation, not-found) — fail immediately**. This is orchestrator prose rather
than an MCP tool **because the MCP layer never shells `gh`** (the no-`gh`
invariant): forge-op resilience is the orchestrator's responsibility. It stays a
one-line spine pointer here — **not** a phase-loaded reference — precisely
because it is cross-cutting: it applies at the **first and every** `gh` op, with
no single phase to load under, so a phase-scoped reference would load late (or
never) relative to the ops it governs; it lives adjacent to the single-writer
invariant it reinforces. The `push_and_verify` MCP tool covers the git-push half
of the same #230 failure mode (an exit-0 push that never lands); this note covers
the `gh`-op half — together they close #230.

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
