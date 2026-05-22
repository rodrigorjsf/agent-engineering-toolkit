# Fixture Corpus — Skill Body Convention (Skill Variant)

Regression corpus for the canonical semantic-tag strictness tiers defined in
`wiki/knowledge/skill-body-convention.md`. Each fixture is a minimal SKILL.md
body that exercises exactly one validation outcome for **skill** targets.

This corpus covers `plugins/agent-customizer/skills/**/SKILL.md` bodies.

To use: run the Canonical Semantic-Tag Convention check against each fixture
file and confirm the produced verdict matches the **Expected verdict** column
below. Any mismatch means the strictness-tier text is ambiguous and must be
tightened — the corpus is the regression test for that clarity.

These fixtures are test data only. They are not loaded by any gate at runtime.

| Fixture | Defect | Expected verdict |
|---------|--------|------------------|
| `compliant-baseline.md` | None — all mandatory tags present, balanced, canonical attributes only | **pass** |
| `missing-trigger.md` | `<TRIGGER>` absent | **hard-fail** — missing mandatory tag |
| `missing-behaviour.md` | `<BEHAVIOUR>` absent | **hard-fail** — missing mandatory tag |
| `missing-hard-rules.md` | `<HARD_RULES>` and `<RULES>` both absent | **hard-fail** — missing mandatory tag |
| `missing-process.md` | `<PROCESS>` absent | **hard-fail** — missing mandatory tag |
| `missing-phase.md` | `<PROCESS>` present but contains zero `<PHASE>` | **hard-fail** — missing mandatory tag |
| `unbalanced-tag.md` | `<PROCESS>` opened, never closed | **hard-fail** — unbalanced tags |
| `malformed-attribute.md` | `<PHASE>` `name` value missing its quotes | **hard-fail** — malformed attribute syntax |
| `non-canonical-attribute.md` | `<BEHAVIOUR>` carries a non-canonical `mood=` attribute | **warn** — non-canonical attribute name; passes otherwise |
| `rules-alias.md` | Uses legacy `<RULES>` instead of `<HARD_RULES>`; all else compliant | **pass** — alias satisfies the `<HARD_RULES>` check; additionally reported as an informational `<HARD_RULES>` alias candidate (not a violation) |
