# The wave loop — operational mechanics

These are the per-wave operational mechanics of section 2. The spine retains the
wave-concurrency **policy** (the parallel-vs-sequential decision rationale and
how the run reads it); this file holds the `run_wave` operations, the per-wave
integration steps, and the final-PR mechanics.

Process waves in order, starting at index `completedWaves`. For each wave:

1. **Refresh the umbrella base.** Before creating this wave's worktrees,
   fast-forward the local umbrella ref to its remote counterpart — every prior
   wave's slices were squash-merged into `orchestrate/umbrella-<runId>` on the
   remote, and this wave's worktrees must branch from that integrated state.
   Call the `run_wave` MCP tool with `operation: "refresh-base"`, the
   repository root as `repoPath`, `umbrellaRef: "orchestrate/umbrella-<runId>"`,
   and `remote: "origin"`:

   - `refreshed` — the local umbrella ref was fast-forwarded to the remote tip
     (a no-op fast-forward on the first wave); proceed.
   - `diverged` — the umbrella history diverged (the remote tip is not a
     descendant of the local ref), so a fast-forward is impossible. The tool
     leaves the local ref untouched; the run must **stop** rather than branch a
     wave from a wrong base — record the failure, report to the user, and halt.
   - `error` — a git failure (an unreachable remote, a missing local umbrella
     ref); halt and report.

   The tool fetches the remote umbrella and gates the local ref update on a
   `git merge-base` ancestor proof, so it **fails loudly** on a
   non-fast-forward rather than clobbering history. This step is what guarantees
   a dependent slice is built on the slices it is blocked by; it does **not**
   rely on `create_worktree`'s internal fetch, which may be skipped or may fail.
   It runs on every wave — the first wave's fetch is a no-op fast-forward — and
   on a resumed run, since the wave loop is re-entered from this step.
2. **Select the processable slices.** A slice in this wave is processable when
   its state is `pending`, every **in-partition** blocker it depends on reached
   `passed`, and every **out-of-partition** blocker is verified resolved. The
   orchestrator first resolves each blocker's state, then hands the gating
   decision to the `run_wave` tool.

   - **In-partition blockers** — a `blockedBy` id that is itself a slice in
     this run's `slices` map. Read each such blocker's `state` directly from
     `run-state.json`.
   - **Out-of-partition blockers** — a `blockedBy` id that is **not** a slice
     in this run's `slices` map. This happens on a partitioned run: a child
     issue may be blocked by an issue outside its parent PRD. `plan_waves` does
     not order such a blocker — it treats any id outside its input set as
     already satisfied — so the orchestrator must verify the blocker's **real**
     tracker state itself before the dependent slice runs (the `gh` lookup stays
     in the spine; the tool never shells `gh`):

     ```
     gh issue view <blocker-id> --json state
     ```

     Never silently assume an out-of-partition blocker is done.

   Then call `run_wave` with `operation: "select-processable"`, passing the
   resolved states it just gathered — `inPartitionBlockers` (each
   `{ blockerId, state }` from `run-state.json`) and `outOfPartitionBlockers`
   (each `{ blockerId, state }`, `state` the `OPEN`/`CLOSED` from
   `gh issue view`):

   - `processable` — every in-partition blocker reached `passed` and every
     out-of-partition blocker is `CLOSED`; process the slice.
   - `skip` (with `blockerId`) — the named blocker is unmet (a non-`passed`
     in-partition blocker, or an `OPEN` out-of-partition one). Mark this slice
     `skipped` with a `failureReason` naming that blocker (e.g. "blocked by
     #<blockerId>, an issue outside this run's partition that is still open"),
     checkpoint, and do not process it.
3. **Process the slices.** Branch on the `intraWaveConcurrency` policy read at
   the top of section 2 (see the wave-concurrency policy retained in the spine):

   - **`parallel` (the default).** Run section 3 for the processable slices,
     **up to the wave's planned width** (below). Slices in a wave are
     independent, so parallelize: when several in-flight slices are at the same
     subagent stage (investigation, implementation, review), spawn those
     subagents by issuing all the Agent tool calls **in a single message**.
     Each slice has its own worktree, so they never collide. Then integrate them
     sequentially — step 4 below.

     **Plan the wave's width first.** A parallel wave holds roughly **twice** as
     many live agents as it has slices — each in-flight slice occupies its slice
     executor **plus** the one worker that executor currently has running — so
     spawning every processable slice at once can walk the session into the
     platform's concurrent-subagent limit. Call the `run_wave` MCP tool with
     `operation: "plan-wave-width"` and `processableCount` (how many slices
     passed step 2), plus `concurrencyLimit` **only** if
     `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` is set to something other than its
     default of 20 — the MCP process cannot read the session's environment, and
     the plugin works **within** the limit rather than raising it:

     - `width-planned` — run at most `waveWidth` slices concurrently. The
       `deferredCount` remainder is **deferred, not skipped**: each deferred
       slice keeps its `pending` state and stays in this wave's processable
       queue. As each in-flight slice finishes integrating (step 4), pull the
       next deferred slice from the queue.

     **A concurrency-limit refusal is backpressure, not a slice failure.** If a
     spawn is refused anyway, pass the verbatim refusal text to the `run_wave`
     MCP tool as `operation: "classify-spawn-outcome"`, `spawnFailureText:
     "<the text>"`:

     - `backpressure` (`limitSignal: "concurrent-subagent-limit"`) — the
       platform was at its concurrent limit. **Nothing is wrong with the
       slice.** Return it to this wave's processable queue with **its state
       unchanged** (`pending`) — exactly where a width-deferred slice sits — and
       re-attempt it when a slot frees. Never mark it `failed`, never write a
       `failureReason`, never apply a triage label, and never count it against
       the run's failures: doing any of those produces a structural false
       negative that would be blamed on the slice's own work. The vendor
       documents this refusal as one Claude is told **not to retry**, which is
       consistent — the requeue is a *later attempt after a slot frees*, not an
       immediate retry of the refused call.
     - `spawn-error` — a genuine spawn failure, handled as a failure. When
       `limitSignal` is `session-spawn-limit` the session's **total** spawn
       budget is spent: re-attempting in this session cannot succeed, so hand
       the run off (section 4) rather than requeueing, which would loop forever.

   - **`sequential`.** Process the wave's processable slices **one at a time, in
     issue-id ascending order** — steps 3 and 4 below fuse into a per-slice
     serial loop. This imposes a deterministic order on slices the DAG says are
     independent, deciding who "wins" a shared-file region; in exchange every
     slice branches from an already-integrated base, so it is conflict-free
     without the conflict-resolver. For each slice, in ascending issue-id order:

     1. **Refresh the umbrella base** by re-running this section's step 1
        `run_wave` `refresh-base` call so this slice branches from
        `base + slice1..N-1` — the integrated state of every earlier slice in
        this wave, not just the prior waves'.
     2. **Process it** — run section 3 (all stages) for this one slice.
     3. **Integrate it** — run section 3 steps 6–9 (commit, pull request, merge)
        for this one slice; merges into the umbrella must not race, and here
        they cannot, because only one slice is in flight.
     4. **Check for the context-handoff signal** — exactly as the `parallel`
        path does in step 4: if `.orchestrate/runs/<runId>/context-flag.json`
        exists, finish writing `run-state.json` for the slice just integrated,
        then go to section 4 (Context handoff) rather than starting the next
        slice.

     After the loop drains the wave's processable slices, continue at step 5.

4. **Integrate sequentially** (the `parallel` path; the `sequential` path
   already integrated each slice inline in step 3). The commit, pull-request,
   and merge steps (section 3, steps 6–9) run **one slice at a time** — merges
   into the umbrella branch must not race each other.

   **Per-slice post-merge unit re-verify (parallel path only).** Each slice's
   worktree was branched from the wave's *starting* umbrella (step 1) and never
   saw this wave's earlier siblings, so the clean `MERGEABLE` path (section 3,
   step 8) would otherwise squash-merge without ever testing the
   `base + slice1..N` combination. Before the `gh pr merge --squash` of each
   slice, in the slice's still-present worktree, call the `run_wave` MCP tool
   with `operation: "reverify-slice"`, `repoPath: "<worktree-path>"`,
   `umbrellaRef: "orchestrate/umbrella-<runId>"`, `remote: "origin"`, and
   `isFirstMergedThisWave` set true **only** for the first merged slice of this
   wave (whose pre-merge gate already covered the umbrella — the merge is a no-op
   at that point). The tool fetches and merges the umbrella into the worktree,
   then runs the two correctness verbs (tests + build — the fast unit command,
   not all four):

   - `skipped-first-merge` — the first merged slice; nothing to re-verify.
     Proceed to the squash-merge.
   - `passed` — both verbs passed against the `base + slice1..N` combination;
     proceed to the `gh pr merge --squash`.
   - `failed` (with `which`) — the merged worktree failed a verb. Gate the
     `gh pr merge --squash` on this: the slice has **FAILED** via the existing
     failure path (its worktree is preserved and the wave continues — see
     "Failure handling"). Because the re-verify runs *before* the merge, the
     failure never pollutes the umbrella and **no revert/rollback machinery is
     needed**.
   - `conflict` — the umbrella merge left an unmerged index (the tool flags it
     in place, never resolving it). Defer to section 3 step 8a (do not duplicate
     conflict logic here).

   The `sequential` path needs no equivalent step: each of its slices already
   branches from `base + slice1..N-1` (step 3 above), so its pre-merge gate has
   already tested the integrated state.

   After each slice finishes integrating, check for
   `.orchestrate/runs/<runId>/context-flag.json`: if it
   exists, the context-watchdog has signalled that one of this session's two
   budgets — its context window or its total subagent-spawn budget — is running
   out (the flag's `trigger` field says which). Do not start the next slice, and
   do not pull the next deferred one — finish writing `run-state.json` for
   the slice just integrated, then go to section 4 (Context handoff).
4a. **Run the per-wave integration suite.** After every processable slice in
   this wave has integrated and passed its post-merge unit re-verify, run the
   optional heavy `integration` suite **once** against the umbrella tip — a
   bounded `num_waves` cost that localizes a cross-slice integration break to
   this wave's small slice set. The slice worktrees are removed at section 3
   step 9, so **defer removal of the last successfully-merged slice's worktree**
   until after this step, fast-forward-merge the umbrella into it, and use that
   worktree path as `repoPath` (`.orchestrate/commands.json` is repo-tracked, so
   it is present in every worktree):

   ```
   git -C <worktree-path> fetch origin orchestrate/umbrella-<runId>
   git -C <worktree-path> merge origin/orchestrate/umbrella-<runId>
   ```

   Then call the `run_wave` MCP tool with `operation: "integration-gate"` and
   `repoPath: "<worktree-path>"`:

   - `tolerate` (the project ships no `integration` command) — **tolerated and
     skipped**, the same posture as any unconfigured capability verb. Proceed to
     step 5.
   - `proceed` (the suite passed) — proceed to step 5.
   - `halt` (the suite failed or errored) — **halt the run**: do **not**
     checkpoint `completedWaves` forward and do **not** build the next wave on a
     broken umbrella. Leave the umbrella branch and the failing worktree on disk,
     record the failure in `run-state.json`, report to the user, and stop —
     consistent with step 1's "fail loud, do not branch a wave from a wrong
     base".

   Remove the deferred worktree (section 3 step 9's `remove_worktree`) only
   after a `proceed` or `tolerate` result.
5. **Checkpoint the wave.** Set `completedWaves` to this wave's index + 1 and
   write `run-state.json`.
6. **Report wave progress to the PRD.** If `parentIssue` is set, post a comment
   on it summarizing this wave's outcomes — which child issues passed, failed,
   or were skipped: `gh issue comment <parentIssue> --body "..."`.

## Final integration pull request

When the last wave is done, open the **final integration pull request** — one
pull request from the umbrella branch into `development`, left **unmerged** for
a developer to review and merge:

```
gh pr create --base development --head orchestrate/umbrella-<runId> \
  --title "orchestrate run <runId>" \
  --body "<summary of the run — slices passed, failed, and skipped>

Closes #<N>
Closes #<M>"
```

The `--body` enumerates **one `Closes #<N>` line per slice** whose
`run-state.json` `state` is `"passed"` (the `#<N>`/`#<M>` placeholders above
stand for those passed-slice issue numbers — emit as many lines as there are
passed slices), in addition to the run summary. A
**failed** or **skipped** slice gets **no** `Closes` line — its code is not in
the umbrella, so its issue must stay open. Because the integration base is
`development`: when `development` is the repository's default branch these
`Closes` keywords fire a native GitHub close the instant the umbrella pull
request merges; when `development` is **not** the default branch the keywords
are inert and the §1 start-of-run sweep backstop closes the passed-slice
issues instead.

Record its URL as `finalPullRequest` in `run-state.json`, set
`status: "completed"`, and checkpoint. Then render the run's HTML artifacts
from the final checkpoint — call the `render_dashboard`, `render_graph`, and
`render_report` MCP tools, each with the repository root as `repoPath` and the
run's `runId`; each tool reads `.orchestrate/runs/<runId>/run-state.json` and
writes its artifact into that same run directory — so a developer has a visual
summary of the run. If `parentIssue` is set, post a final summary comment on
it. Report to the user: the umbrella branch, the final pull request URL, the
paths of the three rendered artifacts, and — per slice — its final state and
pull request.

**Narrate the routing notes in the per-slice summary.** For each slice whose
`resolvedRouting.fallbackTaken` is `true`, note the **model-fallback swap** in
its summary line — e.g. "slice #N: fable declined → served by opus" — so the
premium-lane fallover is visible in the report (the swap itself runs inside the
slice executor and is reported in its envelope's `fallbackTaken`). Surface any
routing-label
**WARNING** (an unconfigured `route:*` label) or **ERROR** (a same-role
`LABEL_CONFLICT`) from `resolve_routing` in the same summary, and — where the
orchestrator judges a slice would have benefited from a premium lane — it may
**suggest** a `route:fable` label, but it **never applies one itself**.
