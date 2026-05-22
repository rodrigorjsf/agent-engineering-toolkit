# Skill Validation Criteria

Quality checklist for generated and improved SKILL.md files.

---

## Contents

- Hard Limits (Auto-fail if violated)
- Canonical Semantic-Tag Convention
- Quality Checks (All must pass)
- If This Is an IMPROVE Operation — Also Check
- Validation Loop Instructions
- Fixture Corpus Expected Verdicts

---

## Hard Limits (Auto-fail if violated)

Any skill violating these criteria must be fixed before proceeding:

| Criterion | Threshold |
|-----------|-----------|
| SKILL.md body length | ≤ 500 lines |
| Reference files | ≤ 200 lines each |
| Reference files >100 lines | Must include a `## Contents` TOC |
| `description` field | Present; non-empty; ≤ 1024 chars; no XML tags |
| `name` field format | Present; non-empty; lowercase letters, numbers, hyphens only; max 64 chars |
| Contradictions between phases | 0 |


---

## Canonical Semantic-Tag Convention

The SKILL.md body (everything after the YAML frontmatter) MUST wrap its logical blocks in the canonical semantic-tag vocabulary. The validator applies three strictness tiers — hard-fail, warn, silent — and produces the same verdict every run.

**Mandatory tags** (the SKILL.md body MUST contain all of these):

- `<TRIGGER>` — plain-language activation cue ("use when X")
- `<BEHAVIOUR>` — behavioural guidelines, mindset, posture
- `<HARD_RULES>` — inviolable constraints
- `<PROCESS>` — container for the ordered phases; MUST contain at least one `<PHASE>`
- `<PHASE id="N" name="X">` — one execution step inside `<PROCESS>`; `id=` is mandatory on every `<PHASE>`

**Optional tags** (absence is silent — never a finding): `<PREFLIGHT>`, `<REFERENCES>`, `<EXAMPLE>`, `<ANTI_PATTERN>`, `<OUTPUT>`, `<VALIDATION>`.

**Closed attribute set**: `avoid=`, `always=`, `when=`, `name=`, `id=`, `priority=`. Any other attribute name is non-canonical.

**Legacy `<RULES>` alias**: a `<RULES>` block satisfies the mandatory `<HARD_RULES>` check exactly as `<HARD_RULES>` does — its presence is neither a warn nor a hard-fail. No mass rename; migrate each `<RULES>` occurrence to `<HARD_RULES>` only when the file is next touched for other reasons.

### Strictness tiers (apply verbatim — the verdict must be deterministic)

| Tier | Trigger | Action |
|-------|---------|--------|
| **Hard-fail** | Any mandatory tag missing (`<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>` or `<RULES>` alias, `<PROCESS>`, or `<PROCESS>` with zero `<PHASE>`) | Stop; fix before proceeding |
| **Hard-fail** | Unbalanced tags — any opening tag without a matching closing tag, or a close with no open | Stop; fix before proceeding |
| **Hard-fail** | Malformed attribute syntax — an attribute value missing its quotes, a stray `=`, or an unterminated quote | Stop; fix before proceeding |
| **Warn** | A non-canonical attribute name (outside `avoid` / `always` / `when` / `name` / `id` / `priority`) — typo guard | Surface a warning; do not block |
| **Silent** | Absence of any optional tag | No finding; proceed |

A self-closing tag (`<TRIGGER ... />`) counts as balanced. `<PHASE>` missing its mandatory `id=` is a hard-fail (a mandatory attribute is absent, not malformed).

---

## Quality Checks (All must pass)

- [ ] Has a self-validation phase that reads the skill's `references/*validation-criteria.md`
- [ ] `${CLAUDE_SKILL_DIR}` used for all bundled file references (not hardcoded paths)
- [ ] `description` written in third person ("Processes..." not "I process..." or "You can use...")
- [ ] `description` includes what the skill does AND when to use it
- [ ] Progressive disclosure applied: references loaded per phase, not all upfront
- [ ] No reference content inlined in SKILL.md body (should be in `references/` subdirectory)
- [ ] Each phase instruction is concise (≤10 lines); depth lives in reference files
- [ ] Reference files cited explicitly so Claude knows what to load and when
- [ ] `disable-model-invocation: true` set for side-effect workflows (commit, deploy, send)
- [ ] Prompt engineering strategy applied: skill follows relevant strategy from prompt-engineering-strategies.md (role prompting for skills, progressive disclosure for phases)
- [ ] Behavioral guidelines applied: the skill surfaces assumptions before acting, prefers the simplest adequate path, keeps changes surgical, and defines explicit validation targets
- [ ] Persuasion cues, if present, stay inside the ethical constraint: they improve compliance with legitimate work only and never weaken safeguards, refusals, or scope boundaries
- [ ] Phase instructions are specific and actionable — no vague directives like "ensure quality" or "review for completeness"
- [ ] Plugin skill body contains no inline bash analysis commands — analysis must be delegated to registered agents (applies to skills in `plugins/*/skills/`)
- [ ] Standalone skill body includes explicit bash commands for each analysis step (applies to skills in `skills/`)
- [ ] Evidence citations present: key decisions reference source docs (e.g., "per skill-authoring-best-practices.md")
- [ ] Canonical semantic tags present in their canonical positions: `<TRIGGER>` after the title, `<BEHAVIOUR>`, `<HARD_RULES>`, then `<PROCESS>` containing one or more `<PHASE id="N" name="X">`
- [ ] All semantic tags balanced and use only the closed attribute set (`avoid`, `always`, `when`, `name`, `id`, `priority`); every `<PHASE>` carries an `id=`
- [ ] YAML frontmatter untouched by the convention — the `<TRIGGER>` cue is not duplicated into the `description` field

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation:**

- [ ] Evidence-grounded references not removed (citations preserved)
- [ ] Existing phase structure not flattened
- [ ] Progressive disclosure references not collapsed into inline content

**Structural:**

- [ ] Reference file ≤200 line limit not violated by merging content; >100-line files have a `## Contents` TOC
- [ ] `${CLAUDE_SKILL_DIR}` references not broken by renaming or moving files

---

## Validation Loop Instructions

Execute this loop for each generated or improved skill:

1. Evaluate the skill against ALL criteria above, including the **Canonical Semantic-Tag Convention** strictness tiers
2. **For improve operations:** verify each suggestion in the improvement plan has a WHY field citing a source doc — no suggestion may lack a source reference
3. If ANY hard-fail criterion fails: identify the specific failure, fix the skill, restart evaluation
4. Surface every warn-tier finding (non-canonical attribute names) without blocking — the user decides whether to fix
5. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
6. Only proceed to writing skills when ALL hard-fail and quality criteria pass

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.

---

## Fixture Corpus Expected Verdicts

The fixture corpus at `${CLAUDE_SKILL_DIR}/assets/fixtures/` is the regression test for the strictness tiers. Each fixture is annotated in `assets/fixtures/MANIFEST.md` with its expected verdict. Running the validation loop against the corpus MUST produce exactly the verdict below for each fixture — any deviation means the strictness-tier text above is ambiguous and must be tightened.

| Fixture | Defect | Expected verdict |
|---------|--------|------------------|
| `compliant-baseline.md` | None — all mandatory tags present, balanced, canonical attributes | **pass** |
| `missing-trigger.md` | `<TRIGGER>` absent | **hard-fail** (missing mandatory tag) |
| `missing-behaviour.md` | `<BEHAVIOUR>` absent | **hard-fail** (missing mandatory tag) |
| `missing-hard-rules.md` | `<HARD_RULES>` and `<RULES>` both absent | **hard-fail** (missing mandatory tag) |
| `missing-process.md` | `<PROCESS>` absent | **hard-fail** (missing mandatory tag) |
| `missing-phase.md` | `<PROCESS>` present but contains zero `<PHASE>` | **hard-fail** (missing mandatory tag) |
| `unbalanced-tag.md` | `<PROCESS>` opened, never closed | **hard-fail** (unbalanced tags) |
| `malformed-attribute.md` | `<PHASE>` attribute value missing its quotes | **hard-fail** (malformed attribute syntax) |
| `non-canonical-attribute.md` | `<BEHAVIOUR>` carries a `mood=` attribute | **warn** (non-canonical attribute name) — passes otherwise |
| `rules-alias.md` | Uses legacy `<RULES>` instead of `<HARD_RULES>`; all else compliant | **pass** (alias satisfies the `<HARD_RULES>` check) |
