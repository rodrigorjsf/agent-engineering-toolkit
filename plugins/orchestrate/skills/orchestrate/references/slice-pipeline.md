# Processing one slice — worktree, routing, and integration

These are the per-slice steps the **orchestrator** performs around the slice
executor (section 3): the two that run **before** the executor is spawned —
creating the worktree and freezing the slice's routing — and the integration tail
that runs **after** its envelope validates.

The intra-slice stages — investigation, implementation and its bounded
continuation loop, the changeset scope check, review, and the capability gate —
are **no longer here**. They belong to the slice executor, whose operating
procedure is the `slice-pipeline` skill preloaded by its subagent definition. The
orchestrator does not perform them and learns their outcome only from the
executor's validated result envelope. The step numbers are therefore
**deliberately non-contiguous**: steps 6–9 keep the numbers they have always had,
because other references cite them by number, and the gap at 3–5a is where the
executor's stages went.

Update the slice's entry in `run-state.json` and write the file at every state
change.

## Contents

- **Step 1 — Create the worktree** — `create_worktree`, the bundled install
- **Step 2 — Resolve routing** — `resolve_routing`, and freezing the result
- **Step 6 — Commit and push** — `finalize_slice` phase `commit-push`
- **Step 7 — Open the slice pull request** — `gh pr create`
- **Step 8 — Merge the slice** — the mergeability gate
- **Step 8a — Resolve a merge conflict (once)** — `resolve_merge_conflict`
- **Step 9 — Finish the slice** — `finalize_slice` phase `post-merge`, pass label

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
2. **Resolve routing — read the labels once, freeze the result.** Call the
   `resolve_routing` MCP tool with the slice's `tier`, the repository root as
   `repoPath`, and the **issue's GitHub labels** (the labels already parsed in
   `references/run-lifecycle.md` step 3) as `labels` — this is the **only** place
   the labels drive routing. It returns, per role, the `model` and `variant` to
   spawn, plus any label-resolved `fallbacks` and `warnings`:
   - `status: "ok"` — use the returned `routing`. **Freeze it into the slice's
     `resolvedRouting` checkpoint field** in `run-state.json` at slice creation:
     the per-role `{model, variant}` blocks — **including the `slice-executor`
     role**, which is what step 3 spawns and what a resumed run must re-spawn
     without re-resolving — and, because the Fable lane is implementer-only, the
     implementer's entry from the returned `fallbacks` array mapped into the
     single `resolvedRouting.fallback` `{model, maxRetries}` (with
     `fallbackTaken: false`). Every later spawn and every resume routes from this
     frozen checkpoint, never by re-reading labels (the resume-routing principle
     in the spine's resume matrix). Capture the result's `continuationBudget`
     too — the executor's briefing carries it.
   - **`warnings[]`** (present on `ok`) — surface each in the run report. An
     unconfigured `route:*` label present on the slice (in the config's `labels`
     block) yields a loud **WARNING** here: the label had no effect, so the
     operator can fix `routing.json` or drop the label. A routing config written
     before the `slice-executor` role existed also warns here, having had that
     role defaulted from the tier's own `implementer` entry.
   - `errorCode: "LABEL_CONFLICT"` — **two applied labels patch the same role**
     (there is no precedence rule). This is a loud **ERROR**: the slice has
     **FAILED**; report the conflicting labels so the operator resolves it in
     `routing.json`.
   - `errorCode: "CONFIG_NOT_FOUND"` — no routing is configured; fall back to
     the `-standard` variant of every role with no `model` override (each
     subagent's frontmatter model applies), skip the investigator, and freeze
     no `fallback` (an unrouted slice has no premium lane).
   - `errorCode: "CONFIG_INVALID"` — the routing config is broken; the slice
     has **FAILED**.

*Steps 3 through 5a are the slice executor's. See section 3 of the spine for
what the orchestrator does between step 2 and step 6: it spawns the executor,
validates one envelope, and acts on it.*

6. **Commit and push.** Run the slice's commit + verified-push mechanics with
   the **`finalize_slice` MCP tool** in phase `commit-push` — not raw `git`. It
   stages the file set, guards an empty changeset, commits, composes
   `push_and_verify`, and writes the `pushed` checkpoint, all git-only. Call it
   with `phase: "commit-push"`, `worktreePath` = the slice `worktreePath`,
   `repoPath` = the **main repo root** (where `run-state.json` lives — NOT the
   worktree), `runId`, `sliceId` = the slice's issue-id-string key, `branch` =
   `orchestrate/slice-<N>`, `remote` = `origin`, `setUpstream: true`,
   `commitSubject` = `<type>(<scope>): <issue title>`, `issueNumber` = `<N>`, and
   `files` = the slice executor envelope's `filesChanged` — every worker's edits
   combined, as the executor reported them.

   `finalize_slice` stages **exactly** that `files` set (`git add -- ...files`,
   never `git add -A` — the capability tools leave untracked build artifacts in
   the worktree). When an implementer fetched a new dependency with
   `run_install`, install ran **in its turn before this commit** and mutated the
   lockfile (`pnpm-lock.yaml` / `package-lock.json` / `Cargo.lock`); because that
   lockfile was declared in `filesChanged` and carried into the executor's
   envelope, it is in this staged set and the commit captures it — so the new
   dependency lands in the slice diff. The commit preserves the two-`-m` form
   (subject + `Closes #<N>` trailer), and the push goes through
   `push_and_verify`'s SHA-matched `git ls-remote` landing check.

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
   conflict the resolver cannot fix is a FAILED slice. This is the
   orchestrator's own work, never the executor's: a conflict is between the
   slice branch and the umbrella branch, so it is git.

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
   2. Spawn the `orchestrate:conflict-resolver-<variant>` subagent — `<variant>`
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
   integration-boundary anchor: a run resumed at `subState: merged` re-enters
   here at step 9 only, never re-merging and never re-spawning the executor.

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
