# Agent Configuration Files

**Summary**: Repository-level context files (AGENTS.md, CLAUDE.md, .cursorrules) that provide persistent project-specific instructions to coding agents — the primary interface between developers and AI tools, governed by the principle that less is more.
**Sources**: a-guide-to-agents.md, how-claude-remembers-a-project.md, rules.md, Evaluating-AGENTS-paper.md, analysis-a-guide-to-agents.md, analysis-how-claude-remembers-a-project.md, monorepos-and-large-repos.md
**Last updated**: 2026-06-04

---

## File Types by Platform

| File                    | Platform       | Purpose                              | Loaded                               |
| ----------------------- | -------------- | ------------------------------------ | ------------------------------------ |
| **CLAUDE.md**           | Claude Code    | Project-specific instructions        | Every request (directory hierarchy)  |
| **AGENTS.md**           | Cross-platform | Portable agent instructions          | Every request                        |
| **.cursor/rules/*.mdc** | Cursor         | Scoped rules with activation modes   | By mode (always, auto, glob, manual) |
| **.claude/rules/*.md**  | Claude Code    | Path-scoped rules with glob patterns | When matching files touched          |

## CLAUDE.md Hierarchy

Claude Code discovers CLAUDE.md files via directory traversal:

1. **Managed policy** — `/etc/claude-code/CLAUDE.md` (Linux), `C:\Program Files\ClaudeCode\CLAUDE.md` (Windows)
2. **User** — `~/.claude/CLAUDE.md`
3. **Project** — `./CLAUDE.md` or `./.claude/CLAUDE.md`
4. **Subdirectory** — Nested CLAUDE.md files (lazy loading)

**Load precedence**: Enterprise > Personal > Project

### Import Syntax

- `@README` — Import file content
- `@package.json` — Import project files
- `@~/.claude/my-instructions.md` — Cross-project imports
- Import depth limit: **5 hops maximum**

## Cursor Rules System

Four activation modes for `.cursor/rules/*.mdc` files:

| Mode                | Frontmatter                          | When Active           |
| ------------------- | ------------------------------------ | --------------------- |
| Always Apply        | `alwaysApply: true`                  | Every chat session    |
| Apply Intelligently | `alwaysApply: false` + `description` | Agent deems relevant  |
| Specific Files      | `globs: ["**/*.ts"]`                 | Pattern-matched files |
| Manual              | Neither                              | @-mentioned in chat   |

**Precedence**: Team Rules → Project Rules → User Rules

## Line Budgets

| Config File      | Target          | Maximum   |
| ---------------- | --------------- | --------- |
| Root CLAUDE.md   | 15–40 lines     | 200 lines |
| Plugin CLAUDE.md | 10–30 lines     | 200 lines |
| Rule files       | 10–30 lines     | 200 lines |
| Cursor rules     | Under 500 lines | —         |

## What Belongs in Config Files

**Include** (unique value):

- Build and test commands
- Project-specific conventions not inferable from code
- Non-obvious patterns and gotchas
- Package manager preferences

**Exclude** (redundant or harmful):

- Standard language conventions (agents already know these)
- Information inferable from the codebase
- Dense paragraphs (use headers and bullets)
- Personal preferences in project files
- Conflicting rules (model picks one arbitrarily)

## Per-directory CLAUDE.md vs path-scoped rules

When a convention belongs to one part of a large repo, choose between two placement mechanisms:

- **Per-directory `CLAUDE.md`** — lives with the code it governs, versioned by that directory's owners, and loads either at launch (when you start Claude from that directory) or on demand (when Claude reads files there) (source: monorepos-and-large-repos.md).
- **Path-scoped `.claude/rules/`** — centralized at the repo root and loads only when files matching its `paths:` glob are touched (source: monorepos-and-large-repos.md).

Prefer path-scoped rules when one convention applies to many scattered paths, or when you want all conventions collected in one place rather than spread across directory-local files (source: monorepos-and-large-repos.md). See [[monorepo-large-codebase-setup]] for scoping Claude Code to part of a monorepo.

## Related pages

- [[progressive-disclosure]]
- [[evaluating-agents-paper]]
- [[claude-code-memory]]
- [[cursor-rules]]
- [[context-engineering]]
- [[monorepo-large-codebase-setup]]
