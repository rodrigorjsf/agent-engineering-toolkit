# Fixture Corpus — Skill Body Convention (Subagent Variant)

Regression corpus for the canonical semantic-tag strictness tiers defined in
`wiki/knowledge/skill-body-convention.md`. Each fixture is a minimal subagent
definition body that exercises exactly one validation outcome for **subagent**
targets.

This corpus covers `plugins/agent-customizer/agents/**/*.md` bodies.

The subagent variant differs from the skill variant in one critical respect:
`<TRIGGER>` is **optional** for subagents (they are spawned by skills, not
user-invoked). Its absence is silent — never a finding. All other mandatory
tags (`<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` with `<PHASE>`) are hard-fail
when absent, same as for skills.

To use: run the Canonical Semantic-Tag Convention check against each fixture
file and confirm the produced verdict matches the **Expected verdict** column
below. Any mismatch means the strictness-tier text is ambiguous and must be
tightened — the corpus is the regression test for that clarity.

These fixtures are test data only. They are not loaded by any gate at runtime.

| Fixture | Defect | Expected verdict |
|---------|--------|------------------|
| `compliant-with-trigger.md` | None — all mandatory tags present, `<TRIGGER>` also present, balanced, canonical attributes only | **pass** |
| `compliant-without-trigger.md` | `<TRIGGER>` absent (subagent variant — optional) | **pass** — `<TRIGGER>` absence is silent for subagents |
| `missing-behaviour.md` | `<BEHAVIOUR>` absent | **hard-fail** — missing mandatory tag |
| `missing-hard-rules.md` | `<HARD_RULES>` and `<RULES>` both absent | **hard-fail** — missing mandatory tag |
| `missing-process.md` | `<PROCESS>` absent | **hard-fail** — missing mandatory tag |
| `missing-phase.md` | `<PROCESS>` present but contains zero `<PHASE>` | **hard-fail** — missing mandatory tag |
| `unbalanced-tag.md` | `<PROCESS>` opened, never closed | **hard-fail** — unbalanced tags |
| `malformed-attribute.md` | `<PHASE>` `name` value missing its quotes | **hard-fail** — malformed attribute syntax |
| `non-canonical-attribute.md` | `<BEHAVIOUR>` carries a non-canonical `mood=` attribute | **warn** — non-canonical attribute name; passes otherwise |
| `rules-alias.md` | Uses legacy `<RULES>` instead of `<HARD_RULES>`; all else compliant | **pass** — alias satisfies the `<HARD_RULES>` check; additionally reported as an informational `<HARD_RULES>` alias candidate (not a violation) |
