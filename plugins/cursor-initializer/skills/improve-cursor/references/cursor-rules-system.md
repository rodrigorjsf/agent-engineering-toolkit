# Cursor Rules System

Reference for generating and evaluating `.cursor/rules/` files. Source: [cursor.com/docs/context/rules](https://cursor.com/docs/context/rules).

## File Format

Cursor rules are markdown files in `.cursor/rules/` with optional `.mdc` extension for frontmatter support. Both `.md` and `.mdc` are supported.

### Frontmatter Fields (only these three valid)

- `description` (string) — what the rule is about; used for "Apply Intelligently" mode
- `alwaysApply` (boolean) — `true` loads on every conversation; `false` lets agent decide based on description
- `globs` (string or array) — file patterns that trigger auto-attachment (e.g., `"**/*.test.ts"` or `["*.py", "*.pyi"]`)

### Four Activation Modes

| Mode | `alwaysApply` | `globs` | `description` | When it loads |
|------|:---:|:---:|:---:|:---|
| **Always** | `true` | — | optional | Every conversation |
| **Auto-attached** | `false` | set | optional | When matching files are in context |
| **Agent-requested** | `false` | — | set | When the agent decides based on description |
| **Manual** | `false` | — | — | Only when user @-mentions the rule |

### Best Practices

- This toolkit enforces ≤200-line limit per file (Cursor allows more); split larger rules into composable ones
- Provide concrete examples or reference files
- Write rules like clear internal docs — avoid vague guidance
- Reference files instead of copying their contents
- Start simple — add rules only when the agent makes the same mistake repeatedly

### Rules vs AGENTS.md

Use `.cursor/rules/` when you need metadata-controlled activation (globs, description), auto-attachment based on file patterns, different activation modes per content, or folder-organized rules. Use `AGENTS.md` for simple, portable, always-loaded instructions that other tools also consume.

### Example

```
---
description: "Standards for React components including styling, animations, and naming"
globs: ["src/components/**/*.tsx", "src/components/**/*.ts"]
alwaysApply: false
---

- Use Tailwind for styling
- Use Framer Motion for animations
- See `components/Button.tsx` for canonical component structure
```
