# Pre-flight pass — the `/orchestrate preflight <PRD#>` mode

These are the procedural mechanics of the **pre-flight pass**, the third mode
dispatched from spine section 0 (Modes). The pre-flight pass runs a run's
one-time setup — `references/run-lifecycle.md` "Fresh run" **steps 1–6** — and
then **stops before the wave loop** (spine section 2), leaving an `in-progress`
run whose slices are all `pending`, `completedWaves: 0`, and whose first
`run-state.json` checkpoint is `validate_run_state`-valid. The operator reviews
that partition and wave plan at the checkpoint; a later `/orchestrate <PRD#>` in
a fresh session resumes the same run and runs the waves. Its value is this
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

Two — and only two — things differ from a normal fresh run, both at the step-6
checkpoint write:

1. **Force `driverSessionId: null`.** The pre-flight session does **not** drive
   the run — it only stages the checkpoint and stops. Write `driverSessionId` as
   `null` regardless of `$ORCHESTRATE_SESSION_ID`; the **execution** session sets
   the real id when it resumes (section 1's exactly-one-match resume refreshes
   `driverSessionId` from its own `$ORCHESTRATE_SESSION_ID`). This `null` is
   **by design**, not a degradation — do **not** emit the fresh-run step-6
   "no automatic context-handoff, resume manually" operator notice; the
   pre-flight handoff doc (step 4) *is* the resume instruction, and the resuming
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

## 3. Stop point — after the valid checkpoint, before the wave loop

Once step-6's `validate_run_state` returns `valid`, write the pre-flight handoff
doc (step 4 below), then **stop**. Do **not** proceed into spine section 2 (the
wave loop). At this stop point exactly one branch exists — the umbrella branch
from fresh-run step 5; **no worktrees and no slice branches** are created (those
are section-3 per-slice work the pass never reaches). The run is left
`in-progress`, fully resumable.

## 4. Write the pre-flight handoff doc

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
