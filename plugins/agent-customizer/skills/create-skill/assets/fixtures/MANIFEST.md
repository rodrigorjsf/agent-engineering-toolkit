# Fixture Corpus — Skill Body Convention

Regression corpus for the canonical semantic-tag strictness tiers defined in
`references/skill-validation-criteria.md` ("Canonical Semantic-Tag Convention"
section). Each fixture is a minimal SKILL.md body that exercises exactly one
validation outcome.

To use: run the validation loop from `skill-validation-criteria.md` against each
fixture file and confirm the produced verdict matches the **Expected verdict**
column below. Any mismatch means the strictness-tier text is ambiguous and must
be tightened — the corpus is the regression test for that clarity.

These fixtures are test data, not real skills. They are not loaded by the
`create-skill` skill at runtime.

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
| `rules-alias.md` | Uses legacy `<RULES>` instead of `<HARD_RULES>`; all else compliant | **pass** — alias satisfies the `<HARD_RULES>` check |
