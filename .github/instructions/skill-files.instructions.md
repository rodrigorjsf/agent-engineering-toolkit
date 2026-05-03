---
applyTo: "**/skills/*/SKILL.md"
---

# Skill File Review Guidelines

## YAML Frontmatter (Required)

Every SKILL.md must start with YAML frontmatter containing:
- `name`: lowercase letters, numbers, hyphens only; max 64 characters
- `description`: non-empty, max 1024 characters, third person, no XML tags

Flag any SKILL.md missing frontmatter or violating these constraints.

## Structure Requirements

- Body must be under 500 lines total
- Must define a clear phase-based workflow (Phase 1, Phase 2, etc.)
- Skills MUST encode the behavioral discipline defined in `.github/instructions/karpathy-guidelines.instructions.md` (assumptions-first, simplest path, surgical changes, validation targets).
- If persuasion patterns are used, they must be framed only as support for legitimate, beneficial, well-scoped work — never to bypass safeguards or refusals
- Must include a self-validation phase that reads the relevant `references/*validation-criteria.md` file for that skill
- Reference files must be loaded conditionally using the platform-appropriate skill-root path convention
- Sibling directories `references/` and `assets/templates/` must exist alongside SKILL.md; validator-type or report-only skills that generate no templated artifacts MAY omit `assets/templates/`

## Plugin vs Standalone Pattern (Critical)

Check the file path to determine distribution:

**Plugin skills** (`plugins/*/skills/*/SKILL.md`):
- `plugins/agents-initializer/skills/*/SKILL.md` analysis phases MUST delegate to agents registered in the plugin's `agents/` directory (currently: `codebase-analyzer`, `scope-detector`, `file-evaluator`)
- `plugins/agent-customizer/skills/*/SKILL.md` analysis phases MUST delegate to the registered agent for that phase — use `skill-evaluator`, `hook-evaluator`, `rule-evaluator`, or `subagent-evaluator` for artifact assessment, and use `artifact-analyzer` for broader context when the workflow requires it
- Never contain inline bash analysis commands
- May suggest all 4 migration mechanisms: hooks, rules, skills, subagents
- Cursor plugin skills must reference bundled files with relative paths from the skill root (`references/...`, `assets/templates/...`)
- Claude-targeted plugin skills may use `${CLAUDE_SKILL_DIR}` for bundled file references

**Standalone skills** (`skills/*/SKILL.md`):
- ALL analysis must be inline — explicit bash commands for each step
- Must NEVER reference agent names or use Task tool delegation
- Must suggest ONLY skills and path-scoped rules as migration targets
- Follow the skill runtime's supported bundled-file path convention consistently within the file

## Platform-Specific Output (Critical)

- `init-claude`/`improve-claude` skills → generate `.claude/rules/` and `CLAUDE.md`
- `init-cursor`/`improve-cursor` skills → generate `.cursor/rules/*.mdc` and AGENTS.md
- `init-agents`/`improve-agents` skills → generate only AGENTS.md (portable)
- Verify Claude artifacts (`.claude/rules/`, `CLAUDE.md`, `paths:`) in cursor skills
- Verify Cursor artifacts (`.cursor/rules/`, `.mdc`, `globs:`) in claude skills

## Evaluating New Patterns

- New plugins or skill types may introduce new delegation patterns — verify they follow the plugin vs standalone boundary
- A new platform target (beyond Claude/Cursor) may produce different artifact types — check for internal consistency
- New skill variants should update the relevant `.claude/rules/` file to document the new pattern

## Common Issues to Flag

- Mixing delegation patterns (inline bash in plugin skills, agent references in standalone)
- Missing self-validation phase
- Missing behavioral-guidance section or equivalent behavioral constraints
- Persuasion framing without an explicit ethical guardrail
- References to files outside the skill's own directory
- Phase instructions that are vague rather than actionable
- Cross-platform contamination (Claude references in Cursor skills or vice versa)
- Name or description exceeding character limits
