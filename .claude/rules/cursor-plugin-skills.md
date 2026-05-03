---
paths:
  - "plugins/cursor-initializer/skills/*/SKILL.md"
  - "plugins/cursor-customizer/skills/*/SKILL.md"
---
# Cursor Plugin Skill Conventions

- Analysis phases MUST delegate to agents registered in the plugin's `agents/` directory (the registered set varies by plugin — e.g., cursor-initializer uses `codebase-analyzer`, `rule-domain-detector`, `file-evaluator`; cursor-customizer uses `artifact-analyzer` plus per-artifact-type evaluators)
- Never add inline bash analysis here — subagent delegation keeps the orchestrator context clean
- Reference agents by registered name (e.g., "Delegate to the `artifact-analyzer` agent with this task:")
- `references/` directory MUST exist alongside SKILL.md and contain evidence-based guidance files
- Skills MUST encode the behavioral discipline defined in `.github/instructions/karpathy-guidelines.instructions.md` (assumptions-first, simplest path, surgical changes, validation targets).
- `assets/templates/` directory MUST exist alongside SKILL.md and contain output templates
- Bundled files in Cursor SKILL.md files MUST be referenced with relative paths from the skill root (`references/...`, `assets/templates/...`), not `${CLAUDE_SKILL_DIR}`
- Self-validation phase MUST read `references/validation-criteria.md` and loop until all checks pass
- Reference files must be one level deep from SKILL.md — no nested `references/references/` paths
- Conditional reference loading pattern: "read X only if project uses Y"
- In `cursor-initializer`: `init-cursor` generates only `.cursor/rules/*.mdc` files; `improve-cursor` migrates AGENTS.md non-destructively into modular rules when the target project has it (the original AGENTS.md is left intact and the user removes it manually after validation). `cursor-customizer` skills do not generate `.cursor/rules/` hierarchies — they CRUD individual artifacts (rules, hooks, skills, subagents) inside an already-initialized project
- Subagent definitions use `readonly: true`, NOT `tools:` whitelists or `maxTurns:`
- .mdc frontmatter allows ONLY: `description` (string), `alwaysApply` (boolean), `globs` (string|array)
- Never use `paths:` in .mdc frontmatter — that is Claude Code specific
- SKILL.md `name` field: ≤64 chars, lowercase letters/numbers/hyphens only, no XML tags
- SKILL.md `description` field: non-empty, ≤1024 chars, third person, no XML tags
- SKILL.md body: under 500 lines
- In `cursor-initializer`: `rule-domain-detector` agent walks a four-tier heuristic (tooling-non-obvious → file-pattern → monorepo-scope → on-demand cross-cutting / domain); empty list is the canonical passing output for trivial single-package projects
- In `cursor-initializer`: `file-evaluator` agent has dual responsibility — per-rule `.mdc` quality assessment, and (when AGENTS.md is present) block-by-block classification of AGENTS.md content by destination activation mode
- `validation-criteria.md` intentionally diverges between `init-cursor` and `improve-cursor` — `improve-cursor` adds preservation, calibration, and migration-sub-flow-schema rules; these files are NOT a parity family
