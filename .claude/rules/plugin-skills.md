---
paths:
  - "plugins/agents-initializer/skills/*/SKILL.md"
  - "plugins/agent-customizer/skills/*/SKILL.md"
---
# Plugin Skill Conventions

- For `plugins/agents-initializer/skills/*`: analysis phases MUST delegate to agents registered in the plugin's `agents/` directory (currently: `codebase-analyzer`, `scope-detector`, `file-evaluator`)
- For `plugins/agent-customizer/skills/*`: analysis phases MUST delegate to the registered agent for that phase — use `skill-evaluator`, `hook-evaluator`, `rule-evaluator`, or `subagent-evaluator` for artifact assessment, and use `artifact-analyzer` for broader context when the workflow requires it
- Never add inline bash analysis here — subagent delegation keeps the orchestrator context clean
- Reference agents by registered name for the target plugin (e.g., "Delegate to the `codebase-analyzer` agent with this task:")
- `references/` directory MUST exist alongside SKILL.md and contain evidence-based guidance files
- `assets/templates/` directory MUST exist alongside SKILL.md and contain output templates; validator-type or report-only plugin skills that do not generate templated artifacts MAY omit it
- Skills MUST encode the behavioral discipline defined in `.github/instructions/karpathy-guidelines.instructions.md` (assumptions-first, simplest path, surgical changes, validation targets).
- If plugin skills use persuasion patterns, they MUST state the ethical constraint that those patterns support legitimate work only and never bypass safeguards or refusals
- Self-validation phase MUST read the relevant `references/*validation-criteria.md` file for that skill and loop until all checks pass
- Reference files must be one level deep from SKILL.md — no nested `references/references/` paths
- Conditional reference loading pattern: "read X only if project uses Y"
- Plugin improve skills suggest available migration mechanisms (currently: hooks, path-scoped rules, skills, and subagents)
- SKILL.md `name` field: ≤64 chars, lowercase letters/numbers/hyphens only, no XML tags
- SKILL.md `description` field: non-empty, ≤1024 chars, third person, no XML tags
- SKILL.md body: under 500 lines
