# AFK guardrails

This skill runs unattended and writes to GitHub. These guardrails keep an unattended run
safe and idempotent. The main thread owns all of this — investigators never touch `gh`.

## Scope echo

After computing the in-scope set, print one line before fanning out:

```
<N> open issues without the <label> label — processing.
```

Informational only. Do not wait for confirmation (this is AFK). If `<N>` is 0, report
"nothing to prime" and stop.

## Label creation (idempotent)

Create the primed label once, up front, before any posting. Tolerate "already exists":

```bash
gh label create "<label>" --color C5DEF5 --description "Primed with an autonomous pre-grill triage" 2>/dev/null || true
```

## Dedup gate (run per issue, in the main thread, right before posting)

Skip an issue if **either** is already true — this makes re-runs and partial-failure
recovery safe:

1. It carries the primed label, or
2. Any existing comment contains the disclaimer marker substring:
   `Autonomous pre-grill triage`

The second check catches the case where a previous run posted the comment but failed to
apply the label — without it, that issue would be double-posted.

## Posting (serial, main thread)

For each returned pointer with `status: "ok"`, in order:

```bash
gh issue comment <N> --body-file .prime-issues/issue-<N>.md
gh issue edit <N> --add-label "<label>"
```

Only after **both** succeed, delete the temp file:

```bash
rm -f .prime-issues/issue-<N>.md
```

If the comment posts but the label fails, leave the temp file and record the issue as
`failed (label)`; the dedup marker will prevent a duplicate comment next run.

## --dry-run

Skip label creation, posting, label application, and temp-file deletion entirely. Leave
every `.prime-issues/issue-<N>.md` in place and list their paths in the report so the
content can be inspected before a live run.

## Failure isolation

Each investigator is wrapped so one failure never aborts the batch (see
[ORCHESTRATION.md](ORCHESTRATION.md)). A `status: "failed"` pointer is recorded and the
run continues.

## Final report

```
Primed:  <list of #N posted>
Skipped: <#N — reason (already primed / dedup marker / dry-run)>
Failed:  <#N — reason>
Dry-run paths: <paths, only when --dry-run>
```
