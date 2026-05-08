# Claude Rules System

Instructions for generating and improving `.claude/rules/` and CLAUDE.md hierarchy.
Claude Code-specific — not applicable to AGENTS.md skills.
Sources: research-claude-code-skills-format.md, research-context-engineering-comprehensive.md, init-claude/SKILL.md, memory/how-claude-remembers-a-project.md

---

## Contents

- Loading behavior summary (defers full table to progressive-disclosure-guide)
- Path-scoping syntax (YAML frontmatter for conditional loading)
- When to create rules files (conventions and domain-critical)
- When NOT to create rules files (content belongs elsewhere)
- Rules directory structure (organization and discovery)
- Rules vs CLAUDE.md decision table
- Maximize on-demand loading (priority order for placement)

---

## Loading Behavior Summary

`.claude/rules/*.md` without `paths:` frontmatter loads at session start (always consumed). With `paths:`, it loads only when matching files are read (on-demand). The full loading-timing matrix for CLAUDE.md, subdirectory CLAUDE.md, domain docs, and skills lives in `progressive-disclosure-guide.md` § CLAUDE.md-Specific Hierarchy.

`claudeMdExcludes` (in `.claude/settings.local.json`) skips irrelevant ancestor CLAUDE.md files in large monorepos.

*Source: memory/how-claude-remembers-a-project.md lines 243-260; research-context-engineering-comprehensive.md:181-208*

---

## Path-Scoping Syntax

Add YAML frontmatter to any `.claude/rules/` file to trigger it only on matching files:

```yaml
---
paths:
  - "src/api/**/*.ts"
  - "**/*.test.ts"
---
# API Development Rules
- All API endpoints must include input validation
- Return consistent error response objects
```

Rules **without** `paths:` frontmatter load unconditionally at session start (always consumed).

*Source: research-context-engineering-comprehensive.md lines 181-196*

---

## When to Create Rules Files

Two categories warrant a `.claude/rules/` file: (1) **convention rules** — file-pattern-specific coding conventions (style rules for `**/*.ts`, `**/*.test.ts`; framework-specific patterns like route handlers or migration scripts), only when non-obvious enough to cause mistakes; (2) **domain-critical rules** — security, privacy, or compliance triggered by sensitive file patterns.

*Source: init-claude/SKILL.md:118-136*

---

## When NOT to Create Rules Files

Project-wide general conventions belong in root `CLAUDE.md`; scope-wide conventions for one area belong in a subdirectory `CLAUDE.md`; obvious patterns the model already knows should be omitted entirely.

---

## Rules Directory Structure

`.claude/rules/` holds one file per topic with descriptive filenames (e.g., `code-style.md`, `testing.md` with `paths: ["**/*.test.*"]`, `security.md` with `paths: ["src/api/**"]`); subdirectories like `frontend/react.md` group rules by domain. Files are discovered recursively. Symlinks are supported for cross-project sharing (circular symlinks handled gracefully). User-level rules (`~/.claude/rules/`) apply to all projects but project rules take precedence.

*Source: research-context-engineering-comprehensive.md lines 284-305*

---

## Rules vs CLAUDE.md Decision Table

Relevant to every task → root `./CLAUDE.md`. Relevant to one area/package → `subdir/CLAUDE.md`. Specific to file patterns → `.claude/rules/rule.md` with `paths:`. Workflow the agent invokes explicitly → skill.

---

## Maximize On-Demand Loading

When placing new content, prefer this priority order: (1) path-scoped `.claude/rules/` file → (2) subdirectory `CLAUDE.md` → (3) domain doc (`docs/TESTING.md`) → (4) skill → (5) only if truly needed every task, root `CLAUDE.md`. The 5-scope CLAUDE.md hierarchy table (Managed/CLI/Local/Project/User) lives in `progressive-disclosure-guide.md`.

*Source: research-context-engineering-comprehensive.md lines 259-282*
