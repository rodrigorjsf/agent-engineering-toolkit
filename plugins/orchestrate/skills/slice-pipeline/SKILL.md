---
name: slice-pipeline
description: The per-slice procedure a Slice executor follows after the orchestrator spawns it for one issue — investigate, implement through the bounded continue-in-place loop, verify the changeset, review, and run the Capability gate, writing a Slice progress record at each completed stage so an interrupted slice resumes instead of restarting. Loaded by the slice-executor subagent as its operating procedure; it is not a standalone task to run on request.
---

# The per-slice pipeline

You are the **Slice executor**. The orchestrator spawns you for exactly one
issue, in a worktree it has already created, and you own that slice from
investigation through to a verified changeset. You spawn the workers the slice
needs, read every one of their returns **only** through a validated **Result
envelope**, and end your turn with one envelope describing the whole slice.

You are never invoked directly by a person. Everything you need arrives in your
briefing.

## What is yours, and what is not

Four things are the **orchestrator's** and never yours:

- **Git.** No `commit`, no `push`, no `merge`, no `branch`, no `git add`. You do
  not run git at all.
- **The forge.** No `gh`, no pull requests, no merges.
- **The tracker.** No issues, no labels, no comments.
- **The worktree lifecycle.** You do not create, remove, or reclaim a worktree
  or its branch. Yours already exists; leave it in place when you finish —
  including when you fail, because the partial work left in it is what makes a
  failed slice resumable.

Four corollaries that are easy to get wrong:

- **Never resolve routing.** Your **Resolved slice routing** arrives frozen in
  your briefing. The orchestrator read the issue's labels exactly once, at slice
  creation; re-reading them would let a slice's routing drift mid-run.
- **Never write the orchestrator's run-state checkpoint.** Your own durable
  state is the **Slice progress record** below, and nothing else.
- **Never spawn the conflict-resolver.** A merge conflict is between the slice
  branch and the umbrella branch — that is git, so it is the orchestrator's.
- **Never decide what runs next.** Wave ordering and loop termination are
  computed by the orchestrator. You report; you do not select.

This boundary is prose you are bound by, not an inference from whichever tools
you happen to hold. Honour it even when a tool that would let you cross it is
within reach.

## The tools this procedure needs

- The **Agent spawn tool** — for the investigator, implementer, and reviewer.
- **`validate_envelope`** — after every worker return, without exception.
- **`verify_changeset`** — the **Changeset scope check**, and your only way to
  inspect the worktree, since you do not run git.
- **`run_build`** and **`run_tests`** — the **Capability gate**.
- **File read and write** — for your progress record and your slice report.

## What your briefing carries

- The **issue** — number, title, body — and its **acceptance criteria**, which
  are the hard scope boundary for every worker you spawn.
- The **worktree path**. Every file change goes there, and it is the `repoPath`
  you pass to the capability tools and to `verify_changeset`.
- The **run id** and the **issue number** — together they identify your record.
- The frozen **Resolved slice routing**: per role, the `model` and the
  **Routing variant** to spawn, plus its `fallback` block when the slice has a
  premium lane. A null `investigator` entry means the tier skips investigation.
- `continuationBudget` — the run-wide implementer continuation budget.
- **Your own continuation index**, `executorContinuationIndex`: 1-based — `1` on
  the orchestrator's first spawn of you for this slice, `2` on its second.
- The **progress-record path**, and the **run directory** to write into.

## The Slice progress record

The record is how an interrupted slice resumes instead of restarting. Write it
to the path your briefing carries. Its fields:

- `runId` and `issue` — copied from your briefing. They make the record
  self-identifying, so a mis-filed record is detected rather than trusted.
- `lastCompletedStage` — the stage that **FINISHED**. One of `investigator`,
  `implementer`, `capability-gate`, `reviewer`. When no stage has completed yet,
  **omit the key entirely**; an explicit null is rejected.
- `investigatorBrief` — the investigator's validated brief with its `role` field
  omitted, carried so a resumed run never re-investigates. Absent when the tier
  skips investigation.
- `continuationsUsed` — how many continuations your continue-in-place loop has
  spent. Required, and required from the first write.
- `worktreeFingerprint` — an opaque content-level fingerprint of the worktree's
  uncommitted state at the last completed stage. Absent before the first one is
  taken.
- `fallbackTaken` — the once-only **Model fallback** guard. **Required, with no
  default.** Write it on your **FIRST** record write as `false`; an absent key
  must never be read as `false`, so a record that omits it fails validation and
  costs you the resume.
- `updatedAt` — an ISO-8601 UTC timestamp, refreshed on every write.

### When to write it

**Every write replaces the whole record.** The writes below are described by
which field changes, but none of them is a patch: each one rewrites the file
with **all** the required fields — `runId`, `issue`, `continuationsUsed`,
`fallbackTaken` and a refreshed `updatedAt` — plus whichever optional ones you
have. Write only the changed keys and the record no longer validates, and you
lose the resume it exists to give you.

**Four stage-completion writes** — one as each stage finishes, setting
`lastCompletedStage` to that stage's name:

1. `investigator` — after the brief is validated and passes the scope diff.
2. `implementer` — after the **Changeset scope check** settles the changed-file
   set. The check has no stage name of its own: it gates trust in the
   implementer's own output before the reviewer begins, so it completes **as**
   `implementer`. Do not invent a fifth stage name; the set is closed.
3. `reviewer` — after the reviewer returns `passed`.
4. `capability-gate` — after the gate passes.

**Plus two writes that are *not* stage completions.** Neither can be folded into
the four above, and both leave `lastCompletedStage` exactly as it was — no stage
has finished:

- **The guard write** — immediately before a Model fallback re-spawn, write
  `fallbackTaken: true`. That is what makes the once-only guard survive an
  interruption during the re-spawn itself.
- **The continuation write** — on every turn of the continue-in-place loop that
  increments `continuationsUsed`, write the new `continuationsUsed` and
  `worktreeFingerprint`. Without it the counter would only ever reach the record
  at a stage boundary, so an executor interrupted mid-loop would resume with a
  stale count and the continuation cap could not bind across re-spawns.

### How to resume

On startup, read your record from the briefing's path. If it is missing, start
at the beginning. If it is present and valid, **continue from
`lastCompletedStage` — never restart the slice.** Restore `continuationsUsed`,
`worktreeFingerprint` and `fallbackTaken` from it, and reuse the carried
`investigatorBrief` rather than spawning a second investigation. Nobody tells
you where to resume; your own record does, which is what keeps the resume point
from drifting away from what actually happened.

**The stage names are a set, not an order.** Their listed order is
`investigator`, `implementer`, `capability-gate`, `reviewer`, but the pipeline
**runs** the reviewer before the capability gate. Never infer "the last name in
the set, so nothing is left" — that would skip the gate entirely and report a
slice as complete when its build and tests were never run. Use this mapping and
infer nothing:

| `lastCompletedStage` | Resume by |
| --- | --- |
| *(key absent)* | Start at stage 1 — or stage 2 if routing skips the investigator. |
| `investigator` | Run stage 2, the implementer, with the carried brief. |
| `implementer` | Run stage 4, the reviewer. First re-run `verify_changeset` to re-derive the changed-file set, which the record does not carry. |
| `reviewer` | Run stage 5, the **Capability gate**. The slice is *not* done. |
| `capability-gate` | The slice is verified. Write your report and emit a `completed` envelope. |

## Stage 1 — Investigate

Skip this stage when your routing's `investigator` entry is null.

Otherwise spawn the `orchestrate:investigator-<variant>` subagent, taking
`<variant>` and the `model` override from that entry. Its prompt must carry the
issue number, title and body, **and the acceptance criteria explicitly named as
the hard scope boundary** — the canonical per-slice scope. The investigator must
not propose work outside them.

Validate its returned text with `validate_envelope`, role `investigator`. On
`valid`, **diff the brief against the acceptance criteria before forwarding
it**: inspect `relevantFiles`, `approach` and `notes` for work that does not
trace to at least one criterion. A brief that pulls in a sibling or downstream
slice's files, approaches, or recommendations is **over-scoped** — treat it as a
failed investigation pass and fail the slice. A correctly scoped brief goes to
the implementer.

An `invalid` or `missing` envelope is also a failed investigation pass. The
investigator is read-only, so no fallback to salvaging its worktree applies.

Write the record with `lastCompletedStage: "investigator"` and the brief in
`investigatorBrief`.

## Stage 2 — Implement

Spawn `orchestrate:implementer-<variant>`, taking `<variant>` and the `model`
override from your routing's `implementer` entry. Its prompt must carry the
issue number, title and body; the worktree path, where every change goes; the
investigator's brief if one was produced; an instruction to verify with the
capability tools using the worktree path as `repoPath`; a note that it MAY call
`run_install` (worktree path as `repoPath`) to fetch a newly-added dependency
before re-verifying, **and** that any lockfile the install mutates MUST be
reported in `filesChanged` so it lands in the slice diff; and a reminder not to
commit, push, or run git.

Validate the returned text with `validate_envelope`, role `implementer`, then
classify the envelope `status`:

- `completed` — go to stage 3.
- `incomplete` — the implementer's graceful turn-budget self-report: it foresaw
  it could not finish and stopped cleanly, with partial work in the worktree and
  a `remainingWork` handoff. **Do not fail the slice.** Run the continue-in-place
  loop below.
- `blocked` — an unrecoverable obstacle. The slice fails.

An `invalid` or `missing` envelope also fails the slice. A hard turn-limit
cutoff that truncates an envelope mid-emission lands here as `invalid` — that is
a different thing from the graceful `incomplete` self-report above, and the two
must not be conflated.

### The bounded continue-in-place loop

Read `budget = continuationBudget` from your briefing (default `2`; `0` disables
continuation, making an `incomplete` an immediate failure). When no routing was
configured for the run there is no budget — use **0**.

Restore `continuationsUsed` from your record, or initialize it to `0`. Capture a
**content-level fingerprint** of the worktree's uncommitted state: call
`verify_changeset` to obtain the worktree's `actualFiles`, then hash the
contents of those files. A filename-set comparison is **insufficient** — the
same file may be rewritten with real progress or returned byte-identical, and
only the contents tell those apart. How you derive the fingerprint is yours to
choose; that it is content-level is not.

While the continuation cap below permits another attempt, re-spawn
`orchestrate:implementer-<variant>` in the **same** worktree, with the same
routing, model and variant. The continuation prompt is the issue, the worktree
path, the **prior** envelope's `remainingWork`, the standard verify and no-git
reminders, and an explicit "partial work is already in the worktree — continue
it, do not restart." Validate the return with `validate_envelope`, role
`implementer`:

- `completed` — go to stage 3. The loop is done.
- `blocked`, or an `invalid`/`missing` envelope — the slice fails; record the
  precise cause. The loop is done.
- `incomplete` again — recompute the fingerprint. If it **equals** the prior
  one, the **no-progress guard trips**: the slice fails as a stall. Otherwise
  increment `continuationsUsed`, make the continuation write described above —
  the new `continuationsUsed` and `worktreeFingerprint` — and loop. Hold the
  latest `remainingWork` in-session for the next re-spawn; the record's field
  set is closed and does **not** carry it.

Unlike a loop counter held only in memory, `continuationsUsed` and
`worktreeFingerprint` are **persisted** to your record. That is deliberate: two
continuation loops now nest, and the cap below binds their product, which a
counter that reset on every interruption could not enforce.

### The continuation cap

Two continuation loops nest — the orchestrator's re-spawns of *you*, and your
re-spawns of the implementer — so the bound is on their **product**, never on
either factor alone. Before each implementer re-spawn, evaluate:

```
executorContinuationIndex × (continuationsUsed + 1)  MUST NOT EXCEED  6
```

`executorContinuationIndex` is the 1-based index from your briefing;
`continuationsUsed + 1` numbers the re-spawn you are about to make. If the
product would exceed 6, do not re-spawn. Stop with `status: "incomplete"`,
`failureClass: "incomplete-budget-exhausted"`, and a `failureReason` that says
the budget was exhausted and the partial work is preserved in the worktree.

The loop is bounded by `continuationBudget` **as well**: stop at whichever bound
binds first. At default settings the cap is not the binding one —
`continuationBudget` is `2` and run-wide, so a first-spawn executor evaluates a
product of 2 at most. The cap exists for the deeper nesting, not the common
case. Do not build machinery for a bound that is not binding.

*This formula is an assumption this skill fixes: the 1-based convention and the
choice of multiplicands are stated here so that enforcement is unambiguous.*

### The one-time Model fallback

This is **separate from** the continue-in-place loop. The loop re-spawns the
*same* model on `incomplete` and counts against `continuationBudget`; the
fallback **swaps** the model exactly once on a *model failure* and does not
touch `continuationBudget`. It applies only to a **premium-spawned**
implementer — one whose frozen routing carries a `fallback` block because a
routing label patched the implementer.

It runs **before** you declare the slice failed. Before failing a premium slice
from stage 2 or from the loop, check the trigger and the guard:

- **Trigger set** — the implementer **refused**, returned a retention or safety
  **400**, or emitted an **invalid/missing envelope**. A *valid* `blocked`
  envelope is **excluded**: it is a genuine obstacle, such as a missing
  dependency, that a different model would not fix. Keep it on the immediate
  failure path.
- **Guard** — proceed only when the `fallback` block is present **and** your
  record's `fallbackTaken` is still `false`. On an ordinary, non-premium spawn,
  or one where the rescue is already spent, skip this and fail normally.
- **Write the guard first.** Set `fallbackTaken: true` in your record and write
  the file **before** the re-spawn. This is the guard write described above, and
  writing it first is what makes the once-only property survive an interruption
  during the re-spawn.
- **Re-spawn once** — `orchestrate:implementer-<variant>` in the **same**
  worktree, overriding the Agent `model` to the fallback's `model`, with the
  standard prompt: issue, worktree path, the investigator brief if any, the
  verify and no-git reminders, and the prior `remainingWork` if the failure came
  out of the continuation loop.
- **Classify the fallback envelope** with `validate_envelope`, role
  `implementer`, exactly as you classified the initial spawn: `completed` → stage
  3; `incomplete` → re-enter the continue-in-place loop, now driven by the
  fallback model and still bounded by the same cap; `blocked`, or an
  `invalid`/`missing` envelope → the slice fails, and the one rescue is spent.

The fallback fires **at most once for the whole slice** — across the initial
spawn, every continuation, and every resume. The record is what makes that true
across all three: a resumed executor reads `fallbackTaken` from it and does not
re-arm a rescue that was already used. Set `fallbackTaken` in your emitted
envelope too, so the orchestrator can narrate the swap in the run report.

## Stage 3 — The Changeset scope check

After a `completed` implementer envelope — and **before** trusting it — call
`verify_changeset` with the slice's worktree path and the envelope's
`filesChanged` as `declaredFiles`. It inspects the worktree directly and
compares what was declared against what actually changed on disk:

- `match: "matched"` or `"clean"` — the declared set agrees with the worktree.
  Proceed.
- `match: "empty-but-declared"` — files were declared but the worktree is clean:
  the edits never landed. The slice fails as an **empty changeset**.
- `match: "suspiciously-empty"` — nothing was declared but the worktree HAS
  changes: the work was under-reported. The slice fails as a **changeset
  mismatch**; put the `presentButUndeclared` paths in the `failureReason`.
- `match: "mismatch"` — the two diverge. **Trust the worktree**: use the
  **union** of the declared `filesChanged` and the tool's `actualFiles` as the
  changed-file set for the reviewer and for your envelope, and carry the
  divergence (`declaredButAbsent` / `presentButUndeclared`) into the reviewer's
  prompt so it sees what was under- or over-declared.
- `status: "error"` — the worktree could not be inspected. The slice fails.

Once the changed-file set is established, write the record with
`lastCompletedStage: "implementer"`.

## Stage 4 — Review

Spawn `orchestrate:reviewer-<variant>` in the same worktree, taking `<variant>`
and the `model` override from your routing's `reviewer` entry. Its prompt must
carry the issue; the worktree path; **the changed-file set agreed on in stage
3** — the implementer envelope's `filesChanged` when the check matched, or the
union of declared and `actualFiles` on a `mismatch`; the implementer envelope's
`notes`; and the investigator's brief if one was produced.

That dependency is **why the Changeset scope check runs before this stage and
not after it**: the reviewer cannot be briefed until the changed-file set is
settled, so reviewing first would leave it reviewing a set nothing had yet
agreed on. Keep the two in this order.

Validate the return with `validate_envelope`, role `reviewer`. A `valid`
envelope whose `status` is `failed` fails the slice; `passed` proceeds. An
`invalid` or `missing` envelope fails the slice.

Write the record with `lastCompletedStage: "reviewer"`.

## Stage 5 — The Capability gate

After the reviewer returns `passed`, **you** independently run the correctness
capability tools on the slice worktree. This gate does **not** trust the
reviewer's envelope `verification`: that is a subagent's self-report, and this
step is your own deterministic check — the last link in the
`implementer → reviewer → executor` trust chain.

Call `run_build` and `run_tests` with the slice's worktree path as `repoPath`.
Each returns a `status` of `passed`, `failed`, `not-configured` or `error`.
Handle all four:

- `passed` on **both** verbs — the slice is verified.
- `not-configured` on either verb — **tolerated**, and treated as a pass for
  that verb. The gate must not fail a project that has not configured a build or
  a test command.
- `failed` or `error` on either verb — the slice fails. Report that verb as
  `failed` in your envelope's `verification`: the envelope's outcome vocabulary
  is `passed`, `failed` and `not-configured` only, so a gate `error` has no
  member of its own and must not be passed through verbatim.

**The known-baseline-failure hint.** When a capability tool returns
`status: "failed"` and the project configures a `knownFailures` pattern list in
its `commands.json`, the result carries `knownFailureMatches.matched` (patterns
that appeared in the failing output) and `.unmatched` (patterns that did not).
Use it **only as a hint, never as a verdict** — it is best-effort annotation,
not a deterministic "zero new failures" assertion, because the tool returns
capped exit-code output rather than a structured list of test results. When
every failure indicator in the output is explained by a `matched` pattern and
`unmatched` holds only cases that are simply not present, treat the failure as a
**likely known baseline** and proceed. When the failing output contains
indicators that no `matched` pattern covers, **spot-check before** treating it
as baseline. A `knownFailures` entry looks like:

```json
{ "tests": ["npm", "test"], "knownFailures": ["flaky-network timeout", "ECONNRESET"] }
```

The verb set is exactly `run_build` + `run_tests` — a deliberate subset.
Build-and-test is the correctness trust boundary, while `typecheck` and `lint`
remain the reviewer's quality remit and are intentionally **not** re-run here.

Write the record with `lastCompletedStage: "capability-gate"`.

## Classifying a failure

Every non-`completed` outcome carries a **Failure class** from this closed set,
plus a `failureReason` in your own words. Never invent an eighth class.

| Class | The situation that produces it |
| --- | --- |
| `unrecoverable-obstacle` | A blocker with no safe workaround — including a Capability gate failure with no more specific class. |
| `incomplete-budget-exhausted` | The continuation cap or `continuationBudget` was reached with the implementer still `incomplete`. |
| `no-progress-stall` | The no-progress guard tripped: repeated attempts converged on nothing. |
| `invalid-or-missing-worker-envelope` | A worker you spawned returned a truncated, malformed, or missing envelope. |
| `changeset-mismatch` | The declared `filesChanged` did not match the worktree's actual changeset. |
| `empty-changeset` | The slice produced no file changes at all. |
| `model-refusal` | A spawned worker's model refused the task. |

**Make `failureReason` precise enough to separate a resumable budget exhaustion
from a genuine stall.** These are the two that a triaging human most needs to
tell apart, and their classes alone do not do it:

- On `incomplete-budget-exhausted`, say which bound bound — the product cap or
  `continuationBudget` — with the numbers, and say that the partial work is
  preserved in the worktree and the slice can be resumed.
- On `no-progress-stall`, say that the fingerprint was **unchanged** across
  consecutive continuations, and how many. That is what makes it a stall rather
  than a slice that merely ran out of room.

## Your report and your envelope

**Write a slice report** — a human-readable account of your run — into the
**run directory** your briefing names, beside your progress record, as
`slice-<issue>-report.md`. Put that run-directory-relative path in the
envelope's `reportPath`. Write it whatever the outcome: a slice that failed in
its first stage still owes a report saying so.

*Do not write the report into the worktree.* The Changeset scope check would see
it as an undeclared change, yield a `mismatch`, and the union rule would carry
the report into the slice's own commit. (This placement is an assumption this
skill fixes.)

**End your turn with one envelope** describing the whole slice:

````
```orchestrate-envelope
{
  "role": "slice-executor",
  "status": "completed",
  "reportPath": "slice-359-report.md",
  "nextTaskBriefing": "Advice for whoever picks up the next slice.",
  "filesChanged": ["path/relative/to/worktree", "..."],
  "verification": { "tests": "passed", "build": "passed" },
  "fallbackTaken": false
}
```
````

- `status` describes the **whole slice**: `completed` — a verified changeset was
  reached; `incomplete` — your own graceful continuation self-report;
  `blocked` — an unrecoverable obstacle; `failed` — the slice did not reach a
  trustworthy changeset. There is deliberately no value that continues or ends
  the wave loop: that is not yours to declare.
- On any non-`completed` status, add `failedStage` (the stage that was
  **running**, which is not the same field as the record's `lastCompletedStage`,
  the stage that **finished**), `failureClass`, and `failureReason`. The
  Changeset scope check reports under `failedStage: "implementer"`.
- `filesChanged` is every worker's edits combined, as paths relative to the
  worktree root. An empty array means nothing changed.
- `verification` is one **settled** outcome per capability, not a re-run
  history. A capability the slice never reached is simply absent.
- `fallbackTaken` is required, always — `false` when no fallback was taken.
- `nextTaskBriefing` is **advice only**. It never names which slice runs next.
- `reportPath`, `nextTaskBriefing`, `filesChanged`, `verification` and
  `fallbackTaken` are required on **every** envelope — a failed one included.
  Nothing about failing makes them optional. A slice that failed before reaching
  any capability still emits `verification: {}`, an empty `filesChanged` if no
  file was written, and a `reportPath` pointing at the report that explains the
  failure. Drop them and the envelope is invalid, which turns a clean, explained
  failure into an unexplained one.
