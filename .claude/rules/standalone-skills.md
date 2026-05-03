---
paths:
  - "skills/*/SKILL.md"
---
# Standalone Skill Conventions

- All analysis must be inline — include explicit bash commands for each step
- Never reference `codebase-analyzer`, `scope-detector`, `file-evaluator`, `artifact-analyzer`, `skill-evaluator`, `hook-evaluator`, `rule-evaluator`, or `subagent-evaluator` agents
- No Task tool, no agent delegation — skills must work with any AI coding tool
- Skills must be fully self-contained
- Analysis phases read converted agent reference docs from `references/` (e.g., `references/codebase-analyzer.md`)
- Reference docs in `references/` are "follow these instructions" content — not executable scripts
- `references/` directory MUST exist alongside SKILL.md and contain evidence-based guidance files
- `assets/templates/` directory MUST exist alongside SKILL.md and contain output templates; validator-type or report-only standalone skills that do not generate templated artifacts MAY omit it
- Templates in `assets/templates/` MAY embed platform-specific format only if the skill's `name` declares that platform target. The skill's `name` field is the canonical platform-target declaration — aliasing to escape this scoping is itself a violation.
- Standalone skills MUST encode behavioral discipline: surface assumptions first, prefer the simplest complete path, keep changes surgical, and define explicit validation targets
- If standalone skills use persuasion patterns, they MUST state the ethical constraint that those patterns support legitimate work only and never bypass safeguards or refusals
- Self-validation phase MUST read `references/validation-criteria.md` and loop until all checks pass
- Reference files must be one level deep from SKILL.md — no nested `references/references/` paths
- Each skill bundles its own copies of shared references — no symlinks, no cross-directory references
- Standalone bundled-file references MUST use relative `references/...` and `assets/templates/...` paths — NEVER `${CLAUDE_SKILL_DIR}`
- When an intentionally shared reference is updated, update all intended copies in sync
- Standalone improve skills MUST suggest only skills and path-scoped rules as migration targets — NEVER hooks or subagents (these require Claude Code plugin architecture)
- When shared references mention hooks or subagents, standalone SKILL.md MUST instruct to substitute with the closest available mechanism (rule or skill)
- SKILL.md `name` field: ≤64 chars, lowercase letters/numbers/hyphens only, no XML tags
- SKILL.md `description` field: non-empty, ≤1024 chars, third person, no XML tags
- SKILL.md body: under 500 lines
