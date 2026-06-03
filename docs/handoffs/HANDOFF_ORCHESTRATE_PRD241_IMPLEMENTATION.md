# Handoff: PRD #241 — orchestrate plugin hardening v2 — AFK implementation

**Created:** 2026-06-03
**Status:** ready to execute (no code written yet — this is the executable plan)
**Companion script:** [`prd241-afk-implementation.workflow.js`](./prd241-afk-implementation.workflow.js) (embedded verbatim in Appendix A)
**Decision ledger (source of truth for every design choice):** `docs/analysis/orchestrate-grill-decisions.md`
**ADRs:** `docs/adr/0011-orchestrate-config-resolution-root.md` (#237), `docs/adr/0012-orchestrate-cross-run-isolation-invariant.md` (#240)

---

## 1. Purpose & scope

Implement **all of PRD #241** — the orchestrate plugin's own hardening backlog: 12 child
issues (#228, #230–#240) decomposed into **19 sub-items** — end to end, **AFK**
(autonomously, no human in the loop), via a single **harness dynamic workflow**. Every
design decision is already locked in the decision ledger; this handoff turns those
decisions into a faithful, code-grounded, step-by-step execution plan plus the runnable
engine that drives it.

**Out of scope:** redesign. The specs in §11 implement the *locked* decisions verbatim —
do not re-grill them. If a spec and the ledger ever disagree, the **ledger wins** and the
spec is the bug.

---

## 2. Engine decision — and why not the `/orchestrate` plugin

**Engine: one harness dynamic workflow, Bash-verified, worktree-isolated, processed
strictly sequentially.** This is *not* the `/orchestrate` plugin.

The reason is structural: **PRD #241 fixes the orchestrate plugin itself**, and the
keystone bug (#237) makes the plugin's MCP capability tools (`run_build`, `run_tests`)
**silently no-op inside worktrees** until #237 lands. Driving the buggy plugin to fix its
own bugs is the dogfooding catch-22. The harness workflow sidesteps it entirely: its
agents verify with **Bash** (`npm run build && npm test`) instead of the plugin's broken
MCP tools, so none of the Tier-0 machinery has to work first.

The honest tradeoff accepted here (chosen by the operator): the harness gives **working
verification** but the orchestration is **hand-authored agent prose** — every git / gh /
merge / conflict action is an `agent()` call, because the workflow script itself has no
shell or filesystem access. For 19 interdependent slices that heavily share the plugin's
core files, that is more fragile than the plugin's tested orchestration — which is exactly
why the schedule is **fully sequential** and every merge is **post-validated** (§6).

---

## 3. Execution model — the conflict-free sequential order

Each sub-item is one **slice**: its own git worktree + branch, cut from the **umbrella tip**
at the moment its turn starts, squash-merged back into the single umbrella branch
`orchestrate/umbrella-prd241` (itself branched off `development`).

**Parallelism ≈ 1 (effectively serial), by design and by necessity.** 18 of the 19
sub-items edit `SKILL.md`; under the hard rule "two items that touch the same file are
never in the same wave," 18 private waves are *forced* — that is the mathematical floor,
and the schedule hits it exactly. This is the operator's explicit requirement —
*"sequential to remove the possibility of parallelism conflicts"* — satisfied by
construction, not by luck.

**The order (18 waves, flattened — this is the execution sequence):**

| Wave | Item | Issue | src/? | What it does |
|------|------|-------|-------|--------------|
| 0 | #237 | 237 | ✅ | **Keystone** — resolve `commands.json` from main repo root; decouple read-cwd vs exec-cwd |
| 1 | #236 | 236 | ✅ | `--untracked-files=all` in verify_changeset + recover_changed_files |
| 1 | #231-P2.4 | 231 | — | doc-only: merge gate is the `mergeable` field; `UNSTABLE` is non-blocking |
| 2 | #230-P1.1 | 230 | ✅ | `push_and_verify` MCP tool (push + ls-remote landing check + backoff) + gh-retry prose |
| 3 | #230-P1.2 | 230 | — | `subState` checkpointing + worktree reconstruction + re-validate on resume |
| 4 | #239 | 239 | ✅ | `rootCause { verified\|hypothesis }` envelope field on FAILED slices |
| 5 | #232-A.1 | 232 | — | incremental slice-branch reclamation at `subState=merged` |
| 6 | #228 | 228 | — | auto-close merged issues on merge→development (orchestrator-driven) |
| 7 | #231-P2.1 | 231 | — | doc-only: worktree IDE diagnostics are non-authoritative |
| 8 | #230-P1.3 | 230 | — | orchestrator-side capability gate before merge (depends on #237) |
| 9 | #233 | 233 | ✅ | orchestrator derives resumePrompt + passes to spawn_successor (optional input) |
| 10 | #231-P2.3 | 231 | ✅ | `intraWaveConcurrency` knob (routing.json top-level) |
| 11 | #231-P2.5 | 231 | ✅ | `knownFailures` allowlist (L1 annotation) — depends on #237 |
| 12 | #238 | 238 | ✅ | slices-is-a-MAP doc fix + thin `validate_run_state` MCP tool |
| 13 | #240 | 240 | ✅ | cross-run isolation — harden the status-gate (finalPullRequest gate + shared guard) |
| 14 | #232-A.2 | 232 | ✅ | failed child-issue comment + `clean --failed` single-run override (depends on #239, #240) |
| 15 | #235 | 235 | ✅ | `integration` verb (per wave) + unit re-verify (per slice-merge) (depends on #237, #230-P1.3) |
| 16 | #231-P2.2 | 231 | ✅ | `run_install` tool + subagent self-install + PM-aware detect-project (depends on #237) |
| 17 | #234 | 234 | ✅ | `incomplete` → continue-in-place with `remainingWork` (depends on #230-P1.2) |

Every `dependsOn` resolves to a strictly-earlier wave; the keystone #237 is solo in wave 0.
The only width-2 wave is wave 1 (`#236` is the single item that avoids `SKILL.md`,
`#231-P2.4` touches only `SKILL.md` → provably disjoint). The companion script processes
even wave 1 serially for simplicity — the wall-clock cost of one extra serial slice is
negligible and it keeps the merge path uniform.

---

## 4. Agent roster

The roster the operator requested (implementer, reviewer, fix, conflict-resolver) plus the
ones that "make sense" for an AFK run. All verify via **Bash**, never the plugin's MCP
capability tools.

| Agent | When | Mandate | Key tools |
|-------|------|---------|-----------|
| **implementer** | every slice | Reads the §11 spec, cuts a worktree from the umbrella tip, makes exactly the spec's changes, installs deps, builds + tests via Bash, commits the slice branch. | Read, Edit, Write, Grep, Glob, Bash |
| **reviewer** | every slice | Checks the slice diff against the spec's acceptance criteria (incl. docs-in-sync), confirms in-scope, re-runs build+test via Bash. | Read, Grep, Glob, Bash |
| **fixer** | on review-fail or post-merge red (≤2 attempts) | Repairs the specific failure in the worktree/umbrella without scope creep; re-verifies to green. | Read, Edit, Write, Bash |
| **integrator** | every slice | Opens the slice PR, squash-merges into the umbrella, runs **post-merge** build+test on the umbrella, rebuilds dist/ when src/ changed, removes the worktree. | Read, Bash, Grep |
| **conflict-resolver** | on merge conflict OR post-merge red (≤2 attempts) | Resolves the umbrella↔slice conflict, or repairs a post-merge integration break, honoring both sides + the spec; re-verifies to green and **pushes the umbrella**. | Read, Edit, Write, Bash |
| **investigator** *(optional)* | complex slices only | Produces a short research brief before the implementer when a slice is broad/high-risk (e.g. #230-P1.2, #234). | Read, Grep, Glob |
| **finalizer** | once, at the end | Consolidated version cascade bump + opens the held umbrella→development PR with `Closes #N`. **Never merges it.** | Read, Edit, Write, Bash |

Model guidance: implementer/fixer/conflict-resolver on the heavier slices (the src/ MCP
items) benefit from the stronger model; doc-only slices (#231-P2.1/P2.4, #228) can run on a
faster tier. The script leaves model to the run default; override per `agent()` call if
desired.

---

## 5. Shared-file contention map

Why the schedule is serial — file-touch counts across the 19 sub-items:

| File | # items touching it | Consequence |
|------|--------------------|-------------|
| `skills/orchestrate/SKILL.md` | **18 of 19** (all but #236) | forces 18 private waves — the floor |
| `.claude-plugin/plugin.json` + root `marketplace.json` | 15 each | the version cascade — **consolidated into one final bump** (§8), not per-slice |
| `orchestrate-mcp/dist/index.js` | 11 | rebuilt+committed per src/ slice; serialized like source |
| `orchestrate-mcp/src/index.ts` | 10 | tool-registry edits serialize the new-tool items |
| `references/run-state.md` | 7 | #230-P1.2, #238, #231-P2.3, #234 … |
| `run-command.ts` | 4 (#237, #235, #231-P2.5, #231-P2.2) | the capability-core serializers |
| `routing.ts` / `validate-envelope.ts` / `clean-runs.ts` | 2 each | pin specific pairs into distinct waves (240↔232-A.2; 231-P2.3↔234; 239↔234, 239↔231-P2.2) |

`dist/*.js` paths are in the file lists too, so dist/ merge conflicts are impossible by
construction (serialized like any source file), not merely by ordering.

---

## 6. Per-slice merge protocol (applied after EACH slice)

Waves run in order 0→17; within a wave, items merge one at a time. After each slice:

1. **Branch isolation.** The slice worktree is cut from the **current umbrella tip** when
   its wave starts — so the later item of any same-file pair always branches *after* the
   earlier merged. (Wave 1's two items branch from the same tip; safe because disjoint.)
2. **Merge** the slice branch into the umbrella. **On conflict:** do not force-resolve
   inline — spawn a **conflict-resolver** (standard, escalate to deep on a hard conflict).
   Conflicts should be impossible given the disjoint-file invariant; the resolver is the
   safety net for any drift (an item touching a file it did not declare).
3. **Post-merge validation** on the umbrella: re-run `npm run build` then `npm test` in
   `plugins/orchestrate/orchestrate-mcp` via Bash. A green claim must map to a real run
   captured this turn.
4. **On post-merge red** (an integration break that was green in the worktree): spawn a
   **fixer** with the failing output + the just-merged diff; it repairs on the umbrella;
   re-run step 3 until green before advancing.
5. **dist/ rebuild discipline.** Whenever the slice changed any `src/` file (the `src/?`
   column in §3), rebuild dist/ on the umbrella (`npm run build`), commit the regenerated
   artifacts in the **same** step, and **push the umbrella** (`git push origin
   orchestrate/umbrella-prd241`). Tests run against `src/`, so green tests alone do **not**
   prove the shipped bundle is current; and an unpushed rebuild (or any local umbrella
   commit — fixer/conflict-resolver repairs included) is silently lost when the next slice
   does `git fetch origin <umbrella>:<umbrella>`. Doc/config-only slices skip the rebuild.
6. **Checkpoint** the slice as merged+validated before the next item, so an interrupted
   AFK run resumes at the right wave/item instead of re-merging.

---

## 7. AFK merge / PR / gate policy

- **Slice → umbrella merges auto-merge** (internal integration; squash + delete-branch).
- **The final umbrella → `development` PR is opened and the run STOPS.** It is **never**
  auto-merged. The operator reviews **one large combined diff** (set this expectation — it
  is the safety valve for AFK merges that pass build/test but are behaviorally subtly
  wrong) and merges it manually.
- **Auto-close on approval — fully-implemented issues only.** The final PR body carries a
  `Closes #N` trailer for **each child issue whose every sub-item merged**. An issue with
  any failed or skipped sub-item is only *partially* implemented and is **deliberately left
  off** the `Closes` list — it stays open for the remaining work. Merging the PR on
  `development` (the default integration base) closes the listed issues natively (the #228
  mechanism, which works today). PRD #241 closes when all its children close — so a partial
  run leaves #241 open too.
- A **failed slice never aborts the run** — it is left preserved (worktree on disk) and
  reported. Every slice whose dependency failed or was skipped is itself **SKIPPED** (it
  would otherwise branch from an umbrella missing the dependency's code and could merge
  silently-wrong work). Failed + skipped sub-items are surfaced in the final PR body for
  triage. (For the orchestrate plugin's own `--failed` reclaim path, see #232-A.2.)

---

## 8. dist/ rebuild + consolidated version cascade

- **`orchestrate-mcp/dist/` is committed.** Every `src/` slice rebuilds + commits dist/ in
  its own merge step (§6.5). 13 of 19 items touch src/ (the `src/?` column).
- **Version cascade is consolidated into ONE final bump** (the finalizer, §7), not done
  per-slice. The per-item specs in §11 list the cascade under docs-in-sync, but doing it 15
  times would serialize 15 version bumps and produce an absurd history. Instead the
  finalizer bumps `plugin.json` + the root `marketplace.json` entry + top-level version
  **once** (magnitude mirrors the release — a feature minor bump unless a breaking change
  shipped), per the plugin-versioning cascade convention. The Cursor entry changes only if
  its shape changed.

---

## 9. Checkpointing, resumability & failure handling

- The workflow is **resumable**: relaunch with `{scriptPath, resumeFromRunId}` — completed
  `agent()` calls return cached results, so an interrupted run continues at the first
  unfinished slice. (Same script + same args → 100 % cache hit.)
- A slice that fails after its bounded fixer/conflict-resolver attempts is recorded
  `failed` with a structured `rootCause` (verified|hypothesis + evidence, per #239) and its
  worktree is preserved. The run continues; every slice depending on it is `skipped`. The
  final PR body lists merged vs. failed vs. skipped.
- **Umbrella-push discipline:** the umbrella is the integrated source of truth *only if*
  every local commit on it is pushed. The slice merge lands via `gh pr merge` (remote), but
  the post-merge dist rebuild, fixer repairs, and conflict-resolver commits happen on the
  local umbrella and **must** be `git push origin <umbrella>`-ed before the next slice
  fetches the tip — otherwise they vanish.
- **Iron law:** every "green" is a real Bash run captured in the slice's turn, never an
  assumption.

---

## 10. How to run

```text
# From the repo root, when ready to launch the AFK run:
Workflow({ scriptPath: "docs/handoffs/prd241-afk-implementation.workflow.js" })

# Watch live:
/workflows

# Resume after an interruption:
Workflow({ scriptPath: "docs/handoffs/prd241-afk-implementation.workflow.js", resumeFromRunId: "<runId>" })
```

**Safety notes.**
- The run creates real worktrees, branches, slice PRs, and umbrella merges. It opens — but
  never merges — the final `development` PR.
- Pre-flight: ensure a clean working tree, `gh` authenticated, and `development` up to date.
- The umbrella branch name `orchestrate/umbrella-prd241` is fixed in the script; change it
  there if a prior run left one behind.
- Per project policy, route any test creation through `/tdd`, and remember the
  `orchestrate-mcp/dist/` rebuild on every `src/` change.

---

## 11. Per-item implementation specs

The full, code-grounded spec for each sub-item, **in execution (wave) order**. Each was
produced by an agent that read the locked ledger entry plus the actual source; each is
faithful to the ledger (the ledger remains the tiebreaker). Acceptance criteria include the
docs-in-sync surfaces per the cross-cutting P0 criterion.

### #237 — Resolve `commands.json` from the main repository root; decouple read-cwd from exec-cwd  [KEYSTONE, Tier 0 pre-wave, ADR-worthy → ADR-0011 already accepted]

**Locked decision (one line).** Resolve `.orchestrate/commands.json` from the **main repository root** (derived via `git rev-parse --git-common-dir`, whose *parent* is the main working tree — uniform for worktree and non-worktree invocations) while still executing the capability/install command with `cwd = repoPath` (the slice worktree), so a fresh worktree (which checks out only tracked files and so lacks `.orchestrate/`) no longer makes every capability tool silently no-op. ADR-0011 (`docs/adr/0011-orchestrate-config-resolution-root.md`, status: accepted 2026-06-02) already records the design; this item lands the implementation.

---

**Target files**

- `plugins/orchestrate/orchestrate-mcp/src/tools/run-command.ts` — the only source change. Three sub-edits:
  1. **New internal helper `resolveConfigRoot(execCwd: string): Promise<string>`** (place it near `loadCommandsConfig`, in the `── Internal helpers ──` region). It runs `git rev-parse --git-common-dir` with `cwd: execCwd` using the already-imported `execFileAsync`, resolves the (possibly relative) output against `execCwd`, and returns its `path.dirname(...)`. On ANY failure (not a git repo, git missing) it returns `execCwd` unchanged — preserving today's behavior for non-git/test callers. Exact sketch:
     ```ts
     /**
      * Resolves the main repository root for config lookup. In a linked worktree
      * `git rev-parse --git-common-dir` points at the shared `.git` dir under the
      * MAIN working tree; its parent IS that main tree (uniform for worktree and
      * non-worktree invocations). The command still executes in `execCwd` (the
      * worktree) — only config resolution moves to the main root. Falls back to
      * `execCwd` on any git failure so non-git/test callers behave as before.
      */
     async function resolveConfigRoot(execCwd: string): Promise<string> {
       try {
         const { stdout } = await execFileAsync(
           "git",
           ["rev-parse", "--git-common-dir"],
           { cwd: execCwd, encoding: "utf8" }
         );
         return path.dirname(path.resolve(execCwd, stdout.trim()));
       } catch {
         return execCwd;
       }
     }
     ```
     DO NOT use `git rev-parse --show-toplevel` — in a linked worktree that returns the *worktree's* root, the wrong answer. The discriminator is `--git-common-dir` + `path.dirname`.
  2. **`runConfiguredCommand` (currently lines ~345–416).** Rename the single `cwd` into two concerns. At the top replace `const cwd = input.repoPath ?? process.cwd();` with:
     ```ts
     const execCwd = input.repoPath ?? process.cwd();
     const configRoot = await resolveConfigRoot(execCwd);
     ```
     Then: `loadCommandsConfig(configRoot)` (was `loadCommandsConfig(cwd)`, ~line 353) and `execCommand(argv, execCwd, timeoutMs)` (was `execCommand(argv, cwd, timeoutMs)`, ~line 376). No other logic in the function changes.
  3. **`runInstall` (currently lines ~473–536).** Identical decoupling: replace `const cwd = input.repoPath ?? process.cwd();` (~line 477) with the same `execCwd` / `configRoot` pair; `loadCommandsConfig(configRoot)` (~line 480); `execCommand(argv, execCwd, timeoutMs)` (~line 501). Install MUST exec in the worktree (it materializes `node_modules` the worktree needs to compile — grill ledger line 458: "install execs with cwd = worktree") while reading config from the main root — same split.
  4. **Schema `.describe()` fix — load-bearing, propagates to the MCP tool schema.** `runCommandInputSchema.repoPath` (lines 54–64) currently claims repoPath "holds the .orchestrate/commands.json configuration file." That is now false. Rewrite it to: repoPath is the **execution directory** (the slice worktree the command runs in); `.orchestrate/commands.json` is resolved from the **main repository root** derived from it, so a fresh worktree still finds config. Because `index.ts` registers via `runCommandInputSchema.shape`, this rewrite is the canonical `.describe()` update — no separate string in `index.ts` needs editing for the four `run_*` tools (their per-tool `description` text at index.ts:299–305 makes no false claim about *where* config is read, so leave it unless it drifts).
  5. **JSDoc fixes** (comment-only, but required for accuracy): the `loadCommandsConfig` header (~line 288 "Reads `<cwd>/.orchestrate/commands.json`" — still correct since the helper now receives the config root, but clarify the *caller* derives that root), and the headers of `runConfiguredCommand` (~line 339 "Reads `<repoPath>/.orchestrate/commands.json`") and `runInstall` (~line 466 "Reads `<repoPath>/.orchestrate/commands.json`") — change `<repoPath>` to "the main repository root derived from `<repoPath>`" and note the command executes with `cwd = <repoPath>`.

- `plugins/orchestrate/orchestrate-mcp/test/run-command.test.ts` — add the **keystone test** + a fallback test. First READ this file to match its existing fixture conventions (temp-dir setup, how it writes `.orchestrate/commands.json`, how it shortens the timeout via `RunCommandOptions`); do not fabricate a fixture style. Tests to add:
  - **Keystone (worktree config-resolution):** create a temp git repo, write `commands.json` ONLY at the repo root with a verb whose argv writes `process.cwd()` to a sentinel file (e.g. `["node","-e","require('fs').writeFileSync('cwd.txt', process.cwd())"]` or the project's existing echo pattern), `git worktree add` a linked worktree, then call `runConfiguredCommand(verb, { repoPath: <worktreePath> })`. Assert (a) status is **not** `not-configured` (config was found via the main root) and (b) the sentinel proves the command executed **in the worktree**, not the root.
  - **Install in worktree:** same setup with an `install` argv; `runInstall({ repoPath: <worktreePath> })` returns `installed` (not `not-configured`) and runs in the worktree.
  - **Non-git fallback:** call with `repoPath` = a temp dir that is NOT a git repo but DOES contain `.orchestrate/commands.json`; assert config still loads (helper falls back to `execCwd`) — proves no regression for the existing non-worktree path.
  - **Non-worktree-root invariant:** call with `repoPath` = a plain git repo root (not a linked worktree); assert behavior is identical to pre-change (config found at that root) — guards the "uniform for worktree and non-worktree" claim.

- `plugins/orchestrate/orchestrate-mcp/dist/tools/run-command.js` and `dist/index.js` — regenerated by `npm run build`; COMMITTED (vitest tests `src/`, so green tests ≠ shipped fix — the dist bundle is what the MCP server actually runs).

- `plugins/orchestrate/skills/orchestrate/SKILL.md` — grep `commands.json`; reconcile any prose implying config is read from / must live in the worktree. Lines 54–65 already frame `.orchestrate/` config as flat/shared and `install` as the worktree-seeding step (consistent with the decision); verify no line claims the capability tools read config from the worktree. If a line does, fix it to "config is resolved from the main repository root; only `install` materializes dependencies into the worktree." Likely a no-op or a one-line clarification.

- `plugins/orchestrate/.claude-plugin/plugin.json` (version `1.2.0`) and `.claude-plugin/marketplace.json` (orchestrate entry `1.2.0` at line ~36 **and** top-level marketplace `version` `1.6.0` at line ~4) — version cascade per the `project_plugin_versioning_cascade` convention: bump plugin.json + the matching marketplace `plugins[]` entry together; the marketplace top-level mirrors the bump magnitude. A bug-fix is a patch bump (`1.2.0` → `1.2.1`, top-level `1.6.0` → `1.6.1`). The Cursor marketplace (`.cursor-plugin/marketplace.json`) carries no orchestrate version field — leave it.

---

**Steps** (executable, in order)

1. Read `plugins/orchestrate/orchestrate-mcp/src/tools/run-command.ts` and `plugins/orchestrate/orchestrate-mcp/test/run-command.test.ts` in-session (required before editing).
2. Add the `resolveConfigRoot` helper to `run-command.ts` (sketch above). No new imports — `path`, `execFileAsync` are already imported.
3. Edit `runConfiguredCommand`: split `cwd` → `execCwd` + `configRoot`; `loadCommandsConfig(configRoot)`; `execCommand(argv, execCwd, timeoutMs)`.
4. Edit `runInstall`: same split.
5. Rewrite `runCommandInputSchema.repoPath.describe(...)` so it no longer claims repoPath holds commands.json; describe it as the exec dir with config resolved from the derived main root. Fix the three JSDoc headers (`loadCommandsConfig`, `runConfiguredCommand`, `runInstall`).
6. Add the keystone + install + non-git-fallback + non-worktree-root tests, matching the existing test file's conventions.
7. Build the MCP bundle: `cd plugins/orchestrate/orchestrate-mcp && npm run build`. Stage the regenerated `dist/tools/run-command.js` and `dist/index.js`.
8. Grep `commands.json` in `SKILL.md`; apply the clarifying fix only if a line falsely places config read in the worktree.
9. Apply the version cascade (plugin.json + marketplace entry + marketplace top-level, patch bump). Per repo Git Conventions, the version bump is its own atomic commit, separate from the code/test/doc commit.

---

**Verification** (exact Bash, run from the plugin's MCP dir)

```bash
cd plugins/orchestrate/orchestrate-mcp && npm test
```
Green = all existing tests still pass AND the four new tests pass: the keystone test proves a linked worktree with config ONLY at the main root yields a non-`not-configured` status with the command executing in the worktree; the non-git fallback test proves the existing non-worktree path is unregressed.

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run build && git status --porcelain dist/
```
Green = build exits 0 and `dist/tools/run-command.js` + `dist/index.js` appear as modified (the shipped bundle now carries the fix). Stage and commit them. If `dist/` shows no diff after a real `src/` change, the build did not run — the fix is NOT shipped.

```bash
cd plugins/orchestrate/orchestrate-mcp && npx tsc --noEmit
```
Green = no type errors from the `Promise<string>` helper / the now-`await`-ed `resolveConfigRoot` (both call sites are already inside `async` functions).

---

**Acceptance criteria** (testable)

- `resolveConfigRoot` returns the **parent of `--git-common-dir`**, resolved against `execCwd`; falls back to `execCwd` on git failure. (unit-covered)
- Keystone: in a linked worktree whose only `commands.json` is at the main root, `runConfiguredCommand` returns a status other than `not-configured` and the configured command executes with `cwd` = the worktree (sentinel-file proof). (test)
- `runInstall` resolves config from the main root but execs `install` in the worktree. (test)
- **Invariant regression guard:** when `repoPath` is a plain (non-worktree) git repo root, `--git-common-dir` parent equals `repoPath`, so behavior is byte-for-byte identical to pre-change. (test)
- Non-git `repoPath` still loads a local `.orchestrate/commands.json` (fallback path). (test)
- `npm run build` run and `dist/tools/run-command.js` + `dist/index.js` committed — green vitest alone does NOT satisfy this item.
- **Docs-in-sync (same unit):**
  - `run-command.ts` — `runCommandInputSchema.repoPath.describe()` rewritten (propagates to the MCP tool input schema via `.shape`); the three JSDoc headers corrected. **No separate `index.ts` edit needed** for the `run_*` tool `description` strings unless one drifts (none currently make a false config-location claim).
  - `skills/orchestrate/SKILL.md` — reconciled against the decision (clarify or confirm no line claims worktree-local config read).
  - `docs/adr/0011-orchestrate-config-resolution-root.md` — **already exists, status accepted** (2026-06-02). Verify it matches the shipped implementation; do NOT author a new ADR. If the implementation diverges from the ADR, update the ADR's Consequences section.
  - **Version cascade** — `plugins/orchestrate/.claude-plugin/plugin.json`, the orchestrate entry in `.claude-plugin/marketplace.json`, and the marketplace top-level `version`, patch-bumped together; `.cursor-plugin/marketplace.json` untouched (no orchestrate version field).
  - `templates/commands.json` — **NO change.** Config still lives at the main-root `.orchestrate/`; the template is correct as-is. Do not touch it.
  - `references/` — only `references/run-state.md` mentions `commands.json` and not in a worktree-read context; no change expected (verify with a grep, don't broadly edit).

---

**Risks / shared files**

- `run-command.ts` is the foundation every Tier-1 verification item (#230-P1.3 capability gate, #231-P2.5 known-failures allowlist, #235 per-wave integration tier — see grill lines 188–200) builds on. #237 is the keystone and MUST land **pre-wave** (Tier 0) before any of them; that is why `dependsOn = []` (it depends on nothing; everything depends on it).
- `index.ts` is also touched by **#238** (registers a new `validate_run_state` tool) and conceptually by #233/#236. #237's `index.ts` impact is **dist-only** (no `src/index.ts` edit needed since the `.describe()` change rides through `.shape`), so conflict risk with #238 is near-zero — but both items regenerate `dist/index.js`, so whichever lands second must rebuild and re-commit `dist/` on top of the first. Sequence #237 first (keystone).
- Version cascade files (`plugin.json`, `marketplace.json`) are touched by every shippable item in the PRD — coordinate the bump so parallel items don't collide on the same version number; landing #237 first claims the first patch bump.
- The `dist/` bundle is committed: any later item that edits `src/` and forgets `npm run build` ships stale behavior. Reassert the build+commit step in every Tier-1 handoff.

---

### #236 — `verify_changeset`/`recover_changed_files` collapse untracked directories

**Locked decision (`docs/analysis/orchestrate-grill-decisions.md:80-89`, `[no fork]`):** Add `--untracked-files=all` to the `git status --porcelain -z` call in **exactly two** files — `verify-changeset.ts:159` and `recover-changed-files.ts:106`. Git's default (`-unormal`) collapses a new untracked directory into a single `?? subdir/` entry; `-uall` enumerates the files individually. `parsePorcelainZ` already handles `??` records and is **unchanged**. Gitignored `node_modules` stays excluded (gitignored ≠ untracked). One flag each — no design alternative is better.

**Why it matters:** When an implementer creates a brand-new directory (e.g. `subdir/nested/file.ts`), the default reports only `subdir/`. `verify_changeset` then sees actual=`{subdir/}` vs declared=`{subdir/nested/file.ts}` and returns a false `mismatch`; `recover_changed_files` returns the directory stub instead of the real files, so the orchestrator's fallback staging misses them.

---

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/verify-changeset.ts`** — in `verifyChangeset()`, the `gitExecFile` call at line 158-161. Change the args array from `["status", "--porcelain", "-z"]` to `["status", "--porcelain", "-z", "--untracked-files=all"]`. Append a one-line why-comment near the existing `-z` comment (line 154-155): `// --untracked-files=all enumerates files inside a new untracked dir (default -unormal collapses them to one 'dir/' entry); gitignored paths stay excluded.` Also refresh the stale JSDoc command mentions at line 111 (`git status --porcelain -z` → `git status --porcelain -z --untracked-files=all`).
- **`plugins/orchestrate/orchestrate-mcp/src/tools/recover-changed-files.ts`** — in `recoverChangedFiles()`, the `gitExecFile` call at line 105-108. Change `["status", "--porcelain", "-z"]` → `["status", "--porcelain", "-z", "--untracked-files=all"]`. Append the same one-line why-comment near the `-z` comment (line 101-102). Refresh the stale JSDoc command mention at line 65 (`git status --porcelain -z` → with the flag).
- **`plugins/orchestrate/orchestrate-mcp/src/index.ts`** — refresh the two stale verbatim command strings in the registered tool `description` (`.describe()`) blocks: line 699 (`recover_changed_files`) and line 823 (`verify_changeset`). Change `'git status --porcelain -z'` → `'git status --porcelain -z --untracked-files=all'`. No schema/handler/registration change. **Shared file with #238** (see Risks).
- **`plugins/orchestrate/orchestrate-mcp/test/recover-changed-files.test.ts`** — add a red-green test for a nested untracked directory (pattern below).
- **`plugins/orchestrate/orchestrate-mcp/test/verify-changeset.test.ts`** — add a red-green test for a nested untracked directory vs a matching declared set.
- **`plugins/orchestrate/orchestrate-mcp/dist/index.js`** — regenerated by `npm run build` (committed bundle; vitest tests `src/`, the MCP runs `dist/`).

---

**Steps** (route test work through `/tdd` per global instruction — RED first, then the flag, then GREEN)

1. **Write the RED tests first** (do NOT apply the flag yet), using the existing `createTempRepo` + `fs.writeFileSync` + `path.join` helpers already in both test files:
   - In `test/recover-changed-files.test.ts`, add inside the `describe("recover_changed_files", ...)` block:
     ```ts
     it("enumerates files inside a new untracked directory, not the dir stub", async () => {
       fs.mkdirSync(path.join(repoPath, "subdir", "nested"), { recursive: true });
       fs.writeFileSync(path.join(repoPath, "subdir", "nested", "file.ts"), "export const x = 1;\n");
       const r = await recoverChangedFiles({ worktreePath: repoPath });
       expect(r.status).toBe("ok");
       expect(r.changedFiles).toContain("subdir/nested/file.ts");
       expect(r.changedFiles).not.toContain("subdir/");
     });
     ```
   - In `test/verify-changeset.test.ts`, add an analogous test that declares the deep path and expects a clean match:
     ```ts
     it("matches a declared deep path inside a new untracked directory", async () => {
       fs.mkdirSync(path.join(repoPath, "subdir", "nested"), { recursive: true });
       fs.writeFileSync(path.join(repoPath, "subdir", "nested", "file.ts"), "export const x = 1;\n");
       const r = await verifyChangeset({ worktreePath: repoPath, declaredFiles: ["subdir/nested/file.ts"] });
       expect(r.status).toBe("ok");
       expect(r.match).toBe("matched");
       expect(r.actualFiles).toContain("subdir/nested/file.ts");
     });
     ```
     (Verify the exact import names/symbols at the top of each test file match what the existing `it(...)` cases call — `recoverChangedFiles` / `verifyChangeset`.)
2. **Run the tests — confirm they FAIL** (RED): pre-fix, `recover` returns `subdir/` and `verify` returns `match: "mismatch"`. This empirically proves the collapse bug; do not skip the RED run.
3. **Apply the flag** to both source files (the two `gitExecFile` arg arrays) plus the why-comments and JSDoc command-string refresh.
4. **Refresh the two `.describe()` command strings** in `index.ts` (lines 699, 823).
5. **Run the tests — confirm they PASS** (GREEN), with no regression in the existing cases.
6. **Rebuild the committed bundle:** `cd plugins/orchestrate/orchestrate-mcp && npm run build`. Stage and commit `dist/index.js` together with the `src/` change (same commit/unit).
7. **Prove the fix shipped to `dist/`** with the grep below before declaring done.

---

**Verification** (run from `plugins/orchestrate/orchestrate-mcp/`)

```bash
cd plugins/orchestrate/orchestrate-mcp && npm test
```
Green = all suites pass, including the two new nested-untracked-dir tests in `verify-changeset.test.ts` and `recover-changed-files.test.ts`.

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run build && grep -c "untracked-files=all" dist/index.js
```
Green = build exits 0 and the grep count is `>= 2` (the two patched call sites compiled into the bundle). `npm test` green alone is NOT sufficient — vitest tests `src/`, the MCP runs `dist/`; the grep on `dist/index.js` is the shipped-fix proof.

Optional source-level sanity check:
```bash
cd plugins/orchestrate/orchestrate-mcp && grep -n "untracked-files=all" src/tools/verify-changeset.ts src/tools/recover-changed-files.ts
```
Expect exactly one hit in each source file's `gitExecFile` args array.

---

**Acceptance criteria**

- [ ] `src/tools/verify-changeset.ts` and `src/tools/recover-changed-files.ts` each pass `--untracked-files=all` in their `git status --porcelain -z` args (one flag each); `parsePorcelainZ` is untouched.
- [ ] New nested-untracked-dir test in each test file fails before the flag and passes after (RED→GREEN proven, not just asserted).
- [ ] `recover_changed_files` returns `subdir/nested/file.ts` (not `subdir/`); `verify_changeset` returns `match: "matched"` for the matching declared set.
- [ ] No regression: every pre-existing test in both files still passes.
- [ ] `npm run build` run and `dist/index.js` committed in the same unit; `grep -c "untracked-files=all" dist/index.js` ≥ 2.
- [ ] **Docs-in-sync (this unit):** the two `.describe()` command strings in `index.ts` (lines 699, 823) and both source files' JSDoc command mentions (`verify-changeset.ts:111`, `recover-changed-files.ts:65`) updated to read `git status --porcelain -z --untracked-files=all`, so no stale command string survives the fix. **No change needed** to `skills/orchestrate/SKILL.md` (names the tools only; never mentions the porcelain command or untracked-collapse behavior — confirmed by grep), `references/`, `templates/`, `CONTEXT.md`, or `docs/adr/`.
- [ ] **Version cascade is NOT bumped per-item.** Bumping `plugin.json` + marketplace entries here would collide with every PRD #241 sibling. The 3-field version cascade is a once-per-PRD integration step, out of this unit's scope.

---

**Risks / shared files**

- **`index.ts` is shared with #238** — #238 also edits `index.ts` to register the new `validate_run_state` tool. The two edits touch non-overlapping blocks (this item: two `.describe()` strings in already-registered tools; #238: a new `registerTool` block + imports), so conflict risk is low, but flag for integration ordering — whichever lands second may need a trivial rebase, and `dist/index.js` must be rebuilt after the LAST `src/` change to `index.ts` so the bundle reflects both.
- **Sibling latent bug, out of scope:** `src/tools/worktree.ts:442` (`removeWorktree`'s dirty-check) uses the identical `["status", "--porcelain", "-z"]` pattern and has the same untracked-dir-collapse behavior. The locked decision's Surface line scopes #236 to **exactly two files, one flag each** — do NOT widen to `worktree.ts`. Capture it as a separate upstream GitHub issue (per the standing "capture orchestrate friction upstream" instruction) rather than folding it in here.
- **dist rebuild caution:** `dist/` is committed; a green `npm test` does not imply the fix shipped because vitest exercises `src/`. The `grep` on `dist/index.js` is the mandatory shipped-fix gate.
- **`dependsOn=[]`:** #237 (the wave-0 keystone) is a *synergy* neighbor — it reduces the `.orchestrate/` untracked-noise that #236 surfaces (grill ledger line 73) — not a code dependency. The flag fix compiles and its tests pass independently of #237.

---

### #231-P2.4 — `mergeStateStatus: UNSTABLE` → doc-only clarification of the merge gate

Locked decision (`docs/analysis/orchestrate-grill-decisions.md:403-407`, `[accepted, no fork]`): `SKILL.md` must document that the merge gate is the **`mergeable`** field — `MERGEABLE` proceeds to squash-merge **even when `mergeStateStatus` is `UNSTABLE`** (a non-*required* check is failing/pending, but no *required* check blocks). Only `UNKNOWN` (recompute / re-check) and `CONFLICTING` (resolve once) alter the path. `mergeStateStatus` is informational, not a second gate. This is a **prose-only** change: no MCP `src/`, no schema, no new tool, no references/CONTEXT/ADR/template touched.

**Target files**

- `plugins/orchestrate/skills/orchestrate/SKILL.md` — **step 8 "Merge the slice."** (lines ~569-581, the block beginning `8. **Merge the slice.**` and the three sub-bullets `UNKNOWN` / `MERGEABLE` / `CONFLICTING` under the `gh pr view <pr-number> --json mergeable,mergeStateStatus` example). Two surgical edits:
  1. **Step 8 preamble** (after the `gh pr view ... --json mergeable,mergeStateStatus` fenced block, before the bullet list): add one sentence stating the gate is the `mergeable` field; `mergeStateStatus` is informational context, not a separate gate.
  2. **The `MERGEABLE` bullet** (`- \`MERGEABLE\` — merge it, squashing ...`): augment it to state that `MERGEABLE` proceeds to the squash-merge **even when `mergeStateStatus` is `UNSTABLE`** — an `UNSTABLE` status means a non-*required* check is failing or still running, and because no *required* check blocks, it does not stop the merge.
  - Do **not** add a new bullet enumerating `mergeStateStatus` values, and do **not** introduce a second decision tree keyed on `mergeStateStatus`. That would contradict the decision (the gate is `mergeable`, full stop). `UNKNOWN` and `CONFLICTING` bullets stay exactly as written.

**Steps**

1. Read `plugins/orchestrate/skills/orchestrate/SKILL.md` (current session) — focus lines ~569-581 (step 8 and its three bullets).
2. Edit the step 8 preamble: after the `gh pr view <pr-number> --json mergeable,mergeStateStatus` code fence and before the bullet list, insert a sentence such as: *"The gate is the `mergeable` field; `mergeStateStatus` is informational context, not a separate gate."*
3. Edit the `MERGEABLE` bullet to read approximately: *"`MERGEABLE` — merge it even when `mergeStateStatus` is `UNSTABLE` (a non-required check is failing or still running, but no required check blocks the merge). Squash to one commit per slice on the umbrella branch: `gh pr merge <pr-number> --squash`."*
4. Leave the `UNKNOWN` and `CONFLICTING` bullets unchanged.
5. Do **not** touch `plugin.json` / `marketplace.json` version fields — the marketplace version cascade is a PRD-wide cross-cutting criterion (`orchestrate-grill-decisions.md:39-40, 44-45`), consolidated at PRD #241 integration, not owned per item (see Risks).
6. Do **not** run `npm run build` — no `orchestrate-mcp/src/` change, so `dist/` is untouched.

**Verification**

This is a prose change; `npm test` is **not** a valid proof (vitest tests `orchestrate-mcp/src/`, never SKILL.md text — it stays green regardless of the edit). The honest gate is a grep assertion on the exact added phrasing:

```bash
cd /home/rodrigo/Workspace/agent-engineering-toolkit
# 1. The MERGEABLE path now explicitly names UNSTABLE as non-blocking:
grep -n -i "UNSTABLE" plugins/orchestrate/skills/orchestrate/SKILL.md
# 2. The gate is stated as the mergeable field near step 8:
grep -n -i "gate is the .mergeable\|mergeable. field" plugins/orchestrate/skills/orchestrate/SKILL.md
# 3. No accidental second decision tree / new mergeStateStatus bullet was added —
#    the three bullets are still UNKNOWN / MERGEABLE / CONFLICTING only:
grep -n -E "^\s*-\s+\`(UNKNOWN|MERGEABLE|CONFLICTING|UNSTABLE)\`" plugins/orchestrate/skills/orchestrate/SKILL.md
```

Green result: command 1 prints at least one line inside the step-8 / `MERGEABLE` region; command 2 prints the new gate sentence; command 3 prints exactly the `UNKNOWN`, `MERGEABLE`, `CONFLICTING` bullet lines and **no** standalone `UNSTABLE` bullet (UNSTABLE appears only inside the `MERGEABLE` bullet prose). Optional human read of step 8 confirms the wording matches the locked decision (gate = `mergeable`; `UNSTABLE` proceeds; only `UNKNOWN`/`CONFLICTING` alter the path).

**Acceptance criteria**

- SKILL.md step 8 states the merge gate is the `mergeable` field and that `mergeStateStatus` is informational, not a second gate.
- The `MERGEABLE` bullet explicitly says merge proceeds even when `mergeStateStatus` is `UNSTABLE` (non-required check failing/pending, no required check blocking).
- `UNKNOWN` (re-check/recompute) and `CONFLICTING` (resolve once) bullets are unchanged and remain the only two statuses that alter the merge path.
- No new bullet/decision-tree keyed on `mergeStateStatus` values is introduced.
- **Docs-in-sync (cross-cutting criterion).** The only surface that mentions this gate is `SKILL.md` step 8 — verified: no `mergeStateStatus`/`mergeable` references exist in `skills/orchestrate/references/*.md`, `CONTEXT.md`, or `docs/adr/`, and the gate is not exposed through any MCP `.describe()` / `index.ts` registration or `templates/commands.json` schema. Therefore **no other doc surface requires a sibling edit** for this item. The marketplace **version cascade** (`plugin.json` + the two `marketplace.json` version fields) is the PRD-wide cross-cutting bump consolidated at PRD #241 integration and is intentionally **not** in this item's `filesTouched` (see Risks).

**Risks / shared files**

- **Version cascade (shared, deferred — do NOT bump in this slice).** `plugins/orchestrate/.claude-plugin/plugin.json` (`version` `1.2.0`), `.claude-plugin/marketplace.json` orchestrate entry (`version` `1.2.0`, line ~36) and top-level (`version` `1.6.0`, line ~4) are touched by *every* PRD #241 item. The ledger defines the cascade as a cross-cutting docs-in-sync criterion applied at PRD integration (`orchestrate-grill-decisions.md:39-40, 44-45`); the sibling entries (e.g. #231-P2.2 "Docs-in-sync per the cross-cutting criterion") do not own a per-item bump. Bumping these here would collide on the same version lines with every other slice. **Ordering caution:** leave the version cascade to the PRD integration step.
- **`SKILL.md` is a shared, high-traffic file** across PRD #241. This item edits **only step 8 "Merge the slice."** (merge-gate region). Other PRD items touch different sections — e.g. #231-P2.2 edits §3 (subagent self-install), #231-P2.3 the intra-wave concurrency note near `SKILL.md:400-402`. Different sections → low textual-conflict risk, but if multiple SKILL.md slices land in one branch, apply them in separate hunks and re-read before each edit to avoid a stale-read failure.
- **No `dist/` rebuild** (no `orchestrate-mcp/src/` change). `dependsOn: []` — no code from another item must land first; the §3 install changes (#231-P2.2) are an independent SKILL.md section.

---

### #230-P1.1 — network retry + verify-push-landed → new `push_and_verify` MCP tool + gh-retry prose

**Locked decision (one line).** Split #230 cleanly along the pervasive no-gh MCP invariant: the *push* half becomes a new **git-only** `push_and_verify` MCP tool (`git push` + `git ls-remote --heads origin <branch>` **SHA-match** landing check + bounded exponential backoff, **fail-loud** if the branch is absent/stale on the remote); the *gh-op* half (pr create/merge/comment, issue edit) stays orchestrator-owned **prose** in `SKILL.md` (bounded retry distinguishing transient from permanent). Rejected: *all-prose* (LLM retry-loop is the unreliable silent-failure point #230 documents) and *all-MCP* (breaks the no-gh invariant, expands MCP blast radius + gh auth surface). This nails the #230 evidence: an exit-0 `git push` that never landed → a confusing downstream `gh pr create` error.

**No-gh invariant (do not break).** The MCP layer deliberately never shells `gh` (`clean-runs.ts:14-16`, `SKILL.md:131-137`); the orchestrator owns all forge ops. `push_and_verify` is git-only and respects this. The gh-retry half therefore CANNOT be MCP — it is prose.

---

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/push-and-verify.ts`** (NEW). Model the file exactly on `recover-changed-files.ts` (closest analog: git-only, discriminated `status`, never throws). Contents:
  - Imports: `import { gitExecFile, optionInjectionError, cleanGitError } from "../git.js";` and `import { z } from "zod";`. (Do NOT import `fs` — no on-disk path existence check is meaningful here; `repoPath` is a worktree git dir, and `gitExecFile` surfaces a non-git path as `GIT_ERROR`.)
  - `pushAndVerifyInputSchema = z.object({ ... })` with `.describe()` on every field:
    - `repoPath: z.string()` — "Absolute path the git push runs in. For a slice push this is the slice **worktree** path (the orchestrator otherwise runs `git -C <worktree-path> push`), not the main repo root."
    - `branch: z.string()` — "Name of the local branch to push and then verify landed on the remote (e.g. `orchestrate/slice-7`)."
    - `remote: z.string().optional().default("origin")` — "Remote to push to and verify against. Defaults to `origin`."
    - `setUpstream: z.boolean().optional().default(true)` — "When true, push with `-u` to set the upstream tracking ref (the first push of a new slice branch). Default true."
  - `pushAndVerifyOutputSchema = z.object({ ... })` with `.describe()` on every field:
    - `status: z.enum(["ok", "error"])` — "Outcome discriminant. 'ok' = the branch was pushed AND confirmed on the remote at the expected commit; 'error' = push failed, the branch never landed, or input was rejected."
    - `branch: z.string().optional()` — "The branch that was verified. Present when status='ok'."
    - `remote: z.string().optional()` — "The remote it landed on. Present when status='ok'."
    - `sha: z.string().optional()` — "The commit SHA confirmed on the remote (matches the local branch tip). Present when status='ok'."
    - `attempts: z.number().optional()` — "How many landing-verification polls ran before the remote ref matched (>=1). Present when status='ok'."
    - `errorCode: z.enum(["INVALID_INPUT", "PUSH_FAILED", "BRANCH_NOT_ON_REMOTE", "GIT_ERROR"]).optional()` — "Machine-readable failure category. 'INVALID_INPUT' = branch/remote would be parsed by git as an option flag; 'PUSH_FAILED' = `git push` itself exited non-zero after all retries; 'BRANCH_NOT_ON_REMOTE' = push reported success but `git ls-remote` never showed the branch at the expected SHA within the backoff budget (the #230 silent-failure mode); 'GIT_ERROR' = a git command could not run (e.g. not a git worktree, or local rev-parse failed)."
    - `errorMessage: z.string().optional()` — "Cleaned, human-readable failure description. Present when status='error'."
  - TS types via `z.infer` (single source of truth), named `PushAndVerifyInput` / `PushAndVerifyOutput`, mirroring the `recover-changed-files.ts` export shape.
  - **Backoff constants** as named module consts so the implementer does not invent them: `const VERIFY_ATTEMPTS = 5;`, `const VERIFY_BASE_DELAY_MS = 500;`, `const VERIFY_BACKOFF_FACTOR = 2;`, `const VERIFY_MAX_DELAY_MS = 8_000;`, `const PUSH_ATTEMPTS = 3;`. Document each with a one-line comment.
  - **Testability seam (mandatory — single biggest risk).** Export the landing-verify step as its own function so it is unit-testable against a local bare repo WITHOUT making `git push` misbehave, and so backoff sleeps don't make tests slow/flaky:
    ```
    export interface VerifyOptions { attempts?: number; baseDelayMs?: number; factor?: number; maxDelayMs?: number; sleep?: (ms: number) => Promise<void>; }
    export async function verifyLanded(repoPath: string, remote: string, branch: string, expectedSha: string, opts?: VerifyOptions): Promise<{ landed: boolean; attempts: number }>
    ```
    `sleep` is an INTERNAL injectable option (default `(ms) => new Promise(r => setTimeout(r, ms))`), **never a public Zod field** — keep the MCP input schema clean.
  - **`pushAndVerify(input)` algorithm** (the core — specify exactly, do not hand-wave):
    1. Option-injection guard on `branch` AND `remote` (both are interpolated into git args). On either guard error → `{ status:"error", errorCode:"INVALID_INPUT", errorMessage }`.
    2. Resolve the **expected SHA** from the local branch tip: `git rev-parse --verify --quiet refs/heads/<branch>` (via `gitExecFile` with `--` discipline already handled by arg-array form). If this throws or returns empty → `{ status:"error", errorCode:"GIT_ERROR", errorMessage }` (cannot verify a branch that does not exist locally).
    3. **Push with retry** (handles transient failure mode (a)): up to `PUSH_ATTEMPTS`, run `git push` (`["push", ...(setUpstream?["-u"]:[]), remote, branch]`). On success, break. On `GitExecError`, sleep with the same backoff schedule and retry; after the last attempt fails → `{ status:"error", errorCode:"PUSH_FAILED", errorMessage: cleanGitError(err) }`. (Push retry reuses the injectable `sleep` so push-failure tests run with `sleep=0`.)
    4. **Verify landed** (handles silent failure mode (b) — the literal #230 bug): call `verifyLanded(repoPath, remote, branch, expectedSha)`. Inside it, poll `git ls-remote --heads <remote> <branch>` up to `attempts` times; parse the first column (the remote SHA) of the matching `refs/heads/<branch>` line. **Compare the remote SHA against `expectedSha` — SHA-match, NOT mere presence.** Rationale (write as a code comment): a stale branch from a prior push passes an existence check but is exactly the bug #230 documents; only a SHA match proves *this* push landed. Sleep `min(base * factor^(i-1), maxDelay)` between polls. Return `{ landed:true, attempts:i }` on first match.
    5. If `verifyLanded` returns `landed:false` after the budget → `{ status:"error", errorCode:"BRANCH_NOT_ON_REMOTE", errorMessage: "git push reported success but branch <branch> never appeared at <sha> on <remote> after N verification attempts — the push did not land." }`. **This is the fail-loud point** the decision mandates.
    6. On match → `{ status:"ok", branch, remote, sha: expectedSha, attempts }`.
  - **Never throws** — every failure mode is a structured result (match `recover-changed-files.ts` contract and the README "every tool returns a discriminated `status` and never throws" claim).

- **`plugins/orchestrate/orchestrate-mcp/test/push-and-verify.test.ts`** (NEW). Vitest, modeled on `recover-changed-files.test.ts` and `worktree.test.ts` (which already set up local bare repos + worktrees — reuse those helpers/patterns). Cover, with `sleep` injected to a no-op so tests are fast and deterministic:
  - `verifyLanded`: ref-absent on remote → `landed:false` after exactly `attempts` polls. Ref-present-matching-SHA → `landed:true, attempts:1`. **Ref-present-but-STALE-SHA** (remote has an older commit for the branch) → `landed:false` (this is the test that proves SHA-match, not presence — without it the #230 fix is not actually exercised).
  - `pushAndVerify` happy path: push a real branch from a worktree to a local bare `origin`, expect `status:"ok"` with the correct `sha`.
  - `pushAndVerify` push-failure: point `remote` at a non-existent/bad path (or a non-existent remote name) → `status:"error", errorCode:"PUSH_FAILED"`.
  - Input guard: `branch:"--force"` or `remote:"--upload-pack=x"` → `errorCode:"INVALID_INPUT"`.
  - `BRANCH_NOT_ON_REMOTE`: simulate a push that exits 0 but does not land by verifying against a remote where the ref is absent/stale (e.g. push to bare repo A but verify against bare repo B, or delete the remote ref between push and verify) → `errorCode:"BRANCH_NOT_ON_REMOTE"`.

- **`plugins/orchestrate/orchestrate-mcp/src/index.ts`** (MODIFY). Register `push_and_verify` following the existing ritual **exactly**:
  - Add to the import block (after the `bootstrap-config` import group): `import { pushAndVerify, pushAndVerifyInputSchema, pushAndVerifyOutputSchema, type PushAndVerifyInput, type PushAndVerifyOutput } from "./tools/push-and-verify.js";`
  - Add a `handlePushAndVerify: ToolHandler<PushAndVerifyInput, PushAndVerifyOutput>` (mirror `handleRecoverChangedFiles`, lines 676-691). Text line on ok: `` `Pushed ${result.branch} to ${result.remote} and confirmed landed at ${result.sha} (${result.attempts} verify attempt(s)).` ``; on error: `` `push_and_verify failed [${result.errorCode}]: ${result.errorMessage}` ``.
  - Add a `registerTool("push_and_verify", { title: "Push a Branch and Verify It Landed", description: "...", inputSchema: pushAndVerifyInputSchema.shape, outputSchema: pushAndVerifyOutputSchema.shape }, handlePushAndVerify as unknown as AnyToolHandler);` — `.describe()`/description must state: git-only (never shells `gh`); pushes `branch` to `remote`, then confirms via `git ls-remote --heads` that the remote ref matches the local tip SHA (a presence-only check is insufficient — a stale ref would pass); bounded exponential backoff; fails loud with `BRANCH_NOT_ON_REMOTE` when a successful-exit push never lands (the #230 silent-failure mode); discriminated `status` of 'ok' or 'error'.
  - Bump the `McpServer` `version` (line 112) from `"0.12.0"` → `"0.13.0"` (minor — new tool/feature; mirrors the package.json bump below).

- **`plugins/orchestrate/orchestrate-mcp/package.json`** (MODIFY). `"version": "0.12.0"` → `"0.13.0"`. Precedent: the package version moved with the PRD#181 14-slice tool-adding merge (982f3d6) and is mirrored by `index.ts`'s `McpServer.version`; a new tool is a minor feature bump, and the two version fields must stay in lockstep.

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** (MODIFY — the locked Surface: §3 step 6 call + gh-retry note):
  - **§3 step 6 "Commit and push"** (lines 543-559): replace the raw push line `git -C <worktree-path> push -u origin orchestrate/slice-<N>` with a call to the **`push_and_verify` MCP tool** (`repoPath` = the slice `worktreePath`, `branch` = `orchestrate/slice-<N>`, `remote` = `origin`, `setUpstream: true`). Keep the `git -C ... add` and `git -C ... commit` lines as raw git (commit is local, not a push). State the wiring: on `status: "ok"` proceed to step 7; on `status: "error"` (any `errorCode` — `PUSH_FAILED`, `BRANCH_NOT_ON_REMOTE`, etc.) the slice has **FAILED** (same wiring as every other MCP-tool error in §3). Add the causal rationale: `push_and_verify` gates step 7's `gh pr create` — a push that exits 0 but never lands is exactly the confusing-`gh pr create`-error site #230 reports; verifying the branch is on the remote before opening the PR removes that failure mode.
  - **gh-retry note** (the prose half): add a short paragraph — recommended placement is the **`## Tracker updates`** section (lines 730-742) or a new sentence in the prerequisites/integration prose — stating that the orchestrator wraps every **`gh` op** (`gh pr create`, `gh pr merge`, `gh pr view`, `gh issue edit`, `gh issue comment`) in a **bounded retry that distinguishes transient failures (network timeout, 5xx, DNS) — retry with backoff — from permanent failures (auth, validation, not-found) — fail immediately**. Explicitly note this is prose (not an MCP tool) **because the MCP layer never shells `gh`** (the no-gh invariant), so gh-op resilience is the orchestrator's responsibility. (`push_and_verify` covers the git-push half; this note covers the gh-op half — together they close #230.)
  - **Scope-of-push-sites decision (explicit — do not silently widen or ignore).** The locked Surface names **§3 step 6 only**, so wire `push_and_verify` there and there ALONE in this item. Flag — as a note in the spec, not as code changes here — that three other raw `git push` sites exist and are candidates for the same treatment in a follow-up, but are OUT OF SCOPE for #230-P1.1: (1) the umbrella push, §1 Fresh-run step 5 (`git push -u origin orchestrate/umbrella-<runId>`, SKILL.md:316); (2) the conflict-resolution clean-merge push, §3 step 8a.3 (SKILL.md:605); (3) the conflict-resolution resolved push, §3 step 8a.6 (SKILL.md:626-627). Default = locked surface (step 6) committed; the other three explicitly listed so a reviewer is not surprised.

- **`plugins/orchestrate/README.md`** (MODIFY — in-scope doc surface). The README carries an explicit MCP tool inventory table (lines 51-66). Add one row, keeping the existing style: `| `push_and_verify` | Push a slice branch and verify it actually landed on the remote (SHA-match `git ls-remote` check + bounded backoff) — fails loud when an exit-0 push never lands; git-only, never shells `gh` |`. Place it logically near the worktree/push tools (e.g. after the `create_worktree` / `remove_worktree` row or alongside `verify_changeset`).

- **`plugins/orchestrate/.claude-plugin/plugin.json`** (MODIFY — plugin version cascade, field 1 of 3). `"version": "1.2.0"` → `"1.3.0"` (minor — new MCP tool + skill capability).

- **`.claude-plugin/marketplace.json`** (MODIFY — plugin version cascade, fields 2 and 3 of 3, magnitude-mirrored). Bump the **orchestrate entry** `version` (line 36) `"1.2.0"` → `"1.3.0"`, AND the **marketplace top-level** `version` (line 4) `"1.6.0"` → `"1.7.0"` (top-level mirrors the bump magnitude — minor → minor). The Cursor marketplace (`.cursor-plugin/marketplace.json`) has **no** orchestrate entry — confirmed by grep — so there is **no Cursor version field** to touch (per the versioning-cascade memory: Cursor `plugins[]` carries no version field).

---

**Steps** (ordered, executable — no design re-derivation)

1. Create `plugins/orchestrate/orchestrate-mcp/src/tools/push-and-verify.ts` per the Target-files spec: schemas + `z.infer` types + backoff consts + exported `verifyLanded` (injectable `sleep`) + `pushAndVerify` with the exact 6-step algorithm (local rev-parse → expected SHA; push-with-retry; ls-remote SHA-match poll-with-backoff; fail-loud `BRANCH_NOT_ON_REMOTE`). Never throw.
2. Create `plugins/orchestrate/orchestrate-mcp/test/push-and-verify.test.ts` per the test list (reuse the bare-repo/worktree setup helpers from `worktree.test.ts` / `recover-changed-files.test.ts`; inject `sleep` no-op). MUST include the stale-SHA test that proves SHA-match (not presence).
3. Edit `src/index.ts`: add the import group, the `handlePushAndVerify` handler, the `registerTool("push_and_verify", …)` block, and bump `McpServer.version` to `"0.13.0"`.
4. Edit `orchestrate-mcp/package.json`: `version` → `"0.13.0"`.
5. Edit `skills/orchestrate/SKILL.md` §3 step 6: swap the raw slice push for the `push_and_verify` MCP call + FAILED-on-error wiring + #230 rationale; add the gh-retry prose note (in `## Tracker updates` or the integration prose). Do NOT touch the umbrella/conflict push sites (out of scope).
6. Edit `plugins/orchestrate/README.md`: add the `push_and_verify` row to the MCP tool table.
7. Edit `plugins/orchestrate/.claude-plugin/plugin.json`: `version` → `"1.3.0"`.
8. Edit `.claude-plugin/marketplace.json`: orchestrate entry `version` → `"1.3.0"`; top-level `version` → `"1.7.0"`.
9. **Rebuild the committed dist** (mandatory — vitest tests `src/`, the shipped server is `dist/`): from `plugins/orchestrate/orchestrate-mcp/` run `npm run build`, then `git add dist/index.js` (and any other rebuilt dist files). Green tests alone do NOT ship the fix.

---

**Verification** (exact Bash; green = what to look for)

```
cd /home/rodrigo/Workspace/agent-engineering-toolkit/plugins/orchestrate/orchestrate-mcp && npm test
```
Green: the full vitest suite passes, INCLUDING the new `push-and-verify.test.ts` (all cases — happy push/verify, push-failure → `PUSH_FAILED`, ref-absent and **stale-SHA** → not-landed / `BRANCH_NOT_ON_REMOTE`, input guard → `INVALID_INPUT`).

```
cd /home/rodrigo/Workspace/agent-engineering-toolkit/plugins/orchestrate/orchestrate-mcp && npm run typecheck
```
Green: `tsc --noEmit` exits 0 (no TS error from the new file or the `index.ts` registration cast).

```
cd /home/rodrigo/Workspace/agent-engineering-toolkit/plugins/orchestrate/orchestrate-mcp && npm run build
```
Green: esbuild bundles with no error and rewrites `dist/index.js`.

```
cd /home/rodrigo/Workspace/agent-engineering-toolkit && git status --porcelain plugins/orchestrate/orchestrate-mcp/dist/
```
Green: `dist/index.js` shows as modified (the new tool is bundled into the shipped server) and is staged before commit.

Optional grep gates (registration + no-gh invariant intact):
```
grep -n "push_and_verify" plugins/orchestrate/orchestrate-mcp/src/index.ts
grep -rn "\bgh\b" plugins/orchestrate/orchestrate-mcp/src/tools/push-and-verify.ts   # MUST return nothing — the tool never shells gh
grep -n "ls-remote" plugins/orchestrate/orchestrate-mcp/src/tools/push-and-verify.ts # MUST match — the landing check is present
```

---

**Acceptance criteria** (testable)

- `push_and_verify` exists as a registered MCP tool: pushes `branch` to `remote`, then confirms via `git ls-remote --heads` that the remote ref **SHA matches the local tip** (presence alone is rejected), with bounded exponential backoff, returning a discriminated `status` of `ok`/`error` and an `errorCode` of `INVALID_INPUT` | `PUSH_FAILED` | `BRANCH_NOT_ON_REMOTE` | `GIT_ERROR`. It NEVER shells `gh` and never throws.
- A successful-exit `git push` whose branch does not land at the expected SHA yields `errorCode: "BRANCH_NOT_ON_REMOTE"` (fail-loud) — exercised by a passing test (stale-SHA / absent-ref).
- The `verifyLanded` seam is independently unit-tested with an injected no-op `sleep`; the `sleep`/backoff knobs are NOT exposed in the MCP input schema.
- `npm test`, `npm run typecheck`, and `npm run build` all pass; `dist/index.js` is rebuilt and staged (vitest hits `src/`, so the dist rebuild is the only thing that ships the fix).
- SKILL.md §3 step 6 calls `push_and_verify` (not a raw `git push`) for the slice push, wires any tool `error` to a FAILED slice, and states the #230 rationale (the push gates `gh pr create`). The umbrella and conflict-resolution push sites are left unchanged and explicitly flagged as follow-up (out of scope).
- SKILL.md carries a gh-retry prose note covering `gh pr create/merge/view` and `gh issue edit/comment` with transient-vs-permanent bounded retry, explicitly justified by the no-gh-in-MCP invariant.
- **Docs-in-sync (same unit):** (1) MCP `.describe()` + `registerTool` description in `index.ts` — present and accurate; (2) `SKILL.md` §3 step 6 + gh-retry note — updated; (3) `plugins/orchestrate/README.md` MCP tool inventory table — new `push_and_verify` row; (4) version cascade — `package.json` `0.12.0`→`0.13.0` AND `index.ts` `McpServer.version` `0.12.0`→`0.13.0` (lockstep), `plugin.json` `1.2.0`→`1.3.0`, marketplace orchestrate entry `1.2.0`→`1.3.0`, marketplace top-level `1.6.0`→`1.7.0` (magnitude-mirrored). N/A surfaces (do NOT touch): `references/` (no push/ls-remote content — confirmed by grep), `templates/` (config files only), `docs/adr/` (no new architectural decision — the no-gh boundary is already ADR-settled; reuse, don't add), root `CONTEXT.md` (its orchestrate vocabulary describes runs/partitions, not the per-tool inventory), `.cursor-plugin/marketplace.json` (no orchestrate entry — no Cursor version field exists).

---

**Risks / shared files**

- **`SKILL.md` §3 is a hot shared file.** #230-P1.2 adds per-step `subState` checkpoints across §3 (and changes §1 resume logic), and #232-A.1 edits §3 step 9 (`--delete-branch` on merge + local branch delete). P1.2's own locked decision states *"Paired with P1.1: `pushed` is recorded only after `git ls-remote` confirms the branch on the remote"* — i.e. P1.2 records `subState: "pushed"` **only after** `push_and_verify` returns `ok`. Land #230-P1.1 **first** so P1.2/A.1 build on the verified-push primitive; P1.1 has no upstream code dependency (`dependsOn: []`).
- **`src/index.ts` is shared by every tool-adding item.** Any concurrent item that registers a new tool edits the same import block and registration region — expect a textual merge there; keep the new registration block self-contained and in the established order to minimize conflict.
- **`.claude-plugin/marketplace.json` top-level + orchestrate `version` are shared by any concurrent plugin bump.** If another item also bumps the orchestrate plugin in the same wave, reconcile to a single agreed version rather than double-bumping.
- **Committed `dist/` is the classic trap** (project memory `orchestrate-mcp-dist-committed`): green vitest ≠ shipped fix. The `npm run build` + `git add dist/index.js` step is non-optional and is the thing a reviewer should confirm.
- **Verify behavior, not just compilation:** the load-bearing risk is a presence-only `ls-remote` check (passes shallow tests, misses the #230 bug) or a non-injectable `sleep` (slow/flaky tests). The stale-SHA test and the `verifyLanded`+injected-`sleep` seam are the guardrails — do not drop them.

---

### #230-P1.2 — sub-step checkpointing → subState + worktree reconstruction + re-validate

**Locked decision (one line).** Each slice gains a `subState` (`implemented|verified|reviewed|pushed|pr-open|merged`, mapping the §3 per-slice steps), checkpointed at every transition. The resume policy **changes**: an `in-progress` slice is no longer discarded and re-processed from `pending` — it **continues from its recorded `subState`**, reconstructing the changed-file set from the preserved worktree via `recover_changed_files` (accurate after the #236 `-uall` fix), **re-validating** the resume point cheaply (capability gate for pre-push subStates; `git ls-remote` for the push landing check), and continuing without re-spawning already-completed subagents. Paired with P1.1: `pushed` is recorded **only after** `git ls-remote` confirms the branch on the remote. This is a **skill + run-state + docs** change only — **no MCP `src/` change** (it reuses existing `recover_changed_files`, `verify_changeset`, `git ls-remote`, and P1.1's `push_and_verify`); the surface is exactly the LOCKED line "`references/run-state.md` (subState field), `SKILL.md` §1 resume logic + §3 per-step checkpoints."

---

**Target files**

- **`plugins/orchestrate/skills/orchestrate/references/run-state.md`** — three edits:
  1. **Schema JSON (~lines 59–74)** — add `"subState": "passed"`-style key inside the example slice object, e.g. add a line after `"state": "passed",`: `"subState": "merged",`.
  2. **Slice fields list (~lines 110–125)** — add a bullet immediately after the `state` bullet documenting `subState`: the enum `implemented | verified | reviewed | pushed | pr-open | merged`, that it is the fine-grained position **within** §3 processing of a slice whose coarse `state` is `in-progress`, written at every §3 transition, `null`/absent before step 4 completes, and that it is the **resume anchor** for an interrupted in-progress slice. Note explicitly: `pushed` is recorded only after `git ls-remote` confirms the branch landed (P1.1 dependency); `merged` (PR merged into umbrella, step 8) precedes the slice reaching coarse `state: passed` (step 9, after label transition + worktree removal).
  3. **Resume section REWRITE (~lines 150–160) + Slice-states REWRITE (~lines 136–137)** — these two passages directly contradict the new policy and must be reversed, not merely supplemented:
     - Line ~136–137 currently reads "`passed`, `failed`, and `skipped` are terminal. `pending` and `in-progress` are re-processed on resume." → Rewrite so `in-progress` is **resumed from its `subState`, not re-processed from scratch**; only `pending` is processed from the start.
     - Lines ~150–160 (the "Exactly one match" bullet) currently says every `in-progress` slice "has its partial artifacts discarded (worktree removed, slice branch deleted) and is coerced back to `pending` before re-processing." → Rewrite to: an `in-progress` slice **continues from its recorded `subState`** — its worktree and slice branch are **preserved**, the changed-file set is reconstructed from the worktree via `recover_changed_files`, the resume point is re-validated, and processing resumes at the next uncompleted §3 step without re-spawning completed subagents. Add a **backward-compat sentence**: an in-progress slice with **no `subState`** (a legacy checkpoint written before this scheme) falls back to the **old discard-and-reprocess path** (remove worktree, delete branch, coerce to `pending`) — mirror the existing graceful-degradation pattern used for absent `driverSessionId` (~lines 90–92).
  - Keep the file ≤200 lines and within the `## Contents`/reference-file conventions (`.claude/rules/reference-files.md`); no out-of-bundle citations.

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — two edits:
  1. **§1 "Exactly one match" resume block (lines 200–208) REWRITE.** Replace the current discard logic ("Every slice still `in-progress` was interrupted before finishing: discard its partial artifacts so it re-processes cleanly — if it has a `worktreePath`, call `remove_worktree` (`force: true`); delete its `sliceBranch` ...; then coerce that slice back to `pending`.") with the continue-from-subState policy: for each `in-progress` slice, read its `subState`; **preserve** its worktree and branch; reconstruct its changed-file set with `recover_changed_files` on `worktreePath`; **re-validate** the resume point per the resume matrix (below); then resume §3 at the next uncompleted step, **not** re-spawning subagents whose work is already captured. Add the **legacy fallback** sentence: an in-progress slice with no `subState` (pre-P1.2 checkpoint) uses the old discard path (`remove_worktree force:true` + delete branch + coerce to `pending`). Keep the surrounding `driverSessionId` refresh, context-flag deletion, and "never re-fetch / re-derive scope" sentences untouched.
  2. **§3 per-step checkpoint writes (steps 4→8).** At each transition listed in the **subState↔step table** below, add an explicit "set `subState` to `<value>` and checkpoint `run-state.json`" instruction. Coordinate with **P1.1** at step 6: P1.1 already inserts the `push_and_verify` (`git push` + `git ls-remote` landing check) call there — `subState: "pushed"` is written **only after** that landing check confirms the branch, in the same checkpoint. Add a one-line note in §"Checkpointing" (lines 744–752) that the per-slice `subState` is checkpointed at every §3 transition (the resume anchor), alongside the existing coarse-`state`/wave checkpoint rule.

- **`plugins/orchestrate/.claude-plugin/plugin.json`** — bump `"version": "1.2.0"` → `"1.3.0"` (minor: new persisted schema field + changed resume behavior). See version-cascade caution under Risks.

- **`.claude-plugin/marketplace.json`** — bump the **orchestrate plugin entry** `"version": "1.2.0"` → `"1.3.0"` and the **top-level** `"version": "1.6.0"` → `"1.7.0"` (magnitude-mirrored minor, per the plugin-versioning-cascade memory). Cursor `plugins[]` entries carry no version field.

---

**Steps** (executable; no design re-derivation)

1. **Edit `references/run-state.md`** — apply the three edits above: add `subState` to the schema JSON example, add the `subState` slice-field bullet, and REWRITE both the Resume "Exactly one match" passage and the slice-states terminal/re-process sentence, including the legacy (absent-`subState`) fallback. Verify the file stays ≤200 lines and keeps its `## Contents` block accurate.
2. **Edit `SKILL.md` §1** — REWRITE lines 200–208 to continue-from-subState (preserve worktree/branch, `recover_changed_files`, re-validate, resume at next step), with the legacy fallback for checkpoints lacking `subState`.
3. **Edit `SKILL.md` §3** — insert the `subState` checkpoint writes per the **subState↔step table**; at step 6 write `pushed` only after the P1.1 `git ls-remote` landing check; add the §Checkpointing one-liner.
4. **Bump versions** — `plugin.json` 1.2.0→1.3.0; `marketplace.json` orchestrate entry 1.2.0→1.3.0 and top-level 1.6.0→1.7.0. (If PRD #241 items are integrated together, coalesce the bump at integration — see Risks.)
5. **No `npm run build`** — nothing under `orchestrate-mcp/src/` changed; `dist/` is untouched.

**subState ↔ §3 step table** (where each checkpoint write lands):

| subState | Written after | Condition |
|---|---|---|
| `implemented` | step 4 (implementer `completed`) **and** step 4a `verify_changeset` agreement | changed-file set established |
| `verified` | the capability gate passes (run_tests/run_typecheck/run_build/run_lint green for the slice) | pre-review gate satisfied |
| `reviewed` | step 5 reviewer envelope `status: passed` | review gate satisfied |
| `pushed` | step 6, **only after** P1.1 `push_and_verify` `git ls-remote` confirms the branch on the remote | branch landed (not just `git push` exit-0) |
| `pr-open` | step 7 slice PR created (URL recorded) | PR open |
| `merged` | step 8 `gh pr merge --squash` succeeds (PR merged into umbrella) | precedes coarse `state: passed` (step 9) |

**Resume re-validate matrix** (per recorded `subState`; worktree always preserved, changed-file set always reconstructed via `recover_changed_files`):

| Recorded subState | Skip these subagents | Re-validate (cheap) | Resume at |
|---|---|---|---|
| (absent / legacy) | — | — | **fallback**: discard worktree+branch, coerce to `pending`, reprocess |
| `implemented` | investigator, implementer | run capability gate (it may have crashed mid-run) | step 4a result already known → step "verified" gate, then step 5 |
| `verified` | investigator, implementer | re-run capability gate (cheap, confirms worktree intact) | step 5 (reviewer) |
| `reviewed` | investigator, implementer, reviewer | re-run capability gate | step 6 (commit + push) |
| `pushed` | impl, reviewer | `git ls-remote --heads origin orchestrate/slice-<N>` confirms branch (a crash mid-push can leave uncertain state) | step 7 (open PR) |
| `pr-open` | impl, reviewer | confirm PR exists (`gh pr view`); `git ls-remote` confirms branch | step 8 (merge) |
| `merged` | all subagents | — (merge already landed in umbrella) | step 9 only (label transition + `remove_worktree`) — this is exactly the integration boundary **#232-A.1** keys on |

**Re-validate tool note (faithfulness).** On resume the implementer's *declared* `filesChanged` is gone, so reconstruct the changed-file set with `recover_changed_files` (this is **why** `dependsOn` includes #236 — the `-uall` fix makes that recovery accurate). Do **not** route reconstruction through `verify_changeset`: `verify_changeset` requires a `declaredFiles` argument that no longer exists on resume. For pre-push subStates the **capability gate** (run_tests/typecheck/build/lint) is the real re-validate; for `pushed`/`pr-open` the re-validate is `git ls-remote` / `gh pr view`. The recovered file set feeds the reviewer prompt and the commit staging just as the live path uses the implementer's declared set.

---

**Verification**

This item changes **skill prose + run-state schema docs + version fields only** — there is no `orchestrate-mcp/src/` change, so the vitest suite does not exercise it. Verification is a build/test sanity pass plus targeted grep contracts. Run from `plugins/orchestrate/orchestrate-mcp`:

```bash
cd plugins/orchestrate/orchestrate-mcp && npm test
```
Green = the existing suite still passes (no regression; expected, since `src/` is untouched). A non-zero exit means something unrelated broke and must be investigated.

Grep contracts (run from repo root) — proving the prose changes landed and the old contradicting text is gone:

```bash
# subState enum present in the reference and field documented
grep -n "implemented|verified|reviewed|pushed|pr-open|merged" plugins/orchestrate/skills/orchestrate/references/run-state.md
grep -n "subState" plugins/orchestrate/skills/orchestrate/references/run-state.md
grep -n "subState" plugins/orchestrate/skills/orchestrate/SKILL.md

# the OLD discard-on-resume policy must be GONE from both files (these should return NOTHING):
grep -n "coerce that slice back to .pending." plugins/orchestrate/skills/orchestrate/SKILL.md
grep -n "coerced back to .pending. before re-processing" plugins/orchestrate/skills/orchestrate/references/run-state.md

# legacy fallback documented (absent subState) — should MATCH:
grep -niE "no .?subState|absent .?subState|legacy checkpoint" plugins/orchestrate/skills/orchestrate/references/run-state.md plugins/orchestrate/skills/orchestrate/SKILL.md

# version cascade:
grep -n '"version"' plugins/orchestrate/.claude-plugin/plugin.json   # expect 1.3.0
grep -n '"version"' .claude-plugin/marketplace.json                  # expect orchestrate entry 1.3.0 + top-level 1.7.0

# reference-file size guard (<=200 lines):
wc -l plugins/orchestrate/skills/orchestrate/references/run-state.md
```
Green result: the enum + `subState` field appear in both edited surfaces; the two "discard / coerce to pending" greps return **empty**; the legacy-fallback grep matches; versions read 1.3.0 / 1.3.0 / 1.7.0; `run-state.md` is ≤200 lines.

---

**Acceptance criteria**

- `subState` enum (`implemented|verified|reviewed|pushed|pr-open|merged`) is documented in `references/run-state.md` (schema JSON example **and** slice-fields list) and the §1 + §3 SKILL prose references it.
- The resume policy in **both** `SKILL.md` (lines 200–208) and `references/run-state.md` (Resume "Exactly one match" + slice-states sentence) is rewritten to **continue-from-subState** (preserve worktree/branch, reconstruct via `recover_changed_files`, re-validate, resume at next uncompleted step). The old discard/remove-worktree/coerce-to-`pending` text for in-progress slices is **removed** (grep contracts above pass).
- **Backward-compat**: an in-progress slice with **no `subState`** (legacy checkpoint) is documented to fall back to the old discard-and-reprocess path — explicitly stated in both files, mirroring the absent-`driverSessionId` degrade pattern.
- §3 writes `subState` at each of the 6 transitions per the table; `pushed` is written **only after** the P1.1 `git ls-remote` landing check (no `subState: pushed` before push is verified landed).
- The §Checkpointing section notes `subState` is checkpointed at every §3 transition.
- Resume at `subState: merged` skips all subagents and runs **only** §3 step 9 (label + `remove_worktree`) — the boundary #232-A.1 reclaims branches on.
- `npm test` in `plugins/orchestrate/orchestrate-mcp` is green (no regression).
- **Docs-in-sync verdicts (each surface gets an explicit verdict, not silence):**
  - `references/run-state.md` — **UPDATED** (subState field + resume rewrite). ✓
  - `SKILL.md` — **UPDATED** (§1 resume + §3 checkpoints + §Checkpointing note). ✓
  - **Version cascade** — **UPDATED**: `plugin.json` 1.2.0→1.3.0; `marketplace.json` orchestrate entry 1.2.0→1.3.0; top-level 1.6.0→1.7.0. ✓
  - **MCP `.describe()` + `index.ts`** — **NOT touched**. Reason: no new/changed tool; reuses `recover_changed_files`, `verify_changeset`, `push_and_verify`, `git ls-remote` as-is. `distRebuild=false`.
  - **CONTEXT.md** — **NOT touched**. Reason: no glossary term changes; the LOCKED surface line scopes P1.2 to skill+run-state and (unlike #234/#228) names no CONTEXT.md/glossary impact.
  - **docs/adr/** — **NOT touched**. Reason: no architectural decision reversal (resume mechanics are an implementation refinement within ADR-0008's concurrent-run model, not a new invariant).
  - **templates/** — **NOT touched**. Confirmed: `templates/` holds only `commands.json`, `handoff.json`, `routing.json`; there is **no** run-state schema template (run-state.json is orchestrator-written per run, never templated).

---

**Risks / shared files**

- **`SKILL.md` is the highest-contention file across PRD #241.** §3 step 6 is edited by **both P1.1** (insert `push_and_verify`) **and P1.2** (`subState: pushed` write gated on P1.1's landing check) — these two must be reconciled into one coherent step-6 block; land **P1.1 first** (it owns the landing check P1.2's `pushed` depends on). Other SKILL.md editors in the same PRD: **#232-A.1** (§3 step 9 `--delete-branch`, keys on P1.2's `subState: merged`), **#234** (§3 step 4 `incomplete` continue-in-place, reuses P1.2's worktree preservation), **#228** (§1 sweep + §2 final-PR). Use **section-anchored** edits and re-read SKILL.md immediately before editing (a sibling item may have already touched it).
- **`plugin.json` + `marketplace.json` version fields are touched by every PRD #241 item** → a guaranteed conflict if each item bumps independently. The bump should **coalesce to a single version cascade at integration time** (the umbrella resolves it), not be applied per-item in isolation. The 1.3.0 / 1.7.0 targets here assume P1.2 lands as part of the #241 batch; the integrator owns the final number.
- **`references/run-state.md`** is also conceptually touched by **P1.1** (it may add a `pushed`-landed note) — coordinate so the `subState` field and the push-landing semantics are described once, consistently.
- **Ordering (restating dependsOn):** **#236** must land first because resume reconstruction relies on `recover_changed_files` being accurate under the `-uall` fix (otherwise the recovered changed-file set silently drops untracked dirs). **#230-P1.1** must land first because `subState: pushed` is defined to be written only after P1.1's `git ls-remote` landing check exists in step 6 — without P1.1, `pushed` has no verified meaning and the resume `git ls-remote` re-validate has no counterpart in the forward path.

---

### #239 — OBSERVED vs INFERRED in failureReason → enforceable `rootCause` envelope field

The implementer and reviewer result envelopes gain an optional `rootCause: { status: "verified" | "hypothesis", claim: string, evidence?: string }` object. It is a **forcing function**: a subagent that reports a non-success outcome must consciously label its root-cause analysis as empirically `verified` (with the command/output as `evidence`) versus an unproven `hypothesis`. The `validate_envelope` validator **hard-requires** `rootCause` on the genuinely-diagnostic failure statuses (implementer `blocked`, reviewer `failed`) — a missing `rootCause` there is an `invalid` / `SCHEMA_MISMATCH` envelope, exactly like the existing role-mismatch check. Downstream consumers (#232-A.2 issue comment, handoff) render the verified-vs-hypothesis distinction; that rendering is **their** lane, not this item's. Cost is bounded to FAILED slices. Locked decision: `docs/analysis/orchestrate-grill-decisions.md:379-394`. Rejected: prompt-instruction-only (unenforceable, no structured downstream signal).

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/validate-envelope.ts`** — the schema source of truth.
  - Add a new `rootCauseSchema` (place it just after `verificationEntrySchema`, ~line 26):
    ```ts
    const rootCauseSchema = z.object({
      status: z
        .enum(["verified", "hypothesis"])
        .describe(
          "Epistemic label for the root-cause analysis. 'verified' = " +
            "confirmed empirically by a command and its output (cite it in " +
            "`evidence`); 'hypothesis' = an unproven inference the subagent " +
            "could not confirm within its turn. The subagent must consciously " +
            "pick one — never present a guess as a fact."
        ),
      claim: z
        .string()
        .describe("The root-cause statement itself — what actually went wrong."),
      evidence: z
        .string()
        .optional()
        .describe(
          "The command run and the relevant output that proves the claim. " +
            "Required in spirit when status='verified'; omit for a 'hypothesis'."
        ),
    });
    ```
  - On `implementerEnvelopeSchema` (after the `notes` field, before the closing `})` at ~line 62) add an **optional** member:
    ```ts
    rootCause: rootCauseSchema
      .optional()
      .describe(
        "Root-cause analysis for a non-success outcome. REQUIRED when " +
          "status='blocked' (label it verified|hypothesis and cite evidence " +
          "when verified); optional for 'incomplete' (cause is definitionally " +
          "turn-budget); omit for 'completed'."
      ),
    ```
  - On `reviewerEnvelopeSchema` (after `notes`, ~line 91) add the same optional `rootCause` field with a reviewer-flavored `.describe()`: "REQUIRED when status='failed'; omit for 'passed'."
  - **Do NOT use `.refine()`/`.superRefine()`** on these two member schemas. They feed `z.discriminatedUnion("role", [...])` (line 162) and `validateEnvelopeOutputSchema.envelope` whose `.shape` crosses the MCP boundary at `index.ts:667`. `.refine()` returns `ZodEffects`, which `z.discriminatedUnion` rejects at module-load — this breaks the build, not a test.
  - Enforce the requirement **imperatively, post-parse**, mirroring the existing role-mismatch block at lines 395-404. Inside `validateEnvelope`, after the `if (result.data.role !== role) {...}` block and before the final `return { status: "valid", ... }`, add:
    ```ts
    // #239: a diagnostic failure outcome must carry a labelled root cause.
    const env = result.data;
    const requiresRootCause =
      (env.role === "implementer" && env.status === "blocked") ||
      (env.role === "reviewer" && env.status === "failed");
    if (requiresRootCause && env.rootCause === undefined) {
      return {
        status: "invalid",
        role,
        errorCode: "SCHEMA_MISMATCH",
        errorMessage:
          `A ${env.role} envelope with status "${env.status}" must include a ` +
          `rootCause object ({ status: "verified" | "hypothesis", claim, ` +
          `evidence? }). The subagent did not declare a root cause for the ` +
          `failure.`,
      };
    }
    ```
  - Keep `envelopeSchema` a pure `discriminatedUnion` (no change to lines 162-167). The derived `ImplementerEnvelope`/`ReviewerEnvelope` types pick up `rootCause` automatically (lines 235-236, no edit).

- **`plugins/orchestrate/orchestrate-mcp/src/index.ts`** — the `validate_envelope` `description` string (lines 657-665). Append one clause so the MCP `.describe()` surface stays in sync, e.g. after "never silently accepted)" add: `… A failure outcome (implementer 'blocked', reviewer 'failed') must also carry a labelled \`rootCause\` (verified|hypothesis) or it is reported invalid.` No handler-logic change (`handleValidateEnvelope` already forwards the structured result verbatim). The registration block and `.shape` wiring are untouched.

- **`plugins/orchestrate/orchestrate-mcp/test/validate-envelope.test.ts`** — add cases. Do **not** change the existing `implementerEnvelope()` / `reviewerEnvelope()` factories (lines 20-44) — their defaults are `completed`/`passed`, which legitimately omit `rootCause`, so existing valid-envelope tests keep passing. Add new `it(...)` cases (described in Steps).

- **`plugins/orchestrate/orchestrate-mcp/dist/index.js`** — rebuilt esbuild bundle (single file; `npm run build` regenerates it). MUST be committed — vitest tests `src/`, so green tests are not the shipped artifact.

- **`plugins/orchestrate/agents/implementer-standard.md`** and **`implementer-deep.md`** — in the "exactly these fields" list (standard ~line 73-101; deep ~line 90 onward), add a `rootCause` bullet after `notes`. Add a **second example** envelope showing a `blocked` status carrying `rootCause`.

- **`plugins/orchestrate/agents/reviewer-standard.md`** and **`reviewer-deep.md`** — same treatment: a `rootCause` bullet after `notes` (standard ~line 89; deep ~line 113) and a second example showing a `failed` status with `rootCause`.

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — one sentence only, in *Failure handling* (~line 696, the "On a FAILED slice:" lead-in or the validated-envelope paragraph at 683-685): note that a `blocked`/`failed` worker envelope now carries a validated `rootCause` (verified|hypothesis) and the failure artifact should surface it. Do **not** write the `gh issue comment` body or add a `rootCause` field to `references/run-state.md` — that is #232-A.2's deliverable, which the ledger says *consumes* #239's `rootCause`.

- **Version cascade (3 fields, magnitude-mirrored — minor bump):**
  - `plugins/orchestrate/.claude-plugin/plugin.json` — `"version": "1.2.0"` → `"1.3.0"`.
  - `.claude-plugin/marketplace.json` orchestrate entry — `"version": "1.2.0"` → `"1.3.0"` (the object whose `"name": "orchestrate"`, line ~36).
  - `.claude-plugin/marketplace.json` top-level — `"version": "1.6.0"` → `"1.7.0"` (mirror the minor magnitude).

**require-vs-warn mapping (resolved from the ledger's "can require/warn"):**

| role | status | `rootCause` |
|---|---|---|
| implementer | `blocked` | **required** (invalid if absent) |
| implementer | `incomplete` | optional (cause is definitionally turn-budget) |
| implementer | `completed` | omitted / ignored |
| reviewer | `failed` | **required** (invalid if absent) |
| reviewer | `passed` | omitted / ignored |
| conflict-resolver | (any) | **out of scope** — ledger Surface names implementer + reviewer only |

Rejected for v1: a separate `warnings` output channel on `validateEnvelopeOutputSchema` (larger surface — a new output field; the file's strictness philosophy is reject-hard, not warn). `verified ⇒ evidence` is **not** hard-enforced (kept optional to avoid a second `ZodEffects` cross-field rule); the `.describe()` text and the subagent defs instruct subagents to cite evidence when `verified`.

**Steps**

1. Edit `src/tools/validate-envelope.ts`: add `rootCauseSchema`; add the optional `rootCause` field to `implementerEnvelopeSchema` and `reviewerEnvelopeSchema`; add the imperative post-parse `requiresRootCause` check inside `validateEnvelope` after the role-mismatch block. Leave `envelopeSchema`, the `conflictResolverEnvelopeSchema`, and the `investigatorEnvelopeSchema` untouched.
2. Edit `src/index.ts`: extend the `validate_envelope` tool `description` string with the one rootCause clause. No handler change.
3. Edit `test/validate-envelope.test.ts`: add (a) **valid** — implementer `blocked` with `rootCause: { status: "verified", claim, evidence }` → expect `status: "valid"`; (b) **valid** — reviewer `failed` with `rootCause: { status: "hypothesis", claim }` (no evidence) → `valid`; (c) **invalid** — implementer `blocked` *without* `rootCause` → `status: "invalid"`, `errorCode: "SCHEMA_MISMATCH"`, `envelope` undefined; (d) **invalid** — reviewer `failed` without `rootCause` → same; (e) **valid** — implementer `incomplete` without `rootCause` → `valid` (proves the optional-for-incomplete branch); (f) **valid** — implementer `completed` with the default factory unchanged still `valid` (regression guard). Build the failure envelopes from the existing factories with spread overrides, e.g. `{ ...implementerEnvelope(), status: "blocked", rootCause: {...} }`.
4. Run `cd plugins/orchestrate/orchestrate-mcp && npm test` — confirm all new + existing cases green.
5. Edit the four subagent defs (`implementer-{standard,deep}.md`, `reviewer-{standard,deep}.md`): add the `rootCause` field bullet and a second (failure) example to each. Keep wording parity between standard and deep variants of the same role.
6. Edit `SKILL.md` *Failure handling*: the single rootCause sentence.
7. Bump the three version fields (plugin.json, marketplace orchestrate entry, marketplace top-level).
8. Rebuild the bundle: `cd plugins/orchestrate/orchestrate-mcp && npm run build`. Confirm `dist/index.js` now contains the change; stage and commit `dist/index.js` together with the `src/` change (do not hand-edit the bundle).

**Verification**

```bash
cd plugins/orchestrate/orchestrate-mcp && npm test
```
Green = the new `blocked`-without-rootCause and `failed`-without-rootCause cases return `invalid`/`SCHEMA_MISMATCH`, the `blocked`/`failed`-with-rootCause and `incomplete`-without-rootCause cases return `valid`, and every pre-existing case (including the unchanged `completed`/`passed` factories) still passes.

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run build
```
Green = esbuild emits `dist/index.js` with no error (proves no `ZodEffects`/discriminated-union load failure).

```bash
grep -c "rootCause" plugins/orchestrate/orchestrate-mcp/dist/index.js
```
Expect ≥ 1 — the rebuilt bundle carries the schema. (Run via `/usr/bin/grep` if RTK condenses the count.)

```bash
git -C /home/rodrigo/Workspace/agent-engineering-toolkit diff --stat plugins/orchestrate/orchestrate-mcp/dist/index.js
```
Non-empty = the committed bundle was actually regenerated (the "green tests ≠ shipped fix" guard).

**Acceptance criteria**

- `rootCauseSchema` exists with `status` (`verified|hypothesis`), `claim`, optional `evidence`, each `.describe()`d.
- `implementerEnvelopeSchema` and `reviewerEnvelopeSchema` carry an **optional** `rootCause`; `envelopeSchema` remains a plain `discriminatedUnion` (no `ZodEffects` member).
- `validate_envelope` returns `invalid` / `SCHEMA_MISMATCH` for implementer `blocked` and reviewer `failed` envelopes that omit `rootCause`; returns `valid` for those statuses when `rootCause` is present, and `valid` for implementer `incomplete` / `completed` and reviewer `passed` regardless of `rootCause`.
- New vitest cases cover both the required-and-present (valid) and required-and-absent (invalid) paths for both roles; `npm test` is green.
- `npm run build` succeeds and the regenerated `dist/index.js` is committed in the same unit; `grep` confirms `rootCause` in the bundle.
- **Docs-in-sync (same unit):**
  - MCP `.describe()` surface: `src/index.ts` `validate_envelope` description extended (no separate index.ts registration change needed beyond the description string).
  - Subagent defs: all **four** of `implementer-{standard,deep}.md` + `reviewer-{standard,deep}.md` document the `rootCause` field and each carry a second (failure-status) example envelope using it.
  - `SKILL.md`: one sentence in *Failure handling* noting `blocked`/`failed` envelopes now carry a validated `rootCause` surfaced in the failure artifact.
  - Version cascade: `plugins/orchestrate/.claude-plugin/plugin.json` 1.2.0→1.3.0, marketplace orchestrate entry 1.2.0→1.3.0, marketplace top-level 1.6.0→1.7.0.
  - **Explicitly NOT updated by this item** (stay in their owners' lanes): `references/run-state.md` and the `gh issue comment` body (#232-A.2); `render.ts` (slice-state `failureReason` → dashboard, not the envelope `rootCause`); the conflict-resolver schema/defs; `CONTEXT.md`/`docs/adr/` (no decision record required for a bounded schema extension already locked in the ledger).

**Risks / shared files**

- **`dist/index.js` is the single bundle every `src/`-touching item regenerates.** Integration ordering: land all `src/` changes (this item, #231-P2.2's `run_install` registration, any other src-touching slice), then run `npm run build` **once** at integration and commit the one bundle — never hand-merge `dist/index.js` across slices.
- **`src/index.ts` is shared** with #231-P2.2 (registers `run_install`). This item touches only the `validate_envelope` description string; the conflict surface is small but real — expect a trivial textual merge.
- **`dependsOn: []`** — #239 is the foundational *producer* of `rootCause`. #232-A.2 (failed-issue comment) and #228 (lifecycle) *consume* it and depend on #239, not vice-versa. #239 can land first/independently.
- **Scope-creep guards (memory-flagged):** do not add `rootCause` to the conflict-resolver schema or its defs (ledger Surface = implementer + reviewer only — but note in the handoff that conflict-resolver `failed` is also a FAILED slice the ledger did not name: flag as possible follow-up, do not fix here); do not edit `render.ts`; do not write the issue-comment body or `run-state.md` field (that is #232-A.2). The lost-`filesChanged` objection for a now-`invalid` `blocked`/`failed` envelope is already answered by the existing `recover_changed_files` fallback (`SKILL.md:707-716`).
- **`ZodEffects` trap (build-breaking if mis-specced):** enforcement is the imperative post-parse check, mirroring `validate-envelope.ts:395-404` — never a `.refine()`/`.superRefine()` on a discriminated-union member.

---

### #232-A.1 — incremental slice-branch reclamation at subState=merged

Reclaim a passed slice's branch the moment it integrates — delete the **remote** branch as part of the squash-merge (`gh pr merge --squash --delete-branch`) and force-delete the **local** branch right after `remove_worktree` frees it — instead of waiting for the end-of-run `clean_runs` sweep. The `clean_runs` whole-run sweep stays as a backstop. This is an **orchestrator-only, SKILL.md-driven** change — no `orchestrate-mcp/src/` touch, no new `clean_runs` mode. Safe because #230-P1.2's `subState=merged` guarantees a resumed run continues from the merged checkpoint and never re-processes (and re-pushes) a slice whose branch was already reclaimed.

**Target files**

- `plugins/orchestrate/skills/orchestrate/SKILL.md` — §3 steps 8/8a/9. Three edits to the merge command and one addition to step 9:
  - **Site 1 — step 8, line ~579** (`MERGEABLE` path): change `gh pr merge <pr-number> --squash` → `gh pr merge <pr-number> --squash --delete-branch`.
  - **Site 2 — step 8a.3, line ~605** (clean-textual-merge path, after re-verify passes): change `gh pr merge <pr-number> --squash` → `gh pr merge <pr-number> --squash --delete-branch`.
  - **Site 3 — step 8a.6, line ~627** (conflict-resolved path, in the fenced command block): change `gh pr merge <pr-number> --squash` → `gh pr merge <pr-number> --squash --delete-branch`.
  - **Step 9 (lines ~630-634) — add the local-branch reclamation.** After the existing `remove_worktree` call, add an explicit local force-delete of the slice branch, run from the repo root, idempotent (tolerate an already-absent branch on a resumed re-entry):
    ```
    git branch -D orchestrate/slice-<N>   # local reclamation; -D (force) because squash rewrote the SHA so the branch is not an ancestor of umbrella; already-absent is fine
    ```
    Add the surrounding prose that the orchestrator deletes the local slice branch only **after** `remove_worktree` releases the worktree's checkout of that branch (otherwise the delete is refused), and that this completes incremental reclamation: remote half done by `--delete-branch` at step 8, local half here.
  - **Step 8 / 8a prose note** (near the first `--delete-branch` site): note that `--delete-branch` deletes the **remote** branch; it may additionally warn or no-op on the local branch because the slice worktree still has it checked out — that warning is **tolerated, not a slice failure**; the authoritative local delete is the explicit `git branch -D` at step 9.

- `plugins/orchestrate/skills/orchestrate/references/run-state.md` — **Cleanup lifecycle** paragraph (~lines 183-186, the sentence "For a `merged` run, `clean_runs` removes its `passed`-slice worktrees, deletes its `umbrellaBranch` and every `sliceBranch` (local and remote)..."). Add that a passed slice's branch is now reclaimed **incrementally, at squash-merge** (remote via `--delete-branch`, local via `git branch -D` after worktree removal), so by the time `clean_runs` runs those branches are normally already gone; `clean_runs` deleting "every `sliceBranch`" is now the **backstop** for any branch that survived a mid-run crash. Keep the existing statement that a preserved (failed-slice) worktree's `sliceBranch` is left fully intact — incremental reclamation fires only on `passed`/`subState: "merged"`, never on a failed slice.

**Steps**

1. Read `plugins/orchestrate/skills/orchestrate/SKILL.md` in this session (required before Edit).
2. Edit **Site 1** (step 8, `MERGEABLE` bullet, ~line 579): append ` --delete-branch` to `gh pr merge <pr-number> --squash`.
3. Edit **Site 2** (step 8a.3, ~line 605): append ` --delete-branch` to that path's `gh pr merge <pr-number> --squash`.
4. Edit **Site 3** (step 8a.6 fenced block, ~line 627): append ` --delete-branch` to `gh pr merge <pr-number> --squash`.
5. In step 8 (near Site 1), add the tolerated-local-warning note: `--delete-branch` reclaims the remote branch; a local-delete warning from `gh` is expected (worktree still holds the branch) and is not a failure — the explicit step-9 `git branch -D` is the real local reclamation.
6. Edit **step 9** (~lines 630-634): after the `remove_worktree` sentence, add the `git branch -D orchestrate/slice-<N>` command (force flag mandatory; idempotent / already-absent tolerated) with the inline rationale (squash rewrote the SHA → `-d` would refuse; must run after `remove_worktree` frees the checkout).
7. Read `plugins/orchestrate/skills/orchestrate/references/run-state.md` in this session, then edit the Cleanup-lifecycle paragraph to describe incremental reclamation at merge + `clean_runs` as backstop (per Target files above). Keep the file ≤200 lines and its existing `## Contents` ToC intact (reference-file convention).
8. Do **not** touch any `orchestrate-mcp/src/` file, any subagent definition, any template, CONTEXT.md, or any ADR — verified none require changes (see Acceptance criteria).
9. Run the Verification grep contracts below and confirm each returns its expected result this turn.

**Verification** (grep contracts — this item touches **no** `orchestrate-mcp/src/`, so vitest proves nothing; do **not** pad with `npm test`)

Run from `plugins/orchestrate/`:

- All three merge sites now force a branch delete — expect **exactly 3** matches:
  ```
  grep -c "gh pr merge <pr-number> --squash --delete-branch" skills/orchestrate/SKILL.md
  ```
  Green = `3`.
- No bare squash-merge without `--delete-branch` remains — expect **0**:
  ```
  grep -nE "gh pr merge <pr-number> --squash([^ ]|$| *$)" skills/orchestrate/SKILL.md | grep -v -- "--delete-branch"
  ```
  Green = no output (exit 1).
- Step 9 performs the local force-delete — expect **≥1**:
  ```
  grep -n "git branch -D orchestrate/slice" skills/orchestrate/SKILL.md
  ```
  Green = at least one hit inside step 9 (around line ~635), using `-D` (uppercase), not `-d`.
- run-state.md reflects incremental reclamation + backstop framing:
  ```
  grep -niE "incremental|backstop|reclaim" skills/orchestrate/references/run-state.md
  ```
  Green = the Cleanup-lifecycle paragraph now mentions incremental reclamation and `clean_runs` as backstop.
- Reference-file size guard still holds:
  ```
  wc -l skills/orchestrate/references/run-state.md
  ```
  Green = ≤ 200.

**Acceptance criteria**

- SKILL.md §3: all three `gh pr merge ... --squash` invocations (step 8 MERGEABLE, step 8a.3 clean-textual-merge, step 8a.6 conflict-resolved) carry `--delete-branch`.
- SKILL.md §3 step 9 force-deletes the **local** slice branch with `git branch -D orchestrate/slice-<N>`, **after** `remove_worktree`, idempotently (already-absent branch tolerated for resumed re-entry), with the inline rationale (squash-rewritten SHA ⇒ `-d` refuses; worktree must be removed first).
- SKILL.md documents that `gh ... --delete-branch`'s local-delete warning is tolerated (not a slice failure) — remote reclamation is step 8's, authoritative local reclamation is step 9's.
- Incremental reclamation fires **only** on a `passed` / `subState: "merged"` slice; a failed/preserved slice's branch remains fully intact (unchanged behavior).
- **Docs-in-sync — exact surfaces, in this same unit:**
  - `SKILL.md` §3 steps 8/8a/9 — the four edits above (primary surface).
  - `references/run-state.md` — Cleanup-lifecycle paragraph updated: passed-slice branches reclaimed incrementally at merge; `clean_runs` is the backstop for crash-survivors.
  - **MCP `.describe()` + `index.ts`** — **no change** (no `orchestrate-mcp/src/` touch; the decision explicitly forbids a new `clean_runs` mode). Affirmatively unaffected.
  - **CONTEXT.md** — **no change required**; verified by grep (`reclaim|sliceBranch|branch-delete|incremental` returns zero glossary hits), so no glossary entry exists to update.
  - **docs/adr/** — **no ADR required** (unlike #228); this is a step-ordering refinement, not a new architectural invariant.
  - **Templates** (`plugins/orchestrate/templates/`) — **unaffected**; reclamation is orchestrator shell/git behavior, not config.
  - **Subagent defs** (`plugins/orchestrate/**/agents/**`) — **unaffected**; all four subagents have no Bash/git access, so branch reclamation is orchestrator-only by construction.
  - **Marketplace version cascade** — bump the 3 fields per project convention, magnitude-mirrored: `plugins/orchestrate/.claude-plugin/plugin.json` `version`, the orchestrate entry's `version` in the top-level marketplace manifest, and the marketplace **top-level** `version` (mirrors the bump magnitude). A behavior change to the merge/reclaim flow is a patch-level bump unless this PRD's release coordinator batches it into a larger version.
- `dependsOn`: **#230-P1.2** must land first — its `subState=merged` continue-from-checkpoint resume policy is what makes reclamation safe (see Risks).

**Risks / shared files**

- **`dependsOn` #230-P1.2 is load-bearing, not cosmetic.** Under the *old* discard-and-reprocess resume policy (SKILL `:202-208`), an interrupted in-progress slice is reset to `pending` and re-run. If the crash happened **after** the squash-merge but the branch was reclaimed, re-processing would re-push the deleted branch and **double-apply the slice into umbrella**. P1.2's "continue from `subState: \"merged\"`, never re-process" closes that window. Land P1.2 first; if the two ship together, ensure P1.2's resume logic is in place before this step's reclamation is exercised.
- **`-D` (force) is mandatory, not stylistic.** After a squash-merge the slice branch is not an ancestor of umbrella (squash rewrites the SHA), so `git branch -d` refuses with "not fully merged." Using `-d` would make every passing slice's step 9 fail. Implementer must use `-D`.
- **Ordering: `remove_worktree` before `git branch -D`.** The worktree has the slice branch checked out; deleting it while checked out is refused. Step 9 already removes the worktree first — keep that order.
- **Shared file — `SKILL.md`** is the highest-contention file in PRD #241: #228 (§2 final-PR body + §1 sweep), #234 (§3 step 4), #230-P1.2 (§1 resume + §3 per-step checkpoints) all edit it. This item edits §3 steps 8/8a/9 only. Sequence after or carefully rebase against #230-P1.2 (which also rewrites §1 resume + §3 checkpoints) to avoid clobbering its step-9 `subState` checkpoint additions; coordinate the §3 step-9 region specifically.
- **`clean_runs` backstop tolerance — verified OK, do not modify.** Post-reclamation, the end-of-run sweep routinely meets already-deleted passed-slice branches. Confirmed `orchestrate-mcp/src/tools/clean-runs.ts` already treats an absent ref as success (file header lines 26-27 "an already-absent resource is success... idempotent"; `not found` / `branch .* not found` detection ~lines 230-233; remote-delete `catch` ~lines 281-291). So the backstop does **not** error on reclaimed branches — no `clean_runs` change needed and none permitted by the locked decision. (Were this tolerance absent, it would warrant a separate issue, not a change here.)

---

### #228 — auto-close merged issues → close on merge→development, orchestrator-driven [philosophy change]

Reverse the deliberate "orchestrator does not close issues" stance. Close a passed slice's issue **exactly when its code lands in `development`** (no premature closure), via two complementary mechanisms: (1) `Closes #<N>` in the **final umbrella PR body** for every passed slice — fires the native GitHub close the instant the umbrella PR merges into the default branch; (2) a **backstop** in the start-of-run cleanup sweep — when the orchestrator resolves a run's final-PR verdict as `merged`, it explicitly `gh issue close <N>` for each still-open passed-slice issue (covers the case where the integration base is not the repo's default branch, and reconciles state). The `gh issue close` is **orchestrator work**, never `clean_runs` — the no-gh invariant on the MCP tool is preserved. This is a SKILL.md procedure change only; **no `orchestrate-mcp/src/` change**, so `clean_runs` stays git+filesystem-only and `dist/` is untouched.

**Target files**

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — three edits, all in the orchestrator procedure:
  1. **Final-PR body (lines 413–421)** — the `gh pr create --base development --head orchestrate/umbrella-<runId>` block. Change the `--body` so that, in addition to the run summary, it lists a `Closes #<N>` line for **each passed slice** (slices whose `run-state.json` `state` is `"passed"`). Explicitly: failed and skipped slices get **no** `Closes` line. Add prose: because the integration base is `development`, when `development` is the repository's default branch these keywords fire a native close on merge; when it is not the default branch the keywords are inert and the §1 sweep backstop closes the issues instead.
  2. **§1 Start-of-run cleanup sweep (lines 113–137, the verdict-resolution + `clean_runs` steps)** — add a backstop. During the verdict-resolution pass (step 1, where the orchestrator already opens each `run-state.json` to read `finalPullRequest`), for every run whose verdict resolves to `merged`, **collect the `issue` number of every slice whose `state` is `"passed"`** from that same run-state, BEFORE calling `clean_runs` (which deletes the run directory and its `run-state.json`). Then, after `clean_runs` returns, run `gh issue close <N>` for each collected issue that is still open. State that the close is idempotent/guarded: when `development` is the default branch the final-PR-body `Closes #N` already closed the issue, so `gh issue close` on an already-closed issue is a no-op, not an error (`gh issue close` on a closed issue exits 0). Reaffirm: the `gh` call is **orchestrator** work; `clean_runs` remains git+filesystem-only and never shells `gh` (line 136–137 invariant unchanged).
  3. **"Tracker updates" / "does not close" prose (lines 730–742)** — REWRITE. Delete the contradiction at 740–742 ("The orchestrator does not close issues. The `Closes #N` trailers on the slice commits close them when a developer merges the final umbrella pull request…"). Replace with the new lifecycle statement: the orchestrator closes a passed slice's issue when its code lands in `development` — via `Closes #N` in the final umbrella PR body (native close on default-base merge) and, as a backstop, via `gh issue close` in the §1 sweep on a `merged` verdict (covers non-default integration base). Reconcile the "single writer" paragraph (732–738): the orchestrator remains the single writer of tracker state, and issue-closing is now part of that writer role (alongside labels and progress comments) — it is **not** delegated to subagents and **not** left to slice-commit trailers. Keep the slice-commit `Closes #N` trailer (line 557) and the slice PR `Implements #N` body (line 565) **unchanged** — do not edit those; the trailer is now harmless reinforcing redundancy and `Implements` is the deliberate non-closing slice→umbrella verb.

- **`plugins/orchestrate/.claude-plugin/plugin.json`** — bump `version` `1.2.0` → `1.3.0` (behavior change to issue lifecycle warrants a minor bump). NOTE: this is a shared cascade field; if a sibling PRD-#241 item lands a bump first, mirror onto its value rather than reverting.

- **`.claude-plugin/marketplace.json`** — bump the `orchestrate` plugin entry `version` `1.2.0` → `1.3.0` (mirror plugin.json), and bump the marketplace top-level `version` `1.6.0` → `1.7.0` (magnitude-mirrored: a minor plugin bump → a minor top-level bump). The `.cursor-plugin/marketplace.json` carries no orchestrate entry and is **not** touched.

**Steps**

1. Read `plugins/orchestrate/skills/orchestrate/SKILL.md` in-session.
2. **Final-PR body** — edit the `gh pr create … --base development` block (≈413–421): make `--body` enumerate `Closes #<N>` for each `state:"passed"` slice, plus run summary; add the default-vs-non-default-base prose. Do not add `Closes` for failed/skipped slices.
3. **§1 sweep backstop** — in the verdict-resolution step (≈113–130), add: "for each run resolving to verdict `merged`, collect from its `run-state.json` the `issue` of every slice with `state:"passed"` into a per-run close-set **before** invoking `clean_runs`." After the `clean_runs` call (≈131–137), add a step: "for each collected issue still open, `gh issue close <N>` — orchestrator work; idempotent if already closed by the native keyword." Keep the explicit "`clean_runs` never shells `gh`" invariant line.
4. **Tracker-updates rewrite** — replace lines 740–742 and reconcile 732–738 per Target-files edit 3. Ensure the new prose says the orchestrator DOES close issues on merge→development and names both mechanisms.
5. Do NOT edit SKILL.md lines 557 (slice-commit trailer) or 565 (slice PR `Implements #N`).
6. Bump `plugins/orchestrate/.claude-plugin/plugin.json` version → `1.3.0`.
7. Bump `.claude-plugin/marketplace.json`: orchestrate entry → `1.3.0`, top-level → `1.7.0`.
8. Run the verification greps below.

**Verification**

This item changes no `orchestrate-mcp/src/` code, so the honest proof is targeted greps showing each prose surface flipped, plus a sanity check that the MCP suite/dist are untouched. Run from the repo root unless noted.

```
# 1. The contradiction is gone — should print NOTHING:
grep -n "orchestrator does not close issues" plugins/orchestrate/skills/orchestrate/SKILL.md

# 2. Final-PR body now closes passed slices — base development block carries Closes:
grep -n -A8 "gh pr create --base development" plugins/orchestrate/skills/orchestrate/SKILL.md | grep -i "Closes #"

# 3. §1 sweep has the gh issue close backstop AND still forbids gh in clean_runs:
grep -n "gh issue close" plugins/orchestrate/skills/orchestrate/SKILL.md
grep -n "never shells" plugins/orchestrate/skills/orchestrate/SKILL.md   # clean_runs no-gh invariant intact

# 4. Slice-level verbs untouched (both must still print):
grep -n "Implements #<N>" plugins/orchestrate/skills/orchestrate/SKILL.md
grep -n 'Closes #<N>"' plugins/orchestrate/skills/orchestrate/SKILL.md    # slice-commit trailer line 557

# 5. Version cascade:
grep -n '"version"' plugins/orchestrate/.claude-plugin/plugin.json                 # 1.3.0
grep -n -A3 '"name": "orchestrate"' .claude-plugin/marketplace.json | grep version  # 1.3.0
sed -n '4p' .claude-plugin/marketplace.json                                         # top-level 1.7.0  (read-only verify)

# 6. MCP sanity — dist untouched, suite still green (proves no collateral src damage, NOT this change):
cd plugins/orchestrate/orchestrate-mcp && npm test
git -C ../../.. status --porcelain orchestrate-mcp/dist   # expect: no output (dist unchanged)
```

Green result: grep 1 prints nothing; greps 2 and 3 print the new `Closes #`/`gh issue close` lines; the `never shells`/`Implements`/slice-trailer lines still print; the three version greps show 1.3.0 / 1.3.0 / 1.7.0; `npm test` passes and `dist/` shows no porcelain changes.

**Acceptance criteria**

- Final umbrella PR body contains a `Closes #<N>` line for every passed slice and for **no** failed/skipped slice.
- The §1 cleanup sweep, on a `merged` verdict, collects passed-slice issue numbers from `run-state.json` **before** `clean_runs` deletes the run dir, then `gh issue close`es each still-open one; the close is idempotent when the native keyword already fired.
- `clean_runs` MCP tool is unchanged — still git+filesystem-only, never shells `gh` (no-gh invariant preserved); the `gh issue close` lives in the SKILL orchestrator procedure.
- Eager close on slice→umbrella is NOT introduced: slice PR keeps `Implements #N`, slice commit keeps its `Closes #N` trailer, neither is relied upon in prose.
- SKILL.md no longer contains the "orchestrator does not close issues" statement; the Tracker-updates section consistently states the orchestrator closes issues on merge→development.
- **Docs-in-sync (verified surfaces for this item):**
  - **SKILL.md** — the three edits above (final-PR body §2, sweep §1, Tracker-updates prose). This is the sole behavior surface.
  - **references/** — grep confirmed **no** copy of the "does not close"/"Closes #"/"single writer" prose lives under `skills/orchestrate/references/`; the lifecycle prose is SKILL-only, so **no reference file needs editing**. (run-state.md already documents `state:"passed"` and `issue` — the fields the sweep reads — so it needs no change.)
  - **MCP `.describe()` + `index.ts`** — **no change**: `clean_runs` schema/registry are unaffected (it does not close issues).
  - **templates/** — `templates/` holds `commands.json`, `handoff.json`, `routing.json` only; the final-PR body is inline in SKILL.md, not templated — **no template change**.
  - **CONTEXT.md** — checked: its lifecycle entries (Run cleanup gate, Integration base, lines 153/228/255) are about the *cleanup gate* and remain consistent; there is **no** "orchestrator does not close issues" glossary entry to reverse. #228 was not tagged with a CONTEXT.md update (unlike its sibling #234). **No CONTEXT.md edit required** — but if review wants the lifecycle made explicit, add a one-line "Issue close" note tying close⇔code-in-`development`.
  - **docs/adr/** — no existing ADR asserts "orchestrator does not close"; none contradicted. No ADR edit required.
  - **Version cascade** — plugin.json `1.3.0`, marketplace orchestrate entry `1.3.0`, marketplace top-level `1.7.0` (all three bumped, magnitude-mirrored).

**Risks / shared files**

- **Ordering race (primary risk).** `clean_runs` deletes the merged run's directory including its `run-state.json` — the only source of the passed-slice issue numbers. The sweep MUST capture those numbers during verdict resolution (it already opens run-state for `finalPullRequest`) **before** calling `clean_runs`; closing after deletion without pre-capture loses the numbers. Spec'd in Steps 3 and called out here.
- **Shared file — SKILL.md §1 sweep + Tracker-updates prose — collides with #232-A.2.** #232-A.2 also edits the §1 sweep region and adds orchestrator `gh` work (a failed-slice issue comment) under the same "gh = orchestrator, no-gh invariant preserved" framing, and likewise touches the Tracker-updates paragraph. Both items rewrite the "orchestrator does gh work / clean_runs is no-gh" statement. **Merge, don't clobber:** the combined prose must say the orchestrator (a) closes passed-slice issues on `merged` verdict (#228) AND (b) comments on failed-slice issues (#232-A.2), both as orchestrator `gh` work, with `clean_runs` still no-gh. If #232-A.2 lands first, extend its sweep text rather than overwrite; if #228 lands first, leave a clear seam.
- **Shared cascade fields — plugin.json + marketplace.json versions.** Every PRD-#241 orchestrate item that bumps versions touches these three fields. Last-writer-wins on the raw value; coordinate so the final landed numbers reflect the highest cumulative bump rather than reverting a sibling's bump. No code dependency — `dependsOn: []`.
- **No `dist/` rebuild** — `distRebuild=false`; do not run `npm run build` for this item (nothing in `src/` changes). The `npm test` line in Verification is a collateral-damage sanity check only, not proof of this behavior change.

---

### #231-P2.1 — worktree IDE diagnostic noise (prose-only)

Add prose to `SKILL.md` stating that IDE / language-server diagnostics about files under a worktree path are **non-authoritative**, and that the orchestrate capability tools (`run_typecheck` / `run_build` / `run_tests` / `run_lint`) are the **only** source of truth for whether a slice builds and passes. **Skip** the optional `go.work` emission entirely (low-value, language-specific; the issue itself names prose as the primary fix and "least plugin-owned surface"). This item ships **no code** — it is a documentation/prose change only.

LOCKED decision (`docs/analysis/orchestrate-grill-decisions.md:396` — `#231-P2.1 → prose-only [accepted, no fork]`): *"`SKILL.md` states IDE/language-server diagnostics about worktree paths are non-authoritative; the capability tools are the only source of truth for build/test. Skip the optional `go.work` emission (low-value, language-specific; the issue itself calls prose the primary fix — 'least plugin-owned surface')."*

---

**Target files**

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — the **single named surface** of the decision. Add one short prose paragraph (2–3 sentences) framing IDE/LSP diagnostics as non-authoritative and the capability tools as the only build/test truth. Anchor it at the **capability-tools-as-verification-truth** framing, NOT at the `not-configured` config discussion (line 58, which is about command *presence*, not epistemic authority). Two good anchor candidates:
  - The intro framing at **line 23** (`…and verifies it through the orchestrate capability tools.`) — append the new prose immediately after this sentence, or
  - The implementer verification flow around **lines 496–497** (`…instruction to verify with the capability tools using the worktree path as repoPath…`) — append the prose as a clarifying sentence/parenthetical there.
  - Pick ONE anchor (recommend line 23, the global framing, so it governs every role's verification, not just the implementer). Exact prose to insert (verbatim):

    > IDE or language-server diagnostics about files under a worktree path — unresolved imports, missing-module errors, or stale type errors from a checkout that lacks generated or installed artifacts — are **non-authoritative**. The orchestrate capability tools (`run_typecheck`, `run_build`, `run_tests`, `run_lint`) are the only source of truth for whether a slice builds and its tests pass; trust their result, never an editor's inline diagnostic.

- **`plugins/orchestrate/.claude-plugin/plugin.json`** — `"version"` field, **patch bump `1.2.0` → `1.2.1`** (line 3). Subject to umbrella-integration reconciliation (see Risks) — do NOT assume this exact pre-image survives if a sibling PRD #241 item lands first.

- **`.claude-plugin/marketplace.json`** — TWO version fields, magnitude-mirrored patch bump:
  - orchestrate plugin entry `"version"` (line 36): `1.2.0` → `1.2.1`.
  - top-level marketplace `"version"` (line 4): `1.6.0` → `1.6.1`.

**Optional reinforcement — BEYOND the decision's named surface (not required, flag if included).** The decision names only `SKILL.md`. If (and only if) the umbrella wants belt-and-suspenders, the same one-sentence non-authoritative-diagnostics note MAY be echoed into the **three build/test verifier** subagent prompts at their `## Process` step-4 verification block:
  - `plugins/orchestrate/agents/implementer-standard.md` (after line 46), `implementer-deep.md`, `reviewer-standard.md`, `reviewer-deep.md`, `conflict-resolver-standard.md`, `conflict-resolver-deep.md`.
  - **EXCLUDE** `investigator-standard.md` / `investigator-deep.md` — read-only, run no build, so a build/test-truth note is irrelevant there.
  - This is explicitly an extension past the locked decision text. Default to **SKILL.md-only**; only add echoes if the integrator asks, and add them to `filesTouched` if you do.

---

**Steps**

1. Read `plugins/orchestrate/skills/orchestrate/SKILL.md` (full or the line 1–70 + 490–540 windows) to confirm the line-23 anchor text is unchanged since this spec (a sibling item may have shifted it).
2. Insert the verbatim prose paragraph (above) immediately after the chosen anchor sentence (recommend line 23). Use a unique surrounding-text match for the `Edit` so it lands deterministically.
3. Do **NOT** add, emit, or reference `go.work` anywhere. No new template, no new emission code, no `detect-project` change. This is a negative requirement — the decision explicitly dropped it.
4. Bump `plugins/orchestrate/.claude-plugin/plugin.json` `"version"` `1.2.0` → `1.2.1`.
5. Bump `.claude-plugin/marketplace.json` orchestrate entry `"version"` `1.2.0` → `1.2.1` and top-level `"version"` `1.6.0` → `1.6.1`.
6. (Optional, only if integrator requests) echo the one-sentence note into the six build/test-verifier subagent defs (NOT the investigators); add those paths to `filesTouched`.
7. Run the grep-based verification below.

---

**Verification** (prose-only — grep-based, NOT `npm test`; per project memory `green vitest ≠ shipped fix`, and the inverse holds: a passing test suite proves nothing about this prose change):

```bash
cd /home/rodrigo/Workspace/agent-engineering-toolkit

# 1. prose present in SKILL.md (expect ≥1 hit each)
grep -n "non-authoritative" plugins/orchestrate/skills/orchestrate/SKILL.md
grep -n "only source of truth" plugins/orchestrate/skills/orchestrate/SKILL.md

# 2. NEGATIVE: no go.work emission was added (expect ZERO new hits in plugin-owned source/templates)
grep -rn "go.work" plugins/orchestrate/templates/ plugins/orchestrate/skills/ plugins/orchestrate/orchestrate-mcp/src/ ; echo "exit=$?"

# 3. version cascade bumped (expect 1.2.1 / 1.2.1 / 1.6.1)
grep -n '"version"' plugins/orchestrate/.claude-plugin/plugin.json
grep -n '"version"' .claude-plugin/marketplace.json
```

Green result:
- step 1: both greps return at least one line (the inserted paragraph).
- step 2: `grep -rn "go.work" …` prints **nothing** and reports `exit=1` (no match) — confirms the skipped emission was not reintroduced.
- step 3: `plugin.json` shows `"version": "1.2.1"`; `marketplace.json` shows the orchestrate entry at `1.2.1` and top-level at `1.6.1`.

Regression-only (expected green, does NOT exercise this change — run only as a sanity check that prose edits didn't corrupt anything build-adjacent): `cd plugins/orchestrate/orchestrate-mcp && npm test` — but a green result is NOT evidence this item works; the grep checks above are the real proof.

---

**Acceptance criteria**

- `SKILL.md` contains a paragraph stating IDE/language-server diagnostics about worktree-path files are non-authoritative AND that `run_typecheck`/`run_build`/`run_tests`/`run_lint` are the only source of truth for build/test. (grep: `non-authoritative` + `only source of truth`).
- **NEGATIVE: no `go.work` emission** was added anywhere under `plugins/orchestrate/` (templates, skill, or MCP src). `grep -rn "go.work"` across those paths returns no new match. (Guards against an eager implementer re-adding the explicitly-skipped optional feature.)
- The prose is added to the **named surface only** (`SKILL.md`); any subagent echoes are explicitly flagged as optional reinforcement beyond the decision and exclude the two investigator defs.
- **Docs-in-sync surfaces** (state each one's disposition):
  - `SKILL.md` — **THE change** (primary and only required edit).
  - `references/` (`context-handoff.md`, `run-state.md`) — **n/a**: not truth-framing surfaces.
  - `templates/` — **n/a**: no `go.work` template (explicitly skipped); no other template carries build-truth framing.
  - MCP `.describe()` + `orchestrate-mcp/src/index.ts` — **n/a**: no MCP tool added or changed; `distRebuild: false`, no `npm run build` / dist commit needed.
  - `CONTEXT.md` — **n/a**: project uses `docs/adr/` at repo root, no `CONTEXT.md` for this plugin; no domain-language change.
  - `docs/adr/` — **n/a**: this item *implements* a locked grill decision (`orchestrate-grill-decisions.md:396`); it does not introduce a new architectural decision, so no new ADR.
  - **Marketplace version cascade** — **REQUIRED**: `plugin.json` 1.2.0→1.2.1, marketplace orchestrate entry 1.2.0→1.2.1, marketplace top-level 1.6.0→1.6.1 (magnitude-mirrored patch). Subject to umbrella reconciliation (one bump for the merged PRD #241 set, not N literal bumps).
- Verification greps all pass as described.

---

**Risks / shared files**

- **`plugins/orchestrate/.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json`** are touched by **every** PRD #241 item. N independent patch bumps will textually conflict and mis-compose at integration. The bump here is subject to **umbrella-integration reconciliation** — the integrator collapses all sibling bumps into one version bump for the merged set; do not treat `1.2.0→1.2.1` as final if a sibling lands first. Expect a trivial conflict on the `"version"` lines.
- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** is also edited by **#231-P2.4** (`mergeStateStatus: UNSTABLE` doc-only) and other Tier-3 prose items. Expect merge conflicts in `SKILL.md`; resolution rule (per project memory `stale-worktree-base-disambiguation`): evolved side wins, new sections additive — the line-23 paragraph is additive prose, low collision risk if anchored to its own surrounding-text match.
- **No code dependency** (`dependsOn: []`): prose + version fields only. Can land in any wave; ordering matters only for the shared-file version reconciliation above, not for correctness.
- **No `dist/` rebuild** (`distRebuild: false`): nothing under `orchestrate-mcp/src/` changes, so the committed `orchestrate-mcp/dist/` is untouched and `npm run build` is not required.

---

### #230-P1.3 — orchestrator-side capability gate before merge

The orchestrator itself runs `run_build` + `run_tests` on each slice's worktree as a deterministic pre-merge gate, **independent of any subagent envelope** — the reviewer's re-run (step 5) is a subagent self-report, and the trust chain must not be entirely self-report. The redundancy `implementer → reviewer → orchestrator` is accepted as the trust boundary. The MCP tools already exist and are registered; this is **orchestration only — a `SKILL.md` gate step, no new tooling and no `orchestrate-mcp/src/` change**. **Depends on #237** (until `commands.json` resolves in worktrees, the gate is a silent no-op).

**Target files**

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — section "## 3. Processing one slice". Insert a NEW gate step between step 5 (reviewer) and step 6 (commit & push). To avoid renumbering the whole tail (6→9 plus internal cross-refs), add it as a **sub-labeled step `5a`** mirroring the existing `8a` convention (the file already uses `8a` at line 583). Content:
  - Prose: "After the reviewer returns `passed` (step 5), and **before any commit, push, or GitHub state exists**, the orchestrator independently runs the correctness capability tools on the slice worktree — this is the pre-merge capability gate. It does **not** trust the reviewer's envelope `verification`: the reviewer's re-run is a subagent self-report; this step is the orchestrator's own deterministic check, the last link in the `implementer → reviewer → orchestrator` trust chain."
  - Call the `run_build` and `run_tests` MCP tools with the slice's `<worktree-path>` as `repoPath` (mirror the exact pattern already used at line 600-602 in step 8a.3, which passes "the worktree path as `repoPath`").
  - Status handling for the `status` enum returned by each tool (enum defined at `orchestrate-mcp/src/tools/run-command.ts:68` — `passed | failed | not-configured | error`):
    - `passed` on both → proceed to step 6.
    - `not-configured` (either verb) → **tolerated**, treated as a pass for that verb (consistent with SKILL.md prerequisites lines 56-59: a missing-command `not-configured` is "tolerated"). The gate must not fail a project that has not configured `build`/`tests`.
    - `failed` or `error` (either verb) → the slice has **FAILED**, using the existing FAILED semantics already defined throughout section 3 (no new failure handling invented).
  - Verb set is exactly **`run_build` + `run_tests`** — a deliberate subset, not illustrative. Add a one-line rationale: build+test is the correctness trust boundary; `typecheck`/`lint` remain the reviewer's quality remit and are intentionally NOT re-run here. Note explicitly that step 8a.3 (post-conflict re-verify) running all four `run_tests`/`run_typecheck`/`run_build`/`run_lint` is a **known, intentional asymmetry** — the pre-merge gate is focused correctness on a worktree the reviewer already saw; the conflict re-verify is max-confidence on a never-before-tested merged combination.
  - Naming reconcile (one line): "pre-merge" describes *what it gates* (whether the merge proceeds); it mechanically runs pre-commit, on the same worktree state the reviewer validated.
- **`CONTEXT.md`** — "### Orchestrate run vocabulary" glossary (begins line 126). Add a one-line **"Capability gate"** entry: the orchestrator's own pre-merge run of `run_build` + `run_tests` on a slice worktree, independent of the reviewer's `verification` self-report; the deterministic final link in the `implementer → reviewer → orchestrator` trust chain. Include an `_Avoid_:` line (e.g. "merge check, verification gate"). Place it adjacent to the existing **Result envelope** / **Capability command map** entries.
- **`plugins/orchestrate/.claude-plugin/plugin.json`** — line 3, bump `"version": "1.2.0"` → `"1.3.0"` (minor bump: additive behavior change, no breaking config/tool-contract change).
- **`.claude-plugin/marketplace.json`** — orchestrate plugin entry `"version"` at line 36, bump `1.2.0` → `1.3.0` to mirror the plugin.json bump; and the top-level marketplace `"version"` at line 4 (`1.6.0`) bumped by the same magnitude (minor) → `1.7.0`, per the project plugin-versioning cascade (top-level mirrors the bump magnitude). The Cursor entry (`.cursor-plugin/marketplace.json`) carries **no** version field and the artifact shape does not change, so it is NOT touched.

**Steps**

1. Read `plugins/orchestrate/skills/orchestrate/SKILL.md` section 3 (steps 5–9, roughly lines 533–634) in the current session.
2. Insert the new **step 5a** immediately after step 5 ends (line 542) and before step 6 begins (line 543), as specified in Target files — prose + the two tool calls + the four-way status handling + the verb-subset rationale + the 8a.3 asymmetry note.
3. Do NOT renumber steps 6–9. Confirm the sub-label `5a` does not collide with any existing cross-reference. Specifically leave untouched the section-1 references to a *different* "step 6" (lines 193, 291, 303 — fresh-run / driverSessionId), and the section-3 self-references that stay valid because the tail is not renumbered: line 401 ("steps 6–9"), line 529 ("the commit (step 6)"), line 580 ("step 8a"), line 734 ("section 3 step 9").
4. Read `CONTEXT.md` glossary section (line 126 region) and add the one-line **"Capability gate"** vocabulary entry with its `_Avoid_:` line.
5. Bump the version cascade: `plugins/orchestrate/.claude-plugin/plugin.json` (1.2.0→1.3.0), `.claude-plugin/marketplace.json` orchestrate entry (1.2.0→1.3.0) and top-level (1.6.0→1.7.0).
6. Run the Verification commands below.

**Verification**

This is a SKILL-prose change with **no `orchestrate-mcp/src/` edit**, so `npm test` is a **regression guard only — it does NOT prove the gate**. Prove the prose change with structural checks:

- No src/dist leak (confirms `distRebuild: false`):
  - `git -C plugins/orchestrate/orchestrate-mcp status --porcelain` → empty for both `src/` and `dist/` (no orchestrate-mcp change in this item).
- Regression guard (green = nothing else broke; NOT proof of P1.3):
  - `cd plugins/orchestrate/orchestrate-mcp && npm test` → all suites pass.
- Gate step exists and is correctly shaped (run from repo root):
  - `grep -n "5a" plugins/orchestrate/skills/orchestrate/SKILL.md` → shows the new sub-labeled step between step 5 and step 6.
  - `grep -n "run_build\|run_tests\|independent\|self-report\|pre-merge" plugins/orchestrate/skills/orchestrate/SKILL.md` → the new step names both `run_build` and `run_tests`, and states the gate is independent of / not trusting the reviewer envelope self-report.
  - `grep -n "not-configured" plugins/orchestrate/skills/orchestrate/SKILL.md` → the new step explicitly tolerates `not-configured`.
- Glossary entry: `grep -n "Capability gate" CONTEXT.md` → one entry present.
- Version cascade consistency:
  - `grep -n "version" plugins/orchestrate/.claude-plugin/plugin.json` → `1.3.0`.
  - `grep -n "1.3.0\|1.7.0" .claude-plugin/marketplace.json` → orchestrate entry `1.3.0`, top-level `1.7.0`.

Green result: `git status` shows no `src/`/`dist/` change; `npm test` passes; all greps return the expected new prose; the three manifest versions are consistent.

**Acceptance criteria**

- A new section-3 sub-step `5a` runs `run_build` + `run_tests` on the slice `<worktree-path>` (`repoPath`) after a `passed` reviewer and before commit/push.
- The step explicitly states it does NOT consult the reviewer envelope's `verification` — it is the orchestrator's own independent check (trust-boundary language present).
- Verb set is exactly `run_build` + `run_tests`; `typecheck`/`lint` are NOT added (documented as a deliberate subset).
- All four `status` enum values handled: `passed`→proceed, `not-configured`→tolerated/pass, `failed`/`error`→slice FAILED (reusing existing FAILED semantics).
- Step 8a.3 four-verb re-verify is left unchanged and the asymmetry is documented as intentional.
- Steps 6–9 NOT renumbered; all existing cross-references (lines 401, 529, 580, 734 in section 3; lines 193, 291, 303 in section 1) remain valid.
- **Docs-in-sync (P0 cross-cutting criterion) — exact surfaces updated in THIS unit of work:**
  - `skills/orchestrate/SKILL.md` — gate step added (the change itself). **REQUIRED.**
  - `CONTEXT.md` glossary — "Capability gate" one-line entry. **REQUIRED.**
  - Marketplace version cascade — `plugins/orchestrate/.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` (orchestrate entry + top-level). **REQUIRED.**
  - **NOT applicable, explicitly:** `references/*.md` (no schema/field doc changes — `run-state.md` subState belongs to #230-P1.2); MCP `.describe()` + `index.ts` (no `src/` change — tools already exist/registered, `run_build`/`run_tests` at `orchestrate-mcp/src/index.ts:283,290`); `templates/commands.json` (schema unchanged — `knownFailures`/`integration` verbs belong to #231-P2.5 / #235); `docs/adr/` (the ledger assigns ADRs to #237 and #240, not P1.3); `.cursor-plugin/marketplace.json` (no shape change, no Cursor version field).

**Risks / shared files**

- **Shared file collision — `SKILL.md` section 3 is the hot spot.** Both **#231-P2.5** (knownFailures annotation: greps the gate's captured output to annotate matched baseline-failure patterns) and **#235** (post-merge per-slice unit re-verify + per-wave integration tier) build on this exact gate step. **P1.3 must land first** because it introduces the step they extend. Sequence P1.3 → P2.5 → #235 on section 3 to avoid three items editing the same step region concurrently.
- **dependsOn `#237` (keystone, hard).** Until #237 makes `commands.json` resolve inside slice worktrees, `run_build`/`run_tests` against the worktree return `not-configured` and the gate is a silent no-op (per the locked sequencing note, lines 8-11 of the ledger). P1.3 is only effective once #237 lands.
- **Step-numbering churn.** Using the `5a` sub-label (mirroring `8a`) deliberately avoids renumbering steps 6–9 and the many `step 6` / `step 9` / `step 8a` cross-references; if a future editor instead renumbers, they must scope it to section 3 ONLY (section 1 has an unrelated "step 6").
- **No `dist/` rebuild needed** (`distRebuild: false`) — purely prose/doc/version edits. If the implementer finds themselves editing `orchestrate-mcp/src/`, they have diverged from the locked decision ("the MCP tools already exist — this is orchestration, a SKILL.md gate step, not new tooling") and should stop.

---

### #233 — `handoff.json` resumePrompt static literal, partition-blind

The orchestrator derives the resume invocation from its own `runId` prefix (`prd<N>-` → `/orchestrate <N>`; `backlog-` → `/orchestrate`) in `SKILL.md` §4 and passes it to `spawn_successor` as a new **optional** `resumePrompt` input; the tool resolves `input.resumePrompt ?? config.successor.resumePrompt`, leaving the static `handoff.json` value as a manual/legacy fallback. The misleading `spawn-successor.ts:16–21` comment ("re-discovery makes the handoff per-run-aware / a `runId` would be a dead parameter") is empirically false for partitioned runs — re-discovery keys on the *invocation prefix*, which the static prompt cannot encode per-run — and is rewritten accordingly.

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/spawn-successor.ts`** (distRebuild source):
  - **Schema — `spawnSuccessorInputSchema` (lines 25–36).** Add a second optional field after `repoPath`, before the closing `})`:
    ```ts
    resumePrompt: z
      .string()
      .optional()
      .describe(
        "Optional resume invocation for the successor, derived by the " +
          "orchestrator from the run's partition: '/orchestrate <N>' for a " +
          "'prd<N>-' run, '/orchestrate' for a 'backlog-' run. Overrides " +
          "handoff.json's successor.resumePrompt, which remains the fallback " +
          "for manual/legacy launches."
      ),
    ```
    No other schema change — `SpawnSuccessorInput` is `z.infer` of this schema (line 95), so the type updates automatically.
  - **Resolution — `spawnSuccessor()` (lines 213–215).** The decision shorthand `input.resumePrompt ?? config.resumePrompt` is path-imprecise: `resumePrompt` is nested under `successor`. Replace the `const successor = config.successor;` binding so the input overrides only that one field, leaving every other successor field (`claudeArgs`, `terminals`) intact:
    ```ts
    const repoPath = input.repoPath ?? process.cwd();
    const { config, warning } = loadHandoffConfig(repoPath);
    const successor = {
      ...config.successor,
      resumePrompt: input.resumePrompt ?? config.successor.resumePrompt,
    };
    const configWarning = warning ?? undefined;
    ```
    Everything downstream (`successor.terminals`, `buildClaudeCommand(successor, repoPath)`) is unchanged — `buildClaudeArgv` already reads `config.resumePrompt`, so it now picks up the overridden value with zero builder change.
  - **Comment fix — file-header block (lines 16–21).** Rewrite the second paragraph. KEEP true: the tool takes no `runId`, resolves no per-run path, reads only the flat `.orchestrate/handoff.json` and launches a terminal. CHANGE the false claim: the orchestrator now derives the partition-correct invocation from its `runId` prefix and passes it as the optional `resumePrompt` input; the successor's `/orchestrate <N>` (or bare `/orchestrate`) re-discovers the active run by matching that **invocation prefix** against in-progress `runId`s. A static `handoff.json` prompt cannot encode the partition per-run, so it is only the fallback. Suggested replacement:
    ```ts
    // `spawn_successor` takes no `runId` and resolves no per-run path: it reads
    // only the flat `.orchestrate/handoff.json` config and launches a terminal.
    // The partition-correct resume invocation is supplied by the orchestrator
    // via the optional `resumePrompt` input — `/orchestrate <N>` for a `prd<N>-`
    // run, `/orchestrate` for a `backlog-` run — derived from the run's `runId`
    // prefix. The successor's invocation prefix is what the run-discovery scan
    // keys on to re-find the active run. When no `resumePrompt` is passed (manual
    // or legacy launch), `handoff.json`'s static `successor.resumePrompt` is the
    // fallback; that static value alone cannot encode the partition per-run.
    ```

- **`plugins/orchestrate/orchestrate-mcp/test/spawn-successor.test.ts`**: add one test inside the existing `describe("spawnSuccessor", …)` block (the integration block at ~line 171, which already uses a temp-dir + bogus-terminal harness) that proves the input override flows end-to-end through `spawnSuccessor()` — not merely through the pure `buildClaudeArgv` (the existing line-89 test only sets a pre-built config and never exercises the `??` resolution inside the tool).

- **`plugins/orchestrate/orchestrate-mcp/dist/tools/spawn-successor.js`**: regenerated by `npm run build`; committed (dist/ is committed; vitest tests src/, so a green test run is NOT proof the fix shipped).

- **`plugins/orchestrate/skills/orchestrate/SKILL.md` §4 step 2 (lines 662–665)**: instruct the orchestrator to derive the resume invocation from the run's `runId` prefix and pass it as `resumePrompt` to `spawn_successor`. Exact derivation rule (state it unambiguously): from the active run's `runId`, if it starts `prd`, strip the `prd` prefix and take the characters up to the first `-` as `<N>` (e.g. `prd195-20260521-015143` → `195`), pass `resumePrompt: "/orchestrate 195"`; if it starts `backlog-`, pass `resumePrompt: "/orchestrate"`. The orchestrator **always derives and passes** `resumePrompt` (uniformly, even for backlog where it equals the default) so the static `handoff.json` value is purely a manual/legacy fallback.

- **`plugins/orchestrate/skills/orchestrate/references/context-handoff.md` §4 (lines 129–132)**: the closing paragraph currently says the successor "resumes the *orchestration run* … by re-invoking `/orchestrate`". Extend it to note the orchestrator derives the partition-correct invocation (`/orchestrate <N>` for a `prd<N>-` run, bare `/orchestrate` for a `backlog-` run) from the run's `runId` prefix and passes it as `spawn_successor`'s `resumePrompt`, overriding `handoff.json`'s static `successor.resumePrompt` (the table row at line 94 stays accurate as the documented fallback default; no change to that row needed beyond optionally appending "fallback when the orchestrator does not pass `resumePrompt`"). Keep the file ≤ 200 lines (reference-file rule).

**Steps**

1. Edit `spawn-successor.ts`: add the optional `resumePrompt` field to `spawnSuccessorInputSchema` (after `repoPath`).
2. Edit `spawn-successor.ts`: change the `successor` binding in `spawnSuccessor()` to `{ ...config.successor, resumePrompt: input.resumePrompt ?? config.successor.resumePrompt }`.
3. Edit `spawn-successor.ts`: rewrite the lines 16–21 header comment per the replacement above.
4. Add the override integration test to `spawn-successor.test.ts` (see Verification for the exact assertion seam).
5. Edit `SKILL.md` §4 step 2 with the derivation rule + "always derive and pass `resumePrompt`".
6. Edit `references/context-handoff.md` §4 closing paragraph with the orchestrator-derived-override note.
7. From `plugins/orchestrate/orchestrate-mcp/`, run `npm run build` to regenerate `dist/`.
8. Run `npm test`; confirm all pass including the new override test.
9. Stage and commit `src/`, the regenerated `dist/`, the test, and both doc surfaces together (atomic, one logical change).
10. Do NOT edit `index.ts` (see Risks) — the new field auto-registers via `spawnSuccessorInputSchema.shape`.

**Verification**

From `plugins/orchestrate/orchestrate-mcp/`:

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run build && npm test
```

Green = TypeScript compiles and every vitest suite passes, including the new `spawnSuccessor` override test. The new test's seam (no real terminal spawned): write a `.orchestrate/handoff.json` into a temp `repoPath` whose `successor.terminals` is a single bogus entry (matching the existing integration-block harness), call `await spawnSuccessor({ repoPath: dir, resumePrompt: "/orchestrate 195" })`, and assert the returned `status === "error"` / `errorCode === "ALL_TERMINALS_FAILED"` result's `attempts[0].argv` ends with `"/orchestrate 195"` — proving the input override reached `buildClaudeArgv` through the tool, not just the pure builder. A second assertion (omit `resumePrompt`) should show the argv ends with the config/default `"/orchestrate"`.

Shipped-fix proof (dist/ is committed; green src tests ≠ shipped bundle):

```bash
cd plugins/orchestrate/orchestrate-mcp && grep -n "config.successor.resumePrompt" dist/tools/spawn-successor.js
```

Non-empty output proves the `??` resolution compiled into the committed bundle.

**Acceptance criteria**

- `spawnSuccessorInputSchema` exposes an optional `resumePrompt: z.string().optional()` with a `.describe()` documenting the partition derivation and the override-vs-fallback relationship.
- `spawnSuccessor()` resolves `input.resumePrompt ?? config.successor.resumePrompt` and passes it through `successor` to `buildClaudeCommand`; no other successor field is altered.
- The lines 16–21 header comment no longer claims re-discovery is what makes the handoff per-run-aware; it states the orchestrator-derived `resumePrompt` carries the partition and the static config is the fallback.
- New `spawnSuccessor` integration test asserts an injected `resumePrompt` reaches `attempts[].argv` as the final token; `npm test` green.
- `npm run build` run and the regenerated `dist/tools/spawn-successor.js` committed; the `grep` shipped-fix proof returns a hit.
- **Docs-in-sync (same unit):**
  - **SKILL.md** — §4 step 2 carries the explicit `runId`-prefix derivation rule and the "always derive and pass `resumePrompt`" instruction.
  - **references/context-handoff.md** — §4 closing paragraph notes the orchestrator-derived override; file stays ≤ 200 lines; no new external citations (reference-file self-containment rule).
  - **MCP `.describe()`** — the partition nuance lives in the schema `.describe()` in `spawn-successor.ts` (above). **`index.ts` is intentionally NOT edited** — the field auto-registers via `spawnSuccessorInputSchema.shape`, and the existing registration description (lines 498–507, "re-invokes /orchestrate") is incomplete-but-not-false; touching `index.ts` here only manufactures a needless merge conflict with #238 (which adds `validate_run_state` to `index.ts`).
  - **CONTEXT.md / docs/adr** — none. #233 is not the ADR-worthy item (that is the separate cross-run-isolation item); no domain-term or decision record is introduced.
  - **templates/handoff.json** — no functional change; the static `"/orchestrate"` stays a valid documented fallback.
  - **Marketplace version cascade** — bumped once at PRD #241 integration, not independently by #233 (see Risks).

**Risks / shared files**

- **`SKILL.md`** is touched by multiple PRD #241 items in different sections (#233 → §4 step 2; #238 → §1 step 6; #237 → fresh-run/worktree prose). Edits are section-disjoint; expect prose-level merge conflicts only, resolved by keeping each item's section intact (evolved-side-wins, additive). No code dependency — `dependsOn: []`.
- **`index.ts`** is edited by #237 (possibly, tool descriptions) and #238 (adds `validate_run_state`). #233 deliberately does **not** touch it — keep it that way to avoid an avoidable conflict; the new input field needs no registration edit.
- **`orchestrate-mcp/dist/`** is regenerated by every distRebuild item in PRD #241 (#236, #237, #238 also touch `src/`). `dist/` diffs can collide at integration; the resolution is mechanical — rebuild (`npm run build`) on the merged `src/` and commit the regenerated bundle, never hand-merge `dist/`.
- **Marketplace version cascade** (`plugin.json` + marketplace entry + marketplace top-level version) is shared across all PRD #241 items — bump once at the integration/umbrella step, magnitude-mirrored; #233 must not bump it independently.
- No ADR, no CONTEXT.md, no template behavior change — explicitly out of scope to prevent scope creep.

---

### #231-P2.3 — intra-wave concurrency knob (routing.json top-level)

Add an **optional top-level `intraWaveConcurrency: "parallel" | "sequential"`** key to `routing.json` (default **`parallel`**). `parallel` preserves today's behavior (all processable slices in a wave spawn in one message, integrate sequentially). `sequential` is an explicit opt-in for shared-file-heavy repos: process the wave's slices **one at a time** in **issue-id ascending order**, refreshing the umbrella base (the existing §2-step-1 fetch) between each, so slice N branches from `base + slice1..N-1` — guaranteed conflict-free at the cost of serializing the wave. This is a **performance/reliability** lever, **not** a correctness fix: conflicts are never lost in either mode (integration is already sequential, conflicts already resolved by the conflict-resolver) — `sequential` only avoids conflict-resolver churn when wave-siblings touch the same file. The three tier blocks (`trivial`/`standard`/`complex`) stay **required**; the new key is optional.

**Critical read-path decision (foreclose the wrong implementation).** The SKILL reads the top-level key by **directly fs-reading `.orchestrate/routing.json`** at wave-start (consistent with how §2 already reads `run-state.json` and checks `context-flag.json` existence), and applies the **default in the SKILL: absent ⇒ `parallel`**. Do **NOT** route this through `resolve_routing` — that tool is per-slice/per-tier, called *inside* §2 step 3 with a `tier` input; the knob is needed run-wide *before* any slice spawns (before step 3). Wrong granularity, wrong time. The Zod `.default("parallel")` on the schema field is for validation/template correctness only — it does **not** reach the orchestrator because the SKILL reads raw JSON, not parsed schema output. **Explicitly rejected scope:** adding a new MCP tool, adding a field to `resolveRoutingOutputSchema`, or changing `resolveRouting`/`resolveRoutingFromConfig`/`handleResolveRouting`/index.ts `resolve_routing` `.describe()`. Adding an optional field to `routingConfigSchema` is backward-compatible; `resolve_routing` simply ignores it (it returns only `tier` + `routing`, never the whole config).

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/routing.ts`** — `routingConfigSchema` (lines 43-47). Add one optional top-level field after the three tier keys:
  ```ts
  export const routingConfigSchema = z.object({
    trivial: tierRoutingSchema,
    standard: tierRoutingSchema,
    complex: tierRoutingSchema,
    intraWaveConcurrency: z
      .enum(["parallel", "sequential"])
      .optional()
      .default("parallel")
      .describe(
        "Run-wide policy: how to process the independent slices within one " +
          "wave. 'parallel' (default) spawns all processable slices at once " +
          "and integrates them sequentially. 'sequential' processes slices one " +
          "at a time in issue-id ascending order, refreshing the umbrella base " +
          "between each so slice N branches from base+slice1..N-1 — guaranteed " +
          "conflict-free, at the cost of serializing the wave. Optional; the " +
          "three tier blocks remain required."
      ),
  });
  ```
  Do **not** touch `resolveRouting`, `resolveRoutingFromConfig`, `resolveRoutingInputSchema`, `resolveRoutingOutputSchema`, or the TS-type derivations — `z.infer<typeof routingConfigSchema>` picks up the new field automatically.

- **`plugins/orchestrate/orchestrate-mcp/src/tools/bootstrap-config.ts`** — `DEFAULT_ROUTING_CONFIG` literal (lines 62-81, `as const`). The doc-comment at lines 58-60 states this literal is kept **byte-for-byte equivalent (modulo formatting) to `templates/routing.json`**, so it must gain the same key. Add `intraWaveConcurrency: "parallel",` as a top-level property (after the `complex` block, before the closing `} as const;` at line 81). Keep it `as const`.

- **`plugins/orchestrate/templates/routing.json`** — add `"intraWaveConcurrency": "parallel"` as a top-level key (after the `complex` block, line 19) for discoverability. Result is the four-key object: `trivial`, `standard`, `complex`, `intraWaveConcurrency`.

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — §2 "The wave loop" (lines 347-411). Insert a **read-the-knob** instruction and **branch** steps 3+4 on it:
  - At the top of §2 (before "Process waves in order…" at line 349, or as a new lead-in), instruct: read `.orchestrate/routing.json`, take its optional top-level `intraWaveConcurrency` — **absent ⇒ `parallel`**. This is a run-wide decision read once.
  - **`parallel` (default):** step 3 (parallel spawn, lines 395-399) and step 4 (sequential integrate, lines 400-406) are unchanged.
  - **`sequential`:** replace the wave's steps 3+4 with a per-slice serial loop over the processable slices in **issue-id ascending order**: for each slice → re-run the §2-step-1 umbrella-refresh fetch (`git fetch origin orchestrate/umbrella-<runId>:orchestrate/umbrella-<runId>`) so the slice branches from `base + slice1..N-1` → process it (section 3, all stages) → integrate it (section 3 steps 6-9) → check `context-flag.json` (same handoff check as step 4) → next slice. Document that this imposes a deterministic order on slices the DAG says are independent, deciding who "wins" a shared-file region.
  - Steps 5 (checkpoint, line 407) and 6 (PRD comment, line 409) run after the loop, unchanged in both modes.
  - Also add a one-line note at the existing `routing.json` mentions (SKILL.md:55, :63, :145, :224) that `routing.json` now also carries **run-wide run policy** (the `intraWaveConcurrency` knob) alongside per-tier routing — at minimum the `:145` "stay flat at the `.orchestrate` root" mention and the `:224` bootstrap mention.

- **`plugins/orchestrate/skills/orchestrate/references/run-state.md`** — lines 20 and 31 describe `routing.json` as "committed config (flat, shared)" / per-tier routing. Update the prose to note it now also carries **run-wide run policy** (`intraWaveConcurrency`), not just per-tier subagent routing. (Accept the documented caveat: routing.json mixes per-tier routing with run-wide policy.)

- **Version cascade (3 fields, per project memory `project_plugin_versioning_cascade`):**
  - `plugins/orchestrate/.claude-plugin/plugin.json` line 3 `"version"` (currently `1.2.0`) — bump minor → `1.3.0` (new feature/knob).
  - `.claude-plugin/marketplace.json` orchestrate entry `"version"` (line 36, `1.2.0`) — mirror → `1.3.0`.
  - `.claude-plugin/marketplace.json` top-level `"version"` (line 4, `1.6.0`) — mirror the bump magnitude (minor) → `1.7.0`.

- **Rebuilt dist (committed, per project memory `feedback_orchestrate_mcp_dist_committed`):** `plugins/orchestrate/orchestrate-mcp/dist/tools/routing.js` and `.../dist/tools/bootstrap-config.js` regenerated by `npm run build`.

**Steps**

1. Edit `routing.ts`: add the optional `intraWaveConcurrency` field to `routingConfigSchema` exactly as shown above (tiers stay required; `.optional().default("parallel")` with the `.describe(...)`).
2. Edit `bootstrap-config.ts`: add `intraWaveConcurrency: "parallel",` as a top-level property to the `DEFAULT_ROUTING_CONFIG` literal, preserving `as const`.
3. Edit `templates/routing.json`: add `"intraWaveConcurrency": "parallel"` as a top-level key. Verify it is byte-for-byte equivalent (modulo formatting) to `DEFAULT_ROUTING_CONFIG`.
4. Edit `SKILL.md` §2: add the knob-read lead-in and the `sequential` branch (serial loop, issue-id ascending, per-slice umbrella refresh) as specified; leave the `parallel` path's steps 3-4 unchanged; add the one-line run-policy notes at the `routing.json` mentions.
5. Edit `references/run-state.md`: update the `routing.json` description (lines 20, 31) to mention run-wide run policy.
6. Bump the 3 version fields (plugin.json + marketplace orchestrate entry + marketplace top-level).
7. From `plugins/orchestrate/orchestrate-mcp/`: run `npm run build` to regenerate `dist/`. Stage the rebuilt `dist/tools/routing.js` and `dist/tools/bootstrap-config.js`.
8. Add/extend a vitest case (in the existing routing test file under `orchestrate-mcp/test/` or `orchestrate-mcp/src/**/*.test.ts` — locate via `npm test -- --reporter=verbose` or grep for `routingConfigSchema`) asserting the three parse cases (see Verification).

**Verification**

All bash runs from `plugins/orchestrate/orchestrate-mcp/`:

- `cd plugins/orchestrate/orchestrate-mcp && npm test` — green vitest, including the new `intraWaveConcurrency` cases. Green = 0 failures.
- `cd plugins/orchestrate/orchestrate-mcp && npm run build` — exits 0; then `git status --porcelain dist/` shows a **staged/modified** diff for `dist/tools/routing.js` and `dist/tools/bootstrap-config.js` (proves the shipped bundle, not just `src/`, carries the change — guards the "green tests ≠ shipped fix" trap).
- Schema assertion proving all three branches (add as a vitest case):
  - `routingConfigSchema.safeParse({ ...validTiers, intraWaveConcurrency: "sequential" }).success === true`.
  - `routingConfigSchema.safeParse({ ...validTiers, intraWaveConcurrency: "bogus" }).success === false`.
  - **Omission yields the default:** `routingConfigSchema.parse({ ...validTiers }).intraWaveConcurrency === "parallel"` (proves optional + default + enum).
- Template/literal parity: confirm `templates/routing.json` parsed equals `DEFAULT_ROUTING_CONFIG` (modulo formatting) and both validate against `routingConfigSchema`.

**Acceptance criteria**

- `routingConfigSchema` accepts an optional top-level `intraWaveConcurrency` of `"parallel" | "sequential"`, defaulting to `"parallel"`; the three tier blocks remain required; an invalid value is rejected.
- `resolve_routing` behavior is unchanged (output still only `tier` + per-tier `routing`); no new MCP tool, no `resolveRoutingOutputSchema` field, no index.ts `.describe()` change.
- `templates/routing.json` and `DEFAULT_ROUTING_CONFIG` both carry `intraWaveConcurrency: "parallel"` and remain byte-for-byte equivalent (modulo formatting); `bootstrap_config` writes a routing.json containing the key.
- SKILL §2 reads the knob run-wide at wave-start (direct fs read, default-applied-in-SKILL = `parallel` when absent) and branches: `parallel` keeps today's spawn-all-then-integrate-sequentially path; `sequential` runs a per-slice serial loop in issue-id ascending order with a per-slice umbrella refresh, documented as imposing a deterministic order on DAG-independent slices.
- `npm test` green and `npm run build` produces a committed `dist/` diff.
- **Docs-in-sync (same unit):**
  - `routing.ts` schema field carries an accurate `.describe()` (done as part of the field).
  - `templates/routing.json` — key added.
  - `bootstrap-config.ts` `DEFAULT_ROUTING_CONFIG` — key added (parity with template).
  - `references/run-state.md` (lines 20, 31) — `routing.json` description updated to mention run-wide run policy.
  - `SKILL.md` §2 — branch added; plus the one-line run-policy note at the routing.json mentions (`:55`/`:63`/`:145`/`:224`).
  - **MCP `.describe()` + index.ts:** N/A for `resolve_routing` (intentionally unchanged); the only `.describe()` touched is the new schema field's.
  - **Version cascade:** `plugin.json` `1.2.0→1.3.0`, marketplace orchestrate entry `1.2.0→1.3.0`, marketplace top-level `1.6.0→1.7.0`.
  - **ADR / CONTEXT.md:** N/A — the locked decision already lives in `docs/analysis/orchestrate-grill-decisions.md` (#231-P2.3). Do not author a new ADR; orchestrate tracks these knobs via the grill-decisions ledger, not `docs/adr/`.

**Risks / shared files**

- **#234 (continuation budget) — shared-file collision, NOT a code dependency.** #234 also adds an optional top-level key to the **same** `routingConfigSchema` (routing.ts:43-47), the **same** `templates/routing.json` + `DEFAULT_ROUTING_CONFIG`, and the **same** `references/run-state.md` "run-config home" prose. If both land in the same wave they will conflict on these exact regions. They are independent in logic (no ordering requirement) — whichever lands second rebases trivially (additive optional key, additive prose). This is why `dependsOn` is empty; surface it to the integrator as a merge-overlap, not a blocker. Apply `sequential` mode for the wave containing both #231-P2.3 and #234 if run via orchestrate (the dogfood case).
- **`dist/` is committed** — forgetting `npm run build` ships a stale bundle while vitest (which tests `src/`) stays green. Always rebuild + stage `dist/` in the same commit.
- **Template/literal drift** — `templates/routing.json` and `bootstrap-config.ts:DEFAULT_ROUTING_CONFIG` are maintained as twins by hand (no codegen); a future reviewer (or #234) must keep both in sync.
- **SKILL §2 is a hot edit surface** — #232 (failed-worktree), #228 (lifecycle), and the context-handoff items all touch §2/§3 wording; coordinate to avoid prose conflicts (evolved side wins, new sections additive — per project memory `feedback_stale_worktree_base_disambiguation`).

---

### #231-P2.5 — known-baseline-failure allowlist → L1 (pattern annotation)

**Locked decision (one-line).** `commands.json` gains an optional `knownFailures` list of substring/regex patterns; when a capability command exits non-zero, the gate greps the captured output and **annotates** which known patterns matched (and which configured patterns went unmatched), giving the orchestrator a deterministic baseline-vs-regression hint — best-effort only, NOT a "0 new failures" guarantee (`docs/analysis/orchestrate-grill-decisions.md:202-225`).

This is an L1 annotation, not an L2/L3 structured parse. The schema and prose must NOT introduce any boolean that asserts "all failures explained" / "zero new failures" — the decision is emphatic that L1 cannot deliver that. Output is purely descriptive: which patterns `matched`, which configured patterns are `unmatched`.

---

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/run-command.ts`** — three changes:
  1. **Extend `commandsConfigSchema`** (the `z.object({...})` at lines 46-52). Add one optional key:
     ```ts
     knownFailures: z.array(z.string().min(1)).optional(),
     ```
     Update the doc-comment above the schema (lines 32-45) to describe `knownFailures` as a non-capability annotation key (like `install`, it is not one of the four capability verbs and is never executed — it is matched against captured output).
  2. **Extend `runCommandOutputSchema`** (lines 66-148). Add ONE optional field after `truncated` (or near the failure-related fields), present only when `status: "failed"` AND `knownFailures` is configured:
     ```ts
     knownFailureMatches: z
       .object({
         matched: z.array(z.string()),
         unmatched: z.array(z.string()),
       })
       .optional()
       .describe(
         "Baseline-failure annotation, present only when the command exited " +
         "non-zero AND `knownFailures` is configured in commands.json. " +
         "`matched` = the configured patterns that appeared in the captured " +
         "output; `unmatched` = the configured patterns that did NOT appear. " +
         "This is a best-effort L1 hint, NOT a guarantee of 'zero new " +
         "failures': run_tests returns capped exit-code output, not a " +
         "structured test-result list, so an unmatched failure indicator in " +
         "the output still warrants a spot-check by the orchestrator."
       ),
     ```
     Do NOT add any `allExplained`/`zeroNewFailures` boolean.
  3. **Annotate in `runConfiguredCommand`** — the `status: exec.exitCode === 0 ? "passed" : "failed"` return block at lines 404-415. Add a new internal helper (e.g. `annotateKnownFailures(patterns: string[] | undefined, rawStdout: string, rawStderr: string): { matched: string[]; unmatched: string[] } | undefined`) placed in the "Internal helpers" section (near `capOutput`, ~line 186). Behavior:
     - Returns `undefined` when `patterns` is absent/empty (so the output field is omitted).
     - **Matches against the UNTRUNCATED `exec.stdout` + `exec.stderr`** (concatenated, e.g. `rawStdout + "\n" + rawStderr`), NOT the `capOutput`-truncated text — a failure indicator can be in the dropped head of oversized output. The returned `stdout`/`stderr` stay truncated; only matching uses the full text.
     - Each pattern is compiled as `new RegExp(pattern)` inside a `try`; on a `SyntaxError` (invalid regex), **fall back to literal `rawCombined.includes(pattern)`**. This honors the file's "never throw — every failure mode is a structured result" philosophy: a stray paren in a pattern annotates literally, it never escalates to `CONFIG_INVALID` and never throws.
     - In the `failed` branch only (`exec.exitCode !== 0`), call the helper and spread the result onto the returned object as `knownFailureMatches`. In the `passed` branch, do NOT call it (field stays absent). Do NOT touch the `timeout`/`exec-error` branches (lines 378-402) or `runInstall` (lines 473-536) — `knownFailures` is a capability-gate concept; `install` is out of scope.

- **`plugins/orchestrate/orchestrate-mcp/src/index.ts`** — the four capability tools are registered in the `RUN_TOOLS` loop (lines 277-313) and share one `description` string (lines 299-305). Append one sentence to that description so the MCP `.describe()` surface documents the new behavior, e.g.: `When the command exits non-zero and the project's commands.json sets a "knownFailures" pattern list, the result also carries knownFailureMatches.matched / .unmatched — a best-effort baseline-failure hint, not a zero-new-failures guarantee.` No new tool, no new registration, no `outputSchema` change beyond what the schema edit already provides (`runCommandOutputSchema.shape` is reused). `summarizeRun` (lines 252-263) MAY optionally append the match count to the `failed` text line, but keep it a hint ("N of M known-failure patterns matched") — out-of-scope to make load-bearing.

- **`plugins/orchestrate/orchestrate-mcp/test/run-command.test.ts`** — add a `describe("knownFailures annotation", ...)` block (mirror the existing `project({...})` fixture helper used at line 60). Required cases below in Steps.

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — add a short gate sub-step where the orchestrator re-runs the capability tools as the pre-merge gate (this is the orchestrator-side capability re-run introduced by **#237**; describe the semantics, do NOT pin a line number since #237 has not landed and lines will move). The sub-step instructs the orchestrator: when a capability tool returns `status: "failed"`, inspect `knownFailureMatches`. If every failure indicator is explained by `matched` patterns and `unmatched` is empty (or the unmatched patterns are simply not-present baseline cases), treat the failure as a **likely known baseline** and proceed per the #237 gate's baseline handling; if the failure output contains indicators NOT covered by any matched pattern, **spot-check** before treating it as baseline — L1 cannot deterministically assert "0 new failures." Wording MUST read "hint / spot-check," never "verdict." Also add one prose example of a `knownFailures` entry (JSON has no comments, so the example lives here, not in the template).

- **`CONTEXT.md`** — line 177 (the `commands.json` glossary entry) enumerates "the four fixed capability verb keys (`tests`, `typecheck`, `build`, `lint`)" and notes `install` is excluded as a setup verb. Add one sentence noting `knownFailures` is an optional non-capability key: a list of substring/regex patterns the run tools match against captured output of a failing capability command to annotate matched-vs-unmatched baseline failures (it is never executed). This keeps the config-key enumeration in sync.

- **`plugins/orchestrate/.claude-plugin/plugin.json`** + **`.claude-plugin/marketplace.json`** — version cascade (see Acceptance criteria): bump plugin version + the orchestrate entry in marketplace + the marketplace top-level version, magnitude-mirrored (a minor additive feature → minor bump).

**Note on dependsOn:** the task hint asserts `#237`, and the SKILL gate sub-step consumes the annotation from the orchestrator-side capability re-run that #237 introduces — so the gate-prose half cannot be wired without #237. The grill ledger's P2.5 "Surface" line (224-225) does not restate the dependency (the explicit "Depends on #237" at line 200 sits under the adjacent P2.4 entry). Honoring the task hint as a conscious choice: the schema + run-command.ts + tests half is independent and can land first, but the SKILL gate-step half should reference #237's re-run step rather than invent a new one.

---

**Steps**

1. Branch off `origin/development` (local `development` drifts): `git fetch origin && git checkout -b orchestrate-231-p2.5-known-failures origin/development`.
2. Edit `src/tools/run-command.ts`: add `knownFailures` to `commandsConfigSchema`; update the schema doc-comment; add the `knownFailureMatches` field to `runCommandOutputSchema` with the `.describe()` text above.
3. In the same file, add the `annotateKnownFailures` helper in the "Internal helpers" section, matching against untruncated `exec.stdout + exec.stderr`, regex-with-includes-fallback, never throwing.
4. Wire the helper into the `failed`-only branch of `runConfiguredCommand` (the return at lines 404-415); leave `passed`, `timeout`, `exec-error`, and all of `runInstall` untouched.
5. Edit `src/index.ts`: append the one knownFailures sentence to the shared `RUN_TOOLS` `description`.
6. Add tests to `test/run-command.test.ts`:
   - matched pattern is annotated on a failing command (`process.exit(1)` + a known stderr/stdout substring).
   - a configured pattern that does NOT appear lands in `unmatched`.
   - a regex pattern (e.g. `"FAIL.*timeout"`) matches.
   - an invalid regex (e.g. `"("`) falls back to literal `includes` and does NOT throw / does NOT yield `CONFIG_INVALID`.
   - `knownFailureMatches` is **absent** when `knownFailures` is unset.
   - `knownFailureMatches` is **absent** on a `passed` command even if `knownFailures` is set.
   - **discriminating case:** a pattern that appears only in the truncated-away HEAD of oversized output (push >64k chars before the marker) still matches — proving matching runs over untruncated output while `stdout` stays capped.
7. Run vitest (Verification). Iterate to green.
8. `npm run build` in `orchestrate-mcp/` and stage the regenerated `dist/` (committed — vitest tests `src/`, so green tests ≠ shipped fix).
9. Edit `SKILL.md` (gate sub-step + prose example) and `CONTEXT.md` (glossary sentence).
10. Bump the version cascade (plugin.json + marketplace entry + marketplace top-level).
11. Commit atomically by scope: (a) `feat(orchestrate): knownFailures allowlist annotation` for src + dist + tests; (b) `docs(orchestrate): document knownFailures in SKILL + CONTEXT`; (c) `chore(orchestrate): version bump`. Never bundle unrelated changes; do not `git add -A`.
12. Call `advisor()` then run `/compound-engineering:ce-code-review` on the diff; resolve P0/P1 before declaring done.

---

**Verification**

```
cd plugins/orchestrate/orchestrate-mcp && npm test
```
Green = all existing `run-command capability tools` and `runInstall` cases still pass, plus the new `knownFailures annotation` describe block passes (matched/unmatched/regex/invalid-fallback/absent-when-unset/absent-on-pass/truncated-head-match all green).

```
cd plugins/orchestrate/orchestrate-mcp && npm run build
```
Green = `dist/` regenerates with no TS errors; `git status` shows `dist/tools/run-command.js` and `dist/index.js` modified — stage them.

```
cd plugins/orchestrate/orchestrate-mcp && npx tsc --noEmit
```
Green = no type errors from the `z.infer` derivations (`CommandsConfig` / `RunCommandOutput` pick up the new optional fields automatically).

Grep proof the field shipped to dist:
```
grep -n "knownFailureMatches" plugins/orchestrate/orchestrate-mcp/dist/tools/run-command.js
```
Non-empty = the src change is in the committed bundle.

---

**Acceptance criteria**

- `commandsConfigSchema` accepts an optional `knownFailures: string[]`; unknown/absent key does not break existing configs (Zod strips unknowns).
- A failing capability command (`status: "failed"`) with `knownFailures` configured returns `knownFailureMatches.matched` (patterns found) and `.unmatched` (configured patterns not found).
- Matching runs over **untruncated** captured output; a pattern only in the dropped head of >64k output still matches; returned `stdout`/`stderr` stay capped.
- Invalid regex falls back to literal substring matching; never throws, never yields `CONFIG_INVALID`.
- `knownFailureMatches` is **absent** when `knownFailures` is unset, on `passed`, on `timeout`, and on `exec-error`; `runInstall` is unchanged.
- NO boolean asserting "zero new failures" exists anywhere in schema or prose; SKILL wording is "hint / spot-check," never "verdict."
- **Docs-in-sync (same unit):**
  - **MCP `.describe()` + index.ts** — `runCommandOutputSchema` field `.describe()` updated; `RUN_TOOLS` shared `description` in `index.ts` mentions knownFailureMatches.
  - **SKILL.md** — gate sub-step added that consumes `knownFailureMatches` at the #237 orchestrator-side capability re-run (semantics, not a line number) + one prose example of a `knownFailures` entry.
  - **CONTEXT.md** — line ~177 glossary entry for `commands.json` gains the `knownFailures` optional-key sentence.
  - **templates/commands.json** — stays `{}` (knownFailures is optional and not auto-detectable; JSON has no comments, so no example is added here). State this as a deliberate no-op; do NOT add content.
  - **references/** — no reference file enumerates config keys (confirmed: only `context-handoff.md` mentions `install` incidentally and `run-state.md` lists `commands.json` as a filename, neither enumerates verbs) — no edit required.
  - **docs/adr/** — no new ADR; this is an additive optional key, design captured in the grill ledger. Do NOT invent `0013-*`.
  - **No `detect-project.ts` / `bootstrap-config.ts` changes** — knownFailures is not generated by the capability detector; keep the implementer out of the generators.
  - **Version cascade (3 fields, magnitude-mirrored)** — `plugins/orchestrate/.claude-plugin/plugin.json` version + the orchestrate entry in `.claude-plugin/marketplace.json` + the marketplace top-level version, all bumped a minor (additive feature).
- `dist/` rebuilt and committed; `grep knownFailureMatches dist/tools/run-command.js` non-empty.

---

**Risks / shared files**

- **`commandsConfigSchema` (run-command.ts:46-52) and `templates/commands.json` are also touched by #235** (which adds the optional `integration` capability verb to the same Zod object and the same template). Both items add an optional key to the same `z.object`. **Ordering caution:** whichever lands second must rebase the schema addition (a trivial but real merge — two new optional lines in the same object). This is exactly what `docs/analysis/orchestrate-grill-decisions.md:37` warns about ("`templates/commands.json` — when the config schema changes (#231-P2.5 …)"). Coordinate so the two edits don't collide on the same lines; prefer placing `knownFailures` and `integration` on distinct adjacent lines.
- **`run-command.ts` is the core capability-execution module** — #237 (orchestrator-side capability re-run gate) consumes its output; the SKILL gate sub-step here depends on #237's re-run step existing. Land #237 (or at least its SKILL re-run step) before wiring the consume-side prose, or the gate sub-step references a step that does not yet exist.
- **`dist/` is committed** — forgetting `npm run build` ships green tests with an unbuilt bundle (the run will execute the old `dist/` and the annotation will silently not appear). Always rebuild + commit dist in the same unit as the src change.
- **`index.ts` shared `RUN_TOOLS` description** is touched by any item that changes the four capability tools' contract — keep the appended sentence additive and self-contained to minimize collision surface.

---

### #238 — run-state `slices` array-vs-map ambiguity, fails maximally late

**Locked decision (one line).** Doc-fix `SKILL.md` §1 step 6 to state `slices` is a **MAP keyed by issue-id string** (naming the `partition_backlog` array → run-state map transform, with an inline `"slices": { "25": {...} }` example), and add a new thin `validate_run_state` MCP tool that reuses the **already-exported** render `runStateSchema` so a mis-shaped checkpoint fails in seconds — called right after the first run-state write **and** on the resume read — instead of after every expensive subagent has run.

**Root cause (lead the doc-fix prose with this).** `partition_backlog` returns `slices` as an **array** (`index.ts:567` uses `result.slices.length`), but `run-state.json` stores `slices` as a **map keyed by issue-id string** (`render.ts:36` `slices: z.record(z.string(), sliceSchema)`). The latent trap is the LLM orchestrator passing the `partition_backlog` array straight through into `run-state.json`. An array-shaped `slices` already fails `runStateSchema.safeParse` — but today that failure only surfaces when a render tool runs, after the run has burned subagent turns. The fix surfaces it immediately.

---

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/validate-run-state.ts`** *(NEW)* — the thin validate tool. Must:
  - `import { z } from "zod";`, `import { resolveRunDir } from "../run-dir.js";`, and `import { runStateSchema } from "../render.js";` (it is exported at `render.ts:25`). **Do NOT import or touch `readAndValidateRunState`** — that helper is private to `render.ts`, returns a `RenderOutput`-typed object, and `render.ts` is a hot shared file. Reuse the **schema only**; the read+validate logic is re-implemented thinly here.
  - Export `validateRunStateInputSchema = z.object({ runId, repoPath? })` with rich `.describe()` on each field, mirroring `renderInputSchema` (`render.ts:39-64`) — `runId` required, `repoPath` optional and defaulting to `process.cwd()` but "callers should pass this explicitly."
  - Export `validateRunStateOutputSchema = z.object({ status, errorCode?, errorMessage? })`, all fields `.describe()`-annotated. `status` is `z.enum(["valid", "invalid"])`. `errorCode` is `z.enum(["RUN_ID_INVALID", "RUN_STATE_NOT_FOUND", "RUN_STATE_INVALID"]).optional()` — the same first three codes render uses (drop render's `WRITE_FAILED`; this tool writes nothing). `errorMessage` optional, present when `status: "invalid"`.
  - Export types `ValidateRunStateInput`/`ValidateRunStateOutput` via `z.infer` (single-source-of-truth pattern, `render.ts:97-100`).
  - Export `async function validateRunState(input): Promise<ValidateRunStateOutput>` that **never throws**: (1) `resolveRunDir(input.repoPath ?? process.cwd(), input.runId)` — on `!ok` return `{ status: "invalid", errorCode: "RUN_ID_INVALID", errorMessage }`; (2) `fs.readFileSync(paths.runStatePath, "utf8")` in a try/catch — on failure return `RUN_STATE_NOT_FOUND`; (3) `JSON.parse` in a try/catch — on failure return `RUN_STATE_INVALID` with "not valid JSON"; (4) `runStateSchema.safeParse(parsed)` — on `!success`, build the detail string exactly as `render.ts:208-210` does (`result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")`) and return `{ status: "invalid", errorCode: "RUN_STATE_INVALID", errorMessage: `run-state.json does not match the expected shape: ${detail}` }`; (5) on success return `{ status: "valid" }`. This is the same `firstLine`-style discipline as `render.ts:173-222` but inlined and `RenderOutput`-free.

- **`plugins/orchestrate/orchestrate-mcp/src/index.ts`** — register the new tool:
  - Add an import block after the `bootstrap_config` import (`index.ts:102-108`): `validateRunState`, `validateRunStateInputSchema`, `validateRunStateOutputSchema`, `type ValidateRunStateInput`, `type ValidateRunStateOutput` from `./tools/validate-run-state.js`.
  - Add a `handleValidateRunState: ToolHandler<ValidateRunStateInput, ValidateRunStateOutput>` and a `registerTool("validate_run_state", {...}, handleValidateRunState as unknown as AnyToolHandler)` block, following the exact shape of the existing handlers (e.g. `validate_envelope` at `index.ts:634-672`). The `content[].text` summary: `valid` → ``Valid run-state for `${runId}`.`` (the handler will need `runId` from input); `invalid` → ``Invalid run-state [${errorCode}]: ${errorMessage}``.
  - The `description` string must be `.describe()`-rich prose stating: validates `.orchestrate/runs/<runId>/run-state.json` against the canonical run-state schema (the same schema the render tools validate against); is the orchestrator's fast-fail guard called right after the first run-state write and on every resume read; specifically catches a `slices` value shaped as an **array** instead of a **map keyed by issue-id string**; reads only, writes nothing; returns discriminated `status` of `valid` or `invalid` (with `RUN_ID_INVALID` / `RUN_STATE_NOT_FOUND` / `RUN_STATE_INVALID`).
  - **Bump the `McpServer` version** at `index.ts:112` from `"0.12.0"` to `"0.13.0"` in lockstep with `package.json`.

- **`plugins/orchestrate/orchestrate-mcp/test/validate-run-state.test.ts`** *(NEW)* — vitest suite importing `validateRunState` from `../src/tools/validate-run-state.js`. Use a `tmpdir` + `fs.mkdirSync(.../.orchestrate/runs/<runId>, {recursive:true})` fixture (or stub `repoPath`). Cases:
  - **valid map** — a full run-state with `slices` as `{ "157": {…} }` → `{ status: "valid" }`.
  - **slices-as-array (the #238 regression)** — same run-state but `slices` is `[ {…} ]` → `{ status: "invalid", errorCode: "RUN_STATE_INVALID" }`. This is the load-bearing case for this item.
  - **missing file** — no `run-state.json` → `errorCode: "RUN_STATE_NOT_FOUND"`.
  - **bad JSON** — file with `"{ not json"` → `errorCode: "RUN_STATE_INVALID"`.
  - **bad runId** — `runId: "../escape"` → `errorCode: "RUN_ID_INVALID"`.

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — two edits:
  - **§1 Fresh run, step 6** (the run-state write, lines ~319-345): after the existing `slices`-entry bullet (line 342-345), add prose stating: *`slices` in `run-state.json` is a **MAP keyed by the issue-id string**, not an array — transform the array `partition_backlog` returned into that map by keying each slice on its issue id*, with the inline example ``"slices": { "25": { "issue": 25, … } }``. Then add a final sentence: *Immediately after writing this first checkpoint, call the `validate_run_state` MCP tool with the repository root as `repoPath` and the run's `runId`; on `status: "invalid"`, **stop loudly** and report the `errorMessage` before creating any worktree or spawning any subagent — a mis-shaped checkpoint must fail here, in seconds, not after expensive subagent work.*
  - **§1 resume branch** ("Exactly one match", lines ~186-209): after "load the whole `run-state.json`, preserving every top-level field" (line ~188), add: *call the `validate_run_state` MCP tool against the loaded checkpoint before acting on it; on `status: "invalid"` (e.g. a legacy array-shaped `slices`), stop loudly rather than resume from a malformed checkpoint.* This is the "blind the mid-run resume read against an array-shaped checkpoint" clause — do not omit it.

- **`plugins/orchestrate/skills/orchestrate/references/run-state.md`** — the schema at line 108 is **already correct** (`slices` is documented as "a map keyed by issue-id string"); **do not change the schema**. Add at most **one sentence** near line 108 noting that the `validate_run_state` MCP tool enforces this shape against the canonical schema right after the first write and on resume. Keep the file under its 200-line cap (currently 198 lines — adding one sentence is fine; if it crosses 200, tighten an adjacent sentence rather than expand).

- **`plugins/orchestrate/orchestrate-mcp/package.json`** — bump `version` `0.12.0` → `0.13.0` (minor: additive new tool).

- **`plugins/orchestrate/.claude-plugin/plugin.json`** — bump `version` `1.2.0` → `1.3.0` (minor).

- **`.claude-plugin/marketplace.json`** — bump the `orchestrate` plugin entry `version` `1.2.0` → `1.3.0` **and** the top-level `version` `1.6.0` → `1.7.0` (magnitude-mirrored minor — the top-level bump is the easy-to-miss one).

---

**Steps** (ordered, executable)

1. Create `src/tools/validate-run-state.ts` per the Target-files spec — input/output Zod schemas, `z.infer` types, and the never-throwing `validateRunState` function reusing `runStateSchema` (from `../render.js`) and `resolveRunDir` (from `../run-dir.js`). Do not import from `render.ts` anything other than `runStateSchema`.
2. Wire `src/index.ts`: add the import block, the `handleValidateRunState` handler, the `registerTool("validate_run_state", …)` call with the `.describe()`-rich description, and bump the `McpServer` version to `"0.13.0"`.
3. Create `test/validate-run-state.test.ts` with the five cases above (the slices-as-array → `RUN_STATE_INVALID` case is mandatory).
4. Edit `SKILL.md` §1 step 6 (array→map transform prose + inline example + post-write `validate_run_state` loud-stop) and §1 resume branch (resume-read `validate_run_state` loud-stop).
5. Add the one enforcement sentence to `references/run-state.md` (schema unchanged); confirm the file stays ≤ 200 lines.
6. Bump the four version fields: `orchestrate-mcp/package.json`, `index.ts` server version, `.claude-plugin/plugin.json`, and both `marketplace.json` versions (orchestrate entry + top-level).
7. From `plugins/orchestrate/orchestrate-mcp/`: run `npm test` and `npm run typecheck` (both green), then `npm run build` to regenerate the committed bundle, then stage `dist/index.js` (and the `dist/` siblings the build rewrites) — vitest tests `src/`, so a green test run is NOT a shipped fix until `dist/` is rebuilt and committed.

---

**Verification** (run from `plugins/orchestrate/orchestrate-mcp/`)

```bash
cd plugins/orchestrate/orchestrate-mcp && npm test
```
Green = all suites pass, including the new `validate-run-state.test.ts` (5 cases), and critically the slices-as-array case asserting `RUN_STATE_INVALID`.

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run typecheck
```
Green = `tsc --noEmit` exits 0 (no type errors from the new tool or its index.ts registration).

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run build
```
Green = esbuild rewrites `dist/index.js` (plus the two hook bundles) with no error; `git status` then shows `dist/index.js` modified — stage and commit it (the dist bundle is committed; an un-rebuilt dist ships the old toolset).

```bash
cd plugins/orchestrate/orchestrate-mcp && node -e "require('./dist/index.js')" 2>&1 | head -1 || true
```
Sanity: the bundle loads without a syntax/registration error (it will then block on stdio — that is expected; the absence of an immediate throw is the signal).

Manual doc check: `grep -n "validate_run_state" ../skills/orchestrate/SKILL.md` returns the two new call sites (fresh-run step 6 and resume branch); `grep -n "MAP keyed" ../skills/orchestrate/SKILL.md` returns the array→map prose.

---

**Acceptance criteria** (testable)

- `validate_run_state` is registered in `index.ts` and callable; a valid map-shaped run-state returns `status: "valid"`.
- An **array-shaped** `slices` returns `status: "invalid"`, `errorCode: "RUN_STATE_INVALID"`, with a `errorMessage` whose detail names the `slices` path — proven by the new test case.
- Missing file → `RUN_STATE_NOT_FOUND`; malformed JSON → `RUN_STATE_INVALID`; traversal-y/invalid `runId` → `RUN_ID_INVALID`.
- The tool reuses the exported `runStateSchema` from `render.ts` (no duplicate schema definition) and does **not** modify `render.ts`.
- `npm test`, `npm run typecheck`, and `npm run build` all green; `dist/index.js` rebuilt and committed.
- **Docs-in-sync (same unit):**
  - `SKILL.md` §1 step 6 — array→map transform prose + inline `"slices": { "25": {…} }` example + post-write `validate_run_state` loud-stop call.
  - `SKILL.md` §1 resume branch — resume-read `validate_run_state` loud-stop call (the "blind the mid-run resume read" clause).
  - MCP `.describe()` + `index.ts` registration — the new tool's description names the array-vs-map failure mode and the discriminated codes; server version bumped in lockstep.
  - `references/run-state.md` — one enforcement sentence added; schema (line 108) left correct and unchanged; file ≤ 200 lines.
  - Version cascade — `orchestrate-mcp/package.json` 0.12.0→0.13.0, `index.ts` server version 0.12.0→0.13.0, `.claude-plugin/plugin.json` 1.2.0→1.3.0, `.claude-plugin/marketplace.json` orchestrate entry 1.2.0→1.3.0 **and** top-level 1.6.0→1.7.0.
  - **No ADR** — #238 is not [ADR-worthy] (only the separate cross-run-isolation NEW item is); do not create one.
  - **No template change** — `templates/` holds `commands.json`/`routing.json`/`handoff.json` only; run-state is never templated.
  - **No subagent-def change** — subagents never write run-state; `agents/**` is untouched.

---

**Risks / shared files**

- **`index.ts`** is the MCP tool registry — every other run-state-touching item in this wave that adds/edits a tool also edits it. Append the new import + handler + `registerTool` block at the end of the existing tool registrations (after `bootstrap_config`) to minimize merge-conflict surface; expect a rebase/merge ordering nudge if a sibling wave-0 item also lands an index.ts change.
- **`SKILL.md`** is the single skill spec — multiple grill-decision items edit different sections. Keep the §1-step-6 and resume-branch edits surgical and section-anchored so they merge cleanly with sibling edits elsewhere in the file.
- **Version files** (`package.json`, `plugin.json`, `marketplace.json`, `index.ts` server version) collide with any other wave-0 sibling that also bumps versions. This is a **merge/rebase coordination** concern, **not a code dependency** — `dependsOn` is empty: this tool imports only `runStateSchema` and `resolveRunDir` from already-shipped modules (`render.ts`, `run-dir.ts`) and has no code dependency on #237/#236/#233. The integrator should reconcile the version bumps (take the highest minor) when several wave-0 items merge.
- **`dist/index.js`** is committed and rebuilt by every src-touching item — whoever integrates the wave must run `npm run build` once after all src merges land and commit the single resulting `dist/index.js`, rather than committing per-item dist diffs that will conflict.
- **`render.ts`** is deliberately NOT in `filesTouched` — reusing its exported schema is the faithful "reuse the existing render Zod schema" called for by the locked decision; editing it would put this item on a hot shared file for no benefit.

---

### #240 — Cross-run isolation: harden the status-gate (Option A)

One-line locked decision: elevate `clean_runs`' defense-in-depth status re-check from a code comment to an ADR-recorded, test-covered invariant — factor the re-check into a **shared, exported guard** that any cross-run-mutating tool reuses; add a non-null `finalPullRequest` requirement as an extra gate before cleanup; and assert (by construction + test) that no tool writes outside its own `runs/<runId>/`. Reject per-run lock/heartbeat (the `status` field is self-cleaning). ADR-0012 is **already written** — this item lands the code + tests + narrative docs that the ADR records.

This is a hardening + guarantee + documentation pass, **not** a hole-fix: in-progress isolation already holds today via Gate 1 (a run absent from the verdict map is `skipped`/`no-verdict-from-orchestrator`) and Gate 2 (`status !== "completed"` → `run-not-completed`). #240 makes Gate 2 a named, reused, tested invariant and closes the `completed`-but-null-`finalPullRequest` fret.

**Scope note for the implementer:** `clean_runs` (`clean-runs.ts`) is the **only** current cross-run-mutating tool. There are no other consumers to retrofit today — the shared guard is factored out now so the *next* such tool calls it instead of re-deriving the gate. Do not hunt for phantom consumers.

---

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/run-state-guard.ts`** *(NEW)* — the shared guard module, the heart of this item. Move `readRunState` here (currently private in `clean-runs.ts:328-360`) and fold the full cleanup-eligibility gate into one exported function:
  - Extend the parsed-state shape: add `finalPullRequest: unknown` to the `ParsedRunState` interface (today it reads only `status`, `umbrellaBranch`, `slices` — `clean-runs.ts:180-185`). Export `ParsedRunState` from this module.
  - Export `readRunState(runStatePath)` returning the existing discriminated result `{ ok: true; state: ParsedRunState } | { ok: false; reason: "missing-run-state" | "malformed-run-state" }`, now also extracting `finalPullRequest` from `obj.finalPullRequest`.
  - Add and export the eligibility guard:
    ```ts
    export type CrossRunGateReason =
      | "missing-run-state"
      | "malformed-run-state"
      | "run-not-completed"
      | "final-pr-missing";

    /** The single cross-run mutation gate. Any tool that deletes or mutates a
     *  run's on-disk/git footprint MUST pass through this before acting. */
    export function checkCrossRunMutationAllowed(
      runStatePath: string
    ):
      | { ok: true; state: ParsedRunState }
      | { ok: false; reason: CrossRunGateReason };
    ```
    Gate order, exactly: (1) `readRunState` — bail with its `missing-run-state`/`malformed-run-state` reason; (2) `status !== "completed"` → `{ ok: false, reason: "run-not-completed" }`; (3) `finalPullRequest == null` (catches both `null` and `undefined`) → `{ ok: false, reason: "final-pr-missing" }`; else `{ ok: true, state }`.
  - Add a module header comment stating this is the shared status-gate guard mandated by ADR-0012 §invariant, reused by every cross-run-mutating tool; `clean_runs` is the only current consumer.

- **`plugins/orchestrate/orchestrate-mcp/src/tools/clean-runs.ts`** — consume the shared guard:
  - Delete the now-moved `readRunState` (lines 328-360) and the local `ParsedRunState` interface duplication; import `checkCrossRunMutationAllowed`, `readRunState`, and `ParsedRunState` from `../run-state-guard.js`. (`cleanMergedRun` still needs `ParsedRunState` for `umbrellaBranch`/`slices`.)
  - In `cleanRuns` (lines 573-586), replace the two-step `readRunState` + `status !== "completed"` block with a single call to `checkCrossRunMutationAllowed(runStatePath)`. On `{ ok: false }`, `runs.push(skippedReport(runId, gate.reason))`. On `{ ok: true }`, pass `gate.state` into `cleanMergedRun`.
  - Add `"final-pr-missing"` to `runReasonSchema` (lines 76-89), in the `// ── skipped ──` group, adjacent to `"run-not-completed"`.
  - Update the file's top-of-file comment (lines 22-24) so the defense-in-depth note also states the `finalPullRequest`-non-null requirement and points to the shared guard as the single chokepoint.

- **`plugins/orchestrate/orchestrate-mcp/src/index.ts`** — narrative-only:
  - In the `registerTool("clean_runs", …)` `description` (lines 797-808): the clause "or one whose run-state is not `completed`, is left strictly intact" must be widened to "…not `completed`, or whose `finalPullRequest` is null, is left strictly intact." No schema/handler logic change (the guard lives in the tool, surfaced via the existing `reason` enum which now carries `final-pr-missing`).

- **`plugins/orchestrate/orchestrate-mcp/test/clean-runs.test.ts`** — add two `describe` blocks (the `buildRunState` fixture already carries a `finalPullRequest` field, lines 128-152, so no fixture change is needed):
  1. **`final-pr-missing` gate** — `status: "completed"`, `finalPullRequest: null`, verdict `{ [runId]: "merged" }`. Assert `run.action === "skipped"`, `run.reason === "final-pr-missing"`, and that the worktree, run dir, and umbrella branch are all still present (mirror the in-progress-defense test at lines 361-393).
  2. **Cross-run isolation (the headline #240 invariant)** — two runs under `.orchestrate/runs/`: Run B `completed` + non-null finalPR + verdict `merged`; Run A `in-progress` (and/or simply absent from the verdict map). After the sweep: Run B is `removed`; Run A's run dir, its worktree, and its umbrella + slice branches (local AND remote) are **completely untouched** (`fs.existsSync` true, `localBranchExists`/`remoteBranchExists` true). Add an inline comment: structural isolation is guaranteed by construction via `run-dir.ts` `isValidRunId`/`resolveRunDir` (two distinct valid run ids always resolve to disjoint paths); this test pins it empirically.

- **`plugins/orchestrate/orchestrate-mcp/dist/index.js`** *(REBUILT, committed)* — esbuild bundles `src/` into three files; clean-runs + the new `run-state-guard.ts` compile into `dist/index.js`. Rebuild and commit it (see Verification). `vitest` tests `src/`, so green tests alone do NOT ship the fix.

- **`plugins/orchestrate/skills/orchestrate/references/run-state.md`** — the "Run cleanup" section (around lines 170-185) currently explains the conceptual eligibility gate (status `completed` + merged verdict) but frames `finalPullRequest` non-null only as the orchestrator's pre-filter. Add one sentence stating that `clean_runs` itself **re-reads** the run-state and refuses to act unless `status === "completed"` **and** `finalPullRequest != null` — a tool-deterministic gate independent of the orchestrator's verdict map (reason key `final-pr-missing`), per ADR-0012.

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — the start-of-run sweep narrative already tells the orchestrator to skip null-`finalPullRequest` runs (lines 113-130). Add a short clause noting `clean_runs` independently enforces the same `status===completed && finalPullRequest!=null` gate as defense-in-depth, so a misbuilt verdict map can never cause it to touch an unconcluded or in-progress run (cite the new `final-pr-missing` skipped reason). Keep it tight — one or two sentences in the section-1 sweep description.

- **`plugins/orchestrate/.claude-plugin/plugin.json`** — version cascade (patch-level hardening): bump `"version"` `1.2.0 → 1.2.1`.

- **`.claude-plugin/marketplace.json`** — version cascade, both fields: bump the `orchestrate` plugin entry `"version"` `1.2.0 → 1.2.1` (line 36) AND the top-level marketplace `"version"` (line 4) by the magnitude-mirrored amount — a patch bump (`1.6.0 → 1.6.1`). The Cursor mirror `.cursor-plugin/marketplace.json` carries no version field for plugins; leave it unless an audit shows otherwise.

---

**Steps**

1. Create `src/run-state-guard.ts`: move `readRunState` out of `clean-runs.ts`, extend `ParsedRunState` with `finalPullRequest`, add the `finalPullRequest` extraction in `readRunState`, and add `checkCrossRunMutationAllowed` + `CrossRunGateReason` per the gate order above. Export `readRunState`, `ParsedRunState`, `checkCrossRunMutationAllowed`, `CrossRunGateReason`.
2. Edit `clean-runs.ts`: remove the moved `readRunState`/local `ParsedRunState`, import from `../run-state-guard.js`, add `"final-pr-missing"` to `runReasonSchema`, replace the inline gate (lines 573-586) with the single `checkCrossRunMutationAllowed` call, update the top-of-file comment.
3. Edit `index.ts`: widen the `clean_runs` `description` string to mention the null-`finalPullRequest` skip.
4. Add the two new test blocks in `clean-runs.test.ts` (final-pr-missing gate; cross-run isolation with a live/absent sibling left untouched).
5. Update narrative docs: `references/run-state.md` (tool-deterministic finalPR re-check) and `SKILL.md` (defense-in-depth clause). Do **not** edit ADR-0012 — it is already written and accurate; only confirm it matches.
6. Bump versions: `plugin.json` (`1.2.1`), `marketplace.json` orchestrate entry (`1.2.1`) and top-level (`1.6.1`).
7. From `plugins/orchestrate/orchestrate-mcp/`: run `npm run build`, then `git add dist/index.js` (and any other changed `dist/*.js`). Commit the rebuilt bundle in the same unit as the `src/` change.
8. Run the verification commands; confirm green; commit atomically by concern (src+dist+tests in one logical commit; version cascade can ride a separate `chore` commit; docs a separate `docs` commit per repo git conventions).

---

**Verification**

```bash
cd plugins/orchestrate/orchestrate-mcp && npm test
```
Green = all suites pass, including the two new `clean-runs.test.ts` blocks (`final-pr-missing` skip; cross-run isolation sibling untouched). Existing in-progress-defense and merged-run tests still pass.

```bash
cd plugins/orchestrate/orchestrate-mcp && npx tsc --noEmit
```
Green = no type errors (confirms `clean-runs.ts` correctly imports `ParsedRunState`/guard from `run-state-guard.ts`).

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run build && git status --porcelain dist/
```
Green = build succeeds; `git status` shows `dist/index.js` as modified (then staged) — proving the shipped bundle carries the gate, not just `src/`. A clean `dist/` after a `src/` change means the rebuild was skipped — investigate.

```bash
cd plugins/orchestrate/orchestrate-mcp && grep -n "final-pr-missing\|checkCrossRunMutationAllowed" dist/index.js | head
```
Green = both identifiers appear in the bundle (the guard and reason actually compiled into the shipped artifact).

---

**Acceptance criteria**

- `clean_runs` skips a `completed` run whose `finalPullRequest` is `null` with reason `final-pr-missing`, touching nothing (test-proven).
- The status + finalPR gate lives in **one exported function** (`checkCrossRunMutationAllowed` in `run-state-guard.ts`) that `clean_runs` calls; gate order is status-first then finalPR; reason keys are `missing-run-state | malformed-run-state | run-not-completed | final-pr-missing`.
- A cross-run isolation test proves a live/in-progress (or absent-from-map) sibling run's dir, worktree, and branches (local + remote) are completely untouched while a merged sibling is cleaned; an inline note cites `run-dir.ts` `isValidRunId`/`resolveRunDir` as the by-construction guarantee.
- `npm test`, `npx tsc --noEmit`, and `npm run build` all green; `dist/index.js` rebuilt and committed; `grep` confirms `final-pr-missing` + `checkCrossRunMutationAllowed` in the bundle.
- **Docs-in-sync (same unit):**
  - **MCP `.describe()` / `index.ts`** — `clean_runs` tool `description` mentions the null-`finalPullRequest` skip. *(`runReasonSchema` in `clean-runs.ts` gains `final-pr-missing` — this is the schema-level surface.)*
  - **`references/run-state.md`** — adds the tool-deterministic `status===completed && finalPullRequest!=null` re-check sentence.
  - **`SKILL.md`** — adds the defense-in-depth clause in the section-1 sweep.
  - **`docs/adr/0012-orchestrate-cross-run-isolation-invariant.md`** — **already landed, no edit**; this code is the recorded invariant it describes (confirm parity, do not modify).
  - **CONTEXT.md / templates/** — no change required (no template or domain-context surface references the gate).
  - **Marketplace version cascade** — `plugin.json` `1.2.1`, `marketplace.json` orchestrate entry `1.2.1` + top-level `1.6.1` (patch, magnitude-mirrored); Cursor mirror unaffected.

---

**Risks / shared files**

- **`clean-runs.ts`, `SKILL.md`, and ADR-0012 are shared with #232-A.2** (the `--failed` human-gated single-run override). #232-A.2's Surface lists exactly those files: it adds a path that **bypasses** the status gate by construction, scoped to one named `runs/<runId>/`. #240 lands the shared guard + the status-gate invariant; #232-A.2 layers the sanctioned bypass on top.
  - **Ordering:** land **#240 first**. #232-A.2's `--failed` path should be implemented as "skip `checkCrossRunMutationAllowed` for the single named run," so the guard must exist first. If both land together, the guard module is still the integration point — #232-A.2 must not duplicate the gate logic.
- **`run-state-guard.ts` is new** — no collision today, but it is the intended chokepoint for any future cross-run-mutating tool (e.g. a hypothetical bulk mutator); keep its surface minimal so later items extend rather than fork it.
- **`marketplace.json` top-level version** is touched by every plugin-version bump — if another item in this PRD also ships an orchestrate `src/` change in the same batch, coordinate a single combined version bump rather than two competing patch bumps.
- **`dist/index.js`** is regenerated wholesale by esbuild; any other item changing orchestrate `src/` in the same branch must rebuild after merge to avoid a stale bundle. Rebuild + commit `dist/` as the **last** src-touching step before the final commit.

---

### #232-A.2 — failed child-issue comment + `clean --failed <runId>` human-gated single-run reclaim

**Locked decision (one line).** Add (a) a post-FAIL `gh issue comment` on the child issue carrying `failureReason` + #239's structured `rootCause` + the preserved worktree path + a resume hint, and (b) a new `/orchestrate clean --failed <runId>` path — a required single `runId`, scoped by construction to `runs/<runId>/` + that run's runId-embedding branches, that **bypasses the `status===completed` gate by design** (the one sanctioned exception to the #240 invariant, already recorded in ADR-0012), protected only by (c) a mandatory interactive confirmation (no `--yes`) that lists the exact deletion set and surfaces `updatedAt` staleness as a non-gating advisory.

**Architectural split (load-bearing — pin before coding).**
- **MCP side = execution only, non-interactive git+fs.** Given a `runId`, it force-removes ALL worktrees (passed *and* failed), the umbrella branch + every slice branch (local+remote), and the run dir. No status gate, no verdict map. Never throws.
- **SKILL side = the human gate.** The interactive confirmation, the deletion-set preview, and the `updatedAt` staleness advisory live entirely in `SKILL.md`. Confirmation logic is NEVER in the MCP tool.

---

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/clean-runs.ts`** — add the single-run reclaim path. Keep `clean_runs`' existing `verdicts`-required, status-gated contract pristine; isolate the bypass to a clearly-named NEW exported function + schema.
  - **Extract a shared removal core.** Refactor the removal body of `cleanMergedRun` (the worktree-removal loop, `deleteBranch` over umbrella+slice branches, and the run-dir `fs.rmSync`) into a private helper, e.g. `async function removeRunFootprint(runId, runDir, state: ParsedRunState, repoPath, opts: { removeFailedWorktrees: boolean })`. `cleanMergedRun` keeps calling it with `removeFailedWorktrees: force`; the reclaim path calls it with `removeFailedWorktrees: true`. This guarantees identical removal behavior and avoids duplication. (If a clean extraction proves invasive, the fallback is to have the reclaim path drive the same primitives directly — but extraction is preferred.)
  - **New input schema** `reclaimRunInputSchema = z.object({ runId: z.string().describe(...), repoPath: z.string().optional().describe(...) })`. `runId` REQUIRED. `.describe()` text must state this bypasses the status gate, is scoped to that single run, and is the human-gated reclaim path for a crashed/`in-progress`-looking run.
  - **Output:** reuse the existing `runReportSchema` (a single `RunReport`, NOT an array) wrapped in a small output object, e.g. `reclaimRunOutputSchema = z.object({ status: z.enum(["ok","error"]), report: runReportSchema.optional(), errorCode: z.enum(["INVALID_INPUT","FS_ERROR"]).optional(), errorMessage: z.string().optional() })`.
  - **Add `runReasonSchema` members:** `"failed-run-reclaimed"` (success) and `"run-not-found"` (valid runId, but no `runs/<runId>/` dir on disk → structured result, never a throw).
  - **New exported function** `export async function reclaimRun(input): Promise<...>`:
    1. `repoPath = input.repoPath ?? process.cwd()`; run `optionInjectionError("repoPath", repoPath)` guard (mirror `cleanRuns`).
    2. `optionInjectionError("runId", input.runId)` AND `isValidRunId(input.runId)` guard → `INVALID_INPUT` / report reason `invalid-run-id` on failure.
    3. Resolve `runDir = path.join(repoPath, ".orchestrate", "runs", runId)`; if absent → `report` with reason `run-not-found`, action `skipped`.
    4. `readRunState(runStatePath)` — reuse the existing helper. On `missing`/`malformed` → reuse `missing-run-state`/`malformed-run-state` reasons. **Do NOT gate on `status` — this is the whole point.**
    5. Call `removeRunFootprint(runId, runDir, state, repoPath, { removeFailedWorktrees: true })`; set report `action: "removed"` (or `"preserved"` if a worktree removal genuinely failed, mirroring existing best-effort semantics), reason `failed-run-reclaimed`.
  - Update the file-header comment block (lines 8–28) to note the sanctioned `reclaimRun` exception alongside the defense-in-depth status gate.
- **`plugins/orchestrate/orchestrate-mcp/src/index.ts`** — register the new MCP tool.
  - Extend the import block (lines ~89–91) to also import `reclaimRun`, `reclaimRunInputSchema`, `reclaimRunOutputSchema` and the inferred `ReclaimRunInput`/`ReclaimRunOutput` types.
  - Add a `handleReclaimRun` handler (mirror `handleCleanRuns` shape at lines 715–736): call `reclaimRun(input)`, build a one-line `text` summary (e.g. `Reclaimed run <runId>: removed <n> worktree(s), <m> branch(es); run dir removed: <bool>.` or the error form), return `{ structuredContent, content }`.
  - Add a `registerTool("reclaim_run", { title, description, inputSchema: reclaimRunInputSchema.shape, outputSchema: reclaimRunOutputSchema.shape }, handleReclaimRun as unknown as AnyToolHandler)` block. The `description` MUST state: single-run, bypasses the status gate by design, scoped by construction to that one `runs/<runId>/` and its runId-embedding branches, and that the human confirmation lives in the skill (this tool is non-interactive execution).
- **`plugins/orchestrate/orchestrate-mcp/test/clean-runs.test.ts`** — add a `describe("reclaimRun", ...)` block (see Verification for the required cases). Follow the existing temp-repo/fixture harness already in this file.
- **`plugins/orchestrate/orchestrate-mcp/dist/index.js`** — regenerated by `npm run build`; commit it (the bundle is committed; vitest tests `src/`, so green tests ≠ shipped bundle).
- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — two additive edits:
  - **(a) Post-FAIL child-issue comment** — in *Failure handling* (after the label-transition / worktree-preserve / recover-changed-files bullets, ~line 716, before *Continue the wave*), add a bullet: **Post a triage comment on the child issue** — `gh issue comment <N> --body "<body>"` whose body carries: the `failureReason`; the structured `rootCause` from the validated envelope (#239) as `rootCause.status` (`verified` | `hypothesis`) + its detail; the preserved `worktreePath`; and a **resume hint that names `/orchestrate clean --failed <runId>`** as the deliberate post-triage reclaim action. State the degraded path explicitly: when the envelope was `invalid`/`missing` (so no `rootCause` exists), the comment omits `rootCause` and carries `failureReason` + `worktreePath` + resume hint only.
  - **(b)/(c) `--failed` mode** — extend section 0 (*Modes — run vs. clean*, lines 72–97). In the mode list (lines 78–81) add `/orchestrate clean --failed <runId>` as a third clean variant. Add a dedicated subsection under `/orchestrate-clean` mode describing the single-run reclaim: it requires a `<runId>` (error out if absent — never sweep on a bare `--failed`); it calls the new `reclaim_run` MCP tool, NOT `clean_runs`; **a mandatory interactive confirmation is the only guard — never `--yes`/no bypass**. Before confirming, the orchestrator MUST read `runs/<runId>/run-state.json`, enumerate the exact deletion set (every slice `worktreePath`, the `umbrellaBranch`, every `sliceBranch`, and the run dir), and present `updatedAt` as a **staleness advisory** (a live run refreshes `updatedAt` every checkpoint — see *Checkpointing*, SKILL ~746–749; a crashed run's freezes) — advisory only, never a gate (no stale-lock). On decline → stop, touch nothing. On confirm → call `reclaim_run` and report its single report.
- **`plugins/orchestrate/skills/orchestrate/references/run-state.md`** — in *Cleanup lifecycle* (around lines 188–197, beside the `--force` paragraph), add a paragraph for the `--failed <runId>` override: distinct from `--force` (which still operates *inside* the completed+merged gate); it bypasses the status gate for one named run; it is scoped by construction to `runs/<runId>/` + that runId's branches so it can never touch another run; the mandatory interactive confirmation + the `updatedAt` staleness advisory are its only protection. (Reference-file rules: no out-of-bundle citations; keep file ≤200 lines.)
- **`CONTEXT.md`** — extend the **Run cleanup** definition (line 152–154) to note that automatic sweeps and `/orchestrate clean` are status-gated, while `/orchestrate clean --failed <runId>` is the sanctioned human-gated single-run override that bypasses the status gate for a crashed/`in-progress`-looking run. Keep the `_Avoid_` line. (Optional: a one-line cross-link in the ubiquitous-language relations block ~228.)
- **`docs/adr/0012-orchestrate-cross-run-isolation-invariant.md`** — **largely pre-satisfied** (it already documents `--failed` as the one sanctioned exception). At most flip forward-looking wording ("anticipated"/"by design") to reflect it is now implemented (`reclaim_run` tool + `clean --failed` skill path). Do NOT rewrite or recreate the ADR.

---

**Steps**

1. Branch off `origin/development` (`git fetch origin && git checkout -b <name> origin/development`).
2. Confirm `#239` has landed: grep for `rootCause` in `plugins/orchestrate/skills/orchestrate/` and the envelope schema/validate_envelope. If absent, only part (a)'s rootCause content is blocked — parts (b)/(c) (the MCP override + skill `--failed` path) are independent and can proceed; the comment then uses the degraded body until #239 lands.
3. In `clean-runs.ts`: extract `removeRunFootprint` out of `cleanMergedRun` (no behavior change — `cleanMergedRun` still calls it with `removeFailedWorktrees: force`). Add `reclaimRunInputSchema`, `reclaimRunOutputSchema`, the two new `runReasonSchema` members, `reclaimRun`, and the inferred types. Update the header comment.
4. In `index.ts`: import the new symbols, add `handleReclaimRun`, register the `reclaim_run` tool.
5. In `clean-runs.test.ts`: add the `reclaimRun` describe block with the required cases (Verification).
6. In `SKILL.md`: add the child-issue comment bullet (Failure handling) and the `--failed` mode subsection (section 0) with the confirmation + staleness advisory.
7. In `references/run-state.md` and `CONTEXT.md`: add the `--failed` override paragraphs/clause.
8. In `docs/adr/0012`: minimal wording refresh only.
9. Version cascade — **defer to integration if slices run in parallel** (see Risks): `plugin.json` 1.2.0→1.3.0, marketplace `orchestrate` entry 1.2.0→1.3.0, marketplace top-level 1.6.0→1.7.0 (minor mirror).
10. From `plugins/orchestrate/orchestrate-mcp/`: `npm test`, `npm run typecheck`, then `npm run build`; commit the regenerated `dist/index.js`.

---

**Verification** (all run from `plugins/orchestrate/orchestrate-mcp/`)

```bash
cd plugins/orchestrate/orchestrate-mcp && npm test
cd plugins/orchestrate/orchestrate-mcp && npm run typecheck
cd plugins/orchestrate/orchestrate-mcp && npm run build
```

Green looks like: vitest `Test Files N passed` / `Tests M passed` with the new `reclaimRun` cases included; `tsc --noEmit` exits 0 with no output; `esbuild` rewrites `dist/index.js` (verify `git status` shows `dist/index.js` modified, then commit it).

Required new `reclaimRun` test cases (these back ADR-0012's "test-covered invariant" claim):
- removes BOTH passed- and failed-state worktrees for the runId;
- deletes the umbrella branch + every slice branch;
- removes the run directory;
- **acts when `run-state.json` `status` is `in-progress`** (the bypass — the central new behavior, contrast with `clean_runs` which refuses);
- ignores any verdict input (no verdict map participates);
- **a second run present on disk is left completely untouched** (cross-run isolation — the #240 invariant);
- invalid runId (fails `isValidRunId` / option-injection) → structured `INVALID_INPUT`/`invalid-run-id`, no throw;
- nonexistent-but-valid runId → reason `run-not-found`, no throw;
- idempotent re-run (second reclaim of the same runId is a clean no-op, absent refs/worktrees treated as success).

Skill-side (manual / not unit-tested): confirm SKILL.md's `--failed` subsection errors on a missing `<runId>`, lists the deletion set, surfaces `updatedAt` staleness as advisory (not a gate), and has no `--yes` bypass.

---

**Acceptance criteria**

- A new `reclaim_run` MCP tool exists, takes a required `runId`, removes that one run's worktrees (passed+failed) + umbrella/slice branches + run dir, bypasses the `status===completed` gate, never throws, and is scoped so it cannot touch any other run (test-proven).
- `clean_runs`' existing contract (verdicts required, status-gated, force-inside-gate) is unchanged — the bypass lives only in `reclaim_run`.
- On a FAILED slice the orchestrator posts a `gh issue comment` on the child issue with `failureReason` + `rootCause.{status,detail}` (degrading gracefully to `failureReason` + worktree + hint when no envelope rootCause exists) + preserved `worktreePath` + a resume hint naming `/orchestrate clean --failed <runId>`.
- `/orchestrate clean --failed <runId>` requires the runId, always confirms interactively (no `--yes`), lists the exact deletion set, and shows `updatedAt` staleness as advisory-only.
- `npm test`, `npm run typecheck`, `npm run build` all green; `dist/index.js` rebuilt and committed.
- **Docs-in-sync (same unit):**
  - `SKILL.md` — child-issue comment bullet (Failure handling) + `--failed` mode subsection (section 0).
  - `references/run-state.md` — `--failed` override paragraph in *Cleanup lifecycle* (distinct from `--force`).
  - MCP `.describe()` + `index.ts` — new `reclaim_run` tool registered with accurate title/description.
  - `CONTEXT.md` — *Run cleanup* definition notes the human-gated `--failed` exception.
  - `docs/adr/0012-...md` — wording refreshed to "implemented" (no rewrite — pre-satisfied).
  - Templates — none required (`templates/` holds only `commands.json`/`handoff.json`/`routing.json`; no comment/clean template exists).
  - Version cascade — `plugin.json` 1.2.0→1.3.0, marketplace `orchestrate` entry →1.3.0, marketplace top-level 1.6.0→1.7.0 (minor mirror); apply ONCE (see Risks).

---

**Risks / shared files**

- **`plugin.json` + `.claude-plugin/marketplace.json`** — the version cascade is PRD-#241-level. If sibling items run as parallel slices, every slice claiming 1.3.0 collides → **apply the bump once at integration, not per-slice**.
- **`dist/index.js`** — generated bundle; conflicts are guaranteed across every src-touching #241 item. The integrator rebuilds once after merging all MCP changes. Rebuild locally for verification, but expect the committed bundle to be overwritten at integration.
- **`clean-runs.ts` / `index.ts`** — shared with any #240 cross-run-isolation-guard item and every other MCP-tool item in #241. The `removeRunFootprint` extraction touches `cleanMergedRun`; coordinate ordering so a concurrent edit to the same function doesn't conflict. If #240 lands a shared `assertRunStatus`/isolation guard, this item's reclaim path must remain the explicit exception that does NOT call it.
- **`SKILL.md` section 0 + Failure handling** — high-traffic; multiple #241 DX items edit these regions. Keep edits additive and locally anchored.
- **Dependency: `#239` (hard, for part (a) only).** The child-issue comment reads `rootCause` off the validated envelope, which does not exist yet (grep confirmed). The MCP override (b) and the skill `--failed` gate (c) are independent of #239.
- **`#228` (lifecycle) — soft tie, NOT a `dependsOn`.** The decision says "ties to," not "depends on"; the FAILED code path this item hooks into already exists. If #228 restructures the Failure-handling block, re-anchor the comment bullet — but do not block on it.
- **ADR-0012 is already accepted and documents this exception** — do not recreate or substantively rewrite it; a wording refresh only.

---

### #235 — integration tier (per wave) + unit re-verify (per slice-merge)

Add an optional 5th `integration` verb to `commands.json` (heavy suite: Testcontainers/failsafe) exposed as a new `run_integration` MCP tool, run **once per wave** after the wave's slices merge and pass unit re-verify; and add a **per-slice-merge** unit re-verify (`run_tests` + `run_build` on the post-merge umbrella state) so a cross-slice break is attributed to the exact slice that introduced it, instead of surfacing late. Locked decision: `docs/analysis/orchestrate-grill-decisions.md` §"#235 — integration tier + post-merge umbrella re-verification → tiered cadence" (lines 227-257).

---

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/run-command.ts`** — widen the verb set in **three** places (all three are load-bearing; missing the third is a silent runtime trap — the SDK validates the tool's *output* against `runCommandOutputSchema` at runtime per the index.ts comment at lines 136-138, so an un-widened output enum throws at call time while `npm test`/`npm run build` stay green):
  1. `CAPABILITY_VERBS` (line 27): `["tests", "typecheck", "build", "lint"]` → `["tests", "typecheck", "build", "lint", "integration"]`.
  2. `commandsConfigSchema` (lines 46-52): add `integration: z.array(z.string().min(1)).optional(),` alongside the other capability verbs (keep `install` last; place `integration` after `lint`, before `install`). Update the JSDoc above (lines 32-45) to note `integration` is an optional, heavy, per-wave suite — distinct from the four fast per-slice capability verbs and distinct from the `install` setup verb. The "Unknown keys are stripped" property already preserves forward-compat for projects that omit it.
  3. `runCommandOutputSchema.capability` (lines 75-77): `z.enum(["tests", "typecheck", "build", "lint"])` → `z.enum(["tests", "typecheck", "build", "lint", "integration"])`. Update its `.describe()` only if needed (current text "The capability verb this result is for. Always present." stays accurate).
  4. Add the wrapper after `runLint` (line 432): `export const runIntegration = (input: RunCommandInput, opts?: RunCommandOptions) => runConfiguredCommand("integration", input, opts);` — a thin fixed-verb forwarder, identical in shape to `runTests`/`runBuild`. No change to `runConfiguredCommand`, `execCommand`, `loadCommandsConfig`, `runInstall`, or `InstallResult` — `integration` flows through the existing capability path unchanged.

- **`plugins/orchestrate/orchestrate-mcp/src/index.ts`** — register the new tool:
  1. Import `runIntegration` in the `./tools/run-command.js` import block (lines 15-24): add `runIntegration,` to the named imports.
  2. Append to the `RUN_TOOLS` array (lines 277-292): `{ name: "run_integration", title: "Run Integration Suite", verb: "integration", run: runIntegration },`. The existing `for (const tool of RUN_TOOLS)` loop (lines 294-313) auto-registers it with the shared parameterized `.describe()` (the description template at lines 300-305 already interpolates `${tool.verb}`, so it reads correctly for `integration` with no template change). No new bespoke handler is needed — `summarizeRun` and `handleRun` already handle any `RunCommandOutput`.
  3. Optionally bump the `McpServer` version string (line 112, currently `"0.12.0"`) to reflect the new tool — keep consistent with whatever convention the umbrella adopts; see Risks re: version cascade.

- **`plugins/orchestrate/orchestrate-mcp/test/run-command.test.ts`** — add tests mirroring the existing four-verb block (the `passed`-case test is what actually exercises the runtime-output-enum trap from target #3):
  - Import `runIntegration` (alongside `runTests`/`runTypecheck`/`runBuild`/`runLint` at lines 6-9).
  - A `passed` case: write a `commands.json` with an `integration` argv that exits 0, assert `r.status === "passed"`, `r.capability === "integration"`, `r.exitCode === 0` (this round-trips through `runCommandOutputSchema` and proves the output enum was widened).
  - A `failed` case: `integration` argv exiting non-zero → `status === "failed"`, `capability === "integration"`.
  - A `not-configured` case: a `commands.json` with no `integration` key → `status === "not-configured"`, no `errorCode`.
  - A `commandsConfigSchema` parse test (mirroring the schema tests around line 9's import): parse an object with an `integration: ["..."]` key and assert it survives validation.

- **`plugins/orchestrate/orchestrate-mcp/dist/tools/run-command.js` + `dist/index.js`** — regenerated by `npm run build` (dist/ is committed; vitest tests `src/`, so green tests are NOT a shipped fix until dist/ is rebuilt and committed). Do not hand-edit; build artifacts only.

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — two edits to §2 "The wave loop" (lines 347-433):
  1. **Per-slice unit re-verify** — insert into step 4 "Integrate sequentially" (lines 400-406), making the clean `MERGEABLE` merge path gate on a post-merge umbrella re-verify. Today the clean path in §3 step 8 (lines 578-579) does *only* `gh pr merge --squash`; the worktree was branched from the wave's *starting* umbrella (step 1, lines 351-368) and never saw this wave's earlier siblings. Model the re-verify on the existing §3 8a.3 path (lines 596-605): **before** the `gh pr merge --squash`, in the slice's still-present worktree, `git -C <worktree-path> merge origin/orchestrate/umbrella-<runId>` to bring this wave's already-merged siblings into the worktree, then run `run_tests` + `run_build` (the ledger's "fast unit command" — only these two, NOT all four; 8a.3 runs four but stay faithful to the ledger here) with the worktree path as `repoPath`. Gate the `gh pr merge` on both passing. **Skip the re-verify for the first merged slice of a wave** (redundant with its pre-merge gate — the umbrella merge is a no-op at that point). On failure: the slice has **FAILED** via the existing failure path (§"Failure handling" lines 705+ — worktree preserved, wave continues); because the re-verify runs *before* `gh pr merge`, the umbrella is never polluted and **no revert/rollback machinery is needed**. If the `git merge origin/orchestrate/umbrella-<runId>` surfaces conflicts, defer to §3 step 8a (do not duplicate conflict logic).
  2. **Per-wave integration step** — insert a new step between current step 4 (Integrate sequentially) and step 5 (Checkpoint the wave). After all of this wave's processable slices have integrated and passed unit re-verify, run the `integration` suite **once** against the umbrella tip: call `run_integration` MCP tool with the umbrella-tip working directory as `repoPath`. **Working dir**: the slice worktrees are removed at §3 step 9, so explicitly **defer removal of the last successfully-merged slice's worktree until after this integration step**, fast-forward-merge the umbrella into it (`git -C <worktree-path> merge origin/orchestrate/umbrella-<runId>`), and use that worktree path as `repoPath` (`.orchestrate/commands.json` is repo-tracked — confirmed via `git ls-files .orchestrate/commands.json` — so it is present in every worktree). A `not-configured` result (project ships no `integration` command) is **tolerated and skipped** — same posture as any unconfigured capability verb. On `passed` → proceed to step 5. On `failed`/`error` → **halt the run**: do not checkpoint `completedWaves` forward, do not build the next wave on a broken umbrella; leave the umbrella branch and the failing worktree on disk, record the failure in `run-state.json`, report to the user, and stop — consistent with step 1's "fail loud, do not branch a wave from a wrong base" (lines 360-368). Remove the deferred worktree only after a `passed`/`not-configured` integration result.
  - Renumber the subsequent steps (old 5 "Checkpoint the wave", old 6 "Report wave progress") accordingly, or insert as "4a" to avoid renumbering — pick whichever keeps cross-references intact; there are no numeric cross-refs to steps 5/6 elsewhere in the file (verified: §2 step references point at section 3 steps 6-9, not §2's own 5/6).

- **`docs/adr/0011-orchestrate-config-resolution-root.md`** — update the capability-tool enumeration at lines 5-6: `run_tests`, `run_build`, `run_typecheck`, `run_lint` → add `run_integration`. The ADR already references "#235's per-wave `integration` tier" at line 27, so this closes the forward-reference. Keep wording consistent with the file's existing phrasing.

- **`CONTEXT.md`** — update the Capability-detector/commands.json definition at line 177: "the four fixed capability verb keys (`tests`, `typecheck`, `build`, `lint`)" → describe the four *auto-detected* capability verbs plus the optional, never-auto-detected `integration` verb (heavy per-wave suite, omitted by `buildCommandsConfig`). Make explicit that `integration` is NOT emitted by the Capability detector — it is hand-authored when a project has a heavy integration suite — so the line stays accurate against the unchanged `bootstrap-config.ts`.

**Explicit non-changes (do NOT edit — call out so the implementer does not "helpfully" add them):**
- `plugins/orchestrate/orchestrate-mcp/src/tools/bootstrap-config.ts` `buildCommandsConfig` and `orchestrate-mcp/src/tools/detect-project.ts` `detectCommandMap` — `integration` is heavy and project-specific and must **never** be auto-detected/auto-populated. `buildCommandsConfig` stays the four-capability + npm-`install` shape it has today.
- `plugins/orchestrate/templates/commands.json` — stays `{}` (it is a schema-pointer-less empty template; do not seed `integration`).
- `runConfiguredCommand` / `execCommand` / `runInstall` internals — `integration` reuses the existing capability execution path verbatim.

---

**Steps**

1. Edit `run-command.ts`: widen `CAPABILITY_VERBS` (line 27), add `integration` to `commandsConfigSchema` (lines 46-52) with updated JSDoc, widen `runCommandOutputSchema.capability` enum (lines 75-77), add the `runIntegration` wrapper after `runLint` (after line 432).
2. Edit `index.ts`: add `runIntegration` to the run-command import block, append the `run_integration` entry to `RUN_TOOLS` (after line 291). Optionally bump the `McpServer` version (line 112).
3. Add the four `integration` test cases (passed / failed / not-configured / schema-parse) to `run-command.test.ts`, mirroring the existing capability-verb block and importing `runIntegration`.
4. From `plugins/orchestrate/orchestrate-mcp/`, run `npm test` (green) then `npm run build`; stage the regenerated `dist/tools/run-command.js` and `dist/index.js`.
5. Edit `SKILL.md` §2: (a) add the per-slice unit re-verify (skip first slice of wave; `git merge origin/orchestrate/umbrella-<runId>` into the worktree, then `run_tests` + `run_build`, gate `gh pr merge` on pass, FAIL-before-merge on fail, defer to 8a on conflict); (b) add the per-wave integration step (defer last worktree removal, `run_integration` against umbrella tip, tolerate `not-configured`, halt-the-run on fail).
6. Edit `docs/adr/0011-orchestrate-config-resolution-root.md` (add `run_integration` to the tool list, lines 5-6) and `CONTEXT.md` (line 177 — four auto-detected capability verbs + optional never-auto-detected `integration`).
7. Apply the version cascade per umbrella convention (see Acceptance + Risks): `plugins/orchestrate/.claude-plugin/plugin.json` `version` (1.2.0), `.claude-plugin/marketplace.json` orchestrate entry `version` (1.2.0) + top-level `version` (1.6.0). Confirm with the umbrella owner whether bumps land per-slice or are deferred to umbrella integration.
8. Re-run `npm test && npm run build` to confirm green after all edits, and confirm `git status` shows the dist/ artifacts staged.

---

**Verification**

Run from `plugins/orchestrate/orchestrate-mcp/`:

```bash
cd plugins/orchestrate/orchestrate-mcp && npm test
```
Green: all suites pass, including the new `integration` cases in `run-command.test.ts` (the `passed` case round-trips through `runCommandOutputSchema` — proving the output enum was widened; a missed widen throws here, not silently).

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run build
```
Green: tsc emits with no errors; `dist/tools/run-command.js` and `dist/index.js` are regenerated.

```bash
cd plugins/orchestrate/orchestrate-mcp && grep -c '"integration"' dist/tools/run-command.js && grep -c 'run_integration' dist/index.js
```
Green: both counts are ≥1 — the shipped bundle (not just `src/`) carries the new verb and tool. (vitest tests `src/`; this grep proves the committed dist/ reflects the change.)

```bash
git -C /home/rodrigo/Workspace/agent-engineering-toolkit status --porcelain plugins/orchestrate/orchestrate-mcp/dist/
```
Green: `dist/tools/run-command.js` and `dist/index.js` appear as modified/staged — the committed bundle is updated.

---

**Acceptance criteria**

- `run-command.ts` widens all **three** verb surfaces (`CAPABILITY_VERBS`, `commandsConfigSchema`, `runCommandOutputSchema.capability`) and adds `runIntegration`; `index.ts` registers `run_integration` via the `RUN_TOOLS` loop.
- `npm test` passes including new `integration` test cases; the `passed`-case test exercises the output-enum round-trip.
- `npm run build` regenerates `dist/`, and the regenerated `dist/tools/run-command.js` + `dist/index.js` are committed (grep confirms `"integration"` / `run_integration` present in the bundle).
- A `commands.json` lacking an `integration` key yields `not-configured` (tolerated/skipped), never an error.
- SKILL.md §2 contains: the per-slice unit re-verify (skip-first-slice, merge-umbrella-into-worktree, `run_tests`+`run_build`, gate-before-merge, FAIL-before-pollution, conflict→8a) and the per-wave integration step (deferred worktree, `run_integration` at umbrella tip, tolerate `not-configured`, halt-on-fail).
- **Docs-in-sync (same unit, this item):**
  - `SKILL.md` §2 wave loop — both new steps (above). *(required)*
  - MCP `.describe()` + `index.ts` — `run_integration` registered with the shared parameterized description; `commandsConfigSchema` and `runCommandOutputSchema.capability` JSDoc/enum updated. *(required)*
  - `docs/adr/0011-orchestrate-config-resolution-root.md` — `run_integration` added to the capability-tool enumeration (lines 5-6); closes the existing line-27 forward-reference. *(required)*
  - `CONTEXT.md` line 177 — capability-verb definition updated to distinguish the four auto-detected capability verbs from the optional, never-auto-detected `integration` verb. *(required)*
  - `references/` — no edit required: `run-state.md`'s only "integration" usage is `integrationBase` (unrelated); `context-handoff.md` is unaffected. *(verified non-change)*
  - `templates/commands.json` — stays `{}`. *(explicit non-change)*
  - `bootstrap-config.ts` / `detect-project.ts` — stay unchanged (integration never auto-detected). *(explicit non-change)*
  - **Version cascade** — `plugins/orchestrate/.claude-plugin/plugin.json` `version` + `.claude-plugin/marketplace.json` orchestrate-entry `version` + marketplace top-level `version`, magnitude-mirrored; coordinate with the umbrella (may be deferred to integration). *(required, but shared — see Risks)*

---

**Risks / shared files**

- **`run-command.ts` schema is a multi-item hotspot.** `commandsConfigSchema` and `runCommandOutputSchema` are *also* edited by **#230-P1.3** (`knownFailures` key) and **P2.2** (`install`/PM-aware defaults) per `orchestrate-grill-decisions.md:38`. This is a **merge-conflict hotspot, not a hard ordering dependency** — `dependsOn: []` is correct. Each item adds a distinct optional key to the same `z.object`; conflicts are mechanical (adjacent lines), resolve by keeping all keys. Coordinate verb ordering in the object to minimize churn.
- **The runtime output-enum trap.** The single most-likely-missed change is `runCommandOutputSchema.capability` (target #3). It is NOT caught by typecheck of `src/` alone in a way that surfaces obviously — but the SDK validates the handler's structured output against this enum at runtime, so a `run_integration` call returns an error envelope while unit tests pass *unless* the `passed`-case test (which round-trips a real `RunCommandOutput`) is present. Keep that test.
- **Version cascade is touched by every PRD #241 item.** `plugin.json` (1.2.0), marketplace orchestrate entry (1.2.0), marketplace top-level (1.6.0). Recommend the umbrella owner bump once at integration rather than per-slice to avoid N-way conflicts on three version fields.
- **SKILL.md §2 is shared across several #241 items** (resume/subState #230-P1.2, push-verify #230-P1.1 §3, knownFailures gate #230-P1.3). The new per-slice re-verify and per-wave integration steps insert into the §2 wave loop and §3 step-8 region — likely to collide textually with those edits. Keep the inserts localized (one new step + one gated sub-step) and reference (not duplicate) the existing 8a.3 re-verify machinery to reduce overlap.
- **No code dependency** on other items: `dependsOn: []`. The change is self-contained within the capability-command path; it does not require #230/#231/#236 code to land first.

---

### #231-P2.2 — run_install tool + subagent self-install + PM-aware detect-project

**Locked decision (one line).** Give the implementer + conflict-resolver subagents a new `run_install` MCP tool (a thin forwarder over the existing internal `runInstall`) so that after editing a manifest they can self-install a new dependency and re-`run_build` in their own turn; make `detect-project` package-manager-aware for the JS ecosystem (lockfile-keyed: `pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn, `package-lock.json`→npm, no lock→**pnpm**) applied to the WHOLE verb set (the 4 capability verbs + a new `install` verb); install uses the **mutating/resolving** form (`pnpm install` / `npm install`, never `npm ci`) so a new dep rewrites the lockfile; **no runtime npm fallback** (a missing PM is a loud `EXEC_ERROR`); install runs **before the slice commit** and the lockfile must land in the slice diff. No envelope `needs-dependency` signal — the manifest+lockfile is the deterministic source of truth; the orchestrator's independent pre-merge build gate (#230-P1.3) is the backstop.

---

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/detect-project.ts`** — the core change. This is NOT "add a field"; it restructures the maps to carry a PM dimension.
  - **`CapabilityCommandMap` type (line 22-27):** add an optional `install?: string[]` member. (It is no longer "only the four capability verbs" — the whole-verb-set decision #4 puts install here so a single detector emits it.)
  - **PM resolution:** add a JS package-manager dimension. Add a `type JsPackageManager = "pnpm" | "yarn" | "npm"` and a pure resolver `function detectJsPackageManager(filesPresent: string[]): JsPackageManager` keyed on lockfile precedence — `pnpm-lock.yaml`→`"pnpm"`, `yarn.lock`→`"yarn"`, `package-lock.json`→`"npm"`, none present→`"pnpm"` (the preferred default per decision #4). Pure, no I/O; caller supplies the filename list (the same list `detectCommandMap`'s `readdirSync` already produces).
  - **`COMMAND_MAPS` (line 57-85):** the static `npm` entry cannot hold one PM. Replace the `npm` static entry with a per-PM builder. Add a `function buildJsCommandMap(pm: JsPackageManager): Required<CapabilityCommandMap>` returning, for `pnpm`: `tests:["pnpm","test"]`, `typecheck:["pnpm","run","typecheck"]`, `build:["pnpm","run","build"]`, `lint:["pnpm","run","lint"]`, `install:["pnpm","install"]`; for `yarn`: `tests:["yarn","test"]`, `typecheck:["yarn","run","typecheck"]`, `build:["yarn","run","build"]`, `lint:["yarn","run","lint"]`, `install:["yarn","install"]`; for `npm`: `tests:["npm","test"]`, `typecheck:["npm","run","typecheck"]`, `build:["npm","run","build"]`, `lint:["npm","run","lint"]`, **`install:["npm","install"]`** (mutating form — decision #5, NOT `npm ci`). Keep `cargo`/`python`/`make` as static `Required<CapabilityCommandMap>` entries but ADD their `install` per decision #4: cargo `install:["cargo","fetch"]`, python `install:["pip","install","-e","."]`. `make` install is unspecified by the ledger → **omit** `install` for make (no `install` key). Keep cargo/python's 4 capability verbs unchanged. Restructure `COMMAND_MAPS` so non-JS types remain a static `Record`, and the `npm` type is computed via `buildJsCommandMap`.
  - **`buildCommandMap(type)` (line 114-119):** signature change — it must now (a) emit the `install` verb (stop being capability-only) and (b) for `npm` accept the resolved PM. Recommended: change to `buildCommandMap(type: ProjectType, jsPackageManager?: JsPackageManager): CapabilityCommandMap` — for `none` return `{}`; for `npm` return `buildJsCommandMap(jsPackageManager ?? "pnpm")`; for cargo/python/make return the static map (with install for cargo/python, without for make/none). The returned object now includes `install` for every type that has one. **The existing doc comment "The `install` verb is never included" is now false — rewrite it.**
  - **`detectCommandMap(repoRoot)` (line 137-152):** already does `readdirSync(repoRoot)` and computes `presentManifests`. For an `npm` project, also resolve the PM from the SAME `entries` list (the lockfiles are top-level entries already in scope — no extra I/O) and pass it to `buildCommandMap(projectType, pm)`. For non-npm, call `buildCommandMap(projectType)`.
  - **Re-exports (line 156):** export the new `detectJsPackageManager` (and `JsPackageManager` type, `buildJsCommandMap`) alongside the existing `DETECTION_RULES`, `COMMAND_MAPS` so tests and bootstrap can import them.
  - **No runtime fallback (decision #6):** do NOT add any pnpm→npm fallback. The lockfile alone decides; a missing `pnpm` binary surfaces later as `runInstall`'s `EXEC_ERROR` (already handled in run-command.ts `execCommand`). Document this in the module/`buildJsCommandMap` comment.

- **`plugins/orchestrate/orchestrate-mcp/src/tools/run-command.ts`** — the ledger parenthetical ("`commandsConfigSchema` already carries `install`") is only half true; the SCHEMA carries it but there is **no Zod output schema for `runInstall`**, and `registerTool` requires `outputSchema.shape`.
  - **Add + export `runInstallOutputSchema`** — a `z.object({...})` mirroring the existing `InstallResult` interface (line 451-462): `status: z.enum(["installed","not-configured","failed","error"])` (+`.describe(...)`), plus optional `command: z.array(z.string())`, `exitCode: z.number()`, `stdout: z.string()`, `stderr: z.string()`, `truncated: z.boolean()`, `durationMs: z.number()`, `reason: z.string()`, `errorCode: z.enum(["CONFIG_INVALID","EXEC_ERROR","TIMEOUT"])`, `errorMessage: z.string()` — each `.optional().describe(...)`, reusing the wording style of `runCommandOutputSchema`'s describes.
  - **Make the schema the source of truth (consistency with the file's stated pattern, lines 150-154):** redefine `export type InstallResult = z.infer<typeof runInstallOutputSchema>;` and DELETE the hand-written `interface InstallResult` (line 451-462). Verify `runInstall`'s return objects still satisfy the inferred type (they should — same fields). `worktree.ts` already imports `runInstall`/`InstallResult` and is unaffected by the interface→type swap.
  - **Input schema:** `run_install` reuses the existing `runCommandInputSchema` (just `repoPath?`) — no new input schema needed. Export nothing new for input.
  - `runInstall` core logic (line 473-536) is unchanged — it already loads config, runs the `install` argv with no shell, and returns the discriminated `InstallResult`.

- **`plugins/orchestrate/orchestrate-mcp/src/tools/bootstrap-config.ts`** — **in scope, blocks correctness** (the ledger Surface line omitting this is a bug). `buildCommandsConfig` (line 258-276) does `config = {...capabilities}` then `if (projectType==="npm") config.install = ["npm","ci"]`. Once `detectCommandMap` emits a PM-aware mutating install, this override (a) clobbers it back to `npm ci` (violating decision #5) and (b) re-strips the new cargo/python install verbs only if it relied on the old capability-only map — but now `capabilities` already carries `install`, so the override is both wrong and redundant.
  - **Delete** the `if (projectType === "npm") { config.install = ["npm", "ci"]; }` block (line 272-274). Let the detected `install` (now present in `capabilities` for npm/cargo/python) flow through unchanged via `{ ...capabilities }`.
  - **Rewrite the stale doc comment** (line 251-256) that says install is `["npm","ci"]` for npm only — it now describes a PM-aware mutating install emitted by the detector for npm/cargo/python.

- **`plugins/orchestrate/orchestrate-mcp/src/index.ts`** — register the new tool and fix stale prose.
  - **Import** `runInstall`, `runInstallOutputSchema`, and `type InstallResult` from `./tools/run-command.js` (extend the existing import block at line 15-24; `runCommandInputSchema` is already imported).
  - **Add a `summarizeInstall(r: InstallResult): string`** helper (InstallResult has no `capability`, so the existing `summarizeRun` at line 252-263 cannot be reused) — e.g. `installed`→`"install passed (exit 0, <ms> ms)."`, `failed`→`"install failed (exit <exitCode>, <ms> ms)."`, `not-configured`→`"install is not configured: <reason>"`, `error`→`"install could not run [<errorCode>]: <errorMessage>"`.
  - **Register `run_install`** with a `handleRunInstall: ToolHandler<RunCommandInput, InstallResult>` (mirroring `handleRun` at line 265-275 but using `summarizeInstall`), then `registerTool("run_install", { title: "Run Install", description: "...", inputSchema: runCommandInputSchema.shape, outputSchema: runInstallOutputSchema.shape }, handleRunInstall as unknown as AnyToolHandler)`. The `.describe()`-equivalent **description** must state: runs the project's `install` setup command (the mutating dependency-resolve step, e.g. `pnpm install`/`npm install`) exactly as configured in `.orchestrate/commands.json`; never accepts a command string; orchestrator- and subagent-callable on any checkout; discriminated status `installed` / `not-configured` / `failed` / `error`; a missing `install` key is the clean `not-configured` state, not a failure.
  - **Fix stale `bootstrap_config` description** (line 845-857): the clause "(with `install` for npm only, empty for an unrecognized project)" is now false — reword to "writes a PM-aware mutating `install` command for npm/cargo/python projects (keyed on the JS lockfile for the npm ecosystem)".

- **`plugins/orchestrate/agents/implementer-standard.md` + `implementer-deep.md`** — grant the tool AND add a body instruction.
  - **`tools:` line (line 4):** append `, mcp__plugin_orchestrate_orchestrate__run_install` to the existing `run_*` list (both files; the deep variant's tools line is identical to standard).
  - **Body — "What you do" / verify step (around step 3-4):** add an instruction: when the slice introduces a NEW runtime dependency, edit the manifest (`package.json`/`Cargo.toml`/`pyproject.toml`) to add it, then **call `run_install` (worktree path as `repoPath`) BEFORE re-running `run_build`/`run_tests`** — a fresh worktree has only tracked files, so a newly-added dependency is not present until install runs. State that `run_install` is the only way to fetch a new dependency (no Bash). Add to "Boundaries"/"What you return": because install mutates the lockfile (`pnpm-lock.yaml`/`package-lock.json`/`Cargo.lock`), the implementer **MUST include the changed lockfile in `filesChanged`** so the orchestrator stages it into the slice diff (decision #7). Note the `npm ci`/`--frozen-lockfile` caveat is NOT the implementer's concern — a project that overrides `install` with a strict reproducible form forfeits in-slice new-dependency support (documented limitation, decision #5).

- **`plugins/orchestrate/agents/conflict-resolver-standard.md` + `conflict-resolver-deep.md`** — same grant + a lighter body note.
  - **`tools:` line (line 4):** append `, mcp__plugin_orchestrate_orchestrate__run_install`.
  - **Body — "What you do" (around step 3, verify):** add: if resolving a conflict that touches a dependency manifest requires fetching a dependency that is not yet installed, call `run_install` (worktree path as `repoPath`) before re-verifying with the capability tools; include any changed lockfile in `filesChanged`.

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — §3 subagent self-install + install-before-commit ordering, plus fix stale prereq prose.
  - **§3 step 4 ("Run the implementer", line 492-512):** in the implementer-prompt requirements list, add: instruct the implementer that it MAY call `run_install` to fetch a newly-added dependency before re-verifying, and that any lockfile install mutates MUST be reported in `filesChanged`.
  - **§3 step 6 ("Commit and push", line 543-559):** reinforce that the staged set is the union of the validated implementer+reviewer `filesChanged` arrays — so a lockfile the implementer declared is staged and lands in the slice diff (decision #7 ordering: install ran in-turn BEFORE the commit; the commit captures the mutated lockfile). No change to the `git add -- <files>` mechanic; just make the lockfile's inclusion explicit.
  - **Prerequisites prose (line 59-63):** the sentence "the bootstrapper sets `install` automatically for an npm project" is now false — reword to "the bootstrapper sets a PM-aware mutating `install` automatically for npm/cargo/python projects (the JS package manager is keyed on the lockfile — pnpm/yarn/npm, defaulting to pnpm)". Mention that a project overriding `install` with a strict reproducible form (`npm ci`, `--frozen-lockfile`) forfeits in-slice new-dependency support.

- **`plugins/orchestrate/.claude-plugin/plugin.json`** — version `1.2.0` → `1.3.0` (MINOR: new MCP tool + new subagent capability — additive, per `.claude/rules/plugin-versioning.md`).

- **`.claude-plugin/marketplace.json`** — `plugins[]` orchestrate entry `version` `1.2.0` → `1.3.0` (mirror plugin.json, cascade rule 2); top-level `version` `1.6.0` → `1.7.0` (cascade rule 3 — per-entry edit, magnitude-mirrored MINOR).

- **`plugins/orchestrate/orchestrate-mcp/dist/index.js`** (+ regenerated bundle artifacts) — committed bundle; rebuild after src changes (see Steps).

---

**Steps** (executable, in order)

1. Edit `detect-project.ts`: add `JsPackageManager` type + `detectJsPackageManager(filesPresent)` pure resolver (lockfile precedence pnpm/yarn/npm, default pnpm); add `install?: string[]` to `CapabilityCommandMap`; add `buildJsCommandMap(pm)`; add `install` to cargo (`cargo fetch`) and python (`pip install -e .`) static entries, omit for make; restructure `COMMAND_MAPS` so npm is computed via `buildJsCommandMap`; change `buildCommandMap(type, jsPackageManager?)` to emit install and PM-resolve npm; update `detectCommandMap` to resolve the PM from `entries` and pass it; rewrite the now-false "install verb is never included" comments; export the new symbols.
2. Edit `run-command.ts`: add+export `runInstallOutputSchema` (z.object mirroring the install result), redefine `InstallResult = z.infer<typeof runInstallOutputSchema>` and delete the hand-written interface. Confirm `runInstall`'s returns still typecheck.
3. Edit `bootstrap-config.ts`: delete the `npm ci` override block in `buildCommandsConfig`; rewrite the stale comment.
4. Edit `index.ts`: import `runInstall` + `runInstallOutputSchema` + `InstallResult`; add `summarizeInstall`; add `handleRunInstall` + `registerTool("run_install", ...)`; fix the stale `bootstrap_config` description clause.
5. Edit the 4 subagent defs (`implementer-standard/deep`, `conflict-resolver-standard/deep`): append `run_install` to each `tools:` line; add the self-install + declare-the-lockfile body instructions.
6. Edit `SKILL.md`: §3 step 4 (implementer prompt may self-install), §3 step 6 (lockfile lands in slice diff), prerequisites prose (PM-aware mutating install + strict-form forfeit note).
7. Update tests via `/tdd` (red→green) — see the three test files in Verification.
8. Bump versions: `plugin.json` 1.3.0, marketplace orchestrate entry 1.3.0, marketplace top-level 1.7.0.
9. From `plugins/orchestrate/orchestrate-mcp/`: `npm run build` then commit the regenerated `dist/` (vitest tests `src/`, so green tests alone do NOT ship the fix — the bundle must be rebuilt).

---

**Verification** (all run from `plugins/orchestrate/orchestrate-mcp/`)

```bash
cd plugins/orchestrate/orchestrate-mcp && npm test
```
Green = all suites pass, INCLUDING the updated assertions:
- `test/detect-project.test.ts` — existing `buildCommandMap("npm")` block (lines 88-95) asserts `tests:["npm","test"]` and `"install" in map === false`; these MUST be rewritten: a no-lockfile/default npm now yields **pnpm** verbs and `install:["pnpm","install"]` is now PRESENT. Add cases: `detectJsPackageManager` precedence (pnpm-lock.yaml→pnpm, yarn.lock→yarn, package-lock.json→npm, none→pnpm); `detectCommandMap` on a repo with `package.json`+`package-lock.json` yields npm-prefixed verbs + `install:["npm","install"]`; cargo yields `install:["cargo","fetch"]`, python `install:["pip","install","-e","."]`, make has no install. The "exactly four keys" guard at line 132-135 must be updated to expect the `install` key where present.
- `test/run-command.test.ts` — the existing `runInstall` block (lines 217+) stays green (logic unchanged); add an assertion that `runInstallOutputSchema.safeParse(<a runInstall result>)` succeeds (schema↔result parity).
- `test/bootstrap-config.test.ts` — line 107 `expect(cmds.install).toEqual(["npm","ci"])` MUST change to the mutating form keyed on PM (e.g. with a `package-lock.json` present → `["npm","install"]`; default/no-lock → `["pnpm","install"]`); cargo `install` (line 117) and python `install` (line 127) flip from `toBeUndefined()` to `["cargo","fetch"]` / `["pip","install","-e","."]`.

```bash
cd plugins/orchestrate/orchestrate-mcp && npm run build && git -C ../../.. status --porcelain plugins/orchestrate/orchestrate-mcp/dist
```
Green = build exits 0 and `dist/index.js` shows as modified (proof the bundle was regenerated and is staged for commit). Optionally grep the bundle: `grep -c run_install dist/index.js` returns ≥1.

---

**Acceptance criteria**

- `run_install` is a registered MCP tool with `inputSchema = runCommandInputSchema.shape` and `outputSchema = runInstallOutputSchema.shape`; calling it on a checkout with a configured `install` runs that argv (no shell) and returns the discriminated `installed`/`not-configured`/`failed`/`error` status.
- `runInstallOutputSchema` exists, is exported, and `InstallResult` is its `z.infer` (single source of truth); `runInstall` results pass `runInstallOutputSchema.safeParse`.
- `detect-project` is PM-aware for the JS ecosystem: lockfile-keyed (`pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn, `package-lock.json`→npm, none→pnpm), applied to ALL of tests/typecheck/build/lint/install; install is the mutating form (`pnpm install`/`npm install`, never `npm ci`); cargo→`cargo fetch`, python→`pip install -e .`, make→no install, none→`{}`.
- No runtime npm fallback: a missing PM binary surfaces as `runInstall` `EXEC_ERROR`, not a silent switch.
- `bootstrap-config` no longer hardcodes `npm ci`; the detected PM-aware install flows through for npm/cargo/python.
- implementer (-standard, -deep) and conflict-resolver (-standard, -deep) — and ONLY these — have `run_install` in `tools:` and a body instruction to self-install a new dependency before re-`run_build` and to declare the mutated lockfile in `filesChanged`. Reviewer and investigator are NOT granted `run_install`.
- The envelope `verification` enum is UNCHANGED (no `install` member); validate-envelope.ts is NOT touched — install is capability, gated via `run_build`, never self-reported (decision #1).
- **Docs-in-sync (same unit):**
  - **MCP `.describe()` + index.ts** — new `run_install` tool description; fixed `bootstrap_config` description clause ("install for npm only" → PM-aware).
  - **detect-project.ts comments** — the "install verb is never included" comments rewritten.
  - **SKILL.md** — §3 step 4 (implementer may self-install), §3 step 6 (lockfile in slice diff), prerequisites prose (PM-aware mutating install + strict-form forfeit caveat).
  - **Subagent defs** — 4 files' `tools:` + bodies.
  - **Version cascade** — `plugin.json` 1.3.0, marketplace orchestrate entry 1.3.0, marketplace top-level 1.7.0.
  - **Templates** — `templates/commands.json` is `{}` (empty) and intentionally carries no install; leave it unchanged (no template edit required).
  - **CONTEXT.md / docs/adr** — none required for this slice (no new architectural decision beyond what the locked ledger already records).
  - **dist/** — rebuilt and committed.

---

**Risks / shared files**

- **`detect-project.ts` is a hub** — `bootstrap-config.ts` imports `detectProjectType`/`detectCommandMap`/`ProjectType` from it, and changing `CapabilityCommandMap`/`buildCommandMap`'s shape ripples into both bootstrap and the detect-project unit tests. Any sibling PRD item touching detection ordering or bootstrap must coordinate; land this item's detect-project change as one atomic unit with its test updates.
- **`run-command.ts` and `index.ts`** are touched by nearly every orchestrate-mcp item (they hold the schemas and the tool registry). Expect merge contention; the additions here (one schema export, one tool registration, one import line) are localized and append-only — minimal conflict surface, but rebase carefully against any concurrent run-tool change.
- **`bootstrap-config.ts` omission in the ledger Surface line is a trap** — bootstrap-config.test.ts asserts the old `npm ci`; without editing both the source override AND the test, the suite stays green while shipping a decision-#5 violation (the exact "green tests != shipped fix" failure mode). Do not skip step 3 + the bootstrap test edit.
- **dist/ is committed** — a src-only change that passes vitest is NOT shipped. `npm run build` + commit `dist/` is mandatory (distRebuild=true).
- **Lockfile-in-diff fragility (decision #7)** — if the implementer forgets to declare the mutated lockfile in `filesChanged`, it survives only via the `verify_changeset` `mismatch`-union fallback (SKILL §3 step 4a), which is fragile. The subagent-body instruction to declare the lockfile is load-bearing, not cosmetic.
- **`go` is deferred** — decision #4 names a go install (`go mod download`) but there is no `go` `ProjectType`, no DETECTION_RULE, and the ledger gives no go test/build/lint verbs. Implementing go would mean fabricating its capability verbs; scope this item to the existing types (npm PM-aware, cargo, python) and flag go as an open follow-up rather than inventing unspecified verbs.
- **No ordering dependency** — this item has no `dependsOn`; `runInstall` and the `install` schema member already exist (#231-P2.2's predecessor work), so this slice only adds the tool surface, PM-awareness, and the subagent grants on top.

---

### #234 — intra-issue sub-slicing → continue-in-place with remainingWork handoff

Change the implementer `incomplete` status from **immediate-FAIL** to **bounded continue-then-FAIL**. The `incomplete` envelope gains a required `remainingWork` handoff field; the orchestrator re-spawns the implementer in the SAME (P1.2-preserved) worktree carrying that handoff, looping until the implementer returns `completed` or a configurable **continuation budget** (a new optional top-level key in `routing.json`) is exhausted — guarded by a **no-progress guard** (a continuation that does not change the worktree FAILS the slice, so the loop can never spin forever). Reuses the existing worktree-preservation behavior; extends the existing `incomplete` status (the slice `state` enum is unchanged — `incomplete` is an envelope status, never a `run-state.json` slice state). Orthogonal to #193 (fan-out budget) and #239 (rootCause).

**LOCKED decision source:** `docs/analysis/orchestrate-grill-decisions.md` heading `### #234 — intra-issue sub-slicing → continue-in-place with handoff note`. CONTEXT.md glossary (`Implementer incomplete status`, lines 188-189 + 232) is ALREADY updated to the bounded-continue semantics — do NOT re-edit it; just verify it still matches what you ship.

---

**Target files**

- **`plugins/orchestrate/orchestrate-mcp/src/tools/validate-envelope.ts`** — In `implementerEnvelopeSchema` (lines 32-63) add an optional field after `notes`:
  ```ts
  remainingWork: z
    .string()
    .optional()
    .describe(
      "Present and non-empty ONLY when status='incomplete'. The handoff note " +
        "the orchestrator forwards to the continuation implementer: what is " +
        "done, what is left, and how to resume in the same worktree. Required " +
        "for an 'incomplete' envelope; absent or empty for 'completed'/'blocked'."
    ),
  ```
  Then attach a `.superRefine` to `implementerEnvelopeSchema` enforcing: `status === "incomplete"` ⇒ `remainingWork` is a present, non-empty (after trim) string — otherwise emit an issue on path `["remainingWork"]` (so `validateEnvelope` classifies it `SCHEMA_MISMATCH` → `invalid`). Do NOT require `remainingWork` for `completed`/`blocked`. Note: `.superRefine` on a member of `z.discriminatedUnion` (line 162) is supported in this zod version — keep the discriminant `role` literal untouched so the union still discriminates. No change to `validateEnvelope()` logic (lines 327-411) — the existing `safeParse` against `envelopeSchema` picks up the refinement automatically.

- **`plugins/orchestrate/orchestrate-mcp/src/tools/routing.ts`** — Add the continuation budget as an **optional top-level key on `routingConfigSchema`** (lines 43-47), sibling to the three tier blocks (same seam #231-P2.3 uses for `intraWaveConcurrency`):
  ```ts
  export const routingConfigSchema = z.object({
    trivial: tierRoutingSchema,
    standard: tierRoutingSchema,
    complex: tierRoutingSchema,
    continuationBudget: z
      .number()
      .int()
      .min(0)
      .default(2)
      .describe(
        "How many times the orchestrator may re-spawn the implementer in the " +
          "same worktree after an 'incomplete' envelope (re-spawns BEYOND the " +
          "initial run). 0 disables continuation (incomplete FAILs immediately, " +
          "the legacy behavior). Defaults to 2."
      ),
  });
  ```
  Extend `resolveRoutingOutputSchema` (lines 67-98) with an optional echoed field `continuationBudget: z.number().int().min(0).optional().describe("The resolved continuation budget for this run — how many implementer re-spawns are allowed after an 'incomplete' envelope. Present when status='ok'.")`. In `resolveRoutingFromConfig` (lines 134-183), on the success path (lines 178-182) add `continuationBudget: config.data.continuationBudget` to the returned object (zod's `.default(2)` guarantees it is populated even when the key is absent). `tierRoutingSchema` is unchanged — the budget is run-wide, not per-tier.

- **`plugins/orchestrate/orchestrate-mcp/src/tools/bootstrap-config.ts`** — Add `continuationBudget: 2` to `DEFAULT_ROUTING_CONFIG` (lines 62-81) to honor the byte-for-byte-equivalent-to-`templates/routing.json` promise at lines 58-60. Place it as a sibling top-level key after `complex`.

- **`plugins/orchestrate/templates/routing.json`** — Add `"continuationBudget": 2` as a top-level key after the `complex` block (keep valid JSON; trailing comma rules).

- **`plugins/orchestrate/orchestrate-mcp/src/index.ts`** — Update the `resolve_routing` registration `.describe()` text (lines 383-389) and the `handleResolveRouting` summary `text` (lines 360-372) to mention the resolved `continuationBudget` (e.g. append `, continuation budget ${result.continuationBudget}` to the ok-path text). Update the `validate_envelope` registration description (lines 657-665) to note the implementer envelope's `remainingWork` handoff field for `incomplete`. No new tool — `resolve_routing` (called in §3 step 2) is the existing carrier; no signature change at the registration call sites.

- **`plugins/orchestrate/orchestrate-mcp/test/validate-envelope.test.ts`** — Add implementer cases: (a) `status:"incomplete"` + non-empty `remainingWork` → `valid`; (b) `status:"incomplete"` with `remainingWork` absent → `invalid`, `errorCode:"SCHEMA_MISMATCH"`; (c) `status:"incomplete"` + empty/whitespace `remainingWork` → `invalid`; (d) `status:"completed"` WITHOUT `remainingWork` → `valid` (field optional for non-incomplete).

- **`plugins/orchestrate/orchestrate-mcp/test/routing.test.ts`** — Add cases: routing.json WITHOUT `continuationBudget` resolves `status:"ok"` with `continuationBudget === 2` (default applied); routing.json WITH `"continuationBudget": 5` resolves `continuationBudget === 5`; a negative/non-integer budget makes `routingConfigSchema` reject → `CONFIG_INVALID`. Update `VALID_CONFIG` (test lines 13-34, typed `RoutingConfig`) — because `.default()` makes the parsed type carry `continuationBudget`, add `continuationBudget: 2` to the literal (or confirm the input-type inference still type-checks; adjust if `tsc` complains).

- **`plugins/orchestrate/orchestrate-mcp/test/bootstrap-config.test.ts`** — The existing parity assertion (line 74: `routingConfigSchema.parse(readConfig(dir, "routing.json"))`) must still pass; add an assertion that the written `routing.json` carries `continuationBudget === 2`, mirroring `DEFAULT_ROUTING_CONFIG`.

- **`plugins/orchestrate/agents/implementer-standard.md` AND `plugins/orchestrate/agents/implementer-deep.md`** (identical envelope sections — edit BOTH): in the envelope field list, update the `"incomplete"` status bullet to instruct emitting a `remainingWork` string (what is done, what is left, how to resume in the same worktree), add a **`remainingWork`** field entry to the field list ("present and non-empty ONLY for `incomplete`; the handoff the orchestrator forwards to your continuation in the same worktree"), and note that an `incomplete` envelope lacking `remainingWork` is rejected as invalid (FAILED). Add a second example envelope showing `status:"incomplete"` with `filesChanged`, `verification`, `notes`, and a populated `remainingWork`. Do not alter `maxTurns`, `tools`, or `model` frontmatter.

- **`plugins/orchestrate/skills/orchestrate/SKILL.md`** — Two edits:
  - **§3 step 4** (`incomplete` bullet, lines 502-506): replace the immediate-FAIL text with the bounded continue-in-place loop (see Steps below). The loop reads the budget from the `resolve_routing` result captured in step 2.
  - **Failure handling** (lines 687-694): rewrite the "`incomplete` is a distinct failure flavor" paragraph so the slice FAILs from `incomplete` ONLY when the continuation budget is exhausted or the no-progress guard trips — not on the first `incomplete`. Specify the label mapping for the two terminal causes: budget-exhausted (resumable) → `needs-info` (matches today's incomplete→needs-info, lines 700-702); no-progress → `needs-triage`. Keep the worktree-preservation rule.

- **`plugins/orchestrate/skills/orchestrate/references/run-state.md`** — Add one sentence near the slice-states section (lines 118-134) clarifying that an `incomplete` implementer envelope drives an in-session continuation loop and does NOT introduce a new slice `state` — the `state` enum stays `pending`/`in-progress`/`passed`/`failed`/`skipped`, and continuation counter/fingerprint are within-session loop state, never persisted to `run-state.json`.

- **`plugins/orchestrate/.claude-plugin/plugin.json`** — version `1.2.0` → `1.3.0`.
- **`.claude-plugin/marketplace.json`** — orchestrate entry version (line 36) `1.2.0` → `1.3.0`; top-level `version` (line 4) `1.6.0` → `1.7.0` (magnitude-mirrored: minor bump mirrors minor). Cursor marketplace (`.cursor-plugin/marketplace.json`) is untouched.
- **`plugins/orchestrate/orchestrate-mcp/dist/**`** — rebuilt + committed (dist/ is committed; vitest tests `src/`, so green tests ≠ shipped fix).

---

**Steps**

1. Edit `validate-envelope.ts`: add optional `remainingWork` to `implementerEnvelopeSchema` + the `incomplete ⇒ remainingWork non-empty` `.superRefine`.
2. Edit `routing.ts`: add optional `continuationBudget` (`.int().min(0).default(2)`) to `routingConfigSchema`; echo it in `resolveRoutingOutputSchema`; populate it on the ok-path of `resolveRoutingFromConfig`.
3. Edit `bootstrap-config.ts` `DEFAULT_ROUTING_CONFIG` and `templates/routing.json`: add `continuationBudget: 2` top-level. Keep them byte-equivalent (modulo formatting).
4. Edit `index.ts`: update `resolve_routing` `.describe()` + handler summary text; update `validate_envelope` `.describe()`.
5. Edit BOTH implementer subagent defs: `remainingWork` field, updated `incomplete` bullet, second (incomplete) example envelope.
6. Edit `SKILL.md` §3 step 4 to the continuation loop and rewrite the Failure-handling `incomplete` paragraph. The loop the implementer follows (state it precisely in the skill):
   - On a `valid` implementer envelope with `status:"incomplete"`: read `budget = routing.continuationBudget` from the step-2 `resolve_routing` result (when `resolve_routing` returned `CONFIG_NOT_FOUND`, the run fell back to no routing → use budget **0**, i.e. legacy immediate-FAIL). Initialize an in-session `continuationsUsed = 0` and capture a **content-level fingerprint** of the worktree's uncommitted state: hash of `git -C <worktreePath> diff HEAD` concatenated with the contents of untracked files (`git -C <worktreePath> ls-files --others --exclude-standard`). Filename-set comparison is insufficient — the same file may be rewritten with real progress or returned byte-identical.
   - While `continuationsUsed < budget`: re-spawn `orchestrate:implementer-<effort>` in the SAME worktree (same routing/model/effort) with a continuation prompt = the issue, the worktree path, the PRIOR envelope's `remainingWork`, the standard verify/no-git reminders, and an explicit "partial work is already in the worktree — continue it, do not restart." Validate the returned text (`validate_envelope`, role `implementer`).
     - `completed` → proceed to step 4a (`verify_changeset`) as normal. Loop done.
     - `blocked`, or `invalid`/`missing` envelope → slice FAILS (record the precise cause). Loop done.
     - `incomplete` again → recompute the fingerprint. If it equals the prior fingerprint → **no-progress guard trips**: slice FAILS, `failureReason` names the no-progress stall, label `needs-triage`. Otherwise increment `continuationsUsed`, update the stored fingerprint and `remainingWork`, and loop.
   - When `continuationsUsed === budget` and the last envelope is still `incomplete`: slice FAILS with a budget-exhausted `failureReason` ("implementer reported `incomplete` after exhausting the continuation budget of N; partial work preserved in the worktree for resumption"), label `needs-info` (resumable).
   - The counter and fingerprint are loop-local; nothing is persisted to `run-state.json`. A mid-continuation context handoff/resume discards the in-progress slice and rebuilds its worktree (§1), restarting the slice clean — this is intentional and outside #234's scope.
7. Edit `run-state.md`: add the one-sentence clarification (no new slice state; loop state not persisted).
8. Edit the test files (`validate-envelope.test.ts`, `routing.test.ts`, `bootstrap-config.test.ts`) per Target files. Route NEW test authoring through `/tdd` (red → green).
9. Bump versions: `plugin.json` 1.3.0; marketplace orchestrate entry 1.3.0; marketplace top-level 1.7.0.
10. Rebuild + commit dist: `cd plugins/orchestrate/orchestrate-mcp && npm run build`, then stage the changed `dist/` files.

---

**Verification** (Bash runs from `plugins/orchestrate/orchestrate-mcp/`)

- `cd plugins/orchestrate/orchestrate-mcp && npm test` — green = all suites pass, including the new `validate-envelope.test.ts` cases (incomplete+remainingWork=valid; incomplete-without=invalid+SCHEMA_MISMATCH; completed-without=valid) and the new `routing.test.ts` cases (default budget 2; explicit budget honored; negative/non-int rejected) and the `bootstrap-config.test.ts` parity assertion.
- `cd plugins/orchestrate/orchestrate-mcp && npx tsc --noEmit` (or the repo's `run typecheck`) — green = no type errors (verifies `VALID_CONFIG` and the new optional fields type-check).
- `cd plugins/orchestrate/orchestrate-mcp && npm run build` — green = `dist/` regenerates with no error; `git status --porcelain dist/` then shows the rebuilt artifacts staged. (Green vitest tests run `src/`, NOT the bundle — the build+commit is what ships the fix.)
- `node -e "const j=require('./plugins/orchestrate/templates/routing.json'); if(j.continuationBudget!==2) throw new Error('template budget missing')"` (run from repo root) — exits 0 = template carries the key.
- Manual: confirm `plugin.json`=1.3.0, marketplace orchestrate entry=1.3.0, marketplace top-level=1.7.0.

---

**Acceptance criteria**

- `implementerEnvelopeSchema` accepts an optional `remainingWork` string; an `incomplete` envelope WITHOUT a non-empty `remainingWork` is rejected `invalid`/`SCHEMA_MISMATCH`; a `completed`/`blocked` envelope without it is `valid`.
- `routingConfigSchema` accepts an optional top-level `continuationBudget` (int ≥ 0, default 2); `resolve_routing` echoes the resolved budget; an absent key yields 2; a negative/non-integer value yields `CONFIG_INVALID`.
- `templates/routing.json` and `bootstrap-config.ts` `DEFAULT_ROUTING_CONFIG` both carry `continuationBudget: 2` and stay byte-equivalent (parity test passes).
- SKILL §3 step 4 describes the continue-in-place loop (re-spawn in same worktree with `remainingWork`, bounded by budget, content-level no-progress guard); Failure-handling FAILs an `incomplete` slice ONLY on budget-exhaustion (→ `needs-info`) or no-progress (→ `needs-triage`).
- Both implementer subagent defs document `remainingWork` and show an `incomplete` example envelope.
- The slice `state` enum is unchanged; no continuation state is persisted to `run-state.json`.
- `npm test` green; `npm run build` run and `dist/` committed.
- **Docs-in-sync (same unit):**
  - SKILL.md — §3 step 4 + Failure-handling paragraph (+ label mapping).
  - References — `run-state.md` (no-new-state + loop-state-not-persisted sentence).
  - MCP `.describe()` + index.ts — `validate-envelope.ts` `remainingWork` describe; `routing.ts` `continuationBudget` describe + output echo; `index.ts` `resolve_routing` and `validate_envelope` registration descriptions + handler summary text.
  - CONTEXT.md — ALREADY updated (lines 188-189, 232); verify-only, no edit.
  - docs/adr — none required (no new ADR; decision lives in the grill ledger).
  - Templates — `templates/routing.json` `continuationBudget`.
  - Subagent defs — `implementer-standard.md` + `implementer-deep.md`.
  - Marketplace version cascade — `plugin.json` 1.3.0, marketplace orchestrate entry 1.3.0, marketplace top-level 1.7.0 (Cursor marketplace untouched).
  - dist/ rebuilt + committed.

---

**Risks / shared files** (name the overlaps; `dependsOn` stays empty — all orthogonal)

- **`validate-envelope.ts` `implementerEnvelopeSchema` + `validate-envelope.test.ts` ↔ #239** (adds `rootCause` to implementer + reviewer envelopes). Both edit the same schema object and test file — whoever lands second resolves a merge; the two fields are independent.
- **`routing.ts` `routingConfigSchema` + `templates/routing.json` + `bootstrap-config.ts` `DEFAULT_ROUTING_CONFIG` + `routing.test.ts` ↔ #231-P2.3** (adds optional top-level `intraWaveConcurrency` via the SAME seam). High collision probability — both add an optional top-level key to the same object in four files. Coordinate so both keys coexist; expect a merge if landed independently.
- **`SKILL.md` §3 step 4 + implementer defs + `index.ts` ↔ #231-P2.2** (grants `run_install`, adds a self-install step in §3 step 4 and the implementer `tools:` frontmatter). Same step and same files; resolve textual conflicts in §3 step 4.
- **dist/ is committed** — any concurrent src/ change forces a `dist/` rebuild conflict; rebuild after merging, never hand-edit `dist/`.
- Ordering caution: none required (no functional dependency), but if landed alongside #231-P2.3, share one `routingConfigSchema` edit pass to avoid clobbering the other's optional key.

---

# Appendix A — executable workflow script

Verbatim copy of [`prd241-afk-implementation.workflow.js`](./prd241-afk-implementation.workflow.js). This is the engine §3–§9 describe; run it per §10.

```js
// =============================================================================
// PRD #241 — orchestrate plugin hardening v2 — AFK implementation engine
// =============================================================================
//
// Engine: a single harness dynamic workflow (NOT the /orchestrate plugin — that
// plugin is the artifact being fixed; its capability tools no-op in worktrees
// until #237 lands, so we verify with Bash instead). Every git/gh/build/test
// action lives inside an agent() prompt because the workflow script itself has
// no shell/fs.
//
// Topology:
//   - One umbrella branch  orchestrate/umbrella-prd241  branched off development.
//   - One slice branch + worktree per sub-item, branched from the umbrella TIP
//     at the moment its turn starts, squash-merged back into the umbrella.
//   - Strictly SEQUENTIAL in the conflict-free wave order (parallelism ≈ 1:
//     18 of 19 items touch SKILL.md, so the schedule is effectively serial —
//     this is the user's explicit "sequential to remove parallelism conflicts").
//
// AFK policy:
//   - Slice PRs auto-merge into the umbrella; post-merge validation + fixer +
//     conflict-resolver keep the umbrella green.
//   - The FINAL umbrella→development PR is opened and the run STOPS. It is NEVER
//     auto-merged. A human reviews the one combined diff and merges it.
//   - `Closes #N` in that final PR body auto-closes the 12 child issues when the
//     human approves+merges (the #228 mechanism, which works today).
//
// Run from the repo root:  Workflow({scriptPath: "<this file>"})
// =============================================================================

export const meta = {
  name: 'prd241-afk-implementation',
  description: 'AFK-implement all of PRD #241 in worktrees, auto-merge slices into one umbrella, hold the final umbrella→development PR for human approval',
  phases: [
    { title: 'Setup', detail: 'create the umbrella branch off development' },
    { title: 'Slices', detail: 'sequential per-item: implement → verify → review → fix → merge → re-validate' },
    { title: 'Finalize', detail: 'consolidated version cascade + open held umbrella→development PR' },
  ],
}

// ── Constants ────────────────────────────────────────────────────────────────
const BASE = 'development'
const UMBRELLA = 'orchestrate/umbrella-prd241'
const HANDOFF = 'docs/handoffs/HANDOFF_ORCHESTRATE_PRD241_IMPLEMENTATION.md'
const MCP = 'plugins/orchestrate/orchestrate-mcp'

// Conflict-free execution order (flattened from the 18-wave contention schedule).
// Each entry: sub-item id, the GitHub issue it belongs to, and whether it touches
// orchestrate-mcp/src/ (→ dist/ must be rebuilt + committed).
// `deps` = sub-item ids whose CODE must already be MERGED for this slice to be
// correct (authoritative from the ledger — not the agent-returned dependsOn,
// which was occasionally incomplete). A slice whose dep failed/skipped is itself
// skipped (it would otherwise branch from an umbrella missing the dependency).
const ORDER = [
  { id: '#237',      issue: 237, src: true,  deps: [] },
  { id: '#236',      issue: 236, src: true,  deps: [] },
  { id: '#231-P2.4', issue: 231, src: false, deps: [] },
  { id: '#230-P1.1', issue: 230, src: true,  deps: [] },
  { id: '#230-P1.2', issue: 230, src: false, deps: ['#236', '#230-P1.1'] },
  { id: '#239',      issue: 239, src: true,  deps: [] },
  { id: '#232-A.1',  issue: 232, src: false, deps: ['#230-P1.2'] },
  { id: '#228',      issue: 228, src: false, deps: [] },
  { id: '#231-P2.1', issue: 231, src: false, deps: [] },
  { id: '#230-P1.3', issue: 230, src: false, deps: ['#237'] },
  { id: '#233',      issue: 233, src: true,  deps: [] },
  { id: '#231-P2.3', issue: 231, src: true,  deps: [] },
  { id: '#231-P2.5', issue: 231, src: true,  deps: ['#237'] },
  { id: '#238',      issue: 238, src: true,  deps: [] },
  { id: '#240',      issue: 240, src: true,  deps: [] },
  { id: '#232-A.2',  issue: 232, src: true,  deps: ['#239', '#240'] },
  { id: '#235',      issue: 235, src: true,  deps: ['#237', '#230-P1.3'] },
  { id: '#231-P2.2', issue: 231, src: true,  deps: ['#237'] },
  { id: '#234',      issue: 234, src: true,  deps: ['#230-P1.2'] },
]

// The 12 child issues the final PR closes when the human merges it.
const CHILD_ISSUES = [228, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240]

const SLICE_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['merged', 'failed'] },
    sliceBranch: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    verification: { type: 'string', description: 'the Bash commands run and their green/red outcome, quoted' },
    notes: { type: 'string' },
    rootCause: { type: 'string', description: 'on failure: verified|hypothesis + claim + evidence (per #239)' },
  },
  required: ['status', 'sliceBranch', 'filesChanged', 'verification'],
}

// ── Agent prompts ────────────────────────────────────────────────────────────
function implementerPrompt(item) {
  return `You are the IMPLEMENTER for PRD #241 sub-item ${item.id}, inside an AFK run that integrates every slice into the umbrella branch \`${UMBRELLA}\`.

1. Read this item's full spec: open ${HANDOFF} and find the section headed "${item.id}". Implement EXACTLY what it specifies — target files, steps, and acceptance criteria (including the docs-in-sync surfaces). Do not exceed the spec's scope.
   SCOPE CARVE-OUT (overrides the spec): do NOT bump \`plugins/orchestrate/.claude-plugin/plugin.json\` or \`.claude-plugin/marketplace.json\` versions, and do NOT add a \`Closes #N\` trailer. The version cascade is consolidated into ONE final bump owned by the finalizer (handoff §8), and issue-closing happens via the final umbrella PR (§7). Skip any version-bump / issue-close step a spec lists.
2. Create an isolated git worktree for this slice, branched from the CURRENT TIP of \`${UMBRELLA}\`:
   - First ensure the umbrella tip is current: \`git fetch origin ${UMBRELLA}:${UMBRELLA}\` (the umbrella already exists; the Setup phase created it).
   - \`git worktree add -b orchestrate/prd241-${item.id.replace(/[#.]/g, '').toLowerCase()} <worktreePath> ${UMBRELLA}\`
3. Make the code/doc changes in that worktree.
4. Prepare deps + verify with BASH (NOT the plugin's MCP capability tools — they may no-op pre-#237):
   - If the change touches dependencies, install (pnpm install / npm install per the repo's lockfile).
   - \`cd ${MCP} && npm run build && npm test\` (and typecheck/lint if configured). ${item.src ? 'This item touches src/ → after a GREEN build, the regenerated dist/ is part of the slice; stage it.' : 'This item is doc/config-only → no dist/ rebuild.'}
5. Capture the actual command output — a green claim must map to a real run this turn.
6. Commit on the slice branch with message \`${item.id}: <summary>\` (no \`Closes #${item.issue}\` trailer — closing happens via the final umbrella PR), then PUSH the slice branch: \`git push -u origin <sliceBranch>\` (the integrator needs it on the remote to open the PR).
7. Return the slice branch name, the changed-file list, and the quoted verification outcome. If you cannot finish or verification stays red, return status=failed with a structured rootCause (verified|hypothesis + evidence), leaving the worktree on disk.`
}

function reviewerPrompt(item, impl) {
  return `You are the REVIEWER for PRD #241 sub-item ${item.id}. The implementer reported: ${JSON.stringify(impl).slice(0, 1200)}.

Read the spec section "${item.id}" in ${HANDOFF} and the slice diff (\`git diff ${UMBRELLA}...${impl.sliceBranch}\` in a checkout of the slice branch). Verify: (a) every acceptance criterion is met, including the docs-in-sync surfaces — EXCEPT the version cascade and \`Closes #N\`, which are deferred to the finalizer (§7–§8): do NOT fail the slice for a missing version bump or close trailer, and DO flag it as out-of-scope if the implementer added one; (b) the change is in-scope (no edits beyond the spec); (c) re-run \`cd ${MCP} && npm run build && npm test\` via Bash and confirm green; (d) for src/ items, dist/ was rebuilt and staged. Return status=merged only if all hold; otherwise status=failed with the specific gaps in notes.`
}

function fixerPrompt(item, problem) {
  return `You are the FIXER for PRD #241 sub-item ${item.id}. A prior step failed: ${problem.slice(0, 1500)}.

Work in the slice worktree for ${item.id}. Repair the specific failure (review gap, red build/test, or missing dist/ rebuild) WITHOUT expanding scope beyond the spec ("${item.id}" in ${HANDOFF}). Re-run \`cd ${MCP} && npm run build && npm test\` via Bash until green, re-stage dist/ if src/ changed, commit on the slice branch, and PUSH it (\`git push\`) so the integrator's PR includes the fix. Return the quoted green verification, or status=failed with a structured rootCause if unfixable.`
}

function integratePrompt(item, impl) {
  return `You are the INTEGRATOR for PRD #241 sub-item ${item.id}. The slice branch \`${impl.sliceBranch}\` passed review.

1. Open a slice PR from \`${impl.sliceBranch}\` into \`${UMBRELLA}\` and squash-merge it (this is an INTERNAL umbrella merge, auto-merge is fine here — only the FINAL umbrella→development PR is human-gated). Use \`gh pr create --base ${UMBRELLA} --head ${impl.sliceBranch} ...\` then \`gh pr merge --squash --delete-branch\`.
2. Sync the LOCAL umbrella to the just-merged remote state: \`git checkout ${UMBRELLA} && git pull origin ${UMBRELLA}\`.
3. POST-MERGE VALIDATION on the umbrella: run \`cd ${MCP} && npm run build && npm test\` via Bash. ${item.src ? `Then rebuild and COMMIT dist/ on the umbrella, and PUSH: \`git add -A && git commit -m "${item.id}: rebuild dist" && git push origin ${UMBRELLA}\`. The push is mandatory — the next slice does \`git fetch origin ${UMBRELLA}:${UMBRELLA}\`, so an unpushed dist rebuild (or any local umbrella commit) would be silently lost.` : `If any local umbrella commit was made, PUSH it: \`git push origin ${UMBRELLA}\` (the next slice fetches the umbrella tip — unpushed commits are lost).`}
4. ON MERGE CONFLICT: stop and report status=failed with the conflicting files (the orchestrator spawns a conflict-resolver). ON POST-MERGE VALIDATION RED (an integration break that was green in the worktree): report status=failed with the failing output (the orchestrator spawns a fixer on the umbrella).
5. Remove the slice worktree after a clean merge. Return status=merged with the quoted post-merge validation outcome.`
}

function conflictResolverPrompt(item, problem) {
  return `You are the UMBRELLA-RECOVERY agent for PRD #241 sub-item ${item.id}. Integrating it into \`${UMBRELLA}\` failed: ${problem.slice(0, 1500)}.

Diagnose which case it is and fix it on the umbrella:
- MERGE CONFLICT → resolve to a correct merged state honoring BOTH the prior umbrella content and this slice's spec ("${item.id}" in ${HANDOFF}).
- POST-MERGE INTEGRATION BREAK (the slice was green in its worktree but the umbrella is now red) → repair on the umbrella without scope creep beyond the spec.

Then: re-run \`cd ${MCP} && npm run build && npm test\` via Bash until green; rebuild + stage dist/ if src/ changed; commit the resolved/fixed state; and PUSH: \`git push origin ${UMBRELLA}\` (mandatory — the next slice fetches the umbrella tip; an unpushed fix is silently lost). Return the quoted green verification.`
}

// ── Slice cycle (sequential) ─────────────────────────────────────────────────
async function runSlice(item) {
  const impl = await agent(implementerPrompt(item), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `impl:${item.id}` })
  if (!impl || impl.status === 'failed') {
    log(`SLICE ${item.id}: implementer FAILED — ${impl ? impl.rootCause || impl.notes : 'null'}`)
    return { item, status: 'failed', stage: 'implement', detail: impl }
  }

  let review = await agent(reviewerPrompt(item, impl), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `review:${item.id}` })
  // bounded fixer loop on review failure (max 2)
  for (let attempt = 0; attempt < 2 && review && review.status === 'failed'; attempt++) {
    log(`SLICE ${item.id}: review failed (attempt ${attempt + 1}) — invoking fixer`)
    const fix = await agent(fixerPrompt(item, review.notes || review.verification || ''), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `fix:${item.id}:${attempt + 1}` })
    if (!fix || fix.status === 'failed') { return { item, status: 'failed', stage: 'fix', detail: fix } }
    review = await agent(reviewerPrompt(item, fix), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `review:${item.id}:r${attempt + 1}` })
  }
  if (!review || review.status === 'failed') { return { item, status: 'failed', stage: 'review', detail: review } }

  // integrate into umbrella, with conflict-resolver + post-merge fixer as safety nets
  let integ = await agent(integratePrompt(item, impl), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `merge:${item.id}` })
  for (let attempt = 0; attempt < 2 && integ && integ.status === 'failed'; attempt++) {
    log(`SLICE ${item.id}: integration failed (attempt ${attempt + 1}) — resolving`)
    await agent(conflictResolverPrompt(item, integ.notes || ''), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `conflict:${item.id}:${attempt + 1}` })
    integ = await agent(integratePrompt(item, impl), { schema: SLICE_RESULT_SCHEMA, phase: 'Slices', label: `merge:${item.id}:r${attempt + 1}` })
  }
  if (!integ || integ.status === 'failed') { return { item, status: 'failed', stage: 'integrate', detail: integ } }

  log(`SLICE ${item.id}: MERGED into ${UMBRELLA} ✓`)
  return { item, status: 'merged', verification: integ.verification }
}

// ── Phase 1: Setup ───────────────────────────────────────────────────────────
phase('Setup')
const setup = await agent(
  `Set up the AFK umbrella for PRD #241. Using Bash + gh from the repo root: fetch origin, then create the umbrella branch \`${UMBRELLA}\` from the current tip of \`origin/${BASE}\` and push it (\`git fetch origin ${BASE} && git branch ${UMBRELLA} origin/${BASE} && git push -u origin ${UMBRELLA}\`). Do NOT modify any file. Confirm the umbrella exists on the remote (\`git ls-remote --heads origin ${UMBRELLA}\`) and report its base SHA.`,
  { phase: 'Setup', label: 'umbrella-setup' }
)
log(`Umbrella ready: ${String(setup).slice(0, 200)}`)

// ── Phase 2: Slices (strictly sequential, conflict-free order) ───────────────
phase('Slices')
const results = []
const bad = new Set() // ids that failed OR were skipped — their dependents must skip too
for (const item of ORDER) {
  // Skip a slice whose dependency did not merge: it would branch from an umbrella
  // missing the dependency's code and could merge silently-wrong work unattended
  // (mirrors SKILL.md §2 step 2 — a blocker that did not reach `passed`).
  const unmetDeps = (item.deps || []).filter((d) => bad.has(d))
  if (unmetDeps.length > 0) {
    log(`⤼ ${item.id} SKIPPED — unmet dependency: ${unmetDeps.join(', ')}`)
    results.push({ item, status: 'skipped', reason: `unmet dependency: ${unmetDeps.join(', ')}` })
    bad.add(item.id)
    continue
  }
  const r = await runSlice(item)
  results.push(r)
  if (r.status === 'failed') {
    // AFK policy: a failed slice does not abort the run; it is left preserved and
    // reported, and its dependents are skipped above. Surfaced in the final PR.
    bad.add(item.id)
    log(`⚠ ${item.id} FAILED at ${r.stage}; preserved. Dependents will be skipped.`)
  }
}
const merged = results.filter((r) => r.status === 'merged').map((r) => r.item.id)
const failed = results.filter((r) => r.status === 'failed').map((r) => `${r.item.id}@${r.stage}`)
const skipped = results.filter((r) => r.status === 'skipped').map((r) => `${r.item.id}(${r.reason})`)
log(`Slices done: ${merged.length} merged, ${failed.length} failed, ${skipped.length} skipped`)

// ── Phase 3: Finalize ────────────────────────────────────────────────────────
// Consolidated version cascade (one bump for the whole PRD, not per-slice) + the
// held final PR. Stops without merging to development.
phase('Finalize')
// Only auto-close an issue whose EVERY sub-item merged. An issue with any
// failed/skipped sub-item is partially implemented — it must stay OPEN for the
// remaining work, so it is excluded from the final PR's `Closes` list.
const fullyDone = CHILD_ISSUES.filter((n) => {
  const subs = ORDER.filter((it) => it.issue === n)
  return subs.length > 0 && subs.every((it) => merged.includes(it.id))
})
const partial = CHILD_ISSUES.filter((n) => !fullyDone.includes(n))
const closes = fullyDone.map((n) => `Closes #${n}`).join('\n')
const finalize = await agent(
  `You are FINALIZING the PRD #241 AFK run on the umbrella \`${UMBRELLA}\`.

1. Consolidated version cascade (ONE bump for the whole PRD — the per-slice specs intentionally deferred this to here to avoid 15 serialized version bumps): on the umbrella, bump \`plugins/orchestrate/.claude-plugin/plugin.json\` and the root \`.claude-plugin/marketplace.json\` entry + top-level version (mirror the bump magnitude; a feature release → minor bump unless a breaking change shipped). The Cursor marketplace entry only changes if its shape changed. Rebuild \`${MCP}\` dist/ once more if any src/ landed, commit, and \`git push origin ${UMBRELLA}\`.
2. Open the FINAL pull request from \`${UMBRELLA}\` into \`${BASE}\` and DO NOT MERGE IT. The body MUST contain these auto-close trailers verbatim (only the fully-implemented issues — do NOT close any other issue):
${closes || '(none — no issue was fully completed; the final PR closes nothing)'}
   ${partial.length ? `Do NOT add Closes for these PARTIALLY-implemented issues (they stay open for the remaining work): ${partial.map((n) => '#' + n).join(', ')}.` : ''}
   Then a summary: merged sub-items (${merged.join(', ') || 'none'})${failed.length ? `; FAILED + preserved for triage (${failed.join(', ')})` : ''}${skipped.length ? `; SKIPPED on unmet deps (${skipped.join(', ')})` : ''}; and a one-line note that the reviewer should expect ONE large combined diff (the AFK safety valve).
3. Report the final PR URL. STOP — never merge it. The human reviews and merges; that merge closes the fully-done child issues and lands everything on ${BASE}.`,
  { phase: 'Finalize', label: 'finalize-and-hold-pr' }
)

return { merged, failed, skipped, closedOnMerge: fullyDone, leftOpen: partial, finalPR: String(finalize) }

```
