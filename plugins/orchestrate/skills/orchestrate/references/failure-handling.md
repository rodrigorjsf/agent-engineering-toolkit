# Failure handling — the FAILED-slice mechanical actions

The spine retains the failure-cause taxonomy and narration — the FAILED
definition, the `incomplete`-vs-`blocked`-vs-`invalid` distinction, the two
terminal `incomplete` causes (budget-exhausted / no-progress), and the SKIPPED
and other-stop-condition narration. This file holds the mechanical actions the
orchestrator performs **on a FAILED slice**, once the spine's taxonomy has
classified it. The continue-in-place loop mechanics that decide when an
`incomplete` slice FAILs live in `references/slice-pipeline.md` (section 3,
step 4).

On a FAILED slice:

- When the failure cause is a validated worker envelope with `status: "blocked"`
  (implementer) or `status: "failed"` (reviewer), that envelope now carries a
  validated `rootCause` (`verified` | `hypothesis` + `claim` + optional
  `evidence`) — surface it in the failure artifact alongside the `failureReason`
  so a developer reads the subagent's own labelled diagnosis.
- Set its `state` to `failed` with a `failureReason`, checkpoint, and
  transition the issue's tracker label. For a slice that failed because the
  continue-in-place loop **exhausted the continuation budget** — partial,
  resumable work — `needs-info` better signals "resume me" than `needs-triage`:
  `gh issue edit <N> --remove-label ready-for-agent --add-label needs-info`.
  For the **no-progress** terminal cause (a continuation that changed nothing)
  and every other failure cause, use `needs-triage`:
  `gh issue edit <N> --remove-label ready-for-agent --add-label needs-triage`.
- Do **not** merge it. **Preserve its worktree** — leave it on disk for a
  developer to inspect. Do not call `remove_worktree`.
- **Recover the changed-file set when the envelope was the failure cause.** If
  the slice failed because a worker subagent's envelope was `invalid` or
  `missing` — so its `filesChanged` array is unavailable or untrustworthy — call
  the `recover_changed_files` MCP tool with the slice's `worktreePath`. It
  inspects the preserved worktree directly with `git status` and returns the
  full changed-file set (build artifacts included), so the `failureReason` can
  record what the interrupted subagent had touched for the developer's
  inspection. This fallback applies to the implementer, reviewer, and
  conflict-resolver only — the investigator is read-only and leaves no worktree
  changes to recover.
- **Post a triage comment on the child issue.** This is **orchestrator** `gh`
  work (alongside closing passed-slice issues on a `merged` verdict) —
  the no-`gh` invariant on the MCP tools is preserved. Run
  `gh issue comment <N> --body "<body>"` whose body carries: the `failureReason`;
  the structured `rootCause` from the validated envelope (#239) as
  `rootCause.status` (`verified` | `hypothesis`) plus its `claim`/`evidence`
  detail; the preserved `worktreePath`; and a **resume hint that names
  `/orchestrate clean --failed <runId>`** as the deliberate post-triage reclaim
  action for this run once a developer has inspected the worktree. When the
  envelope was `invalid` or `missing` (so no `rootCause` exists), the comment
  **omits `rootCause`** and carries `failureReason` + `worktreePath` + the resume
  hint only — the degraded body, never a blocker.
- **Continue the wave.** A failed slice never cancels the other slices in its
  wave — they are independent and proceed normally.
