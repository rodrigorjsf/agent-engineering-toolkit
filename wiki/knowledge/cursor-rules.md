# Cursor Rules

**Summary**: System-level instructions stored as `.md` or `.mdc` files in `.cursor/rules/` that guide Cursor's AI agent — supporting four activation modes (always, intelligent, glob-matched, manual) with YAML frontmatter-controlled scoping and a team/project/user precedence hierarchy.
**Sources**: rules.md, agent-best-practices.md
**Last updated**: 2026-05-22

---

## File Format

Project rules live in `.cursor/rules/` as `.md` or `.mdc` files and are version-controlled. Use `.mdc` files with YAML frontmatter to control when a rule applies (source: rules.md):

```yaml
---
description: "API endpoint conventions for Express routes"
alwaysApply: false
globs: ["src/api/**/*.ts"]
---
Use Zod for all API input validation.
Return standardized error responses.
```

Rules can be organized into folders inside `.cursor/rules/`.

## Four Activation Modes

| Mode                    | Frontmatter                          | When Active                               |
| ----------------------- | ------------------------------------ | ----------------------------------------- |
| **Always Apply**        | `alwaysApply: true`                  | Every chat session (globs/description ignored) |
| **Apply Intelligently** | `alwaysApply: false` + `description` | Agent deems relevant based on description |
| **Specific Files**      | `alwaysApply: false` + `globs`       | A matching file is in context             |
| **Manual**              | Neither `description` nor `globs`    | Only when @-mentioned in chat             |

## Rule Anatomy

Each rule is a markdown file with frontmatter metadata and content. Only three frontmatter fields are valid in `.mdc` files (source: rules.md):

- `description` — When the rule is relevant
- `alwaysApply` — Boolean, always-on toggle
- `globs` — File patterns the rule applies to

> **Never** use `paths:` in `.mdc` files (that's Claude Code specific).

### Glob Pattern Examples

Use `globs` to scope a rule to specific files or directories; separate multiple patterns with commas (source: rules.md).

| Pattern                       | Matches                                                |
| ----------------------------- | ------------------------------------------------------ |
| `*`                           | Any single file name segment                           |
| `**`                          | Any number of directories (recursive)                  |
| `*.ts`                        | All `.ts` files in the root                            |
| `**/*.ts`                     | All `.ts` files in any directory                       |
| `src/**`                      | All files anywhere under `src/`                        |
| `src/**/*.tsx`                | All `.tsx` files anywhere under `src/`                 |
| `docs/**/*.md, docs/**/*.mdx` | `.md` and `.mdx` files under `docs/` (comma-separated) |
| `tailwind.config.*`           | `tailwind.config` with any extension                   |

## Precedence Hierarchy

Rules apply in the order **Team Rules → Project Rules → User Rules**; all applicable rules are merged, and earlier sources take precedence when guidance conflicts (source: rules.md).

- **Team**: Managed from the dashboard (Team and Enterprise plans). Free-form text, support glob patterns for file-scoped application, and can be marked **Enforced** so users cannot disable them.
- **Project**: `.cursor/rules/` (checked into version control)
- **User**: Global preferences in **Cursor Settings → Rules**; used by Agent (Chat) only, not Inline Edit (Cmd/Ctrl+K)

## Creating a Rule

Two ways to create rules (source: rules.md):

- **`/create-rule` in chat** — describe the rule; the agent generates the file with frontmatter and saves it to `.cursor/rules/`
- **From settings** — **Cursor Settings → Rules, Commands → + Add Rule**

## Remote Rule Imports

Rules can be imported from any GitHub repository you have access to, public or private — **Cursor Settings → Rules, Commands → + Add Rule → Remote Rule (GitHub)** (source: rules.md). Cursor scans for all `.mdc` files, preserves their relative paths, and places them under `.cursor/rules/imported/<repoName>/`.

## Nested AGENTS.md

`AGENTS.md` is a plain markdown alternative to `.cursor/rules/` with no metadata. Cursor supports `AGENTS.md` in the project root and in subdirectories; nested files are combined with parent directories, with more specific instructions taking precedence (source: rules.md).

## Key Practices

- Keep rules under **500 lines**; split large rules into multiple composable rules
- Add rules **only when the agent repeats the same mistake**
- Don't copy entire style guides — use a linter instead
- Don't document commands agents already know (npm, git, pytest)
- Reference files (`@filename.ts`) instead of copying their contents, so rules stay short and don't go stale

## Related pages

- [[agent-configuration-files]]
- [[progressive-disclosure]]
- [[claude-code-memory]]
- [[cursor-skills]]
