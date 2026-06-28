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

### Routing labels and the Fable premium lane

`routing.json` (v2) carries an optional `labels` block — a map of `route:*`
label names to a routing override. When a slice issue carries one of those
labels, `resolve_routing` patches the named roles with the label's `{model,
variant}` and resolves its optional model `fallback`. The orchestrator passes
the issue's labels to `resolve_routing` **once, at slice creation**, and freezes
the result into the slice's `resolvedRouting` checkpoint; every later spawn and
every resume routes from that frozen checkpoint, never from live labels (the
mechanics are in `references/slice-pipeline.md` step 2, the judgment in the
spine). The orchestrator may **suggest** a `route:*` label in its report but
**never applies one itself**.

- **`route:fable`** — the canonical premium lane: a **label-gated,
  implementer-only** override that spawns the implementer on a premium model
  with an `opus` fallback. It is **not** a complexity tier — it is orthogonal to
  `trivial`/`standard`/`complex` and is triggered solely by the label.
- **Unconfigured `route:*` label** — a `route:*` label on the slice that the
  `labels` block does not define produces a loud **WARNING** in the run report
  (`resolve_routing`'s `warnings[]`): the label had no effect; fix `routing.json`
  or drop the label.
- **Same-role conflict** — two applied labels that patch the **same** role is a
  loud **ERROR** (`resolve_routing` `LABEL_CONFLICT`); there is no precedence
  rule and the slice FAILS until the operator resolves it in `routing.json`.
- **Security exclusion** — the Fable lane is **excluded for security/cyber
  slices**: Fable's safety classifiers refuse benign security work, so such a
  slice would only burn the spawn and fall through to the `opus` fallback. Do
  **not** apply (or suggest) `route:fable` on a security/cyber slice; route it
  through the ordinary complexity tiers instead.

An optional `.orchestrate/handoff.json` tunes the context-watchdog threshold
and the successor launcher; without it, built-in defaults apply (see
`references/context-handoff.md`). Installing the `ast-grep` CLI is optional —
it enables the investigator and reviewer subagents' structural code search,
which otherwise falls back to text search.

To run the one-time setup and inspect the partition and wave plan before
committing the full execution, use the pre-flight mode: `/orchestrate preflight
<PRD#>` runs Fresh-run steps 1–6 (including this bootstrap), then stops before
the wave loop; `/orchestrate <PRD#>` in a fresh session resumes it.

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
