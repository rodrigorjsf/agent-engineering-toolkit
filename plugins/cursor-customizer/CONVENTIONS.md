# cursor-customizer Plugin

Follows the official Cursor plugin specification. Customizer of the Cursor distribution: creates and improves individual Cursor artifacts (rules, hooks, skills, subagents) inside an already-initialized project. Sibling of `cursor-initializer`.

## Conventions

- `skills/` — `SKILL.md` entry points; per-skill `references/` and `assets/templates/` directories land with each artifact-type slice.
- `agents/` — Cursor-native subagent format: frontmatter exposes exactly the four Cursor-native fields (`name`, `description`, `model`, `readonly`) and nothing else.
- Plugin agents MUST NOT spawn other agents and cannot perform writes when `readonly: true`.
- Generated artifacts target Cursor-native locations only: rules under `.cursor/rules/*.mdc`, skills under `.cursor/skills/` by default (`.agents/skills/` for portable workflows), subagents under `.cursor/agents/`, hooks per the project's Cursor hook configuration.
- Generated rule files use `.mdc` format with frontmatter limited to `description`, `alwaysApply`, `globs`.
- Shared references are copied into each skill (not symlinked) — there is no plugin-root `references/` directory.
- `agents/` will grow as artifact-type slices land: per-type evaluators alongside `artifact-analyzer`.

## Boundary with cursor-initializer

- `cursor-initializer` bootstraps the platform-wide configuration of a new project (one-shot setup of `.cursor/rules/*.mdc` + legacy AGENTS.md migration).
- `cursor-customizer` operates on a project that is already initialized: single-artifact CRUD for rules, hooks, skills, and subagents. Never bootstraps the project; never touches platform-wide configuration outside the artifact under work.
