---
name: orchestrate
description: Implement one ready-for-agent GitHub issue end to end — create an umbrella branch off development, run an implementer subagent in an isolated worktree, review it, and merge a slice pull request into the umbrella branch. Use when the user wants to autonomously orchestrate agent-driven implementation of a tracked issue, or invokes /orchestrate.
---

# Orchestrate

Drive one `ready-for-agent` GitHub issue from open to a reviewed, merged slice,
with no human in the loop. This is the single-issue path — one issue, one slice.

## Roles and the safety boundary

- **Orchestrator** — you, running this skill. You own every git, GitHub, and
  shell operation: branches, worktrees, commits, pushes, pull requests, merges.
- **Implementer** — the `implementer` subagent. It edits code in an isolated
  worktree and verifies it through the orchestrate capability tools.
- **Reviewer** — the `reviewer` subagent. It reviews the implemented slice in
  the same worktree, fixes clarity and consistency issues inline, re-runs the
  capability tools, and gates the auto-merge.

Both subagents have **no Bash and no git access** — they are sandboxed to file
edits inside one worktree. Only the orchestrator touches branches, remotes, and
the tracker.

## Prerequisites

Check these before starting. If one is missing, report it and stop.

- `gh` CLI is installed and authenticated (`gh auth status`).
- The repository's `origin` remote has a `development` branch — it is the
  integration base.
- The orchestrate MCP server is available (its tools are used below).
- Branch protection does not block merges into `orchestrate/umbrella-*` or
  `orchestrate/slice-*` branches — the auto-merge in step 9 needs them open.

The target project should also have a committed `.orchestrate/commands.json`
(see the plugin's `templates/commands.json`) so the implementer and reviewer can
verify their work — without it the capability tools return `not-configured`,
which is tolerated but means no automated verification.

## Procedure

### 1. Resolve the run context

- Confirm the repository root: `git rev-parse --show-toplevel`.
- Fetch so branch operations are based on current refs: `git fetch origin`.
- Confirm the integration base exists: `git rev-parse --verify origin/development`.
- Generate a run id from the current timestamp including seconds, e.g.
  `20260521-015143`, so two runs in the same minute cannot collide.

### 2. Select one ready-for-agent issue

List open issues carrying the `ready-for-agent` label:

```
gh issue list --label ready-for-agent --state open --json number,title --limit 1
```

- If the list is empty, report "no ready-for-agent issues" and stop — this is a
  clean, successful no-op.
- Otherwise take the single issue and read it in full. Always use `--json`;
  plain `gh issue view` can fail on repos with the projectCards deprecation:

```
gh issue view <N> --json number,title,body,labels,state
```

Treat the issue body's **Acceptance criteria** section as the slice contract.

### 3. Create the umbrella branch

The umbrella branch collects slice pull requests; it is created fresh from
`origin/development` (the just-fetched integration base) and pushed so a slice
PR can target it.

```
git branch orchestrate/umbrella-<run-id> origin/development
git push -u origin orchestrate/umbrella-<run-id>
```

### 4. Create the slice worktree

Use the `create_worktree` MCP tool. Branch the slice from the umbrella branch
into a worktree **outside** the repository working tree (e.g. a sibling
`.orchestrate-worktrees/` directory):

- `baseRef`: `orchestrate/umbrella-<run-id>`
- `branch`: `orchestrate/slice-<N>`
- `worktreePath`: an absolute path outside the repo, e.g.
  `<repo-parent>/.orchestrate-worktrees/<run-id>/slice-<N>`
- `repoPath`: the repository root

If `create_worktree` returns `status: "error"`, report the `errorCode` and
`errorMessage` and stop. If `fetchStatus` is `failed`, note it — the slice may
be based on a stale ref — but continue.

### 5. Run the implementer subagent

Spawn the `implementer` subagent with the Agent tool. Its prompt must contain:

- The issue number, title, and full body (the acceptance criteria are its
  contract).
- The **worktree path** from step 4 — tell it every file change goes there.
- An instruction to verify with the capability tools (`run_typecheck`,
  `run_build`, `run_tests`, `run_lint`) using the worktree path as `repoPath`.
- A reminder that it must not commit, push, or run git — the orchestrator does.

When the implementer returns, read its structured summary. If its `status` is
`blocked`, the slice has **FAILED** — handle it per *Failure handling* below
(do not review, commit, or merge).

### 6. Review the slice

Spawn the `reviewer` subagent with the Agent tool, in the **same worktree**. Its
prompt must contain:

- The issue number, title, and full body.
- The **worktree path** from step 4.
- The implementer's `filesChanged` list and `notes`.
- An instruction to verify with the capability tools using the worktree path as
  `repoPath`.

The reviewer reviews the changed files, fixes clarity and consistency issues
inline, and re-runs the capability tools. When it returns:

- `status: "passed"` — continue to step 7.
- `status: "failed"` — the reviewer found a blocker it could not safely fix.
  The slice has **FAILED** — handle it per *Failure handling* below.

### 7. Commit and push the slice

The subagents cannot commit. You do, from outside the worktree with `git -C` —
the commit captures both the implementer's and the reviewer's changes.

Stage exactly the files the subagents reported changing — the union of the
implementer's and the reviewer's `filesChanged` lists. Do **not** use
`git add -A`: the capability tools leave untracked build artifacts (`dist/`,
caches, coverage) in the worktree that must not enter the commit.

```
git -C <worktree-path> add -- <file> <file> ...
```

Confirm something was staged. If `git -C <worktree-path> diff --cached --quiet`
exits 0, nothing changed and the slice has **FAILED** (the subagents produced no
changes) — handle it per *Failure handling* below.

Commit and push. Pass the subject and body as two separate `-m` flags — git
joins them with a blank line, which avoids embedding a newline in a single
shell argument:

```
git -C <worktree-path> commit -m "<type>(<scope>): <issue title>" -m "Closes #<N>"
git -C <worktree-path> push -u origin orchestrate/slice-<N>
```

Use a commit type that fits the change (`feat`, `fix`, `docs`, `refactor`,
`chore`).

### 8. Open the slice pull request

Open a pull request from the slice branch into the umbrella branch:

```
gh pr create \
  --base orchestrate/umbrella-<run-id> \
  --head orchestrate/slice-<N> \
  --title "<issue title>" \
  --body "Implements #<N>.

<short summary of the implementer's and reviewer's changes and verification>"
```

### 9. Auto-merge the slice pull request

The slice passed review, so merge its pull request into the umbrella branch.
GitHub computes mergeability asynchronously — check it before merging rather
than racing a freshly-opened pull request:

```
gh pr view <pr-number> --json mergeable,mergeStateStatus
```

- `mergeable: "UNKNOWN"` — GitHub is still computing; wait a moment and
  re-check.
- `mergeable: "CONFLICTING"` — the slice has **FAILED** (merge conflict) —
  handle it per *Failure handling* below.
- `mergeable: "MERGEABLE"` — merge it:

```
gh pr merge <pr-number> --squash
```

Squash keeps the umbrella history at one commit per slice. Do not delete the
slice branch here — its worktree still holds it.

### 10. Remove the worktree

Only on a merged slice. The work is now captured in the umbrella branch, so the
worktree is disposable. Remove it with the `remove_worktree` MCP tool using
`force: true` — the worktree may hold untracked build artifacts, and forcing
makes cleanup unconditional:

- `worktreePath`: the worktree path from step 4
- `repoPath`: the repository root
- `force`: `true`

### 11. Report

Report the outcome to the user: the issue handled, the umbrella branch, the
slice branch, the slice pull request URL, and that it was merged.

## Failure handling

A slice **FAILS** when the implementer returns `blocked`, the reviewer returns
`failed`, there are no changes to commit, or the merge conflicts. On a FAILED
slice:

- Do **not** commit, open, or merge a pull request for it.
- **Preserve its worktree** — leave it in place so a developer can inspect the
  partial work. Do not call `remove_worktree`.
- Report the failure clearly: the issue, the stage that failed, and why.

Other stop conditions:

- No ready-for-agent issue → clean no-op (step 2).
- `create_worktree` error → report and stop (step 4).

Retry, multi-issue waves, and conflict resolution are added by later capability.
