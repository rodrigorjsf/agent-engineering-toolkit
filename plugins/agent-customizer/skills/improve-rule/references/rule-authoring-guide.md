# Rule Authoring Guide

Evidence-based guidance for creating effective Claude Code rule files (`.claude/rules/*.md`).
---

## Contents

- When to use rules (vs hooks, skills, CLAUDE.md)
- Rule file structure and location
- Path-scoping with YAML frontmatter
- Glob pattern syntax
- Writing effective rule content
- Anti-patterns

---

## When to Use Rules

Rules are instruction files loaded on-demand when Claude reads files matching their scope. In Claude Code more generally, unscoped rules load at session start; in this project, keep that always-loaded guidance in `CLAUDE.md` instead of `.claude/rules/`.

| Use rules when | Use hooks when | Use skills when |
|----------------|---------------|----------------|
| Guidance should load automatically | Deterministic enforcement needed | Instructions needed only on explicit invocation |
| Conventions apply to a file type | Side effects must always happen | Large workflows not needed every session |
| Domain expertise scoped to a path | No LLM judgment required | Complex multi-step instruction sets |
| Standard behaviors for a subsystem | | |

**Rules load into context** when matching files are read, so keep them focused and concise.


---

## Rule File Structure and Location

```
.claude/
├── CLAUDE.md           # Main project instructions (always loaded)
└── rules/
    ├── testing.md      # Path-scoped rule for test files
    ├── api-design.md   # Path-scoped rule for API files
    └── frontend.md     # Path-scoped rule for frontend files
```

Each file should cover **one topic** with a descriptive filename. All `.md` files in `.claude/rules/` are discovered recursively — subdirectories like `frontend/` and `backend/` are supported.

For this project, rules should use `paths` frontmatter so they load only when Claude reads matching files. Put always-loaded project guidance in root `CLAUDE.md`, not in `.claude/rules/`.


---

## Path-Scoping with YAML Frontmatter

Add YAML frontmatter with a `paths` array to scope a rule to specific file patterns:

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/api/**/*.js"
---

# API Development Rules

- All API endpoints must include input validation
- Use the standard error response format
```

Rules without a `paths` field load unconditionally; in this project that is a defect, not a supported target.

Multiple patterns and brace expansion are supported:

```markdown
---
paths:
  - "src/**/*.{ts,tsx}"
  - "tests/**/*.spec.ts"
---
```


---

## Glob Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `**/*.ts` | All TypeScript files in any directory |
| `src/**/*` | All files under `src/` directory |
| `*.md` | Markdown files in project root only |
| `src/components/*.tsx` | React components in a specific directory |
| `src/**/*.{ts,tsx}` | TypeScript and TSX in any subdir of src |
| `tests/**/*.spec.*` | All spec files in tests/ |

Path-scoped rules trigger when Claude **reads files** matching the pattern, not on every tool use.


---

## Writing Effective Rule Content

**Size guidelines:**

- Rules must have `paths:` frontmatter with specific glob patterns
- Path-scoped rules: ≤50 lines (in context when matching files read)
- Split large topics into multiple files by subdomain

**Specificity** — write instructions concrete enough to verify:

- Good: "Use 2-space indentation"
- Bad: "Format code properly"
- Good: "All API endpoints must return `{error: string, code: number}`"
- Bad: "Return consistent errors"

**One scope per file** — each rule file should cover exactly one topic or subdomain. Mixing concerns makes rules harder to maintain and creates contradictions.

**No contradictions** — if two rules conflict, Claude may pick one arbitrarily. Review `.claude/rules/` periodically to remove outdated or conflicting instructions.


---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Overly broad glob patterns (`**/*`) | Rule loads on every file read, wastes context | Scope to specific extensions or directories |
| Duplicated content across multiple rule files | Contradictions + wasted tokens | Consolidate into one file |
| Vague instructions ("keep code clean") | Not actionable; ignored | Write verifiable, specific instructions |
| Rules for what Claude already knows | Unnecessary token waste | Delete standard conventions Claude already follows |
| Always-loaded rules for rare situations | Context cost on every session | Convert to path-scoped or skill |
| Rule files exceeding 50 lines | Poor adherence; attention fragmentation | Split into multiple focused files |

