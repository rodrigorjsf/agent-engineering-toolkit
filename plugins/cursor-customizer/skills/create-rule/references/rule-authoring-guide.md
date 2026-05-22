# Rule Authoring Guide

Evidence-based guidance for creating effective Cursor rule files (`.cursor/rules/*.mdc`).

---

## Contents

- When to use rules (vs hooks, skills, manual prompting)
- Rule file structure and location
- Frontmatter contract (`description`, `alwaysApply`, `globs` only)
- The four activation modes
- Glob pattern syntax
- Writing effective rule content
- Anti-patterns

---

## When to Use Rules

Rules are markdown files placed in `.cursor/rules/`. Their contents are included at the start of the model context based on their activation mode. Use rules to:

- Encode domain-specific knowledge about a codebase
- Standardize style or architecture decisions
- Automate project-specific workflows or templates

| Use rules when | Use hooks when | Use skills when |
|----------------|---------------|----------------|
| Guidance should attach automatically | Deterministic enforcement is needed | Instructions should run only on explicit invocation |
| Conventions apply to a file pattern or topic | Side effects must always happen | Multi-phase workflows are required |
| Domain expertise scoped to a path or topic | No agent judgment is required | Rich, progressive-disclosure references are needed |


---

## Rule File Structure and Location

```
.cursor/rules/
  api-guidelines.mdc       # Rule with frontmatter (description, globs)
  react-patterns.mdc       # Rule with frontmatter
  frontend/                # Subfolder organisation supported
    components.mdc
```

Each file should cover **one topic** with a kebab-case filename. Both `.md` and `.mdc` extensions are recognised; this distribution generates `.mdc` so that frontmatter can specify activation mode.


---

## Frontmatter Contract

Cursor rule frontmatter is restricted to **three fields**. No other key is valid in this distribution:

| Field | Type | Purpose |
|-------|------|---------|
| `description` | string | Topic-attractor sentence the agent reads to decide whether to attach the rule |
| `alwaysApply` | boolean | When `true`, the rule loads on every conversation |
| `globs` | string or array | File patterns that trigger auto-attachment |

The token used by other agent platforms to scope rules by file pattern is NOT supported here — Cursor uses `globs` for the same role. Any other frontmatter key is invalid and must be removed.


---

## The Four Activation Modes

Activation mode is determined by which frontmatter fields are set:

| Mode | `alwaysApply` | `globs` | `description` | When it loads |
|------|:---:|:---:|:---:|:---|
| **Always** | `true` | — | optional | Every conversation |
| **Auto-attached** | `false` | set | optional | When matching files enter context |
| **Agent-requested** | `false` | — | set | When the agent decides the topic is relevant |
| **Manual** | `false` | — | — | Only when the user @-mentions the rule |

Pick the mode that matches the **content's nature**:

- Always → critical tooling commands and project-wide constraints (short — every line loads on every chat)
- Auto-attached → conventions tied to a specific file pattern (test files, generated code, monorepo packages)
- Agent-requested → cross-cutting / domain content the agent should pull in by name (authentication, observability, accessibility, API design)
- Manual → templates and reference snippets the user explicitly opts into


---

## Glob Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `**/*.ts` | All TypeScript files in any directory |
| `src/**/*` | All files under `src/` |
| `*.md` | Markdown files in project root only |
| `src/components/*.tsx` | React components in a specific directory |
| `src/**/*.{ts,tsx}` | TypeScript and TSX in any subdir of src |
| `tests/**/*.spec.*` | All spec files in tests/ |

Auto-attached rules trigger when files matching the pattern enter the agent's context, not on every tool use.

In monorepos, scope globs to the relevant package subtree (e.g., `services/api/**/*.go` rather than `**/*.go`). Language-only globs match across every package and defeat scoping.


---

## Writing Effective Rule Content

**Size guidelines:**

- Cursor accepts large rules, but this toolkit enforces ≤200 lines per `.mdc` file
- Split anything approaching 200 lines into multiple composable rules
- Always-apply rules should be SHORT — every line loads on every conversation

**Specificity** — write instructions concrete enough to verify:

- Good: "Use 2-space indentation"
- Bad: "Format code properly"
- Good: "All API endpoints must return `{error: string, code: number}`"
- Bad: "Return consistent errors"

**One concern per file** — each rule file should cover exactly one topic or subdomain. Mixing concerns makes rules harder to maintain and creates contradictions.

**Reference, do not copy** — point to canonical files with `@path/to/file` rather than inlining their content. This keeps rules short and prevents staleness as code evolves.

**No contradictions** — if two rules conflict, the agent may pick one inconsistently. Review `.cursor/rules/` periodically to remove outdated or conflicting instructions.


---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Overly broad globs (`**/*`) on auto-attached rules | Rule loads on most file reads, wastes context | Scope to specific extensions or directories |
| Always-apply rules longer than ~30 lines | Burns context budget on every conversation | Convert to auto-attached or agent-requested |
| Duplicated content across multiple rule files | Contradictions plus wasted tokens | Consolidate into one file |
| Vague instructions ("keep code clean") | Not actionable; ignored | Write verifiable, specific instructions |
| Rules for what the agent already knows | Unnecessary token waste | Delete standard conventions the agent already follows |
| Copying entire style guides | Linter handles this faster and more reliably | Use a linter; reference its config from a rule if needed |
| Documenting every command | The agent knows common tools | Mention only non-default commands |
| Edge-case instructions | Rare branches steal attention from common paths | Keep rules focused on patterns used frequently |
| Rule files exceeding 200 lines | Poor adherence; attention fragmentation | Split into multiple focused files |
| Mixing activation modes in one file | Activation-mode contract is per file | One activation mode per file |

