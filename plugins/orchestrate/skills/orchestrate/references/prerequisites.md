# Prerequisites and config bootstrap

Check these before starting. If one is missing, report it and stop.

- `gh` CLI is installed and authenticated (`gh auth status`).
- The repository's `origin` remote has a `development` branch — it is the
  integration base.
- The orchestrate MCP server is available (its tools are used below).
- Branch protection does not block merges into `orchestrate/umbrella-*` or
  `orchestrate/slice-*` branches — the auto-merge needs them open.

The target project's `.orchestrate/` configuration — `commands.json`,
`routing.json`, and the optional `handoff.json` — may be **bootstrapped on the
first run** by the `bootstrap_config` MCP tool (section 1, Fresh run, step 1),
or committed ahead of time from the plugin's `templates/`. Without
`commands.json` the capability tools return `not-configured`, which is
tolerated. **When the bootstrapper writes an empty `commands.json` (`{}`)** —
because no recognized project type was detected — it emits a `warnings[]` field
in its result and surfaces the warning in its human-readable output. This means
`run_tests` and `run_build` will report `not-configured`, and a slice can merge
green with no verification. If you see this warning, edit
`.orchestrate/commands.json` to add your project's test and build commands
before starting the run. When the project's capability commands need installed dependencies,
`commands.json` must also set an `install` command — `create_worktree` runs it
in every fresh worktree, which checks out only tracked files and so has no
dependency directory of its own, and the implementer/conflict-resolver
subagents can re-run it via `run_install` to fetch a dependency they added. The
bootstrapper sets a **PM-aware mutating** `install` automatically for
npm/cargo/python projects — for the JS ecosystem the package manager is keyed
on the lockfile (`pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn,
`package-lock.json`→npm, defaulting to **pnpm** with no lock), and the install
is the mutating/resolving form (`pnpm install` / `npm install`, never
`npm ci`). Maven and Gradle projects are also detected (test, build, and
typecheck commands are set), but receive **no `install` verb** — JVM build
tools resolve dependencies on demand and an install step would fail in a
pom-less worktree; neither ecosystem has a canonical linter, so `lint` is also
omitted. A project that overrides `install` with a strict reproducible form
(`npm ci`, `--frozen-lockfile`) forfeits in-slice new-dependency support — a
subagent has no shell to regenerate the lockfile. Without `routing.json` the
`resolve_routing` tool errors
and the run falls back to the `-standard` variant of every role with no model
override.
An optional `.orchestrate/handoff.json` tunes the context-watchdog threshold
and the successor launcher; without it, built-in defaults apply (see
`references/context-handoff.md`). Installing the `ast-grep` CLI is optional —
it enables the investigator and reviewer subagents' structural code search,
which otherwise falls back to text search.

## Fresh-run config bootstrap (`bootstrap_config`)

On a fresh run (section 1, Fresh run, step 1), bootstrap the configuration if
this is a first-ever run. If the repository has no `.orchestrate/` directory,
call the `bootstrap_config` MCP tool with the repository root as `repoPath` and
this session's model id as `model` (or an explicit `contextWindowTokens`). It
detects the project type, writes a project-appropriate `commands.json`,
`routing.json` (per-tier routing plus the run-wide `intraWaveConcurrency`
policy, defaulting to `parallel`), and `handoff.json`, creates
`.orchestrate/runs/`, and adds `.orchestrate/runs/` to the repository's
`.gitignore`. Every step is
idempotent — an existing committed config is never overwritten — so this
is also a safe no-op on a repository already configured by hand.
