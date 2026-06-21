# Cursor Skills

**Summary**: Portable, version-controlled capability packages following the Agent Skills open standard that extend Cursor's agent with domain-specific knowledge and workflows — discovered automatically at startup, optionally scoped to specific files via `paths`, and invoked manually or by the agent based on description matching.
**Sources**: agent-skills-guide.md, agent-best-practices.md
**Last updated**: 2026-06-21

---

## Skill Locations

Cursor discovers skills from multiple directories (source: agent-skills-guide.md):

| Location            | Scope         |
| ------------------- | ------------- |
| `.agents/skills/`   | Project       |
| `.cursor/skills/`   | Project       |
| `~/.agents/skills/` | User          |
| `~/.cursor/skills/` | User          |
| `.claude/skills/`   | Compatibility |
| `.codex/skills/`    | Compatibility |

Compatibility loading also covers `~/.claude/skills/` and `~/.codex/skills/`.

## Format

Each skill is a directory with `SKILL.md` at its root:

```yaml
---
name: deploy-app
description: "Deploy applications to staging or production. Use when deploying or releasing code."
disable-model-invocation: true
---
```

### Frontmatter Fields

| Field                      | Required | Description                                                                 |
| -------------------------- | -------- | --------------------------------------------------------------------------- |
| `name`                     | Yes      | kebab-case identifier; must match the parent folder name                    |
| `description`              | Yes      | What the skill does and when to use it (drives agent relevance matching)    |
| `paths`                    | No       | Glob patterns scoping the skill to matching files                           |
| `disable-model-invocation` | No       | When `true`, the skill is only included via explicit `/skill-name` invocation |
| `metadata`                 | No       | Arbitrary key-value mapping for additional metadata                         |

### Optional Directories

- `scripts/` — Executable code (Bash, Python, JavaScript) the agent can run
- `references/` — Detailed documentation loaded on demand
- `assets/` — Templates, images, data files

## Scoping a Skill to Specific Files

The `paths` field limits a skill to files that match one or more glob patterns; the skill is then only surfaced when the agent reads or edits a matching file, keeping file-specific guidance out of context for unrelated work (source: agent-skills-guide.md). It accepts either a list or a single comma-separated string:

```yaml
paths:
  - "**/*.tsx"
  - "packages/ui/**/*.ts"
```
```yaml
paths: "**/*.py, scripts/**/*.py"
```

The `globs` field is a **deprecated alias** for `paths`: it is still accepted as a fallback (not rejected) so existing skills continue to work, but new skills should use `paths` (source: agent-skills-guide.md). Leave `paths` unset for a skill that should be available regardless of which files are open.

## Nested Skill Directories

Skill directories can be organized into category subdirectories — Cursor walks the skills root recursively and picks up any `SKILL.md` it finds (source: agent-skills-guide.md). The category folder is purely organizational; a skill's identity comes from the folder directly containing `SKILL.md`.

Cursor also discovers skills inside nested project subdirectories: a `.cursor/skills/` (or `.agents/skills/`) folder anywhere in the repo is picked up, so monorepos can colocate skills with the package they apply to. Such nested skills are **automatically scoped** to files inside their directory — similar to `paths`, but without needing to set the field.

## Invocation

- **Automatic**: The agent decides based on task-to-description matching
- **Manual**: Type `/` in Agent chat and search the skill name
- **Disabled auto**: Set `disable-model-invocation: true` to make a skill behave like a traditional slash command

## Migrating Rules and Commands to Skills

Cursor 2.4 ships a built-in `/migrate-to-skills` skill that converts existing dynamic rules and slash commands to skills (source: agent-skills-guide.md):

- **Dynamic rules** — rules using "Apply Intelligently" (`alwaysApply: false` or undefined, no `globs`) become standard skills
- **Slash commands** — both user- and workspace-level commands become skills with `disable-model-invocation: true`, preserving explicit invocation

Rules with `alwaysApply: true` or specific `globs` are **not** migrated (they have explicit triggering conditions). User rules are not migrated either, since they are not stored on the file system.

## Cursor vs Claude Code Skills

| Feature         | Cursor                                              | Claude Code                                      |
| --------------- | --------------------------------------------------- | ------------------------------------------------ |
| Discovery dirs  | `.agents/skills/`, `.cursor/skills/` (+ compat)     | `.claude/skills/`                                |
| Frontmatter     | Agent Skills standard (`paths`, `metadata`, etc.)   | Standard + `model`, `effort`, `context`, `agent` |
| File references | Relative paths from skill root                      | `${CLAUDE_SKILL_DIR}` or relative paths          |
| Disabling auto  | `disable-model-invocation`                          | `disable-model-invocation`                       |

## Related pages

- [[agent-skills-standard]]
- [[skill-authoring]]
- [[claude-code-skills]]
- [[cursor-rules]]
- [[cursor-plugins]]
