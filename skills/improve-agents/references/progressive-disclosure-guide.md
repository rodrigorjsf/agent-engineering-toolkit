# Progressive Disclosure Guide

Evidence-based instructions for structuring AGENTS.md and CLAUDE.md hierarchies.
Sources: a-guide-to-agents.md, research-context-engineering-comprehensive.md

---

## Contents

- File hierarchy decision table (where to place content)
- Root file requirements (minimal elements only)
- Monorepo: what goes where (root vs package level)
- Progressive disclosure patterns (domain files, nested docs, skills)
- AGENTS.md hierarchy (scope, load order, merge behavior)
- Anti-patterns to detect and remove
- Validation checklist

---

## File Hierarchy Decision Table

When deciding where to place content, use this table:

| Location | Use when content is... | Load timing |
|----------|------------------------|-------------|
| Root AGENTS.md | Relevant to **every single task** in the repo | Always (every request) |
| Separate domain file | Relevant to one domain (TypeScript, testing, API design) | On-demand |
| Subdirectory AGENTS.md | Specific to one package or area | On-demand when working there |
| Skill | A workflow the agent should invoke explicitly | On-demand when invoked |

*Source: a-guide-to-agents.md lines 228-233; research-context-engineering-comprehensive.md lines 257-305*

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

*Source: a-guide-to-agents.md lines 164-193*

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

*Source: a-guide-to-agents.md lines 110-163*

---

## AGENTS.md Hierarchy

| Scope | Location | Loads when |
|-------|----------|------------|
| Project-wide | Root `AGENTS.md` | Always (every request) |
| Subdirectory / package | `packages/api/AGENTS.md` | On-demand when working in that directory |
| Domain reference | `docs/TESTING.md`, `docs/BUILD.md` | On-demand via pointer in root |
| Workflow | Skill | On-demand when invoked |

**Priority rule**: Minimize content in root AGENTS.md. Move scope-specific and domain content to on-demand locations.

**Merge behavior**: Subdirectory AGENTS.md files merge with root (not replace) — content from both applies when the agent works in that directory.

*Source: research-context-engineering-comprehensive.md lines 181-208, 257-305*

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
