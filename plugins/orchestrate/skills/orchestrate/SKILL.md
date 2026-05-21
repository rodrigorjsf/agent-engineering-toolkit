---
name: orchestrate
description: Implement one ready-for-agent GitHub issue end to end — create an umbrella branch off development, run an implementer subagent in an isolated worktree, verify, and open a slice pull request. Use when the user wants to autonomously orchestrate agent-driven implementation of a tracked issue, or invokes /orchestrate.
---

# Orchestrate

Drive one `ready-for-agent` GitHub issue from open to an opened pull request,
with no human in the loop. This is the walking skeleton — a single issue, a
single slice.

## Roles and the safety boundary

- **Orchestrator** — you, running this skill. You own every git, GitHub, and
  shell operation: branches, worktrees, commits, pushes, pull requests.
- **Implementer** — the `implementer` subagent you spawn. It edits code in an
  isolated worktree and verifies it through the orchestrate capability tools.
  It has **no Bash and no git access**.

The safety model is that only the orchestrator touches branches, remotes, and
the tracker; the implementer is sandboxed to file edits inside one worktree.

## Prerequisites

Check these before starting. If one is missing, report it and stop.

- `gh` CLI is installed and authenticated (`gh auth status`).
- The repository's `origin` remote has a `development` branch — it is the
  integration base.
- The orchestrate MCP server is available (its tools are used below).

The target project should also have a committed `.orchestrate/commands.json`
(see the plugin's `templates/commands.json`) so the implementer can verify its
work — without it the capability tools return `not-configured`, which is
tolerated but means no automated verification.

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
`blocked`, do **not** open a pull request: report the blocker, leave the
worktree in place for inspection, and stop.

### 6. Commit and push the slice

The implementer cannot commit. You do, from outside the worktree with `git -C`:

Pass the subject and body as two separate `-m` flags — git joins them with a
blank line, which avoids embedding a newline in a single shell argument:

```
git -C <worktree-path> add -A
git -C <worktree-path> commit -m "<type>(<scope>): <issue title>" -m "Closes #<N>"
git -C <worktree-path> push -u origin orchestrate/slice-<N>
```

Use a commit type that fits the change (`feat`, `fix`, `docs`, `refactor`,
`chore`). If `git commit` reports nothing to commit, the implementer produced no
changes — treat that as a blocked slice: report it and stop.

### 7. Open the slice pull request

Open a pull request from the slice branch into the umbrella branch:

```
gh pr create \
  --base orchestrate/umbrella-<run-id> \
  --head orchestrate/slice-<N> \
  --title "<issue title>" \
  --body "Implements #<N>.

<short summary of the implementer's changes and verification results>"
```

### 8. Remove the worktree

The slice work is now safely captured in the branch and the pull request, so
the worktree is disposable. Remove it with the `remove_worktree` MCP tool using
`force: true` — the worktree may hold untracked build artifacts, and forcing
makes cleanup unconditional:

- `worktreePath`: the worktree path from step 4
- `repoPath`: the repository root
- `force`: `true`

### 9. Report

Report the outcome to the user: the issue handled, the umbrella branch, the
slice branch, and the slice pull request URL.

## Failure handling

This walking skeleton stops on the first failure rather than recovering:

- No ready-for-agent issue → clean no-op (step 2).
- `create_worktree` error → report and stop (step 4).
- Implementer `blocked`, or no changes to commit → report, leave the worktree
  for inspection, and stop (steps 5–6).

Automated review, retry, and multi-issue waves are added by later capability.
