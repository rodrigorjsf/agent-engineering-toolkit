# Validation Routing — Claude Code Plugins

**Summary**: Routing guide for validators checking Claude Code plugin artifacts (`agents-initializer`, `agent-customizer`). Lists primary sources, forbidden sources, convention entry points, and direct read paths.
**Sources**: docs/compliance/normative-source-matrix.md
**Last updated**: 2026-05-02

---

> **Derived view** — Derived from `claude-plugin-bundle` and `agent-customizer-bundle` in the normative source matrix (`docs/compliance/normative-source-matrix.md:265-296`). See [[compliance-routing]] for the full routing table.

---

## Scope Identifier

**Named bundle**: `claude-plugin-bundle`
**Distributions**: `plugins/agents-initializer/`, `plugins/agent-customizer/`

---

## Source Authority

### Primary Sources (Tier 1 — Claude Code)

| Source ID | Canonical Path | What it governs |
|-----------|----------------|-----------------|
| `CLAUDE-SKILLS` | `docs/claude-code/skills/` | SKILL.md format, frontmatter, discovery, `${CLAUDE_SKILL_DIR}` |
| `CLAUDE-PLUGINS` | `docs/claude-code/plugins/` | plugin.json manifest, namespace, marketplace |
| `CLAUDE-SUBAGENTS` | `docs/claude-code/subagents/` | Agent definitions, frontmatter fields, tool restrictions |
| `CLAUDE-MEMORY` | `docs/claude-code/memory/` | CLAUDE.md hierarchy, `paths:` scoping, imports |
| `CLAUDE-HOOKS` | `docs/claude-code/hooks/` | Hook lifecycle, exit codes, JSON stdio (agent-customizer only) |

### Secondary Sources (Tier 2 — Shared)

| Source ID | Canonical Path |
|-----------|----------------|
| `SHARED-SKILLS-STD` | `docs/shared/skills-standard/` |
| `SHARED-AUTHORING` | `docs/shared/skill-authoring-best-practices.md` |
| `PROJECT-DESIGN-GUIDELINES` | `DESIGN-GUIDELINES.md` |

### Project Rules & Instructions

- `.claude/rules/plugin-skills.md` — plugin skill delegation conventions
- `.claude/rules/agent-files.md` — Claude Code agent definition constraints
- `.claude/rules/reference-files.md` — reference file line limits and structure
- `.github/instructions/skill-files.instructions.md` — SKILL.md review criteria
- `.github/instructions/agent-definitions.instructions.md` — agent definition review criteria

---

## Forbidden Sources

The following must NEVER be used as normative authority for Claude Code plugin artifacts:

- `docs/cursor/**` — all Cursor-specific documentation
- `docs/cursor/rules/` — `.mdc` format and Cursor rule activation
- `docs/cursor/skills/` — Cursor skill invocation format
- `docs/cursor/subagents/` — Cursor subagent format
- `.cursor/rules/**` — Cursor IDE rule files
- Any `CURSOR-*` source ID

**Key contamination signals to watch for:**
- `globs:` in rule file frontmatter (Cursor field; Claude uses `paths:`)
- `model: inherit` in agent definitions (Cursor-only; Claude uses `model: sonnet`)
- `readonly: true` in agent definitions (Cursor-only)
- Missing `tools:` restriction in agent frontmatter (Claude agents must restrict to read-only tools)
- References to `.mdc` format in skill or reference content

---

## Convention Entry Points

Start validation from these files:

| Artifact Type | Entry Point | Key Rules |
|---------------|-------------|-----------|
| `SKILL.md` | `plugins/agents-initializer/skills/*/SKILL.md` | Delegates to named agents; `${CLAUDE_SKILL_DIR}` for bundled files; name ≤64 chars |
| Agent definitions | `plugins/agents-initializer/agents/*.md` | `model: sonnet`, read-only `tools:`, `maxTurns: 15-20` |
| Reference files | `plugins/*/skills/*/references/*.md` | ≤200 lines; ≥100 lines requires TOC; no nested references |
| Templates | `plugins/*/skills/*/assets/templates/**/*.md` | `<!-- TEMPLATE: -->` metadata; bracket placeholders |
| Plugin manifest | `plugins/*/.claude-plugin/plugin.json` | `name` field required; `source` is marketplace-only |
| `CLAUDE.md` | `plugins/*/CLAUDE.md` | 10-30 lines; plugin-specific only; no duplication with root |

---

## Direct Read Paths

Read these in order when validating a Claude Code plugin artifact:

1. Wiki concept pages (compact, curated): `[[claude-code-skills]]`, `[[claude-code-subagents]]`, `[[claude-code-plugins]]`, `[[claude-code-memory]]`, `[[claude-code-hooks]]`.
2. Source documents (raw): `docs/claude-code/skills/`, `docs/claude-code/subagents/`, `docs/claude-code/plugins/`, `docs/claude-code/memory/`, `docs/claude-code/hooks/`.
3. Concrete examples in this repo: `plugins/agents-initializer/skills/`, `plugins/agent-customizer/agents/`.

---

## Common Validation Mistakes

- Loading `docs/cursor/` to check `.mdc` activation modes when auditing a Claude skill that mentions rules — Claude rules use `paths:`, not `globs:`
- Using Cursor agent constraints (model: inherit, readonly: true) when auditing Claude agent definitions
- Treating general-llm research (Tier 4) as sole authority instead of corroboration

## Related pages

- [[compliance-routing]]
- [[validation-routing-cursor]]
- [[validation-routing-standalone]]
