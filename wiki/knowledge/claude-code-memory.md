# Claude Code Memory

**Summary**: The multi-layered system by which Claude Code maintains persistent project context across sessions — comprising CLAUDE.md and CLAUDE.local.md file hierarchies, path-scoped rules in `.claude/rules/`, auto memory from corrections, and import-based composition.
**Sources**: how-claude-remembers-a-project.md, analysis-how-claude-remembers-a-project.md, monorepos-and-large-repos.md
**Last updated**: 2026-06-04

---

## Memory Layers

| Layer                 | Written By          | Persistence                    | Scope                  |
| --------------------- | ------------------- | ------------------------------ | ---------------------- |
| **CLAUDE.md**         | Human               | Permanent (version-controlled) | Project, user, managed |
| **CLAUDE.local.md**   | Human               | Permanent (gitignored)         | Per-project, just you  |
| **`.claude/rules/`**  | Human               | Permanent (version-controlled) | Path-specific          |
| **Auto memory**       | Claude              | Persistent (local storage)     | Per repository         |
| **Imports** (`@file`) | Human (referencing) | Derived from source files      | Composable             |

## When to Add to CLAUDE.md

Treat CLAUDE.md as the place you write down what you would otherwise re-explain (source: how-claude-remembers-a-project.md). Add to it when:

- Claude makes the same mistake a second time
- A code review catches something Claude should have known about this codebase
- You type the same correction or clarification into chat that you typed last session
- A new teammate would need the same context to be productive

Keep it to facts Claude should hold in **every** session — build commands, conventions, project layout, "always do X" rules. If an entry is a multi-step procedure, move it to a [[claude-code-skills]] skill; if it only matters for one part of the codebase, move it to a [[#Path-Scoped Rules]] file instead.

## CLAUDE.md File Hierarchy

CLAUDE.md files live in several locations, listed below in **load order** — broadest scope first, most specific last, so a project instruction lands in context after a user instruction (source: how-claude-remembers-a-project.md):

| Scope                | Location                                                                                                                              | Purpose                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Managed policy       | macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`; Linux/WSL `/etc/claude-code/CLAUDE.md`; Windows `C:\Program Files\ClaudeCode\CLAUDE.md` | Org-wide instructions, cannot be excluded |
| User instructions    | `~/.claude/CLAUDE.md`                                                                                                                 | Personal preferences, all projects     |
| Project instructions | `./CLAUDE.md` or `./.claude/CLAUDE.md`                                                                                                | Team-shared, via source control        |
| Local instructions   | `./CLAUDE.local.md`                                                                                                                   | Personal per-project, add to `.gitignore` |

Within the directory tree, content is ordered from filesystem root down to the working directory; within each directory `CLAUDE.local.md` is appended after `CLAUDE.md`. Subdirectory `CLAUDE.md`/`CLAUDE.local.md` files (e.g. `./src/CLAUDE.md`) are not loaded at launch — they load on demand when Claude reads files in that directory. This on-demand rule holds only when you start Claude from the repository root or an ancestor of the subdirectory; when you **start Claude from a subdirectory**, it loads that directory's `CLAUDE.md` plus every ancestor's at launch (source: monorepos-and-large-repos.md).

Project `.claude/settings.json` loads only from the starting directory and is **not** inherited from parent directories the way `CLAUDE.md` is, so each subdirectory's settings file must be self-contained (source: monorepos-and-large-repos.md).

### CLAUDE.local.md

`CLAUDE.local.md` at the project root holds private per-project preferences (sandbox URLs, preferred test data) that should not be checked in (source: how-claude-remembers-a-project.md). It loads alongside `CLAUDE.md` and is treated the same way. Add it to `.gitignore` — running `/init` with the personal option does this for you. Because a gitignored `CLAUDE.local.md` only exists in the worktree where it was created, share personal instructions across worktrees by importing a home-directory file (`@~/.claude/my-project-instructions.md`) instead.

The managed-policy layer can also be supplied as a `claudeMd` key inside `managed-settings.json` rather than a separate file; `claudeMd` set in user, project, or local settings has no effect.

`claudeMdExcludes` is a static path/glob exclusion that skips matching `CLAUDE.md`/rules files — it is a settings-level list, not a per-task switch. Globs are matched against **absolute** paths, so prefix patterns with `**/` to match by basename or relative location. The arrays merge across user, project, local, and managed scopes, and the exclusion cannot remove a managed-policy `CLAUDE.md`. To focus on one part of the tree per task, start Claude from the relevant directory instead of editing exclusions (source: monorepos-and-large-repos.md).

## Path-Scoped Rules

Rules in `.claude/rules/` are the implementation of [[progressive-disclosure]] for instructions:

```yaml
---
paths:
  - "src/api/**/*.ts"
---
Use Zod for all API input validation.
Return standardized error responses with error codes.
```

Rules load **only when matching files are touched**, keeping the context budget clean.

### Pattern Examples

- `**/*.ts` — All TypeScript files
- `src/components/*.tsx` — React components
- `src/**/*` — Everything in src
- `*.md` — All markdown files

## Import Syntax

Compose instructions from existing files:

- `@README` — Import README content
- `@package.json` — Import package manifest
- `@~/.claude/my-instructions.md` — Cross-project shared instructions
- **Depth limit**: 5 hops maximum
- **Symlinks**: Supported for sharing rules across projects (`ln -s ~/shared-claude-rules .claude/rules/shared`)

## Line Budget

| File             | Target      | Maximum   |
| ---------------- | ----------- | --------- |
| Root CLAUDE.md   | 15–40 lines | 200 lines |
| Plugin CLAUDE.md | 10–30 lines | —         |
| Rule files       | 10–30 lines | —         |

Every token loads on **every request**. The test: "Would removing this cause the agent to make mistakes?" If not, cut it.

## Auto Memory

Claude accumulates learnings across sessions without you writing anything — build commands, debugging insights, architecture notes, style preferences (source: how-claude-remembers-a-project.md). It does not save every session; it decides what is worth remembering. On by default; requires Claude Code v2.1.59 or later. Toggle via the `/memory` command, the `autoMemoryEnabled` setting, or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`.

- **Storage**: `~/.claude/projects/<project>/memory/`, derived from the git repository — all worktrees and subdirectories of one repo share a single auto-memory directory. Machine-local; not shared across machines. Relocatable via `autoMemoryDirectory` (user/policy settings only).
- **Structure**: a `MEMORY.md` index plus optional topic files (`debugging.md`, etc.). Only the first 200 lines or 25 KB of `MEMORY.md` (whichever comes first) load at session start; topic files load on demand.
- **`/memory`** lists all loaded CLAUDE.md, CLAUDE.local.md, and rules files, toggles auto memory, and links to the auto-memory folder.

## Key Practices

- Use **specific, concrete instructions** ("Use 2-space indentation" not "Format properly")
- Use **markdown headers and bullets**, not dense paragraphs
- Run `/init` to auto-generate a starter CLAUDE.md (`CLAUDE_CODE_NEW_INIT=1` enables an interactive multi-phase flow)
- Commit project CLAUDE.md to version control; put private per-project notes in gitignored `CLAUDE.local.md`
- Put personal preferences in user CLAUDE.md, not project
- Don't mix conflicting rules (Claude picks one arbitrarily)
- Block-level HTML comments (`<!-- ... -->`) in CLAUDE.md are stripped before injection — use them for human-only maintainer notes

## Related pages

- [[agent-configuration-files]]
- [[progressive-disclosure]]
- [[context-engineering]]
- [[claude-code-hooks]]
- [[cursor-rules]]
- [[monorepo-large-codebase-setup]]
