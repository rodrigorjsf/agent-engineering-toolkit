# Skill Validation Criteria

Quality checklist for generated and improved SKILL.md files.
Source: skills/skill-authoring-best-practices.md, skills/extend-claude-with-skills.md, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md`, `wiki/knowledge/skill-body-convention.md`

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

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| SKILL.md body length | ≤ 500 lines | Anthropic: "Keep SKILL.md under 500 lines" |
| Reference files | ≤ 200 lines each | `.claude/rules/reference-files.md` — hard limit |
| Reference files >100 lines | Must include a `## Contents` TOC | skill-authoring-best-practices.md line 403 |
| `description` field | Present; non-empty; ≤ 1024 chars; no XML tags | Agent Skills specification |
| `name` field format | Present; non-empty; lowercase letters, numbers, hyphens only; max 64 chars | Agent Skills specification |
| Contradictions between phases | 0 | Claude picks arbitrarily when contradictions exist |

*Source: skills/skill-authoring-best-practices.md lines 259; skills/extend-claude-with-skills.md lines 183-199; `.claude/rules/reference-files.md`*

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

**Legacy `<RULES>` alias**: a `<RULES>` block satisfies the mandatory `<HARD_RULES>` check exactly as `<HARD_RULES>` does — its presence is neither a warn nor a hard-fail. Report it as a `<HARD_RULES>` alias candidate (informational), not as a violation. No mass rename; migrate each `<RULES>` occurrence to `<HARD_RULES>` only when the file is next touched for other reasons.

### Strictness tiers (apply verbatim — the verdict must be deterministic)

| Tier | Trigger | Action |
|------|---------|--------|
| **Hard-fail** | Any mandatory tag missing (`<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>` or `<RULES>` alias, `<PROCESS>`, or `<PROCESS>` with zero `<PHASE>`) | Stop; fix before proceeding |
| **Hard-fail** | Unbalanced tags — any opening tag without a matching closing tag, or a close with no open | Stop; fix before proceeding |
| **Hard-fail** | Malformed attribute syntax — an attribute value missing its quotes, a stray `=`, or an unterminated quote | Stop; fix before proceeding |
| **Warn** | A non-canonical attribute name (outside `avoid` / `always` / `when` / `name` / `id` / `priority`) — typo guard | Surface a warning; do not block |
| **Silent** | Absence of any optional tag | No finding; proceed |
| **Informational** | Legacy `<RULES>` tag present — alias for `<HARD_RULES>` | Surface as alias candidate; do not fail or warn |

A self-closing tag (`<TRIGGER ... />`) counts as balanced. `<PHASE>` missing its mandatory `id=` is a hard-fail (a mandatory attribute is absent, not malformed).

### Structured violation report format

When evaluating a target skill body, report every finding using this format:

```
VIOLATION REPORT — <target-path>
──────────────────────────────────
[HARD-FAIL] Missing mandatory tag: <TRIGGER> — required for skills
[HARD-FAIL] Unbalanced tag: <PROCESS> opened at line 42, no closing tag found
[HARD-FAIL] Malformed attribute: <PHASE id=1 name="x"> — attribute value `1` missing quotes
[WARN]      Non-canonical attribute: <BEHAVIOUR mood="high"> — `mood` is outside the closed set
[INFO]      Legacy alias: <RULES> at line 20 — satisfies <HARD_RULES> check; candidate for organic retrofit to <HARD_RULES>
──────────────────────────────────
Result: HARD-FAIL (3 blocking violations, 1 warning, 1 informational)
```

A compliant target produces:

```
VIOLATION REPORT — <target-path>
──────────────────────────────────
No violations found.
──────────────────────────────────
Result: PASS
```

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

**Canonical Tag Vocabulary:**

- [ ] Target skill body uses all mandatory tags (`<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` with at least one `<PHASE>`)
- [ ] All tags in target skill body are balanced (no unmatched open/close)
- [ ] All attribute syntax in target skill body is well-formed (no missing quotes, no stray `=`)
- [ ] Non-canonical attributes in target skill body surfaced as warnings (not hard-fails)
- [ ] Legacy `<RULES>` in target skill body reported as informational alias candidate (not a fail)

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

The strictness tiers above are exercised by a regression corpus shipped with the
sibling `create-skill` skill at
`plugins/agent-customizer/skills/create-skill/assets/fixtures/` (see its
`MANIFEST.md`). `improve-skill` does not ship its own copy — the strictness-tier
logic is identical, so the `create-skill` corpus is the single regression test
for both. The table below documents the expected verdict for each fixture so the
contract is visible here too; running the validation loop against any body MUST
produce exactly these verdicts.

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
| `rules-alias.md` | Uses legacy `<RULES>` instead of `<HARD_RULES>`; all else compliant | **pass** (alias satisfies the `<HARD_RULES>` check); surface informational alias candidate |
