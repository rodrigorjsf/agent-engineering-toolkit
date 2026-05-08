# Validation Routing — Standalone Skills

**Summary**: Routing guide for validators checking standalone skills (`skills/` — the `npx skills add` portable distribution). Lists primary sources, forbidden sources, convention entry points, and direct read paths.
**Sources**: docs/compliance/normative-source-matrix.md
**Last updated**: 2026-05-03

---

> **Derived view** — Derived from `standalone-bundle` in the normative source matrix (`docs/compliance/normative-source-matrix.md:283-291`). See [[compliance-routing]] for the full routing table.

---

## Scope Identifier

**Named bundle**: `standalone-bundle`
**Distribution**: `skills/`

---

## Source Authority

### Primary Sources (Tier 2 — Shared Standards)

| Source ID | Canonical Path | What it governs |
|-----------|----------------|-----------------|
| `SHARED-SKILLS-STD` | `docs/shared/skills-standard/` | Agent Skills open standard: SKILL.md format, frontmatter, loading |
| `SHARED-AUTHORING` | `docs/shared/skill-authoring-best-practices.md` | Universal skill writing, eval-driven iteration, description optimization |

### Secondary Sources (Tier 3 — Project)

| Source ID | Canonical Path |
|-----------|----------------|
| `PROJECT-DESIGN-GUIDELINES` | `DESIGN-GUIDELINES.md` |
| `GENERAL-AGENTS-GUIDE` | `docs/general-llm/a-guide-to-agents.md` |

### Project Rules & Instructions

- `.claude/rules/standalone-skills.md` — inline bash analysis requirement; no agent delegation
- `.claude/rules/reference-files.md` — reference file line limits and structure
- `.github/instructions/skill-files.instructions.md` — SKILL.md review criteria (standalone section)

---

## Layered scope

The standalone bundle is split into two compliance layers per ADR-0005:

**Skill body layer** (SKILL.md prose and `references/`):
- Must be platform-agnostic. Allowed source IDs are `SHARED-*` and `GENERAL-*` only.
- Claude harness mechanisms (`${CLAUDE_SKILL_DIR}`, Task tool, named agents, `paths:` frontmatter in generated rules) in skill prose remain contamination findings regardless of the skill's target.

**Template layer** (`assets/templates/`):
- MAY embed platform-specific format **only if** the skill's `name` field declares the platform target.
- `init-claude` and `improve-claude` name `claude` as target → their templates may contain `CLAUDE-*`-sourced content (e.g., `paths:` frontmatter in `.claude/rules/*.md` templates, `${CLAUDE_SKILL_DIR}` in template examples).
- A platform-neutral skill (e.g., `create-skill`, targeting the open Agent Skills standard) must keep its templates neutral — no platform-specific fields.
- The skill `name` field is the canonical platform-target declaration. Aliasing or workaround naming to escape this scoping is itself a violation.

---

## Forbidden Sources

The following must NEVER be used as normative authority for the **skill body layer** (SKILL.md prose, `references/`) of a standalone skill, nor by neutral-skill templates. **Templates of platform-targeted skills (`init-claude`/`improve-claude`, `init-cursor`/`improve-cursor`) may use the matching `<PLATFORM>-*` IDs per ADR-0005 § Authority chain.**

- `docs/claude-code/**` — all Claude Code-specific documentation
- `docs/claude-code/skills/` — Claude `${CLAUDE_SKILL_DIR}` substitution (not available in standalone)
- `docs/claude-code/hooks/` — Claude hook exit codes and JSON stdio
- `docs/claude-code/subagents/` — Claude agent delegation patterns
- `docs/cursor/**` — all Cursor IDE-specific documentation
- `docs/cursor/rules/` — Cursor `.mdc` format and `globs:` frontmatter
- Any `CLAUDE-*` source ID
- Any `CURSOR-*` source ID
- Hook-specific or subagent-specific guidance of any platform

**Key contamination signals to watch for:**
- `${CLAUDE_SKILL_DIR}` in **skill prose or neutral-skill templates** (Claude-only substitution — not available in standalone runtime; allowed in platform-targeted-skill templates per ADR-0005)
- References to named agents or the Task tool for analysis phases (standalone must use inline bash)
- `paths:` in **skill prose or neutral-skill templates** (Claude-specific; allowed in Claude-targeted-skill templates like `init-claude`/`improve-claude` per ADR-0005)
- `globs:` in **skill prose or neutral-skill templates** (Cursor-specific; allowed in Cursor-targeted-skill templates per ADR-0005)
- `model: sonnet` or `model: inherit` references in skill body (platform-specific)
- Phase instructions that say "delegate to" an agent instead of providing explicit bash commands

---

## Critical Standalone Constraint

> **ALL analysis must be inline** — explicit bash commands for each step.
> Standalone skills MUST NEVER reference agent names, use Task tool delegation, or spawn subagents.
> This is the most common contamination pattern from Claude Code plugin skill patterns.

```
WRONG (Claude plugin pattern):
  - Delegate to `codebase-analyzer` agent

CORRECT (standalone pattern):
  - Run: find . -name "SKILL.md" | head -20
  - Run: grep -r "name:" skills/*/SKILL.md
```

---

## Convention Entry Points

Start validation from these files:

| Artifact Type | Entry Point | Key Rules |
|---------------|-------------|-----------|
| `SKILL.md` | `skills/*/SKILL.md` | ALL analysis inline; no agent delegation; explicit bash per step |
| Reference files | `skills/*/references/*.md` | ≤200 lines; same content structure as plugin references |
| Templates | `skills/*/assets/templates/**/*.md` | Same metadata conventions as plugin templates; no hook/subagent content |
| Standalone `README.md` | `skills/README.md` | Must NOT reference `init-cursor` or `improve-cursor` (plugin-only skills) |

---

## Direct Read Paths

Read these in order when validating a standalone skill artifact:

1. Wiki concept pages (compact, curated): `[[agent-skills-standard]]`, `[[skill-authoring]]`, `[[progressive-disclosure]]`.
2. Source documents (raw): `docs/shared/skills-standard/`, `docs/shared/skill-authoring-best-practices.md`, `docs/general-llm/a-guide-to-agents.md`.
3. Concrete examples in this repo: `skills/*/SKILL.md`.

---

## Common Validation Mistakes

- Loading `docs/claude-code/skills/` to check SKILL.md format — standalone uses the Agent Skills open standard, not Claude-specific format
- Accepting "delegate to codebase-analyzer" as valid for standalone (it is valid ONLY in Claude plugin skills)
- Using Claude hook or subagent docs as supporting authority for standalone artifacts
- Checking that `.claude/rules/` are referenced by standalone skill **prose or by neutral-skill templates** — they should NOT be there. (Templates of platform-targeted skills like `init-claude`/`improve-claude` MAY reference `.claude/rules/` per ADR-0005.)
