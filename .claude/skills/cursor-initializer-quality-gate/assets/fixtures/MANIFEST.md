# Fixture Corpus — Skill Body Convention (Skill Variant, Shared)

> **Shared corpus redirect** — the canonical golden fixture files live at:
> `.claude/skills/agent-customizer-quality-gate/assets/fixtures/skill/`
>
> The semantic-tag convention body rules are platform-agnostic (per ADR-0007 and
> `wiki/knowledge/skill-body-convention.md`). Tag vocabulary and strictness tiers
> are identical for Claude Code skills, Cursor skills, and standalone skills.
> One corpus serves all gates; duplicating it would add maintenance overhead
> without adding coverage.
>
> **To run the Canonical Semantic-Tag Convention skill-body check for this gate:**
> read fixtures from `.claude/skills/agent-customizer-quality-gate/assets/fixtures/skill/`
> and use the MANIFEST.md there for the expected verdicts.

This covers `plugins/cursor-initializer/skills/**/SKILL.md` bodies.
The expected verdict table is in the shared MANIFEST at the path above.

Note: `cursor-initializer` has no subagent flows — only skill bodies need to be checked
for this gate (per Convention scope v1 and the issue AC for cursor-initializer-quality-gate).
