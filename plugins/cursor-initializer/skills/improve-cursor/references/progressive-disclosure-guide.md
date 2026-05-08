# Progressive Disclosure Guide

Where AGENTS.md and `.cursor/rules/*.mdc` content lives by load timing.
Sources: a-guide-to-agents.md, research-context-engineering-comprehensive.md, memory/how-claude-remembers-a-project.md.

For anti-patterns (ball-of-mud growth, auto-generated init files, everything-in-one-file), see `what-not-to-include.md` § Common Traps. For validation thresholds, see `validation-criteria.md`.

---

## File Hierarchy

Place content based on what's relevant when. **Root AGENTS.md** — relevant to every task; always loaded. **Domain file** — one domain (TypeScript, testing); on-demand. **Subdirectory AGENTS.md** — specific to one package or area; on-demand. **`.cursor/rules/*.mdc` with `globs:`** — file patterns; on-demand on file match. **Skill** — workflow agent invokes explicitly; on-demand.

**Borderline tiebreaker (10–15 lines)**: when domain content falls between 10–15 lines, prefer extracting to a separate domain file if it applies to only one domain. Root brevity is more valuable than an additional file.

*Source: a-guide-to-agents.md lines 228-233; research-context-engineering-comprehensive.md lines 257-305*

---

## Root File Requirements

Generate root files with only: (1) one-sentence project description; (2) package manager — only if non-standard; (3) build/typecheck commands — only if non-standard; (4) progressive-disclosure pointers to domain files (no inline content). "The absolute minimum… everything else should go elsewhere." (a-guide-to-agents.md)

---

## Monorepo Placement

**Root**: monorepo purpose, package navigation, shared tooling — never package-specific tech stacks. **Package**: package purpose, specific tech stack, package-specific conventions — never cross-repo decisions. The agent sees all merged files. In Cursor monorepos, use `.cursor/rules/*.mdc` with narrow `globs:` patterns; keep `alwaysApply: true` rules minimal.

*Source: a-guide-to-agents.md; memory/how-claude-remembers-a-project.md lines 243-260; docs/cursor/rules-and-memory.md*

---

## Extraction Triggers

Extract a section to a separate domain file when it has 3+ distinct rules AND spans 10+ lines, or when irrelevant to most work sessions. Prefer "For TypeScript conventions, see docs/TYPESCRIPT.md" over inlining. Workflows go to skills (agent invokes only when needed).

*Source: a-guide-to-agents.md lines 110-163*

---

## Cursor Rule Scoping

Use `.cursor/rules/*.mdc` when guidance depends on file patterns, activation mode, or agent-requested loading. Keep rule metadata minimal — only `description`, `alwaysApply`, `globs`. Prefer narrow `globs:` over `alwaysApply: true` when guidance applies to specific files only.

---

## AGENTS.md in Cursor

Cursor supports AGENTS.md at the project root and in subdirectories. Nested AGENTS.md files merge with parents; more specific scopes take precedence. Keep AGENTS.md for project-wide or directory-wide guidance; move file-pattern-specific instructions to `.cursor/rules/*.mdc`.
