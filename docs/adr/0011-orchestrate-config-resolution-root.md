# Orchestrate resolves capability config from the main repository root

**Status:** accepted (2026-06-02)

The orchestrate capability tools (`run_tests`, `run_build`, `run_typecheck`,
`run_lint`, and the `install` setup step) read `.orchestrate/commands.json` from
the same `cwd` they execute the command in — the slice **worktree**
(`run-command.ts`). But a fresh `git worktree` checks out only tracked files, so
in a worktree the `.orchestrate/` config is untracked-or-absent, the config load
returns `not-configured`, and every capability tool silently no-ops. That is the
keystone bug behind the orchestrator-side capability gate (#230-P1.3), the
known-failures allowlist (#231-P2.5), and any self-verification — all silent
no-ops until it is fixed. We **decouple the two concerns the single `cwd`
conflated**: *where config is read* versus *where the command executes*.
`commands.json` (and `routing.json` / `handoff.json`) is now resolved from the
**main repository root** — via `git rev-parse --git-common-dir`, whose parent is
the main working tree and is uniform for both worktree and non-worktree
invocations — while the command still runs with `cwd` set to the slice worktree,
so tests execute against the slice's code. Config is shared, flat, and read-only
during a run (ADR-0008); it does not need to live in the worktree to be read.

## Considered Options

- **Copy `commands.json` into each worktree at `create_worktree`** — rejected: it
  reintroduces a commit footgun (a present-but-untracked config file can be
  staged into the slice branch), goes stale if config changes mid-run (relevant
  to #235's per-wave `integration` tier), and adds `.orchestrate/` untracked
  noise that the changed-file enumeration (#236) must then filter back out. The
  existing `runInstall` seed precedent does **not** apply: it materializes build
  inputs (`node_modules`) that must physically exist to compile, whereas config
  need not live in the worktree to be read.
- **Hybrid (resolve from root + copy a worktree-local copy for human
  inspection)** — rejected: carries both costs (footgun + staleness) for no real
  gain. A human inspecting a failed worktree runs `mvn test` (or the project's
  real command) directly, not the MCP tool.

## Consequences

- The config-resolution root and the execution `cwd` become two separate inputs
  to the capability and `install` tools; the worktree case is covered by an
  explicit test.
- Eliminates the #236 `.orchestrate/`-in-worktree noise source by construction
  and kills the commit footgun.
- This is the **keystone** of the Tier-1 capability-gated work — until it lands,
  the capability gate, the known-failures allowlist, and self-verification are
  silent no-ops in every worktree.
