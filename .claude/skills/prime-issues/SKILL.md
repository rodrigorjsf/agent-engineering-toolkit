---
name: prime-issues
description: Autonomous AFK pass that pre-triages every open GitHub issue to seed a future grilling session. Fans out one background investigator per un-primed issue to analyze it against current repo state and docs, then posts an honest, adversarial pre-grill triage comment (evidence, ambiguities, value doubts, >=3 alternatives, gotchas, a prioritized grilling agenda) and applies a "grill-primed" label. Use when the user wants to prime or seed issues for grilling, run an autonomous pre-grill triage over the backlog, enrich open issues with honest points of view before grill-with-docs, or invokes /prime-issues. Agnostic to any GitHub repo via the gh CLI.
---

# prime-issues

Autonomous (AFK) batch pass that enriches open GitHub issues with an honest, adversarial **pre-grill triage** — so a future grilling session on any one of them opens with the maximum number of realistic points of view already on the table.

## Boundaries

- **Tracker assumption.** "Agnostic" means *any GitHub repo accessed via the `gh` CLI* — not any tracker. GitHub + `gh` is assumed. Infer the repo from `git remote -v`; `gh` does this automatically inside a clone.
- **Not a disposition decision.** This skill does **not** decide whether an issue is ready, valuable, or rejected, and does **not** touch state/category roles (e.g. `needs-triage`, `ready-for-agent`). It only *enriches*. Its sole mutations are: post one comment + add the primed label. Deciding disposition is a separate, interactive concern.
- **AFK.** Runs to completion without user feedback. The scope echo at the start is informational, not a gate.

## Arguments

- `--dry-run` — produce analyses and write temp files, but do **not** post comments, apply labels, or delete temp files. Report the temp paths for inspection.
- `--label <name>` — override the primed-label name (default: `grill-primed`).
- `#<n> #<m> …` — process only these issues.
- `--label-filter <name>` — process only open issues carrying this label.

Without narrowing args, process **all** open issues that lack the primed label.

## Flow

1. **Scope.** List open issues (`gh issue list --state open` — gh excludes PRs natively), drop any already carrying the primed label, apply narrowing args. Echo the count: `"<N> open issues without the <label> label — processing."`
2. **Orientation digest.** One upfront agent probes the repo's docs generically and returns a compact repo+docs map, shared with every investigator so none re-reads the whole repo. See [DOC-DISCOVERY.md](DOC-DISCOVERY.md).
3. **Fan-out.** Use the **Workflow** tool to run one background investigator per in-scope issue. Each investigator analyzes its issue, **writes** the analysis to `.prime-issues/issue-<N>.md`, and **returns a tiny pointer only** (anti context-rot). Adapt the skeleton in [ORCHESTRATION.md](ORCHESTRATION.md); use the role prompt in [INVESTIGATOR-PROMPT.md](INVESTIGATOR-PROMPT.md).
4. **Post (main thread, serial).** For each `ok` pointer: run the dedup gate, read the temp file, `gh issue comment`, apply the label, confirm both, delete the temp file. See [AFK-GUARDRAILS.md](AFK-GUARDRAILS.md).
5. **Report.** Summarize processed / skipped (reason) / failed (reason), plus dry-run paths.

## The two artifacts that carry the quality

The comment the reader receives is only as good as these — invest the rigor here, not in the plumbing:

- [COMMENT-TEMPLATE.md](COMMENT-TEMPLATE.md) — the canonical comment structure posted to each issue.
- [INVESTIGATOR-PROMPT.md](INVESTIGATOR-PROMPT.md) — the adversarial, self-critiquing investigator role.

## Companion files

- [COMMENT-TEMPLATE.md](COMMENT-TEMPLATE.md) — canonical pre-grill triage comment.
- [INVESTIGATOR-PROMPT.md](INVESTIGATOR-PROMPT.md) — per-issue investigator role prompt.
- [DOC-DISCOVERY.md](DOC-DISCOVERY.md) — ordered documentation probe list for the orientation digest.
- [AFK-GUARDRAILS.md](AFK-GUARDRAILS.md) — scope echo, dry-run, dedup gate, label creation, failure isolation, report.
- [ORCHESTRATION.md](ORCHESTRATION.md) — known-good Workflow fan-out skeleton.

> Temp files live under `.prime-issues/`. Add that path to the repo's `.gitignore`.
