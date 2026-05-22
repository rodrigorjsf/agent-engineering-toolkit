# Fixture Corpus — Skill Body Convention (Skill Variant, Shared)

> **Shared corpus redirect** — the canonical golden fixture files live at:
> `.claude/skills/agent-customizer-quality-gate/assets/fixtures/skill/`
>
> The semantic-tag convention body rules are platform-agnostic (per ADR-0007 and
> `wiki/knowledge/skill-body-convention.md`). Tag vocabulary and strictness tiers
> are identical for plugin skills (agents-initializer) and standalone skills.
> One corpus serves all gates; duplicating it would add maintenance overhead
> without adding coverage.
>
> **To run the Canonical Semantic-Tag Convention skill-body check for this gate:**
> read fixtures from `.claude/skills/agent-customizer-quality-gate/assets/fixtures/skill/`
> and use the MANIFEST.md there for the expected verdicts.

This covers `plugins/agents-initializer/skills/**/SKILL.md` and `skills/**/SKILL.md` bodies.
The expected verdict table is in the shared MANIFEST at the path above.

Note: `quality-gate` checks both the agents-initializer plugin skills and the standalone
skills distribution. Both use the same mandatory tag vocabulary — `<TRIGGER>`, `<BEHAVIOUR>`,
`<HARD_RULES>`, `<PROCESS>` with `<PHASE>`. The same fixture corpus exercises both.
