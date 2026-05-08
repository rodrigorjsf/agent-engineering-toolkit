# Claude Rules System

`.claude/rules/` and CLAUDE.md hierarchy. Claude Code-specific.
Sources: research-claude-code-skills-format.md, research-context-engineering-comprehensive.md, init-claude/SKILL.md, memory/how-claude-remembers-a-project.md.

## Loading Behavior

`.claude/rules/*.md` without `paths:` loads at session start. With `paths:`, on file match. Full matrix in `progressive-disclosure-guide.md` § CLAUDE.md Hierarchy. `claudeMdExcludes` in `.claude/settings.local.json` skips irrelevant ancestor CLAUDE.md files.

## Path-Scoping

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

Without `paths:`, rules load unconditionally.

## When to Create

Two categories: **convention rules** — file-pattern-specific coding conventions, only when non-obvious enough to cause mistakes; **domain-critical rules** — security, privacy, compliance triggered by sensitive file patterns.

## When NOT to Create

Project-wide → root `CLAUDE.md`. Scope-wide → subdirectory `CLAUDE.md`. Obvious patterns → omit.

## Directory Structure

`.claude/rules/` holds one file per topic with descriptive filenames; subdirectories like `frontend/react.md` group rules by domain. Files discovered recursively. Symlinks supported. User-level rules (`~/.claude/rules/`) apply to all projects; project rules take precedence.

## Rules vs CLAUDE.md

Every task → root `./CLAUDE.md`. One area/package → `subdir/CLAUDE.md`. File-pattern → `.claude/rules/*.md` with `paths:`. Workflow → skill.

## On-Demand Priority

For new content: (1) path-scoped `.claude/rules/` → (2) subdirectory `CLAUDE.md` → (3) domain doc → (4) skill → (5) only if every-task-needed, root `CLAUDE.md`.
