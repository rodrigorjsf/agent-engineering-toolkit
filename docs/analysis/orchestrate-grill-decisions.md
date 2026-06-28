# Orchestrate backlog — grill-with-docs decision ledger

Running ledger of design decisions resolved while grilling the open `orchestrate`
plugin issues (#228, #230–#239). Each entry records the chosen approach, the
rejected alternatives, and the implementation surface. Formal ADRs and issue
comments are produced from this ledger at the end of the session.

**Sequencing (locked):** bugs-first manual pre-wave, then enhancements by
dependency DAG. `#237` is the keystone — until `commands.json` resolves in
worktrees, the capability gate (#230-P1.3), known-failures allowlist (#231-P2.5),
and any self-verification are silent no-ops.

| Tier | Issues |
|------|--------|
| 0 — self-breaking bugs (pre-wave) | #237 (keystone), #238, #236, #233 |
| 1 — capability-gated | #230-P1.3, #231-P2.5, #235 |
| 2 — resilience/state | #230-P1.1, #230-P1.2 → #232-A.1 |
| 3 — DX/epistemic | #231-P2.1/2.2/2.3/2.4, #232-A.2, #239, #234, #228 |

---

## Cross-cutting acceptance criteria (apply to EVERY child issue + PRD #241)

**Documentation in-sync — mandatory acceptance criterion (P0).** Every child
issue and the PRD must keep the plugin's documentation in sync with the change in
the SAME unit of work; no doc drift may be introduced. A change is not "done"
until every touched doc surface is updated in the same change, and this is gated
in review (docs-drift check). The in-sync surfaces for the orchestrate plugin:

- `skills/orchestrate/SKILL.md` — skill prose: phases, steps, gates.
- `skills/orchestrate/references/*.md` — e.g. `run-state.md` (schema/field docs).
- MCP tool descriptions — the Zod `.describe()` strings and `index.ts` tool
  registrations (the tool-facing contract a caller reads).
- `CONTEXT.md` glossary — when a term's meaning changes (e.g. #234's
  `incomplete`).
- `docs/adr/` — when an ADR-worthy decision lands (#237, #240).
- `templates/commands.json` — when the config schema changes (#231-P2.5
  `knownFailures`, #235 `integration`, P2.2 `install`/PM-aware defaults).
- Marketplace version cascade — `plugin.json` + the root marketplace manifest;
  the Cursor entry only if the shape changes.
- User-facing docs under `docs/`, authored via `/docs:update-docs` (vendor-doc
  mirrors excluded).

This criterion is added verbatim to PRD #241 and to each child issue's
acceptance criteria.

---

## Tier 0 — self-breaking bugs

### #237 — fresh worktrees lack `.orchestrate/commands.json` → capability tools no-op  [ADR-worthy]

**Decision.** Resolve `commands.json` from the **main repository root**, not the
worktree's own `repoPath`. Decouple two concerns that are currently conflated in
the single `cwd` (`run-command.ts:350`): *where config is read* (main root, via
`git rev-parse --git-common-dir` whose parent is the main working tree — uniform
for worktree and non-worktree invocations) vs *where the command executes*
(`repoPath`/worktree, so tests run against the slice's code).

**Rejected.**
- *Copy `commands.json` into the worktree at `create_worktree`* — reintroduces
  the commit footgun the issue flags (present-but-untracked file can be staged
  into the slice branch), goes stale if config changes mid-run (relevant to
  #235's `integration` tier), and adds an `.orchestrate/` untracked entry that
  becomes noise in #236. The existing `runInstall` seed precedent does not apply:
  it materializes *build inputs* (node_modules) that must physically exist to
  compile, whereas `commands.json` is *config* that need not live in the worktree
  to be read.
- *Hybrid (resolve from root + copy for human inspection)* — carries both costs
  (footgun + staleness) with no real gain; a human inspecting a failed worktree
  runs `mvn test` directly, not the MCP tool.

**Synergy.** Eliminates #236's `.orchestrate/` noise source (no one needs to
create a worktree-local `commands.json`) and kills the commit footgun by
construction.

**Surface.** `run-command.ts` (config-resolution root via `--git-common-dir`;
keep exec cwd = `repoPath`). Possibly `index.ts` tool descriptions.

### #236 — `verify_changeset`/`recover_changed_files` collapse untracked directories  [no fork]

**Decision.** Add `--untracked-files=all` to the `git status --porcelain -z`
call in `verify-changeset.ts:159` and `recover-changed-files.ts`. Git's default
collapses a new untracked directory into one entry; `-uall` enumerates the files
individually. `parsePorcelainZ` already handles `??` records; gitignored
`node_modules` stays out (gitignored ≠ untracked). No design alternative is
better than the one-flag fix.

**Surface.** `verify-changeset.ts`, `recover-changed-files.ts` (one flag each).

### #233 — `handoff.json` resumePrompt static literal, partition-blind

**Decision.** The orchestrator derives the resume invocation from its own
`runId` prefix (`prd<N>-` → `/orchestrate <N>`; `backlog-` → `/orchestrate`) in
`SKILL.md` §4 and passes it to `spawn_successor` as a new **optional**
`resumePrompt` input. The tool uses `input.resumePrompt ?? config.resumePrompt`;
the static `handoff.json` value becomes a fallback for manual/legacy use. Fix the
misleading `spawn-successor.ts:16–21` comment (its "re-discovery makes it
per-run-aware / runId would be a dead parameter" claim is empirically false for
partitioned runs — re-discovery keys on the invocation prefix, which the static
prompt cannot encode per-run).

**Rejected.**
- *`spawn_successor` derives by reading run-state* — contradicts the tool's
  deliberate no-`runId`/no-run-state design and reintroduces `driverSessionId`
  disambiguation under concurrency. Heavier.
- *Rewrite `handoff.json` at fresh-run start* — `handoff.json` is shared,
  committed, flat config; concurrent runs (ADR-0008) last-write-win on
  resumePrompt (race) and it dirties a committed file. Unsafe.

**Surface.** `SKILL.md` §4 step 2 (derive + pass), `spawn-successor.ts` (optional
input). Both small.

### #238 — run-state `slices` array-vs-map ambiguity, fails maximally late

**Decision.** Doc fix — `SKILL.md` §1 step 6 states `slices` is a **MAP keyed by
issue-id string** with an inline example `"slices": { "25": { ... } }` (the
`references/run-state.md:108` schema is already correct; only the SKILL prose is
ambiguous). Plus a thin `validate_run_state` MCP tool reusing the **existing
Zod schema** the render tools already validate against; the orchestrator calls it
right after the first run-state write, so a mis-shape fails in seconds instead of
after every expensive subagent has run. Also blinds the mid-run resume read
against an array-shaped checkpoint.

**Rejected.**
- *Doc-only* — leaves the late+expensive failure if the LLM orchestrator drifts
  from the prose again.
- *Doc + tolerant render (coerce array→map on `issue`)* — masks the authoring
  error and leaves the mid-run resume read still seeing an array; treats the
  symptom, not the cause.

**Surface.** `SKILL.md` §1 step 6, new `validate_run_state` tool (reuses render
schema), `index.ts` registration.

---

## New issues raised during the grill

### NEW — guarantee cross-run isolation (a new/concurrent invocation must never delete or mutate another run's data)  [ADR-worthy]

**Origin.** User concern: invoking a second `/orchestrate` while another run is
in progress must never delete or alter the other run's data — a deterministic
guarantee, not a prose convention.

**Audit finding (good news).** The guarantee already holds deterministically for
in-progress runs via two independent gates in `clean_runs`:
- **Gate 1 (orchestrator-driven)** — a run absent from the verdict map is
  `skipped` (`no-verdict-from-orchestrator`), strictly intact (`clean-runs.ts:553-557`).
- **Gate 2 (tool-deterministic)** — even when the verdict says `merged`,
  `clean_runs` re-reads the run's own `run-state.json` and refuses unless
  `status === "completed"`; an `in-progress` run is never cleaned
  (`clean-runs.ts:580-586`). `completed` is set only when the final PR opens
  (`SKILL.md:423`), so a concurrent in-progress run is always protected.

Traced the full concurrent scenario (Run A `prd24` mid-wave, Run B `prd30`
fresh): B's sweep skips A (Gate 2), B's run-discovery matches only `prd30-`,
B's fresh run creates disjoint `umbrella-prd30-<ts>` + `runs/prd30-<ts>/`, and
`git fetch --all --prune` only touches remote-tracking refs of branches already
deleted on the remote. In-progress isolation is solid today.

**Decision (Option A — harden the existing status-gate).** Not a hole-fix; a
hardening + guarantee + documentation pass:
1. Elevate Gate 2 from a defense-in-depth code comment to an ADR-recorded,
   test-covered invariant.
2. Extend the status re-check to ANY tool that could delete or mutate cross-run
   data (not just `clean_runs`).
3. Close the adjacent `completed`-but-not-merged fret: require `finalPullRequest`
   non-null as an extra gate before cleanup.
4. Assert (by construction + test) that no tool writes outside its own
   `runs/<runId>/`.

**Rejected.**
- *Per-run lock/heartbeat* — introduces stale-lock reclamation: a crashed run
  leaves an orphan lock that BLOCKS legitimate cleanup, the opposite of the
  goal. The `status` field is self-cleaning (a crashed run stays `in-progress`
  and is correctly protected, reclaimed via the resume / `--failed` path).
- *Both (status-gate + heartbeat backstop)* — carries the lock lifecycle cost
  for protection the status-gate alone already provides for the in-progress case.

**Surface.** `clean-runs.ts` (finalPullRequest gate; factor the status re-check
into a shared guard), any future cross-run-mutating tool, tests, new ADR.
**To file:** new `enhancement` issue on `rodrigorjsf/agent-engineering-toolkit`.

---

## Tier 1 — capability-gated

**Unifying frame:** these three are one verification architecture — what the
orchestrator verifies, when, and against what baseline. All depend on #237
(capability tools must resolve `commands.json` in the worktree first).

### #230-P1.3 — orchestrator-side capability gate before merge  [settled by the issue]

**Decision.** The orchestrator runs the capability tools (`run_build`,
`run_tests`) itself on each slice worktree as a pre-merge gate, **independent of
any subagent envelope** (the reviewer's re-run is a subagent self-report; the
trust chain must not be entirely self-report). Accept the redundancy
(implementer → reviewer → orchestrator) as the trust boundary. The MCP tools
already exist — this is orchestration, a `SKILL.md` gate step, not new tooling.
**Depends on #237.**

### #231-P2.5 — known-baseline-failure allowlist  →  L1 (pattern annotation)

**Decision.** `commands.json` gains an optional `knownFailures` list
(substring/regex patterns). When a capability command exits non-zero, the gate
greps the captured output and **annotates** which known patterns matched, giving
the orchestrator a deterministic hint instead of re-deriving "baseline or
regression?" every slice. Framework-agnostic and cheap.

**Explicit limit.** `run_tests` returns exit-code + capped output, not a
structured test-result list, so L1 is best-effort: it cannot deterministically
assert "0 new failures". The orchestrator still spot-checks when an unmatched
failure indicator is present.

**Rejected.**
- *L3 (structured parse — JUnit XML/TAP/JSON, subtract known test-IDs,
  deterministic "0 new")* — robust but needs per-framework adapters plus
  configuring each test command to emit a structured format. Too heavy for v1;
  the L1 annotation removes most of the re-judgement tax without faking a
  guarantee it cannot deliver. Reconsider if L1 proves insufficient.
- *L2 (count baseline)* — still needs framework-specific count extraction and is
  blind to "same count, different test" (a regression masking a baseline fix).

**Surface.** `commands.json` schema (`knownFailures`), `run-command.ts`
(annotate matched-vs-unmatched), `SKILL.md` gate step.

### #235 — integration tier + post-merge umbrella re-verification  →  tiered cadence

**Key insight.** The per-slice pre-merge gate (P1.3) tests a worktree branched
from the umbrella base = the *prior* wave's integrated state, WITHOUT same-wave
siblings. So post-merge re-verification is only non-redundant from the **2nd
slice of a wave onward** — after slice 2 merges, `umbrella = base+slice1+slice2`,
a combination no worktree ever tested. That is exactly where cross-slice breaks
appear, and why #235 reports "surfacing late".

**Decision (tiered cadence).**
- **Unit/build post-merge re-verify — per slice-merge.** After each slice merges
  onto the umbrella, the orchestrator re-runs `tests`/`build` on the umbrella
  (the 1st slice of a wave is technically redundant with its pre-merge gate and
  may be skipped). Early detection + attribution to the exact slice, reusing the
  fast unit command. Closes #235 gap #2 (no umbrella re-verify on clean
  `MERGEABLE` merges — today only the spurious-conflict path at `SKILL.md:8a.3`
  re-verifies).
- **Integration tier — per wave.** A new optional 5th verb `integration` in
  `commands.json` (heavy: Testcontainers/failsafe). Runs once per wave after the
  wave's slices merge and pass the unit re-verify. Bounded cost (`num_waves`
  runs), localizes a failure to a small slice set. Closes #235 gap #1.

**Rejected.**
- *Per-wave for both* — cheaper but a cross-slice break is seen only after the
  whole wave piled on top of it (the original #235 complaint, merely less late).
- *Integration end-only* — cheapest, caught before the human merges the unmerged
  final PR, but zero localization (whole umbrella broken, unknown slice/wave).

**Surface.** `commands.json` schema (`integration` verb), `SKILL.md` wave loop
(per-slice unit re-verify step + per-wave integration step), capability tool
registration for the new verb.

## Tier 2 — resilience/state

### #230-P1.1 — network retry + verify-push-landed  →  push tool + gh prose

**Key constraint.** The MCP layer deliberately never shells `gh` (`clean-runs.ts:14-16`,
`SKILL.md:137`); the orchestrator owns all forge ops. This splits P1.1 cleanly.

**Decision.**
- **`git push` verify+retry → new MCP `push_and_verify` tool** (git-only,
  respects the invariant): `git push` + `git ls-remote --heads origin <branch>`
  landing check + bounded exponential backoff, fails loud if the branch is absent
  from the remote. The orchestrator calls it instead of raw `git push`. Nails the
  #230 evidence (exit-0 push that never landed → confusing `gh pr create` error).
- **`gh` op retry (pr create/merge/comment, issue edit) → `SKILL.md` prose**: the
  orchestrator wraps gh calls in bounded retry distinguishing transient
  (timeout/5xx/DNS) from permanent. Cannot be MCP without breaking the no-gh
  invariant.

**Rejected.** *All-prose* (the push retry/verify is the silent-failure point the
issue documents — an LLM prose retry-loop is unreliable). *All-MCP* (breaks the
pervasive no-gh invariant; expands MCP blast radius + gh auth surface).

**Surface.** New `push_and_verify` MCP tool + `index.ts` registration; `SKILL.md`
§3 step 6 (call the tool) + a gh-retry note.

### #230-P1.2 — sub-step checkpointing  →  subState + worktree reconstruction + re-validate

**Decision.** Each slice gains a `subState`
(`implemented|verified|reviewed|pushed|pr-open|merged`, mapping section-3 steps)
in run-state, checkpointed at each transition. The resume policy CHANGES: an
in-progress slice is no longer discarded and re-processed from `pending`
(`SKILL.md:202-208`) — it **continues from its recorded `subState`**, the
orchestrator reconstructs the changed-file set from the preserved worktree via
`recover_changed_files` (accurate after the #236 `-uall` fix), **re-validates**
the resume point (verify_changeset / capability gate / `git ls-remote` per the
subState — a crash mid-commit/mid-push can leave uncertain state; re-verify is
cheap vs re-running subagents), and continues without re-spawning completed
subagents. Paired with P1.1: `pushed` is recorded only after `git ls-remote`
confirms the branch on the remote.

**Why reconstruct, not persist.** The worktree is already the source of truth;
reconstructing inter-step data from it (via existing `recover_changed_files`)
keeps the checkpoint lean and reuses machinery, vs persisting envelope payloads
in run-state (bloats the checkpoint, duplicates the worktree, diverges from
worktree-as-truth).

**Rejected.** *Persist envelope payloads in run-state* (heavier, duplicative).
*Keep the discard policy* (the documented waste of expensive implementer +
reviewer turns).

**Surface.** `references/run-state.md` (subState field), `SKILL.md` §1 resume
logic + §3 per-step checkpoints.

### #232-A.1 — incremental slice-branch reclamation  [settled; depends on P1.2]

**Decision.** Delete a slice branch (remote via `gh pr merge --squash
--delete-branch`; local after `remove_worktree`) as soon as it reaches
`subState: "merged"` / `state: "passed"`. The dependency the issue notes — only
reclaim a *truly integrated* branch so a resumable slice never loses a branch it
still needs — is satisfied by P1.2's `subState=merged`. No new `clean_runs`
mode; the whole-run sweep stays the backstop.

**Surface.** `SKILL.md` §3 step 9 (`--delete-branch` on merge + local branch
delete after worktree removal).

## Tier 3 — DX/epistemic

### #228 — auto-close merged issues  →  close on merge→development, orchestrator-driven  [philosophy change]

**Sharpening.** "Merged" is ambiguous: slice→umbrella (the slice vanishes into the
umbrella branch) ≠ umbrella→development (code actually lands in the integration
base). The current design deliberately does NOT close (`SKILL.md:740-742`),
deferring to `Closes #N` trailers on slice commits firing when the human merges
the final umbrella PR — fragile twice over: the trailer may not survive the
squash-merge, and closing keywords only fire on the repo's DEFAULT branch (if
`development` isn't default, never fires).

**Decision.** Close on **merge→development**, orchestrator-driven (correct
semantics: issue closed ⇔ code in development; no premature closure):
1. `Closes #<N>` in the **final umbrella PR body** for each passed slice →
   immediate native close when the integration base is the default branch.
2. **Backstop:** at the start-of-run cleanup sweep, when the orchestrator
   resolves a run's final-PR verdict as `merged`, it explicitly `gh issue close
   <N>` for each still-open passed slice (covers integration-base ≠ default;
   reconciles state). The `gh close` is orchestrator work, not `clean_runs`
   (no-gh invariant preserved).

**Rejected.** *Eager close on slice→umbrella* (premature — umbrella PR rejection
wrongly-closes issues whose code is nowhere). *Fix slice-trailer only* (fragile
across squash + default-branch dependency). *Auto-merge the final PR* (removes
the deliberate human review gate).

**Surface.** `SKILL.md` §2 final-PR body (closing keywords) + §1 sweep (close
passed-slice issues on verdict=merged).

### #234 — intra-issue sub-slicing  →  continue-in-place with handoff note  [changes `incomplete` semantics]

**Decision.** Change `incomplete` from immediate-FAIL to **continue-then-fail**.
The `incomplete` envelope gains a `remainingWork` handoff field; the orchestrator
re-spawns the implementer in the SAME (P1.2-preserved) worktree with that
handoff, until `completed` or a configurable **continuation budget** (routing.json,
the issue's suggestion 3) is exhausted, with a **no-progress guard** (a
continuation that doesn't change the worktree → FAIL, no infinite loop). Reuses
P1.2's worktree preservation; extends the existing `incomplete` status. Orthogonal
to #193 (fan-out budget — necessary but insufficient; a large union of independent
work can't fit one turn regardless of budget).

**Rejected.** *Upfront intra-issue decomposition* (ordered sub-task checklist
tracked in run-state — more structured, handles the largest issues, but heavy:
new decomposer role + sub-task state machine; deferred as a future enhancement if
continue-in-place proves insufficient). *Configurable budget only* (the issue
itself says budget-sizing alone is insufficient).

**Glossary impact.** The CONTEXT.md **Implementer `incomplete` status** entry
("orchestrator treats `incomplete` as a FAILED slice") must be updated: it is now
bounded-continue-then-FAIL.

**Surface.** Envelope schema (`remainingWork`), `validate_envelope`, implementer
subagent defs, `routing.json` (continuation budget), `SKILL.md` §3 step 4.

### #239 — OBSERVED vs INFERRED in failureReason  →  enforceable schema field

**Decision.** The envelope gains `rootCause: { status: "verified" | "hypothesis",
claim, evidence? }` (`evidence` = the command/output when verified). A forcing
function: the subagent must consciously label each root-cause as verified vs
hypothesis; the `validate_envelope` validator (extends #189) can require/warn;
downstream consumers (issue comment, handoff doc, resume session) render the
distinction. The prompt instruction is subsumed (it's how the field is populated).
Cost bounded to FAILED slices.

**Rejected.** *Prompt-instruction only* (unenforceable, no structured downstream
signal — treats the same over-confidence that caused the problem with a nudge of
the same nature).

**Surface.** Envelope schema (`rootCause`), `validate_envelope`, reviewer +
implementer subagent defs, downstream renderers (issue comment / handoff).

### #231-P2.1 — worktree IDE diagnostic noise  →  prose-only  [accepted, no fork]

`SKILL.md` states IDE/language-server diagnostics about worktree paths are
**non-authoritative**; the capability tools are the only source of truth for
build/test. Skip the optional `go.work` emission (low-value, language-specific;
the issue itself calls prose the primary fix — "least plugin-owned surface").

### #231-P2.4 — `mergeStateStatus: UNSTABLE`  →  doc-only  [accepted, no fork]

`SKILL.md` documents that the gate is the `mergeable` field: `MERGEABLE` proceeds
even when `mergeStateStatus` is `UNSTABLE` (no *required* check blocks); only
`UNKNOWN` (recompute) and `CONFLICTING` (resolve) alter the path.

---

## Tier 3 — resolved via the continuation grill (deferred via handoff; now LOCKED)

### #231-P2.2 — subagents cannot prepare new dependencies  [LOCKED]

**Crux (from code).** The implementer/conflict-resolver subagents have
`Read, Edit, Write, Grep, Glob` + the `run_*` capability MCP tools — **no Bash,
no install verb**. They can edit a manifest (`package.json`/`go.mod`) but cannot
download the dependency. `install` runs once inside `create_worktree`
(`worktree.ts:344`), BEFORE implementation, and `detect-project.ts` does not even
emit an `install` (COMMAND_MAPS holds only the 4 capability verbs). So any NEW
dependency a slice introduces is never installed → the build/test gate fails.

**Decision.**
1. **Drop the `needs-dependency: <mod>@<ver>` envelope signal** (the leaning
   rec). The dependency manifest is the deterministic source of truth (it pins
   the version and is already in the slice diff); an envelope signal would be
   subagent self-report. Consistent with #230-P1.3 ("trust boundary, not
   self-report") and #239.
2. **New `run_install` MCP tool** — a thin forwarder over the existing internal
   `runInstall`. Orchestrator-callable on any checkout (also serves #235 umbrella
   re-verify and #230-P1.2 resume reconstruction, since `node_modules` is
   gitignored and the lockfile is the durable artifact).
3. **Subagent self-install.** The implementer + conflict-resolver subagents are
   GRANTED `run_install`. After editing a manifest they call `run_install` →
   `run_build` within their own turn and return a truthful green envelope. The
   orchestrator's independent pre-merge gate (#230-P1.3) is the deterministic
   backstop — a failed/forgotten install makes the gate's build fail and the
   slice fail honestly. (`run_install` is *capability*, not self-report.)
4. **`detect-project` becomes package-manager-aware for the JS ecosystem**,
   keyed on the lockfile, applied to the WHOLE verb set (install + the 4
   capability verbs) for consistency: `pnpm-lock.yaml → pnpm`,
   `yarn.lock → yarn`, `package-lock.json → npm`, no lock → **pnpm** (preferred
   default). Non-JS defaults: go `go mod download` (subagent edits `go.mod`),
   python `pip install -e .`, cargo `cargo fetch`.
5. **install is the mutating/resolving form** (`pnpm install`/`npm install`, not
   `npm ci`) so a new dep resolves + rewrites the lockfile. A project that
   overrides `install` with a strict reproducible form (`npm ci`,
   `--frozen-lockfile`) explicitly forfeits in-slice new-dependency support — the
   subagent has no shell to regenerate the lock. Documented, not a bug.
6. **No runtime npm-fallback (fail-loud).** The lockfile decides the PM; a
   missing pnpm yields a clear `EXEC_ERROR`. A blind pnpm→npm fallback would
   corrupt a pnpm/yarn repo (foreign lockfile in the slice diff) and silently
   switch PMs mid-run.
7. **Ordering.** install runs **before the slice commit** so the updated
   lockfile (`pnpm-lock.yaml`/`package-lock.json`/`go.sum`) lands in the slice
   diff.

**#237 interaction.** install execs with cwd = worktree
(`repoPath: absWorktreePath`), config resolved from the main root — the
dependency lands in the worktree, which is where it must compile.

**Rejected.** Envelope `needs-dependency` signal (self-report; manifest is
deterministic). Orchestrator-driven re-install (worse DX — the subagent's
in-turn build cannot pass; diff-detection lives in the orchestrator). Blind
pnpm-first / runtime npm-fallback (corrupts npm/yarn repos). `npm ci` default
(cannot regenerate the lock for a new dep). install-only PM-awareness (a
pnpm-only environment would still break on `npm test`).

**Surface.** `detect-project.ts` (PM-aware COMMAND_MAPS incl. `install`, lockfile
detection), new `run_install` tool + `index.ts` registration, implementer +
conflict-resolver subagent defs (grant `run_install`), `SKILL.md` §3 (subagent
self-install step; install-before-commit ordering), `run-command.ts`
(`commandsConfigSchema` already carries `install`). Docs-in-sync per the
cross-cutting criterion.

### #231-P2.3 — intra-wave concurrency knob  [LOCKED]

**Frame (the key insight).** Integration is **already sequential**
(`SKILL.md:400-402` — merges into the umbrella must not race). Only the
*subagent work* (investigate/implement/review) is parallel, each slice in its own
worktree branched from the **same** umbrella base (`SKILL.md:395-399`), and
conflicts are **already resolved** by the conflict-resolver. So this knob is a
**performance/reliability** lever (avoid conflict-resolver churn when wave-
siblings touch the same file), **not** a correctness fix — conflicts are never
lost in either mode, only cheaper or costlier. That is what justifies a `parallel`
default.

**Decision.**
- **Knob `intraWaveConcurrency: "parallel" | "sequential"`**, default
  **`parallel`** (preserves current behavior; `sequential` is an explicit opt-in
  for shared-file-heavy repos).
- **Home: `routing.json`, as an optional top-level key** alongside #234's
  continuation budget (routing.json becomes the run-config home). The three
  tier blocks (`trivial`/`standard`/`complex`) stay required; the run-policy keys
  are optional with defaults. Schema change: `routingConfigSchema`
  (`routing.ts:43-47`) gains optional top-level `intraWaveConcurrency` (and the
  #234 budget). Caveat accepted: routing.json now mixes per-tier subagent routing
  with run-wide policy.
- **`sequential` semantics:** process the wave's slices **one at a time**,
  refreshing the umbrella base (reusing the `SKILL.md:351-368` §2-step-1 fetch)
  between each, so slice N branches from `base + slice1..N-1` — guaranteed
  conflict-free at the cost of serializing the wave. It imposes an
  arbitrary-but-deterministic order (e.g. issue-id ascending) on slices the DAG
  says are independent, deciding who "wins" a shared-file region — documented.
- **Manual knob only for v1.** A slice's file set is unknown until its subagent
  runs, so static pre-implementation auto-detection of contention is unreliable.

**Rejected.** New run-config file (re-homes #234's budget; a 2nd policy file —
consistency with #234 wins). `sequential` default (pays the serialization cost in
the common no-conflict case). Static auto-detect (file set unknown
pre-implementation). *Noted as a possible future enhancement:* reactive
fallback — after parallel implementation, diff the wave's changed-file sets and
re-base only the overlapping slices sequentially.

**Surface.** `routing.ts` (`routingConfigSchema` top-level `intraWaveConcurrency`),
`templates/routing.json`, `SKILL.md` §2 wave loop (branch on the knob: the
existing parallel path vs a serial-with-refresh path), `references/run-state.md`
if the mode is surfaced. Docs-in-sync per the cross-cutting criterion.

### #232-A.2 — failed-worktree retention/reclaim  [LOCKED]

**The fact that constrains the design.** The run-level `status` enum is only
`in-progress` | `completed` (`references/run-state.md:84`) — there is **no**
`failed`/`aborted` run status. A crashed or abandoned run stays `in-progress`
forever, indistinguishable from a live run in another session. #240 deliberately
rejected heartbeat/lock, so there is **no runtime signal** separating
crashed-in-progress from alive-in-progress. The automatic `clean_runs` sweep is
status-gated (only `completed` + `merged`, `clean-runs.ts:583-586`) precisely to
protect in-progress runs — so a `--failed` reclaim is, by necessity, the one tool
that may act on a non-`completed` run.

**Decision.**
- **(a) Failed child-issue comment.** On a FAILED slice the orchestrator posts a
  comment on the child issue with `failureReason` + the structured `rootCause`
  from #239 (`verified|hypothesis`) + the preserved worktree path + a resume hint.
  Orchestrator work (gh = orchestrator; no-gh invariant preserved). Ties to #228
  (lifecycle) and #239. This comment is the triage artifact that makes `--failed`
  a deliberate **post-triage** action.
- **(b) `/orchestrate clean --failed <runId>` — human-gated single-run override.**
  A required single `runId`; scoped **by construction** to `runs/<runId>/` +
  branches embedding that runId (`orchestrate/umbrella-<runId>` + the run's slice
  branches) → it can never touch another run, so the #240 invariant ("no tool
  writes outside its own `runs/<runId>/`") holds. It **bypasses the status gate
  by design** — it is the reclaim path #240 itself anticipated. Distinct from the
  existing `force` flag (which still operates *inside* the completed+merged gate).
- **(c) Required interactive confirmation, no bypass.** Because `--failed` is the
  only tool that can delete an `in-progress`-looking run, confirmation is its
  **only** protection — always interactive, no `--yes`. The prompt lists the exact
  deletion set (worktree paths, branches, run dir) and surfaces the run-state
  `updatedAt` **staleness** as an advisory signal (a live run updates it every
  checkpoint, `SKILL.md:746-749`; a crashed run's freezes) — informing the human
  without becoming a gate (no stale-lock problem).

**Residual risk (explicitly accepted, documented).** A genuinely-live run in
another session could be reclaimed by mistake if the developer misjudges. There is
no deterministic guard against this because #240 rejected heartbeat/lock;
confirmation + staleness signal + the post-triage framing are the mitigations.
This is the sanctioned exception to the #240 status gate and **must be recorded in
the #240 ADR** as such (automatic sweeps = status-gated; `--failed` = human-gated
single-run override).

**Rejected.** Status-gated `--failed` (impossible — a crashed run is `in-progress`
forever, so it could never be reclaimed). Hard-gate by `updatedAt` staleness
(reintroduces a threshold guess and can block a legitimate reclaim of a
recently-crashed run — a lighter flavor of the stale-lock problem #240 avoided).
`--yes` bypass (removes the only guard exactly in the non-interactive context
where the mistake is most likely and least visible).

**Surface.** `clean-runs.ts` (new single-run `--failed <runId>` path: required
runId, scoped removal of worktrees + branches + run dir, bypasses the
`status===completed` gate for that one run), `SKILL.md` (the `--failed` mode:
required confirmation listing the deletion set + `updatedAt` staleness; the
post-FAIL child-issue comment with rootCause + worktree path + resume hint), the
#240 ADR (record `--failed` as the sanctioned human-gated exception). Docs-in-sync
per the cross-cutting criterion.

---

## New issues created during the grill

- **#240** — guarantee cross-run isolation (filed `enhancement`). See the
  "New issues raised during the grill" section above for the full decision.
