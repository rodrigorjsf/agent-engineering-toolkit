# Progressive Disclosure Guide

Where AGENTS.md / CLAUDE.md content lives by load timing.
Sources: a-guide-to-agents.md, research-context-engineering-comprehensive.md, memory/how-claude-remembers-a-project.md.

For anti-patterns, see `what-not-to-include.md` § Common Traps. For validation thresholds, see `validation-criteria.md`.

## File Hierarchy

**Root AGENTS.md / CLAUDE.md** — every task; always loaded. **Domain file** — one domain (TypeScript, testing); on-demand. **Subdirectory AGENTS.md / CLAUDE.md** — one package or area; on-demand. **`.claude/rules/` path-scoped** — file patterns; on-demand. **Skill** — workflow agent invokes explicitly; on-demand.

*Source: a-guide-to-agents.md lines 228-233; research-context-engineering-comprehensive.md lines 257-305*

## Root File Requirements

Root files contain only: (1) one-sentence project description; (2) package manager — only if non-standard; (3) build/typecheck commands — only if non-standard; (4) progressive-disclosure pointers (no inline content). "The absolute minimum… everything else should go elsewhere." (a-guide-to-agents.md)

## Monorepo Placement

**Root**: monorepo purpose, package navigation, shared tooling — never package-specific tech stacks. **Package**: package purpose, specific tech stack, package conventions — never cross-repo decisions. The agent sees all merged files. In large monorepos, use `claudeMdExcludes` in `.claude/settings.local.json` (glob patterns; absolute paths; arrays merge across settings layers; managed policy files cannot be excluded).

*Source: a-guide-to-agents.md; memory/how-claude-remembers-a-project.md lines 243-260*

## Extraction Triggers

Extract a section to a separate domain file when 3+ distinct rules AND 10+ lines, or when irrelevant to most sessions. Prefer pointers ("For TypeScript conventions, see docs/TYPESCRIPT.md") over inlining. Workflows go to skills.

*Source: a-guide-to-agents.md lines 110-163*

## CLAUDE.md Hierarchy

Loading by scope: org-wide managed policy (MDM) and personal `~/.claude/CLAUDE.md` always load; project `./CLAUDE.md` or `./.claude/CLAUDE.md` loads at session start; subdirectory `./subdir/CLAUDE.md` and path-scoped `.claude/rules/*.md` (with `paths:`) load on-demand.

**@import** — `@path/to/file` expands at launch; relative paths resolve relative to the importing file (not CWD); max recursion 5; one-time user approval per project.

**Load order** — Claude Code walks up the directory tree from CWD, loading every ancestor CLAUDE.md at session start. Subdirectory files load only when Claude reads files there.

*Source: research-context-engineering-comprehensive.md lines 181-208, 257-305*

## AGENTS.md Notes

For cross-tool compatibility, symlink `ln -s AGENTS.md CLAUDE.md`. AGENTS.md has no `.claude/rules/` equivalent (use subdirectory AGENTS.md). Subdirectory AGENTS.md merges with root.
