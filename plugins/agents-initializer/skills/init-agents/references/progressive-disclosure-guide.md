# Progressive Disclosure Guide

Evidence-based instructions for structuring AGENTS.md and CLAUDE.md hierarchies.

---

## Contents

- File hierarchy decision table (where to place content)
- Root file requirements (minimal elements only)
- Monorepo: what goes where (root vs package level, claudeMdExcludes)
- Progressive disclosure patterns (domain files, nested docs, skills)
- CLAUDE.md-specific hierarchy (5 scopes, @import, load order)
- AGENTS.md-specific notes (open standard, symlinks, merging)
- Anti-patterns to detect and remove
- Validation checklist

---

## File Hierarchy Decision Table

When deciding where to place content, use this table:

| Location | Use when content is... | Load timing |
|----------|------------------------|-------------|
| Root AGENTS.md / CLAUDE.md | Relevant to **every single task** in the repo | Always (every request) |
| Separate domain file | Relevant to one domain (TypeScript, testing, API design) | On-demand |
| Subdirectory AGENTS.md / CLAUDE.md | Specific to one package or area | On-demand when working there |
| `.claude/rules/` (path-scoped) | Specific to certain file patterns | On-demand when files match |
| Skill | A workflow the agent should invoke explicitly | On-demand when invoked |


---

## Root File Requirements

Generate root files with **only** these elements:

1. **One-sentence project description** — anchors every agent decision ("This is a React component library for accessible data visualization.")
2. **Package manager** — only if non-standard (e.g., `pnpm`, `bun`; omit if npm)
3. **Build/typecheck commands** — only if non-standard
4. **Progressive disclosure pointers** — links to domain files, not inline content

> "Consider this the absolute minimum... That's honestly it. Everything else should go elsewhere."
> — a-guide-to-agents.md

---

## Monorepo: What Goes Where

| Level | Generate here | Do NOT put here |
|-------|---------------|-----------------|
| Root | Monorepo purpose, how to navigate packages, shared tooling | Package-specific tech stacks, package conventions |
| Package | Package purpose, specific tech stack, package-specific conventions | Cross-repo decisions |

Root example:

```markdown
This is a monorepo containing web services and CLI tools.
Use pnpm workspaces to manage dependencies.
See each package's AGENTS.md for specific guidelines.
```

> "Don't overload any level. The agent sees all merged files in its context."
> — a-guide-to-agents.md lines 164-193

**`claudeMdExcludes`**: In large monorepos, skip irrelevant ancestor CLAUDE.md files via `.claude/settings.local.json`:

```json
{ "claudeMdExcludes": ["**/other-team/CLAUDE.md", "**/other-team/.claude/rules/**"] }
```

Patterns match absolute paths with glob syntax. Arrays merge across settings layers. Managed policy CLAUDE.md files cannot be excluded.


---

## Progressive Disclosure Patterns

Apply these patterns when content exceeds root-file scope:

**Extraction trigger**: Extract a section to a separate domain file when it has 3+ distinct rules AND spans 10+ lines, OR when the topic is irrelevant to most work sessions (e.g., database migration conventions in a project where most work is UI changes).

**Move domain rules to separate files:**

```markdown
# In root file — do this:
For TypeScript conventions, see docs/TYPESCRIPT.md

# NOT this (inline domain rules):
Always use const instead of let. Never use var...
```

**Nest disclosure hierarchically:**

```
docs/
├── TYPESCRIPT.md      → references TESTING.md
├── TESTING.md         → references test runners
└── BUILD.md           → references build config
```

**Use skills for workflows** — agents invoke skills only when needed, keeping base context minimal.


---

## CLAUDE.md-Specific Hierarchy

| Scope | Location | Loads when |
|-------|----------|------------|
| Org-wide | Managed policy (MDM) | Always |
| Project | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Session start (always) |
| Personal | `~/.claude/CLAUDE.md` | Session start (always) |
| Subdirectory | `./subdir/CLAUDE.md` | When reading files in that dir |
| Path-scoped rules | `.claude/rules/*.md` with `paths:` | When matching files are read |

**Priority rule**: Minimize content in always-loaded locations. Move to on-demand locations wherever possible.

**@import syntax**: CLAUDE.md files can import additional files with `@path/to/file`. Imports expand at launch alongside the importing CLAUDE.md. Relative paths resolve relative to the importing file, not CWD. Max recursion depth: 5 hops. Requires one-time user approval per project.

**Load order**: Claude Code walks up the directory tree from CWD, loading every ancestor CLAUDE.md at session start. Subdirectory CLAUDE.md files load on-demand only when Claude reads files in that directory — not at launch.


---

## AGENTS.md-Specific Notes

- AGENTS.md is an **open standard** supported by most agent frameworks (not Claude Code)
- Claude Code uses CLAUDE.md; create a symlink for cross-tool compatibility: `ln -s AGENTS.md CLAUDE.md`
- AGENTS.md has **no `.claude/rules/` equivalent** — use subdirectory AGENTS.md files for scoped rules
- Subdirectory AGENTS.md files **merge with root** (not replace)

---

## Anti-Patterns to Detect and Remove

| Anti-pattern | Why it fails | Fix |
|--------------|--------------|-----|
| Ball-of-mud growth | Each fix adds a rule; after hundreds of additions the file confuses agents | Refactor with progressive disclosure |
| Auto-generated init files | "Prioritize comprehensiveness over restraint" — flood file with irrelevant content | Author manually, restraint first |
| Everything in one file | Exceeds ~150-200 instruction attention budget | Split by domain |

> "There's a natural feedback loop that causes AGENTS.md files to grow dangerously large."
> — a-guide-to-agents.md lines 34-43

---

## Validation

Before finalizing any generated hierarchy, check:

- [ ] Root file contains ONLY: one-liner, package manager (if non-standard), build commands (if non-standard), pointers
- [ ] Domain content lives in separate files, not inlined
- [ ] No file exceeds 200 lines
- [ ] Each file covers exactly one scope
- [ ] Subdirectory files exist for areas with distinct tooling or conventions
