# Pre-flight pass — the `/orchestrate preflight <PRD#>` mode

These are the procedural mechanics of the **pre-flight pass**, the third mode
dispatched from spine section 0 (Modes). The pre-flight pass runs a run's
one-time setup — `references/run-lifecycle.md` "Fresh run" **steps 1–6** — and
then **stops before the wave loop** (spine section 2), leaving an `in-progress`
run whose slices are all `pending`, `completedWaves: 0`, and whose first
`run-state.json` checkpoint is `validate_run_state`-valid. It then **probes the
capability gate** (§3), executing the project's configured verbs once in a
throwaway dependency-free checkout, so the operator reviews not only the
partition and wave plan at the checkpoint but what the gate will actually
verify; a later `/orchestrate <PRD#>` in a fresh session resumes the same run
and runs the waves. Its value is this
**staged-inspection gate**, not token relocation (post-#293 the bootstrap
residue it shifts is ~2% of a ~1M execution window — see ADR-0014).

The pass is an **orchestrator mode**, never a privileged subagent: the
orchestrator keeps doing every `gh` and `git` operation, exactly as for a normal
run (ADR-0009, ADR-0014). Pre-flight only changes *when* the setup happens (its
own pass) and *where it stops* (before the wave loop) — not *who* may touch the
tracker and remotes.

## 1. Detect-and-stop guard (section-0 dispatch, before section 1)

The guard is **carried** by the section-0 dispatch bullet and runs **before**
section 1 ever executes. It is evaluated here, in the pre-flight dispatch, so the
pass can never fall through into section 1's run-discovery — where an
exactly-one-match would **resume** an existing run straight into the wave loop,
the very duplication this guard prevents.

Scan **every** `.orchestrate/runs/*/run-state.json` for any run whose `runId`
starts `prd<N>-` for the invoked `<N>`. Two precision points:

- **Same prefix key as section 1's run-discovery, different status predicate.**
  The `prd<N>-` prefix is the same match key section 1 parses, but this scan is
  **status-agnostic** — it matches a run in **any** status, `in-progress`
  **or** `completed`. Section 1's run-discovery only scans `in-progress` runs;
  do **not** copy that filter here. A concluded-but-uncleaned run (still on disk
  because `/orchestrate clean` has not swept it) must still block a re-bootstrap,
  so it counts as a match. Mirroring section 1's `in-progress`-only filter would
  let a completed-uncleaned run fall through and mint a duplicate second run.
- **The trailing dash is load-bearing.** Match the literal `prd<N>-` prefix
  including the dash: `prd2-` must not match `prd29-`.

Act on the count:

- **Any match (one or more, any status)** — **detect-and-stop**. Report that
  run's `runId` and `status` and **stop**. Do not re-derive the partition, do
  not enter the wave loop, do not create a duplicate run. (A concluded-but-
  uncleaned run blocks a re-bootstrap until `/orchestrate clean` removes it.)
- **Zero matches** — proceed into step 2 below (the fresh-run setup).

## 2. Setup — fresh-run steps 1–6, by reference, with two overrides

Run `references/run-lifecycle.md` **"Fresh run" steps 1–6 exactly as written** —
config bootstrap, integration-base confirmation and `runId` mint (step 1),
backlog fetch (step 2), parse + partition (step 3), `plan_waves` (step 4),
umbrella branch create-and-push (step 5), and the first `run-state.json`
checkpoint with its immediate `validate_run_state` (step 6). Do **not**
re-narrate those steps here; follow them in `run-lifecycle.md`.

Two — and only two — things differ from a normal fresh run, both at the
fresh-run step-6 checkpoint write:

1. **Force `driverSessionId: null`.** The pre-flight session does **not** drive
   the run — it only stages the checkpoint and stops. Write `driverSessionId` as
   `null` regardless of `$ORCHESTRATE_SESSION_ID`; the **execution** session sets
   the real id when it resumes (section 1's exactly-one-match resume refreshes
   `driverSessionId` from its own `$ORCHESTRATE_SESSION_ID`). This `null` is
   **by design**, not a degradation — do **not** emit the fresh-run step-6
   "no automatic context-handoff, resume manually" operator notice; the
   pre-flight handoff doc (§5) *is* the resume instruction, and the resuming
   driver session restores the watchdog binding.
2. **Confirm pending slices OMIT `subState`.** Every slice is written
   `state: "pending"` with **no** `subState` key — exactly as fresh-run step 6
   already produces (a pending slice never carries a `subState`). This is a
   confirm-it's-absent check, not an added field: **never** write
   `"subState": null`. The canonical run-state schema declares `subState`
   optional but **not** nullable, so an explicit `null` is **rejected** by
   `validate_run_state`; omission is the only valid pending shape.

The resulting checkpoint is **byte-identical** to a normal fresh-run step-6
checkpoint **except** `driverSessionId: null`. That is precisely why the
**unchanged** section-1 exactly-one-match resume path just resumes it with no new
semantics — its `status: "in-progress"`, all-`pending` slices, `completedWaves:
0`, and persisted `waves`/`slices` are the run's fixed scope, and resume only
refreshes `driverSessionId` and enters wave 0. **Do not modify that resume
path** — pre-flight depends on it being unchanged.

## 3. Capability probe — prove the gate before the run commits to it

The staged-inspection gate is the pass's whole value, and the one thing that
decides whether every slice merges **verified** or merely **green** is whether
the project's configured capability commands actually run. Fresh-run step 1's
`bootstrap_config` reports which verbs are *configured*; only executing them
reports whether they *work*. This probe supplies that second half, and it
belongs here because this is the last moment before the run commits — and
because the evidence it needs is exactly what a slice worktree is: a checkout of
tracked files only, with **no installed dependencies**. A command that works in
the developer's main checkout can still fail there.

**Run the probe after fresh-run step 6's checkpoint is written and
`validate_run_state` returns `valid`, and before the handoff doc (§5).** That
placement is
structural, not incidental: the checkpoint is already on disk, so **a failing
probe can never prevent it** — the probe reports, the operator decides whether
to resume — and the handoff doc written next can carry the result. The probe is
**not** a third divergence from fresh-run steps 1–6 (section 2's "two — and only
two — things differ" stands unchanged); it is a pre-flight-only step that runs
after those steps have completed.

**Keep this distinct from the `falseGreenRisk` stop (they pull in opposite
directions on purpose).** `bootstrap_config`'s `falseGreenRisk` — both `tests`
and `build` unconfigured — **retains** its "report it and stop BEFORE planning
the backlog" behaviour from `references/prerequisites.md`. Such a run never
reaches this probe at all, and nothing here weakens that stop; re-enabling the
false-green it prevents is exactly the failure it exists to catch. The probe
answers the *different* question — of the verbs that **are** configured, which
ones actually execute — and a probe failure is **non-blocking**.

### 3.1 Create the probe checkout

```
git worktree add --detach <repo-parent>/.orchestrate-worktrees/<runId>/preflight-probe origin/development
```

- **`--detach` creates no branch.** The stop point's branch invariant (§4)
  is preserved exactly: the umbrella branch stays the only branch this pass
  creates. Creation and teardown are deliberately **orchestrator shell**:
  `create_worktree`'s `branch` field is required and it always runs
  `git worktree add -b <branch>`, so there is no branch-free path through it and
  no lower-level checkout tool exists. Running git here is the orchestrator's
  own remit (ADR-0009, ADR-0014), not a new privilege. Only the **execution**
  below goes through MCP.
- **Name the ref explicitly.** `origin/development` is the integration base
  fresh-run step 1 verified and where every slice worktree starts, so it is
  "the run's starting point" the baseline inventory (3.5) is about. Bare
  `git worktree add --detach <path>` would default to the current HEAD — a
  different tree.
- **It must be a linked worktree — never a clone or a `git archive` extract.**
  The capability tools resolve `.orchestrate/commands.json` by running
  `git rev-parse --git-common-dir` in the exec directory and taking its parent,
  falling back to the exec directory on any git failure. A linked worktree
  resolves to the main repository root and finds the config; a detached copy
  does not. Since `commands.json` may be gitignored (it is in this repository),
  a copy would find no config and **every verb would report `not-configured`** —
  a broken probe indistinguishable from "this project has no tests", precisely
  the mis-report 3.4 forbids.
- The path is deterministic and `runId`-derived so a leaked probe is findable
  (see 3.6). It cannot collide with a slice worktree: those are
  `<repo-parent>/.orchestrate-worktrees/<runId>/slice-<N>`.
- **On failure, report and skip to §5.** `git worktree add` fails if the path
  already exists — the signature of a leaked probe from an earlier crashed pass
  (3.6 has the manual clearance). Report the probe as **not run**, giving the
  git error, and go straight to the handoff doc. The probe is non-blocking, so a
  probe that cannot even be created must not stop the pass either.

### 3.2 Install, then check the checkout is clean — in that order

Call `run_install` with the probe path as `repoPath`. Then, **immediately after
install and before any other verb**, inspect the checkout:

```
git -C <probe-path> status --porcelain
```

The ordering is load-bearing. This check is about what **install** did, and a
build regenerates tracked build output in repositories that commit their bundle
— running `run_build` first would contaminate the verdict and blame install for
a build artifact.

Report `install` as a verb of its own under the same 3.4 classification, with
one mapping to apply first: `run_install`'s success status is **`installed`**,
not `passed` (its enum is `installed | failed | not-configured | error`). Read
`installed` wherever 3.4's table says `passed`; its other three values match the
table as written, and `capabilities.install` supplies the configuredness half. A
`not-configured` install is legitimate for a project whose commands need no
dependency step (Maven and Gradle projects are bootstrapped without one), but a
configured install that **fails** is a broken configuration that invalidates
everything after it: say so explicitly, because every verb below will then fail
for a reason that is not its own.

Report a dirty checkout: `create_worktree` runs the same install in **every**
slice worktree, so an install form that rewrites a lockfile puts an unrelated
change into every slice's diff before the slice has done any work. Corroborate a
`git status` hit against a non-empty `git -C <probe-path> diff` before calling it
dirty — with `core.autocrlf` on, a regenerated file can surface as modified in
`git status` while its diff is empty.

### 3.3 Execute each configured verb

Call `run_typecheck`, `run_build`, `run_tests`, and `run_lint` with the probe
path as `repoPath`. **All four** — not the `run_build` + `run_tests` subset the
slice executor's own **Capability gate** uses. That subset
deliberately narrows a gate on a worktree the reviewer has already seen; the
probe is answering whether verification happens **at all**, so every verb the
project relies on has to be exercised.

### 3.4 Classify each verb — configuredness × outcome

Report the verbs **individually**. Cross `bootstrap_config`'s per-verb
`capabilities` map (configuredness) with the probe's status (outcome) — do not
re-derive either half. The probe status is the capability tools' own enum —
`passed | failed | not-configured | error` — except for `install`, which reports
`installed` for `passed` (3.2):

| `capabilities.<verb>` | probe status | report as |
| --- | --- | --- |
| `true` | `passed` (`installed` for `install`) | **passed** |
| `true` | `failed` | **failed** — its cases feed the baseline inventory (3.5) |
| `true` | `error` *or* `not-configured` | **broken configuration** |
| `false` | `not-configured` | **not configured** — the project genuinely lacks this verb |

**The bottom two rows are the whole point.** A verb whose command cannot execute
in a dependency-free checkout is a **broken configuration**, never a project
lacking that capability — a configured verb coming back `not-configured` or
`error` is the signature. The usual causes: the command's package is not at the
repository root and the argv never targets it, the binary is absent until the
install step has run, or the config is not resolvable from the exec directory.

### 3.5 Capture the baseline failure inventory

For every verb reporting **failed**, extract an identifier for **each failing
case** from the captured output — the **test title (or case name), not the
file**. A file-keyed pattern masks a later, genuinely new failure in the same
file; a title-keyed one does not. These identifiers are what the operator turns
into a `knownFailures` pattern list in `.orchestrate/commands.json`, so a
pre-existing failure is not re-reported by every slice as its own regression.

Read the result defensively. A large `run_tests` result may exceed the harness's
tool-result limit and be **spilled to a file** instead of arriving inline — read
`status`, the captured output, `truncated`, and `knownFailureMatches` from that
file (e.g. with `jq`) rather than assuming an inline result.

Two properties of that result decide where the inventory comes from:

- **`knownFailureMatches` is a shortcut, not the source.** It is present only
  when the command exited non-zero **and** `commands.json` already configures a
  `knownFailures` list. On a first pre-flight of a project being onboarded — the
  probe's whole use case — no patterns exist yet, so the field is **absent** and
  the inventory must be parsed from the captured output. When it *is* present it
  is the better source: it is matched against the untruncated output.
- **The captured output is capped at 64,000 characters per stream**, and a
  verbose test reporter reaches that. When `truncated` is `true` and the
  inventory came from the output, say so in the handoff (3.7) — a partial
  inventory presented as complete becomes a `knownFailures` list that silently
  under-covers, and the slices it fails to cover report a pre-existing failure as
  their own regression.

### 3.6 Tear the probe down

Call `remove_worktree` with the probe path as `worktreePath` and — unlike 3.2
and 3.3, which take the probe path — the **main repository** as `repoPath`: this
call is addressed to the repo that *owns* the worktree, not to the worktree.

Without `force` it refuses on any uncommitted or untracked change and returns
`dirtyFiles` — and the probe will normally have left exactly that: install's
rewritten lockfile and installed dependency directory (3.2), plus regenerated
build output in a repository that commits its bundle (3.3). **Retry once with
`force: true`**: the probe must remove whatever it created.

**Nothing else will ever sweep it.** Both cleanup paths derive their deletion
set from `run-state.json` — the status-gated `clean_runs` sweep and
`reclaim_run`, whose set is every slice's `worktreePath`, the umbrella branch,
every slice branch, and the run directory. The probe is not a slice and appears
nowhere in that state. If the pass crashes between 3.1 and 3.6, the leak is
cleared by hand:

```
git worktree remove --force <repo-parent>/.orchestrate-worktrees/<runId>/preflight-probe
git worktree prune
```

Because the probe carries **no branch**, such a leak can pollute
`git worktree list` only — it can never violate the stop point's branch
invariant.

### 3.7 Report the probe, and keep it out of `run-state.json`

Write the probe result into the handoff doc (§5) and the operator report —
**never** into `run-state.json`. The fresh-run step-6 checkpoint stays byte-identical to a
normal fresh-run checkpoint except `driverSessionId: null` (section 2), and that
identity is exactly what lets the **unchanged** resume path resume it.

Report **loudly** when the probe found nothing that verifies: no verb reported
**passed**, every configured verb broken or failing. That is the same
false-green shape `falseGreenRisk` guards structurally, arriving through a
different door — a gate that exists on paper and verifies nothing in practice.
It is a loud report, not a stop; the operator decides whether to resume.

## 4. Stop point — after the valid checkpoint, before the wave loop

Once fresh-run step 6's `validate_run_state` returns `valid`, run the capability
probe (§3), write the pre-flight handoff doc (§5 below), then **stop**. Do
**not** proceed into spine section 2 (the wave loop). At this stop point exactly
one branch exists — the umbrella branch from fresh-run step 5 — and **no
worktree remains**: **no slice branch and no slice worktree is ever created**
(those are *spine* section 3 per-slice work the pass never reaches), and the
probe's detached checkout is created and removed entirely within §3 of this
file, carrying no branch of its own. The run is left `in-progress`, fully resumable.

## 5. Write the pre-flight handoff doc

Write `.orchestrate/runs/<runId>/preflight-handoff.md` — a human-readable,
per-run handoff that tells the operator how to resume. It carries:

- the **`runId`**;
- the **resume invocation** — `/orchestrate <N>` (for the invoked PRD `<N>`),
  run in a fresh session, which resumes this checkpoint via the unchanged
  exactly-one-match path and enters wave 0;
- the **preconditions** the resume relies on — the umbrella branch exists and is
  pushed, the checkpoint is `validate_run_state`-valid, all slices are `pending`
  with `completedWaves: 0`, and `driverSessionId` is `null` until the execution
  session sets it on resume;
- the **capability probe result** (§3) — this is what tells whoever resumes
  the run what the gate will actually verify:
  - each verb reported individually as **passed**, **failed**, **broken
    configuration**, or **not configured** (the 3.4 classification);
  - whether the install step left the checkout **dirty**, and which paths, since
    every slice would then start with that unrelated change in its diff;
  - the **baseline failure inventory** — one entry per failing *case*, keyed to
    the test title rather than the file, ready to paste into `commands.json` as
    `knownFailures` patterns, and flagged **partial** if it was parsed from
    truncated output (3.5);
  - the explicit note that a **failing probe did not block this checkpoint** —
    the run is resumable either way and the decision to proceed is the
    operator's;
- the **known risks** — e.g. the partition or wave plan may be stale if the
  backlog changed after this pass (a slice's `ready-for-agent` label was added
  or removed since the checkpoint was minted), and the run blocks a second
  `/orchestrate preflight <N>` (detect-and-stop) until it concludes and is
  cleaned.

`preflight-handoff.md` is **distinct** from two existing files: it is **not**
`.orchestrate/handoff.json` (the flat, committed context-window config that tunes
the context-watchdog threshold and successor launcher — shared across runs), and
**not** `.orchestrate/runs/<runId>/context-flag.json` (the per-run
context-handoff *trigger* signal). `preflight-handoff.md` is a per-run,
human-facing resume note written once at the pre-flight stop point.
