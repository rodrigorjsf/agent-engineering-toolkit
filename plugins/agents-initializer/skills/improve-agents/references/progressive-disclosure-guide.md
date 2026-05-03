# Progressive Disclosure Guide

Where AGENTS.md / CLAUDE.md content lives by load timing.
Sources: a-guide-to-agents.md, research-context-engineering-comprehensive.md, memory/how-claude-remembers-a-project.md.

For anti-patterns to detect and remove (ball-of-mud growth, auto-generated init files, everything-in-one-file), see `what-not-to-include.md` § Common Traps. For validation thresholds, see `validation-criteria.md`.

---

## File Hierarchy

Place content based on what's relevant when. **Root AGENTS.md / CLAUDE.md** — relevant to every task; always loaded. **Domain file** — one domain (TypeScript, testing); on-demand. **Subdirectory AGENTS.md / CLAUDE.md** — one package or area; on-demand. **`.claude/rules/` path-scoped** — file patterns; on-demand on file match. **Skill** — workflow agent invokes explicitly; on-demand.

*Source: a-guide-to-agents.md lines 228-233; research-context-engineering-comprehensive.md lines 257-305*

---

## Root File Requirements

Generate root files with only: (1) one-sentence project description (anchors agent decisions); (2) package manager — only if non-standard; (3) build/typecheck commands — only if non-standard; (4) progressive-disclosure pointers to domain files (no inline content). "The absolute minimum… everything else should go elsewhere." (a-guide-to-agents.md)

---

## Monorepo Placement

**Root**: monorepo purpose, package navigation, shared tooling — never package-specific tech stacks. **Package**: package purpose, specific tech stack, package-specific conventions — never cross-repo decisions. The agent sees all merged files in its context. In large monorepos, use `claudeMdExcludes` in `.claude/settings.local.json` to skip irrelevant ancestor CLAUDE.md files (glob patterns match absolute paths; arrays merge across settings layers; managed policy files cannot be excluded).

*Source: a-guide-to-agents.md; memory/how-claude-remembers-a-project.md lines 243-260*

---

## Extraction Triggers

Extract a section to a separate domain file when it has 3+ distinct rules AND spans 10+ lines, or when irrelevant to most work sessions. Prefer "For TypeScript conventions, see docs/TYPESCRIPT.md" over inlining. Workflows go to skills (agent invokes only when needed; base context stays minimal).

*Source: a-guide-to-agents.md lines 110-163*

---

## CLAUDE.md Hierarchy

Loading by scope: org-wide managed policy (MDM) and personal `~/.claude/CLAUDE.md` always load; project `./CLAUDE.md` or `./.claude/CLAUDE.md` loads at session start; subdirectory `./subdir/CLAUDE.md` and path-scoped `.claude/rules/*.md` (with `paths:`) load on-demand. Prioritize on-demand.

**@import** — `@path/to/file` expands at launch alongside the importer; relative paths resolve relative to the importing file (not CWD); max recursion 5 hops; one-time user approval per project.

**Load order** — Claude Code walks up the directory tree from CWD, loading every ancestor CLAUDE.md at session start. Subdirectory files load only when Claude reads files in that directory.

*Source: research-context-engineering-comprehensive.md lines 181-208, 257-305*

---

## AGENTS.md Notes

For cross-tool compatibility, symlink `ln -s AGENTS.md CLAUDE.md`. AGENTS.md has no `.claude/rules/` equivalent (use subdirectory AGENTS.md). Subdirectory AGENTS.md files merge with the root rather than replace.
