# Claude Code Worktrees

**Summary**: CLI-native git-worktree isolation in Claude Code: the --worktree/-w flag, base-branch selection (worktree.baseRef, PR worktrees), .worktreeinclude, subagent worktree isolation, change-aware cleanup, and non-git VCS hooks.
**Sources**: parallel-sessions-worktrees.md
**Last updated**: 2026-06-04
---

A git worktree is a separate working directory with its own files and branch that shares the same repository history and remote as the main checkout (source: parallel-sessions-worktrees.md). Running each Claude Code session in its own worktree means edits in one session never touch files in another, so Claude can build a feature in one terminal while fixing a bug in a second (source: parallel-sessions-worktrees.md). Everything on this page assumes a git repository; for other version control systems, see [Non-git version control](#non-git-version-control) (source: parallel-sessions-worktrees.md).

## File isolation versus work coordination

Worktrees are deliberately distinct from [[claude-code-subagents]] and agent teams: worktrees isolate **file edits**, while subagents and agent teams **coordinate the work itself** (source: parallel-sessions-worktrees.md). The two approaches compose rather than compete — subagents can run inside worktrees — but they solve different problems, so reach for worktrees when the concern is files colliding and for subagents/teams when the concern is who does which task (source: parallel-sessions-worktrees.md). These parallel-execution patterns are the file-isolation substrate underneath the orchestration approaches described in [[agent-workflows]] (source: parallel-sessions-worktrees.md).

## Start Claude in a worktree

Pass `--worktree` or `-w` to create an isolated worktree and start Claude in it (source: parallel-sessions-worktrees.md). By default the worktree is created under `.claude/worktrees/<value>/` at the repository root, on a new branch named `worktree-<value>` (source: parallel-sessions-worktrees.md).

```bash
claude --worktree feature-auth
```

Running the command again with a different name in another terminal starts a second isolated session (source: parallel-sessions-worktrees.md). If the name is omitted, Claude generates one such as `bright-running-fox` (source: parallel-sessions-worktrees.md).

```bash
claude --worktree
```

During a session you can also ask Claude to "work in a worktree" and it creates one with the `EnterWorktree` tool (source: parallel-sessions-worktrees.md). Once in a worktree, Claude can switch directly to another one under `.claude/worktrees/` by calling `EnterWorktree` with the target path, and the previous worktree stays on disk untouched (source: parallel-sessions-worktrees.md). The `EnterWorktree`/`ExitWorktree` tools are how Claude moves between isolated checkouts during a session (source: parallel-sessions-worktrees.md).

Before using `--worktree` in a directory for the first time, accept the workspace trust dialog by running `claude` once in that directory (source: parallel-sessions-worktrees.md). If trust has not yet been accepted, `--worktree` exits with an error and prompts you to run `claude` in the directory first — including when combined with `-p` (source: parallel-sessions-worktrees.md). Adding `.claude/worktrees/` to `.gitignore` keeps worktree contents from appearing as untracked files in the main checkout (source: parallel-sessions-worktrees.md).

## Choose the base branch

Worktrees branch from the repository's default branch, `origin/HEAD`, so they start from a clean tree matching the remote (source: parallel-sessions-worktrees.md). If no remote is configured or the fetch fails, the worktree falls back to the current local `HEAD` (source: parallel-sessions-worktrees.md).

To always branch from local `HEAD` instead, set `worktree.baseRef` to `"head"` in settings (source: parallel-sessions-worktrees.md). Setting `baseRef` to `"head"` makes new worktrees carry unpushed commits and feature-branch state, which is useful when isolating subagents that need to operate on in-progress work (source: parallel-sessions-worktrees.md). The setting accepts only `"fresh"` or `"head"`, not arbitrary git refs (source: parallel-sessions-worktrees.md).

```json
{
  "worktree": {
    "baseRef": "head"
  }
}
```

To branch from a specific pull request, pass the PR number prefixed with `#`, or a full GitHub pull request URL (source: parallel-sessions-worktrees.md). Claude Code fetches `pull/<number>/head` from `origin` and creates the worktree at `.claude/worktrees/pr-<number>` (source: parallel-sessions-worktrees.md).

```bash
claude --worktree "#1234"
```

For full control over how worktrees are created, configure a `WorktreeCreate` hook, which replaces the default `git worktree` logic entirely (source: parallel-sessions-worktrees.md). See [[claude-code-hooks]] for the worktree hook events.

## Copy gitignored files into worktrees

A worktree is a fresh checkout, so untracked files like `.env` or `.env.local` from the main repository are not present (source: parallel-sessions-worktrees.md). To copy them automatically when Claude creates a worktree, add a `.worktreeinclude` file to the project root (source: parallel-sessions-worktrees.md).

The file uses `.gitignore` syntax, and only files that match a pattern and are also gitignored are copied, so tracked files are never duplicated (source: parallel-sessions-worktrees.md).

```text
.env
.env.local
config/secrets.json
```

This applies to worktrees created with `--worktree`, to subagent worktrees, and to parallel sessions in the desktop app (source: parallel-sessions-worktrees.md). Note the important exception: when a `WorktreeCreate` hook replaces the default git logic, `.worktreeinclude` is **not** processed, so local config files must be copied inside the hook script instead (source: parallel-sessions-worktrees.md).

## Isolate subagents with worktrees

Subagents can run in their own worktrees so parallel edits don't conflict (source: parallel-sessions-worktrees.md). Ask Claude to "use worktrees for your agents", or set it permanently on a custom subagent by adding `isolation: worktree` to the frontmatter (source: parallel-sessions-worktrees.md). Each subagent gets a temporary worktree that is removed automatically when the subagent finishes without changes (source: parallel-sessions-worktrees.md). See [[claude-code-subagents]] for the full frontmatter contract.

Subagent worktrees use the same base branch as `--worktree`, so they branch from the repository's default branch unless `worktree.baseRef` is set to `"head"` (source: parallel-sessions-worktrees.md).

## Clean up worktrees

Cleanup on exit depends on whether you made changes (source: parallel-sessions-worktrees.md):

- With **no uncommitted changes, no untracked files, and no new commits**, the worktree and its branch are removed automatically; if the session has a name, Claude prompts instead so you can keep the worktree for later (source: parallel-sessions-worktrees.md).
- With **uncommitted changes, untracked files, or new commits**, Claude prompts you to keep or remove the worktree — keeping preserves the directory and branch, while removing deletes the directory and branch and discards those uncommitted changes, untracked files, and commits (source: parallel-sessions-worktrees.md).
- For **non-interactive runs**, worktrees created with `--worktree` alongside `-p` are not cleaned up automatically because there is no exit prompt, so remove them with `git worktree remove` (source: parallel-sessions-worktrees.md).

The asymmetry between automatic and never-automatic cleanup is the load-bearing distinction. Worktrees that Claude created for subagents and background sessions **are** removed automatically once they are older than the `cleanupPeriodDays` setting, provided they have no uncommitted changes, no untracked files, and no unpushed commits (source: parallel-sessions-worktrees.md). Worktrees you create with `--worktree`, by contrast, are **never** removed by that sweep (source: parallel-sessions-worktrees.md).

## Manage worktrees manually

For full control over worktree location and branch configuration, create worktrees with Git directly, which is useful when you need to check out a specific existing branch or place the worktree outside the repository (source: parallel-sessions-worktrees.md).

```bash
git worktree add ../project-feature-a -b feature-a   # new branch
git worktree add ../project-bugfix bugfix-123        # existing branch
cd ../project-feature-a && claude                     # start Claude there
git worktree list                                     # list worktrees
git worktree remove ../project-feature-a              # remove when done
```

Remember to initialize the development environment in each new worktree: install dependencies, set up virtual environments, or run whatever the project's setup requires (source: parallel-sessions-worktrees.md). This per-worktree setup discipline mirrors the guidance for Cursor's worktree feature in [[cursor-tools]], even though the two platforms use different cleanup mechanisms (source: parallel-sessions-worktrees.md).

## Non-git version control

Worktree isolation uses git by default (source: parallel-sessions-worktrees.md). For SVN, Perforce, Mercurial, or other systems, configure `WorktreeCreate` and `WorktreeRemove` hooks to provide custom creation and cleanup logic (source: parallel-sessions-worktrees.md). Because the hook replaces the default git behavior, `.worktreeinclude` is not processed when you use `--worktree`, so you must copy any local configuration files inside your hook script instead (source: parallel-sessions-worktrees.md).

A `WorktreeCreate` hook can read the worktree name from stdin, check out a fresh working copy (for example via `svn checkout`), and print the directory path so Claude Code uses it as the session's working directory (source: parallel-sessions-worktrees.md). Pair it with a `WorktreeRemove` hook to clean up when the session ends (source: parallel-sessions-worktrees.md). See [[claude-code-hooks]] for the input schema and worktree hook event details.

## Related pages

- [[cursor-tools]]
- [[claude-code-subagents]]
- [[claude-code-hooks]]
- [[agent-workflows]]
- [[claude-code-memory]]
