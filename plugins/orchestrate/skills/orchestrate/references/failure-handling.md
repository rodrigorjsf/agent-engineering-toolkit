# Failure handling — the FAILED-slice mechanical actions

The spine retains the failure-cause narration — where a slice can fail, the rule
that a verdict comes only from a validated envelope, and the SKIPPED and
other-stop-condition narration. This file holds the mechanical actions the
orchestrator performs **on a FAILED slice**: first the deterministic
failure-class-to-label mapping, then the actions that apply it. The bounded
continuation loop that decides when an `incomplete` slice fails is the slice
executor's, and lives in its own operating procedure.

## The failure-class to triage-label mapping

A slice executor classifies its own failure — that is where the evidence is — and
reports one **failure class** on its envelope. The orchestrator maps that class
to a tracker label, because it is the single writer of tracker state. This table
is that mapping's **only** home; the class set itself is defined once in
`validate_envelope`'s schema and is not restated here.

| `failureClass` | Label | Why |
|---|---|---|
| `incomplete-budget-exhausted` | `needs-info` | Resumable partial work is preserved in the worktree — "resume me", not "diagnose me". |
| `no-progress-stall` | `needs-triage` | Repeated attempts converged on nothing; a human has to look. |
| `unrecoverable-obstacle` | `needs-triage` | A blocker with no safe workaround. |
| `invalid-or-missing-worker-envelope` | `needs-triage` | A worker's result could not be trusted. |
| `changeset-mismatch` | `needs-triage` | Declared files did not match the worktree. |
| `empty-changeset` | `needs-triage` | The slice produced no file changes. |
| `model-refusal` | `needs-triage` | A spawned model refused the task. |

When **no class exists at all** — the executor's envelope was itself invalid or
missing and `recover_slice_progress` could not rescue the slice — use
`needs-triage`. The one case that is **not** a slice failure and must not be
labelled: an `unrecoverable-obstacle` whose `failureReason` names a missing
operating procedure is an environment fault; report it to the operator instead.

The label vocabulary is the project's, not this tool's — swap the label column if
a project uses different triage labels.

## The mechanical actions

On a FAILED slice:

- When the failure cause is a validated envelope carrying a `rootCause`
  (`verified` | `hypothesis` + `claim` + optional `evidence`) — surface it in the
  failure artifact alongside the `failureReason` so a developer reads the
  subagent's own labelled diagnosis.
- Set its `state` to `failed` with a `failureReason`, checkpoint, and
  transition the issue's tracker label to the one the mapping above yields:
  `gh issue edit <N> --remove-label ready-for-agent --add-label needs-info`
  or
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
