# Progressive Disclosure Guide

Evidence-based instructions for structuring AGENTS.md and CLAUDE.md hierarchies.
Sources: a-guide-to-agents.md, research-context-engineering-comprehensive.md, memory/how-claude-remembers-a-project.md.

---

## Contents

- File hierarchy decision (where content lives by load timing)
- Root file requirements (minimal elements only)
- Monorepo: what goes where (root vs package level, `claudeMdExcludes`)
- Progressive disclosure patterns (domain files, nested docs, skills)
- CLAUDE.md-specific hierarchy (scopes, @import, load order)
- AGENTS.md-specific notes (cross-tool symlink, merging)

For anti-patterns to detect and remove (ball-of-mud growth, auto-generated init files, everything-in-one-file), see `what-not-to-include.md` § Common Traps. For validation thresholds, see `validation-criteria.md`.

---

## File Hierarchy Decision

Place content based on what's relevant when. **Root AGENTS.md / CLAUDE.md**: relevant to every task, always loaded. **Separate domain file**: relevant to one domain (TypeScript, testing, API design), on-demand. **Subdirectory AGENTS.md / CLAUDE.md**: specific to one package or area, on-demand when working there. **`.claude/rules/` path-scoped**: specific to certain file patterns, on-demand when files match. **Skill**: a workflow the agent invokes explicitly, on-demand.

*Source: a-guide-to-agents.md lines 228-233; research-context-engineering-comprehensive.md lines 257-305*

---

## Root File Requirements

Generate root files with only these elements: (1) one-sentence project description (anchors agent decisions, e.g. "This is a React component library for accessible data visualization."); (2) package manager — only if non-standard (`pnpm`, `bun`; omit if npm); (3) build/typecheck commands — only if non-standard; (4) progressive disclosure pointers to domain files (no inline content). "Consider this the absolute minimum… everything else should go elsewhere." (a-guide-to-agents.md)

---

## Monorepo: What Goes Where

- **Root**: monorepo purpose, package navigation, shared tooling. Don't put package-specific tech stacks or per-package conventions here.
- **Package**: package purpose, specific tech stack, package-specific conventions. Don't put cross-repo decisions here.

Don't overload any level — the agent sees all merged files in its context. In large monorepos, use `claudeMdExcludes` in `.claude/settings.local.json` to skip irrelevant ancestor CLAUDE.md files (glob patterns match absolute paths; arrays merge across settings layers; managed policy files cannot be excluded).

*Source: a-guide-to-agents.md; memory/how-claude-remembers-a-project.md lines 243-260*

---

## Progressive Disclosure Patterns

Apply when content exceeds root-file scope. **Extraction trigger**: extract a section to a separate domain file when it has 3+ distinct rules AND spans 10+ lines, or when the topic is irrelevant to most work sessions. **Move domain rules to separate files**: prefer "For TypeScript conventions, see docs/TYPESCRIPT.md" over inlining domain rules. **Nest hierarchically**: domain docs reference each other rather than the root inlining everything. **Use skills for workflows** — agents invoke them only when needed, keeping base context minimal.

*Source: a-guide-to-agents.md lines 110-163*

---

## CLAUDE.md-Specific Hierarchy

Loading by scope: org-wide managed policy (MDM) and personal `~/.claude/CLAUDE.md` always load; project `./CLAUDE.md` or `./.claude/CLAUDE.md` loads at session start; subdirectory `./subdir/CLAUDE.md` and path-scoped `.claude/rules/*.md` (with `paths:`) load on-demand. Priority: minimize always-loaded content; move to on-demand locations.

**@import syntax** — CLAUDE.md files can include other files with `@path/to/file`. Imports expand at launch alongside the importer; relative paths resolve relative to the importing file, not CWD; max recursion depth is 5 hops; requires one-time user approval per project.

**Load order** — Claude Code walks up the directory tree from CWD, loading every ancestor CLAUDE.md at session start. Subdirectory files load on-demand only when Claude reads files in that directory.

*Source: research-context-engineering-comprehensive.md lines 181-208, 257-305*

---

## AGENTS.md-Specific Notes

For cross-tool compatibility, symlink `ln -s AGENTS.md CLAUDE.md`. AGENTS.md has no `.claude/rules/` equivalent (use subdirectory AGENTS.md files), and subdirectory AGENTS.md files merge with root rather than replace.
