# Processing one slice — the per-slice pipeline

These are the per-slice steps the wave loop invokes (section 3). The spine
retains the Result-envelope trust-chain narration (how every subagent outcome is
read **only** from its validated envelope); this file holds the step-by-step
procedure. Update the slice's entry in `run-state.json` and write the file at
every state change.

Every subagent ends its turn with a result envelope; after each subagent
(investigator, implementer, reviewer, conflict-resolver) returns, call the
`validate_envelope` MCP tool with the subagent's verbatim returned text and its
`role`, then act on the validated `status`/`envelope` as the trust-chain
narration in the spine describes.

1. **Create the worktree.** Set the slice `state` to `in-progress`, write its
   `sliceBranch` (`orchestrate/slice-<N>`) and the `worktreePath` you will use
   into the slice entry, and checkpoint — so an interruption here is resumable.
   Use the `create_worktree` MCP tool: `baseRef` = `orchestrate/umbrella-<runId>`,
   `branch` = `orchestrate/slice-<N>`, `worktreePath` = an absolute path outside
   the repo (e.g. `<repo-parent>/.orchestrate-worktrees/<runId>/slice-<N>`),
   `repoPath` = the repository root. `create_worktree` also runs the configured
   `install` command in the new worktree before returning, so the capability
   tools have the dependencies they need. On `status: "error"` — including an
   `install` that failed — the slice has **FAILED** (see *Failure handling*).
2. **Resolve routing.** Call the `resolve_routing` MCP tool with the slice's
   `tier` and the repository root as `repoPath`. It returns, per role, the
   `model` and effort variant to spawn:
   - `status: "ok"` — use the returned `routing`.
   - `errorCode: "CONFIG_NOT_FOUND"` — no routing is configured; fall back to
     the `-standard` variant of every role with no `model` override (each
     subagent's frontmatter model applies), and skip the investigator.
   - `errorCode: "CONFIG_INVALID"` — the routing config is broken; the slice
     has **FAILED**.
3. **Run the investigator (higher tiers only).** If `routing.investigator` is
   non-null, spawn the `orchestrate:investigator-<effort>` subagent — `<effort>`
   and the Agent `model` override both come from `routing.investigator`. Its
   prompt must carry the issue number/title/body **and the slice's acceptance
   criteria explicitly named as the hard scope boundary** — the canonical per-
   slice scope established by the backlog partitioner. The investigator must
   not propose work that falls outside those acceptance criteria. Validate its
   returned text with `validate_envelope` (role `investigator`); on `valid`,
   **diff the returned brief against the acceptance criteria before forwarding
   it to the implementer**: inspect the brief's `relevantFiles`, `approach`,
   and `notes` for any work that does not trace to at least one acceptance
   criterion. If the brief includes work from a sibling or downstream slice —
   files, approaches, or recommendations that the acceptance criteria do not
   require — the brief is over-scoped: treat it as a failed investigation pass
   (the slice has **FAILED**). A brief that is correctly scoped to the
   acceptance criteria is forwarded to the implementer as the research brief.
   An `invalid` or `missing` envelope is a failed investigation pass — the
   slice has **FAILED** (the investigator is read-only, so no worktree fallback
   applies). If `routing.investigator` is null, skip this step.
4. **Run the implementer.** Spawn the `orchestrate:implementer-<effort>`
   subagent — `<effort>` and the `model` override from `routing.implementer`. Its
   prompt must carry the issue number/title/body, the worktree path (every
   change goes there), the investigator's brief if one was produced, an
   instruction to verify with the capability tools using the worktree path as
   `repoPath`, a note that it MAY call `run_install` (worktree path as
   `repoPath`) to fetch a newly-added dependency before re-verifying — and that
   any lockfile that install mutates MUST be reported in `filesChanged` so it
   lands in the slice diff — and a reminder not to commit, push, or run git.
   Validate its returned text with `validate_envelope` (role `implementer`). On
   a `valid` envelope, classify the envelope `status`:
   - `completed` — proceed to the worktree scope check in step 4a.
   - `incomplete` — the implementer's graceful turn-budget self-report: it
     foresaw it could not finish within its remaining turns and stopped cleanly
     with partial work recorded **and a `remainingWork` handoff**. Do **not**
     fail the slice immediately. Instead run the **bounded continue-in-place
     loop** below: re-spawn the implementer in the *same* worktree carrying the
     `remainingWork`, until it returns `completed` or the continuation budget is
     exhausted. The slice FAILs from `incomplete` only when the budget runs out
     or the no-progress guard trips — see the loop and *Failure handling*.
   - `blocked` — the implementer hit an unrecoverable obstacle: the slice has
     **FAILED**.

   **Continue-in-place loop (on a `valid` `incomplete` envelope):**
   - Read `budget = continuationBudget` from the step-2 `resolve_routing` result
     (the resolved run-wide budget, default `2`; `0` disables continuation —
     legacy immediate-FAIL). When `resolve_routing` returned `CONFIG_NOT_FOUND`
     (no routing configured), there is no budget — use **0**.
   - Initialize an in-session `continuationsUsed = 0` and capture a
     **content-level fingerprint** of the worktree's uncommitted state: a hash
     of `git -C <worktreePath> diff HEAD` concatenated with the contents of the
     untracked files listed by
     `git -C <worktreePath> ls-files --others --exclude-standard`. A filename-set
     comparison is insufficient — the same file may be rewritten with real
     progress or returned byte-identical.
   - While `continuationsUsed < budget`: re-spawn `orchestrate:implementer-<effort>`
     in the **same** worktree (same routing/model/effort) with a continuation
     prompt = the issue, the worktree path, the PRIOR envelope's `remainingWork`,
     the standard verify/no-git reminders, and an explicit "partial work is
     already in the worktree — continue it, do not restart." Validate the
     returned text with `validate_envelope` (role `implementer`).
     - `completed` — proceed to the worktree scope check in step 4a. Loop done.
     - `blocked`, or an `invalid`/`missing` envelope — the slice has **FAILED**
       (record the precise cause). Loop done.
     - `incomplete` again — recompute the fingerprint. If it **equals** the
       prior fingerprint, the **no-progress guard trips**: the slice FAILs, its
       `failureReason` names the no-progress stall, label `needs-triage`.
       Otherwise increment `continuationsUsed`, update the stored fingerprint and
       `remainingWork`, and loop.
   - When `continuationsUsed === budget` and the last envelope is still
     `incomplete`: the slice FAILs with a budget-exhausted `failureReason`
     ("implementer reported `incomplete` after exhausting the continuation budget
     of N; partial work preserved in the worktree for resumption"), label
     `needs-info` (resumable).
   - The counter and fingerprint are **loop-local** — nothing is persisted to
     `run-state.json`. A mid-continuation context handoff/resume discards the
     in-progress slice and rebuilds its worktree (§1), restarting the slice
     clean; this is intentional.

   An `invalid` or `missing` envelope also means the slice has **FAILED** — a
   hard turn-limit cutoff that truncates the envelope mid-emission lands here as
   `invalid`, distinct from the graceful `incomplete` self-report above.
4a. **Verify the changeset against the worktree.** After a `completed`
   implementer envelope — and before trusting it — call the `verify_changeset`
   MCP tool with the slice's `worktreePath` and the implementer envelope's
   `filesChanged` as `declaredFiles`. It inspects the worktree directly with
   `git status` and compares the declared file set against what actually
   changed on disk:
   - `match: "matched"` or `"clean"` — the declared set agrees with the
     worktree; proceed to step 5.
   - `match: "empty-but-declared"` — the implementer declared files but the
     worktree is clean: its edits never landed. The slice has **FAILED**.
   - `match: "suspiciously-empty"` — the implementer declared nothing but the
     worktree HAS changes: the work was under-reported. The slice has
     **FAILED**; record the `presentButUndeclared` paths in the `failureReason`.
   - `match: "mismatch"` — the declared set and the worktree changeset diverge.
     Trust the worktree: use the **union** of the implementer's declared
     `filesChanged` and the tool's `actualFiles` as the changed-file set for the
     reviewer and the commit (step 6), and note the divergence
     (`declaredButAbsent` / `presentButUndeclared`) so the reviewer sees it.
   - `status: "error"` — the worktree could not be inspected; the slice has
     **FAILED**.

   Once the changed-file set is established (a `matched`/`clean`/`mismatch`
   verdict), set the slice's `subState` to `implemented` and checkpoint
   `run-state.json`; the completed implementer envelope also satisfies the
   pre-review gate, so set `subState` to `verified` and checkpoint again before
   spawning the reviewer. (These two adjacent checkpoints differ only in
   resume granularity — the resume matrix in section 1 re-runs the capability
   gate for both.)
5. **Run the reviewer.** Spawn the `orchestrate:reviewer-<effort>` subagent —
   `<effort>` and the `model` override from `routing.reviewer` — in the same
   worktree. Its prompt must carry the issue, the worktree path, the
   changed-file set agreed on by step 4a — the implementer envelope's
   `filesChanged` when `verify_changeset` matched, the union of declared and
   `actualFiles` on a `mismatch` — the implementer envelope's `notes`, and the
   investigator's brief if one was produced. Validate its returned text with
   `validate_envelope` (role `reviewer`). On a `valid` envelope, an envelope
   `status` of `failed` means the slice has **FAILED**; `passed` proceeds. An
   `invalid` or `missing` envelope also means the slice has **FAILED**. On a
   `passed` envelope, set the slice's `subState` to `reviewed` and checkpoint
   `run-state.json` before proceeding to step 6.
5a. **Pre-merge capability gate.** After the reviewer returns `passed` (step 5),
   and **before any commit, push, or GitHub state exists**, the orchestrator
   independently runs the correctness capability tools on the slice worktree —
   this is the pre-merge capability gate. It does **not** trust the reviewer's
   envelope `verification`: the reviewer's re-run is a subagent self-report;
   this step is the orchestrator's own deterministic check, the last link in the
   `implementer → reviewer → orchestrator` trust chain.

   Call the `run_build` and `run_tests` MCP tools with the slice's
   `<worktree-path>` as `repoPath` (the same pattern step 8a's `clean`-verdict
   re-verify uses). Each tool
   returns a `status` enum (`passed | failed | not-configured | error`); handle
   all four:
   - `passed` on **both** verbs → proceed to step 6.
   - `not-configured` (either verb) → **tolerated**, treated as a pass for that
     verb (consistent with the prerequisites note that a missing-command
     `not-configured` is tolerated). The gate must not fail a project that has
     not configured `build`/`tests`.
   - `failed` or `error` (either verb) → the slice has **FAILED** (the existing
     FAILED semantics defined throughout section 3 — no new failure handling).

   **Known-baseline-failure hint (`knownFailureMatches`).** When a capability
   tool returns `status: "failed"` and the project's `commands.json` configures a
   `knownFailures` pattern list, the result carries
   `knownFailureMatches.matched` (configured patterns that appeared in the
   failing output) and `.unmatched` (configured patterns that did not). Use it
   only as a **hint**, never as a verdict — it is a best-effort L1 annotation,
   not a deterministic "zero new failures" assertion (`run_tests` returns capped
   exit-code output, not a structured test-result list). When every failure
   indicator in the output is explained by a `matched` pattern and `unmatched`
   holds only not-present baseline cases, treat the failure as a **likely known
   baseline** and proceed per this gate's baseline handling. When the failing
   output contains indicators NOT covered by any `matched` pattern,
   **spot-check** before treating it as baseline — L1 cannot deterministically
   assert "0 new failures." A `knownFailures` entry in `commands.json` looks
   like, e.g.:

   ```json
   { "tests": ["npm", "test"], "knownFailures": ["flaky-network timeout", "ECONNRESET"] }
   ```

   The verb set is exactly `run_build` + `run_tests` — a deliberate subset:
   build+test is the correctness trust boundary, while `typecheck`/`lint` remain
   the reviewer's quality remit and are intentionally **not** re-run here. The
   step 8a `clean`-verdict (post-`prepare`) re-verify running all four
   `run_tests`/`run_typecheck`/`run_build`/`run_lint` verbs is a **known,
   intentional asymmetry** — and is left unchanged: this pre-merge gate is
   focused correctness on a worktree the reviewer already saw, whereas the
   conflict re-verify is max-confidence on a never-before-tested merged
   combination. "Pre-merge" names what the gate controls (whether the merge
   proceeds); mechanically it runs pre-commit, on the same worktree state the
   reviewer validated.
6. **Commit and push.** Run the slice's commit + verified-push mechanics with
   the **`finalize_slice` MCP tool** in phase `commit-push` — not raw `git`. It
   stages the file set, guards an empty changeset, commits, composes
   `push_and_verify`, and writes the `pushed` checkpoint, all git-only. Call it
   with `phase: "commit-push"`, `worktreePath` = the slice `worktreePath`,
   `repoPath` = the **main repo root** (where `run-state.json` lives — NOT the
   worktree), `runId`, `sliceId` = the slice's issue-id-string key, `branch` =
   `orchestrate/slice-<N>`, `remote` = `origin`, `setUpstream: true`,
   `commitSubject` = `<type>(<scope>): <issue title>`, `issueNumber` = `<N>`, and
   `files` = the union of the `filesChanged` arrays from the validated
   implementer and reviewer envelopes.

   `finalize_slice` stages **exactly** that `files` set (`git add -- ...files`,
   never `git add -A` — the capability tools leave untracked build artifacts in
   the worktree). When the implementer fetched a new dependency with
   `run_install`, install ran **in its turn before this commit** and mutated the
   lockfile (`pnpm-lock.yaml` / `package-lock.json` / `Cargo.lock`); because the
   implementer declared that lockfile in `filesChanged`, it is in this staged
   union and the commit captures it — so the new dependency lands in the slice
   diff. The commit preserves the two-`-m` form (subject + `Closes #<N>`
   trailer), and the push goes through `push_and_verify`'s SHA-matched
   `git ls-remote` landing check.

   On `status: "ok"` (`verdict: "committed-pushed"`) the slice's `subState` was
   set to `pushed` and `run-state.json` checkpointed by the tool — and **only**
   then, because that status means `push_and_verify`'s SHA-matched
   `git ls-remote` confirmed the branch actually landed; proceed to step 7. The
   tool never writes `subState: pushed` on a bare `git push` exit-0 — the landing
   check is what the `pushed` checkpoint attests to (and what the section-1
   resume re-validates). On `status: "failed"` the slice has **FAILED** — an
   `EMPTY_CHANGESET` errorCode means the staged index was empty (nothing changed);
   a `PUSH_FAILED` / `BRANCH_NOT_ON_REMOTE` errorCode is bubbled from
   `push_and_verify`; `INVALID_INPUT` / `GIT_ERROR` / the run-state error codes
   wire the same way as every other MCP-tool error in this section.

   This gates step 7's `gh pr create`: a `git push` that exits 0 but never lands
   is exactly the confusing-`gh pr create`-error site #230 reports — verifying
   the branch is on the remote *before* opening the PR removes that
   silent-failure mode. The PR open itself (`gh pr create`) and the `pr-open`
   checkpoint stay in the spine at step 7 — `finalize_slice` is git-only and
   never shells `gh`.

7. **Open the slice pull request.**

   ```
   gh pr create --base orchestrate/umbrella-<runId> --head orchestrate/slice-<N> \
     --title "<issue title>" --body "Implements #<N>. <summary>"
   ```

   Record the pull request URL in the slice's `run-state.json` entry, set its
   `subState` to `pr-open`, and checkpoint.
8. **Merge the slice.** GitHub computes mergeability asynchronously — check it
   before merging:

   ```
   gh pr view <pr-number> --json mergeable,mergeStateStatus
   ```

   The gate is the `mergeable` field; `mergeStateStatus` is informational
   context, not a separate gate.

   - `UNKNOWN` — GitHub is still computing; wait a moment and re-check, up to a
     few attempts. If it never resolves, the slice has **FAILED**.
   - `MERGEABLE` — merge it even when `mergeStateStatus` is `UNSTABLE` (a
     non-required check is failing or still running, but no required check
     blocks the merge). Squash to one commit per slice on the umbrella branch:
     `gh pr merge <pr-number> --squash --delete-branch`. The `--delete-branch`
     flag reclaims the **remote** slice branch as part of the merge; it may
     additionally warn or no-op on the **local** branch because the slice
     worktree still has it checked out — that warning is **tolerated, not a
     slice failure**. The authoritative local reclamation is the explicit
     `git branch -D` at step 9.
   - `CONFLICTING` — resolve the conflict once, per step 8a. Do not FAIL a
     slice on a conflict without attempting resolution.

8a. **Resolve a merge conflict (once).** Attempt resolution exactly once — a
   conflict the resolver cannot fix is a FAILED slice.

   1. Prepare the worktree for resolution with the **`resolve_merge_conflict`
      MCP tool** in operation `prepare`. Call it with `operation: "prepare"`,
      `worktreePath` = the slice `worktreePath`, `umbrellaRef` =
      `orchestrate/umbrella-<runId>`, and `remote` (defaults to `origin`). The
      tool first **recovers re-entrantly**: if a pre-existing in-progress merge
      is found (a stale `MERGE_HEAD` left by an interrupted predecessor), it
      `git merge --abort`s it best-effort so this run is not wedged on "you have
      not concluded your merge"; then it fetches the umbrella and merges it into
      the worktree, surfacing any conflict markers in the files. The
      `conflictedFiles` it returns (a rename-conflict emits BOTH of its paths)
      is the list passed to the resolver in step 4.

      - `verdict: "conflicted"` — the merge left an unmerged index; carry
        `conflictedFiles` into step 4.
      - `verdict: "clean"` — the umbrella merge applied cleanly with no
        conflicts to resolve, and the tool already auto-committed it. **Do not
        spawn the conflict-resolver.** A clean textual merge is not proof of a
        correct one: Git auto-merges non-overlapping hunks that may still be
        semantically broken. Re-verify the merged worktree before integrating —
        run the `run_tests`, `run_typecheck`, `run_build`, and `run_lint`
        capability tools with the worktree path as `repoPath`. If any reports
        failure, the slice has **FAILED**. If all pass, the merge commit already
        exists — push and merge the slice PR: `git -C <worktree-path> push` then
        `gh pr merge <pr-number> --squash --delete-branch`.
      - `verdict: "error"` — a git or input failure (`errorCode`,
        `errorMessage`); the slice has **FAILED**, wired like every other
        MCP-tool error in this section.
   2. Spawn the `orchestrate:conflict-resolver-<effort>` subagent — `<effort>`
      and the `model` override from `routing.conflict-resolver`. Its prompt
      must carry the issue, the worktree path, and the list of conflicted
      files (the `conflictedFiles` from step 1).
   3. Validate its returned text with `validate_envelope` (role
      `conflict-resolver`). An `invalid` or `missing` envelope, or a `valid`
      envelope with `status: "failed"`, means resolution failed: abort and the
      slice has **FAILED** — `git -C <worktree-path> merge --abort`.
   4. On a `valid` envelope with `status: "resolved"`, finalize the merge with
      the **`resolve_merge_conflict` MCP tool** in operation `finalize`. Call it
      with `operation: "finalize"`, `worktreePath` = the slice `worktreePath`,
      and `resolvedFiles` = the resolver's resolved file set. The tool stages
      exactly that set (`git add -- ...`, never `-A`/`-u`/`.`), scans the staged
      diff for residual conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), and
      completes the merge commit.

      - `verdict: "completed"` — the resolved set staged cleanly with no
        residual markers and the merge commit was written. Push and merge the
        pull request: `git -C <worktree-path> push` then
        `gh pr merge <pr-number> --squash --delete-branch`. If `gh pr merge`
        fails (the resolution did not make the pull request mergeable), the
        slice has **FAILED**; the one attempt is spent.
      - `verdict: "markers_remain"` — residual conflict markers remain, so the
        resolution is incomplete: the tool has already **aborted the merge**,
        leaving the worktree clean. The slice has **FAILED**.
      - `verdict: "error"` — a git or input failure (`errorCode`,
        `errorMessage`); the slice has **FAILED**.

9. **Finish the slice.** Once any of step 8's `gh pr merge --squash` paths
   (`MERGEABLE`, the clean-textual-merge `prepare` `clean`-verdict path at step
   8a.1, or the conflict-resolved `finalize` `completed`-verdict path at step
   8a.4) has succeeded — the slice PR is now squash-merged into the
   umbrella — run the merged-tail mechanics with the **`finalize_slice` MCP
   tool** in phase `post-merge`. Call it with `phase: "post-merge"`,
   `worktreePath` = the slice `worktreePath`, `repoPath` = the **main repo root**
   (where `run-state.json` lives), `runId`, `sliceId` = the slice's
   issue-id-string key, and `branch` = `orchestrate/slice-<N>`. The tool writes
   the slice's `subState` to `merged` and checkpoints `run-state.json` **first**,
   then removes the worktree (force — it may hold untracked build artifacts), then
   force-reclaims the **local** slice branch (`git branch -D`, ordered after the
   removal because a checked-out branch refuses the delete). `merged` is the
   integration-boundary anchor: a run resumed at `subState: merged` skips every
   subagent and re-enters here at step 9 only, never re-merging.

   On `status: "ok"` (`verdict: "committed-pushed"`) the merged checkpoint,
   worktree removal, and local-branch reclaim are all done. The tool is
   idempotent: on a run resumed at `subState: merged` the worktree may already be
   gone and the branch already reclaimed by an earlier pass — both count as
   success, not failure. The `-D` force is mandatory because the squash-merge
   rewrote the commit SHA, so the slice branch is **not** an ancestor of umbrella
   and `git branch -d` would refuse it as "not fully merged." This completes
   incremental reclamation: the **remote** half was done by `--delete-branch` at
   step 8, the **local** half here. On `status: "failed"` the slice has
   **FAILED**, wired like every other MCP-tool error in this section.

   The forge-state half of finishing stays in the spine — it is **not**
   `finalize_slice`'s concern (the tool is git-only and never shells `gh`). After
   `finalize_slice` returns ok, set the slice `state` to `passed` and transition
   the issue's tracker label — it is done and awaiting human review:
   `gh issue edit <N> --remove-label ready-for-agent --add-label ready-for-human`.
   Incremental reclamation fires only on a `passed` / `subState: merged` slice; a
   failed (preserved) slice's branch is left fully intact.
