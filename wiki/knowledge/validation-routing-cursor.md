# Validation Routing — Cursor IDE Plugin

**Summary**: Routing guide for validators checking Cursor IDE plugin artifacts (`cursor-initializer`). Lists primary sources, forbidden sources, convention entry points, and direct read paths.
**Sources**: docs/compliance/normative-source-matrix.md
**Last updated**: 2026-05-02

---

> **Derived view** — Derived from `cursor-plugin-bundle` in the normative source matrix (`docs/compliance/normative-source-matrix.md:274-281`). See [[compliance-routing]] for the full routing table.

---

## Scope Identifier

**Named bundle**: `cursor-plugin-bundle`
**Distribution**: `plugins/cursor-initializer/`

---

## Source Authority

### Primary Sources (Tier 1 — Cursor)

| Source ID | Canonical Path | What it governs |
|-----------|----------------|-----------------|
| `CURSOR-SKILLS` | `docs/cursor/skills/` | Cursor SKILL.md format, discovery directories, invocation |
| `CURSOR-PLUGIN` | `docs/cursor/plugin/` | Cursor plugin manifest, bundling, `.cursor-plugin/` |
| `CURSOR-SUBAGENTS` | `docs/cursor/subagents/` | Cursor subagent format, `model: inherit`, `readonly: true` |
| `CURSOR-RULES` | `docs/cursor/rules/` | `.mdc` format, `globs:`, four activation modes, precedence |
| `CURSOR-HOOKS` | `docs/cursor/hooks/` | Cursor hook events, JSON stdio |
| `CURSOR-PRACTICES` | `docs/cursor/best-practices/` | Cursor Plan Mode, best practices |

### Secondary Sources (Tier 2 — Shared)

| Source ID | Canonical Path |
|-----------|----------------|
| `SHARED-SKILLS-STD` | `docs/shared/skills-standard/` |
| `SHARED-AUTHORING` | `docs/shared/skill-authoring-best-practices.md` |
| `PROJECT-DESIGN-GUIDELINES` | `DESIGN-GUIDELINES.md` |

### Project Rules & Instructions

- `.claude/rules/cursor-plugin-skills.md` — Cursor plugin skill conventions
- `.claude/rules/reference-files.md` — reference file line limits and structure
- `.github/instructions/skill-files.instructions.md` — SKILL.md review criteria
- `.github/instructions/agent-definitions.instructions.md` — agent definition review criteria (Cursor section)

---

## Forbidden Sources

The following must NEVER be used as normative authority for Cursor plugin artifacts:

- `docs/claude-code/**` — all Claude Code-specific documentation
- `docs/claude-code/hooks/` — Claude hook lifecycle (Claude exit codes ≠ Cursor hook format)
- `docs/claude-code/skills/` — Claude skill `${CLAUDE_SKILL_DIR}` and `paths:` rule format
- `docs/claude-code/subagents/` — Claude agent frontmatter fields
- `docs/claude-code/memory/` — CLAUDE.md hierarchy and `paths:` scoping
- Claude-only files under `.claude/rules/` that govern Claude memory, Claude hooks, or Claude-specific `paths:` semantics — do NOT exclude Cursor-specific project rules (e.g., `cursor-plugin-skills.md`, `cursor-agent-files.md`) that are part of `cursor-plugin-bundle`
- `CLAUDE.md` (any level) — Claude Code memory system
- Any `CLAUDE-*` source ID

**Key contamination signals to watch for:**
- `paths:` in `.mdc` frontmatter (Claude field; Cursor uses `globs:`)
- `${CLAUDE_SKILL_DIR}` in skill content (Claude-only string substitution)
- `model: sonnet` in agent definitions (Cursor agents must use `model: inherit`)
- `tools:` field in Cursor agent definitions (Claude-specific; Cursor agents must not have it)
- `maxTurns:` field in Cursor agent definitions (Claude-specific)
- References to Claude hooks (exit code 1 blocking, JSON output) in Cursor skill or reference content

---

## Convention Entry Points

Start validation from these files:

| Artifact Type | Entry Point | Key Rules |
|---------------|-------------|-----------|
| `SKILL.md` | `plugins/cursor-initializer/skills/*/SKILL.md` | Relative paths for bundled files; no `${CLAUDE_SKILL_DIR}`; delegates to cursor agents |
| Cursor agents | `plugins/cursor-initializer/agents/*.md` | `model: inherit`, `readonly: true`; NO `tools:`/`maxTurns:` fields |
| Reference files | `plugins/cursor-initializer/skills/*/references/*.md` | ≤200 lines; same content standards as Claude plugin references |
| Templates | `plugins/cursor-initializer/skills/*/assets/templates/**/*.mdc` | Valid frontmatter: `description`, `alwaysApply`, `globs` ONLY — never `paths:` |
| Plugin manifest | `plugins/cursor-initializer/.cursor-plugin/plugin.json` | `name` field required |

---

## Direct Read Paths

Read these in order when validating a Cursor IDE plugin artifact:

1. Wiki concept pages (compact, curated): `[[cursor-rules]]`, `[[cursor-skills]]`, `[[cursor-subagents]]`, `[[cursor-plugins]]`, `[[cursor-hooks]]`, `[[cursor-mcp]]`, `[[cursor-tools]]`.
2. Source documents (raw): `docs/cursor/skills/`, `docs/cursor/rules/`, `docs/cursor/subagents/`, `docs/cursor/plugin/`, `docs/cursor/hooks/`, `docs/cursor/best-practices/`.
3. Concrete examples in this repo: `plugins/cursor-initializer/skills/`, `plugins/cursor-initializer/agents/`.

---

## Common Validation Mistakes

- Loading `docs/claude-code/skills/` to check skill format — Cursor skills use relative paths, not `${CLAUDE_SKILL_DIR}`
- Using Claude agent constraints (`model: sonnet`, `tools:`) when auditing Cursor agent definitions
- Loading Claude-only `.claude/rules/` files (e.g., `claude-memory.md`, `plugin-skills.md`) when validating Cursor artifacts — use Cursor-specific project rules bundled for this scope (`cursor-plugin-skills.md`, `cursor-agent-files.md`) instead, but do not apply Claude-only conventions
- Checking `.mdc` files for `paths:` instead of `globs:` — `paths:` is a Claude leak and a contamination finding

## Related pages

- [[compliance-routing]]
- [[validation-routing-claude]]
- [[validation-routing-standalone]]
