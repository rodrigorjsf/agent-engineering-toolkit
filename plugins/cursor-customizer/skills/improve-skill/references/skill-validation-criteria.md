# Skill Validation Criteria

Quality checklist for generated and improved Cursor SKILL.md packages.
Source: docs/cursor/skills/agent-skills-guide.md

---

## Contents

- Hard limits (auto-fail if violated)
- Canonical Semantic-Tag Convention
- Foreign-platform dialect ban (auto-fail if violated)
- Quality checks (all must pass)
- Improve-only checks (information preservation, structural)
- Validation loop instructions

---

## Hard Limits (Auto-fail if violated)

Any skill violating these criteria must be fixed before proceeding:

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| SKILL.md body length | ≤ 500 lines | Agent Skills best practice: keep SKILL.md focused |
| Reference files | ≤ 200 lines each | reference-files convention |
| Reference files >100 lines | Must include a `## Contents` table of contents | reference-files convention |
| `description` field | Present, non-empty, ≤ 1024 chars, no XML tags | Agent Skills specification |
| `name` field | Present, non-empty, lowercase letters/numbers/hyphens only, max 64 chars, matches parent folder | Agent Skills specification |
| Frontmatter fields | Restricted to `name`, `description`, `license`, `compatibility`, `metadata`, `disable-model-invocation` | Agent Skills specification |
| Contradictions between phases | 0 | Agents pick arbitrarily when contradictions exist |

*Source: docs/cursor/skills/agent-skills-guide.md "Frontmatter fields" and "Optional directories"*

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

*Source: wiki/knowledge/skill-body-convention.md; docs/adr/0007-skill-body-semantic-tag-convention.md*

---

## Foreign-Platform Dialect Ban (Auto-fail if any present)

The Cursor distribution is product-strict. The skill tree (SKILL.md, references, assets, scripts) must conform to the following allowlists. Anything outside an allowlist is foreign-platform dialect and is forbidden.

| Check | Allowlist (anything else fails) |
|-------|---------------------------------|
| Frontmatter fields | Only the six recognised by the Agent Skills standard: `name`, `description`, `license`, `compatibility`, `metadata`, `disable-model-invocation` |
| Bundled-path references | Relative paths from the skill root only (e.g., `references/foo.md`, `scripts/deploy.sh`, `assets/templates/foo.yaml`); no string-substitution variables of any form (no `${...}` or `$NAME` forms inside bundled paths) |
| Discovery-path references | Only `.cursor/`, `.agents/`, and `~/.cursor/` are recognised; no references to discovery directories or memory files belonging to other agent platforms |
| Documentation citations | Local Cursor docs and vendor-neutral research only; no citations to product documentation for other agent platforms |

---

## Quality Checks (All must pass)

- [ ] Has a self-validation phase that reads the skill's `references/skill-validation-criteria.md`
- [ ] All bundled-path references in SKILL.md use relative paths from the skill root
- [ ] `description` written in third person ("Deploys..." not "I deploy..." or "You can use...")
- [ ] `description` includes what the skill does AND when to use it (trigger terms)
- [ ] Progressive disclosure applied: references loaded per phase, not all upfront
- [ ] No reference content inlined in SKILL.md body (should be in `references/` subdirectory)
- [ ] Each phase instruction is concise (≤10 lines); depth lives in reference files
- [ ] Reference files cited explicitly so the agent knows what to load and when
- [ ] `disable-model-invocation: true` set for side-effect workflows (commit, deploy, send)
- [ ] Prompt engineering strategy applied: skill follows relevant strategy from `references/prompt-engineering-strategies.md`
- [ ] Behavioral guidelines applied: the skill surfaces assumptions before acting, prefers the simplest adequate path, keeps changes surgical, and defines explicit validation targets
- [ ] Persuasion cues, if present, stay inside the ethical constraint: they improve compliance with legitimate work only and never weaken safeguards, refusals, or scope boundaries
- [ ] Phase instructions are specific and actionable — no vague directives like "ensure quality" or "review for completeness"
- [ ] Plugin skill bodies delegate analysis to registered subagents; no inline bash analysis commands
- [ ] Evidence citations present: key decisions reference source docs (e.g., "per skill-authoring-guide.md")
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

- [ ] Reference file ≤200 line limit not violated by merging content; >100-line files have a `## Contents` table of contents
- [ ] Bundled-path references not broken by renaming or moving files

---

## Validation Loop Instructions

Execute this loop for each generated or improved skill:

1. Evaluate the skill against ALL criteria above (hard limits, the **Canonical Semantic-Tag Convention** strictness tiers, foreign-dialect ban, quality checks, and IMPROVE-only checks if applicable).
2. **For improve operations:** verify each suggestion in the improvement plan has a WHY field citing a source doc — no suggestion may lack a source reference.
3. If ANY hard-fail criterion fails: identify the specific failure, fix the skill, restart evaluation.
4. Surface every warn-tier finding (non-canonical attribute names) without blocking — the user decides whether to fix.
5. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user.
6. Only proceed to writing skills when ALL hard-fail and quality criteria pass.

**Do not skip criteria for "minor" violations.** Hard limits and the foreign-dialect ban are absolute.
