# Subagent Validation Criteria

Quality checklist for generated and improved Claude Code subagent definitions.
Source: subagents/creating-custom-subagents.md, subagents/research-subagent-best-practices.md, `wiki/knowledge/skill-body-convention.md`

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

Any subagent violating these criteria must be fixed before proceeding:

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| YAML frontmatter | Valid YAML syntax | subagents/creating-custom-subagents.md |
| `name` field | Lowercase letters and hyphens only | subagents/creating-custom-subagents.md lines 217-220 |
| `description` field | Present and non-empty | subagents/creating-custom-subagents.md lines 217-220 |
| `model` field | Recognized alias or full model ID | subagents/creating-custom-subagents.md lines 234-241 |
| `maxTurns` | 15 for analysis agents; 20 for evaluators; values outside 15–20 require justification | Project convention — `.claude/rules/agent-files.md` |
| System prompt | Not empty; task-specific | subagents/creating-custom-subagents.md lines 199-212 |

*Source: subagents/creating-custom-subagents.md lines 213-232; subagents/research-subagent-best-practices.md lines 33-55*

---

## Canonical Semantic-Tag Convention

The subagent body (everything after the YAML frontmatter) MUST wrap its logical blocks in the canonical semantic-tag vocabulary. The validator applies three strictness tiers — hard-fail, warn, silent — and produces the same verdict every run.

**Mandatory tags** (the subagent body MUST contain all of these):

- `<BEHAVIOUR>` — behavioural guidelines, mindset, posture
- `<HARD_RULES>` — inviolable constraints
- `<PROCESS>` — container for the ordered phases; MUST contain at least one `<PHASE>`
- `<PHASE id="N" name="X">` — one execution step inside `<PROCESS>`; `id=` is mandatory on every `<PHASE>`

**Subagent-specific variant**: `<TRIGGER>` is OPTIONAL for subagents (they are spawned by skills, not user-invoked). Its absence is **silent** — never a finding.

**Optional tags** (absence is silent — never a finding): `<TRIGGER>`, `<PREFLIGHT>`, `<REFERENCES>`, `<EXAMPLE>`, `<ANTI_PATTERN>`, `<OUTPUT>`, `<VALIDATION>`.

**Closed attribute set**: `avoid=`, `always=`, `when=`, `name=`, `id=`, `priority=`. Any other attribute name is non-canonical.

**Legacy `<RULES>` alias**: a `<RULES>` block satisfies the mandatory `<HARD_RULES>` check exactly as `<HARD_RULES>` does — its presence is neither a warn nor a hard-fail. No mass rename; migrate each `<RULES>` occurrence to `<HARD_RULES>` only when the file is next touched for other reasons.

### Strictness tiers (apply verbatim — the verdict must be deterministic)

| Tier | Trigger | Action |
|------|---------|--------|
| **Hard-fail** | Any mandatory tag missing (`<BEHAVIOUR>`, `<HARD_RULES>` or `<RULES>` alias, `<PROCESS>`, or `<PROCESS>` with zero `<PHASE>`) | Stop; fix before proceeding |
| **Hard-fail** | Unbalanced tags — any opening tag without a matching closing tag, or a close with no open | Stop; fix before proceeding |
| **Hard-fail** | Malformed attribute syntax — an attribute value missing its quotes, a stray `=`, or an unterminated quote | Stop; fix before proceeding |
| **Warn** | A non-canonical attribute name (outside `avoid` / `always` / `when` / `name` / `id` / `priority`) — typo guard | Surface a warning; do not block |
| **Silent** | Absence of `<TRIGGER>` or any other optional tag | No finding; proceed |

A self-closing tag (`<TRIGGER ... />`) counts as balanced. `<PHASE>` missing its mandatory `id=` is a hard-fail (a mandatory attribute is absent, not malformed).

*Source: wiki/knowledge/skill-body-convention.md; docs/adr/0007-skill-body-semantic-tag-convention.md*

---

## Quality Checks (All must pass)

- [ ] `description` specific enough for automatic delegation (includes trigger phrases)
- [ ] Model appropriate for task complexity (Haiku for exploration, Opus only for complex reasoning)
- [ ] `tools` field restricts to minimum needed (don't grant write access to review agents)
- [ ] System prompt includes: role definition, responsibilities, process steps, output format
- [ ] Delegation trigger language is normal ("use when..."), not aggressive ("CRITICAL: MUST always...")
- [ ] No instructions telling subagent to spawn other subagents (runtime blocks this)
- [ ] System prompt is task-specific, not generic ("you are a helpful AI")
- [ ] Evidence citations present: system prompt references source docs for domain-specific constraints
- [ ] Prompt engineering strategy applied: system prompt uses role prompting, structured output format, and confidence filtering per prompt-engineering-strategies.md
- [ ] Canonical semantic tags present: `<BEHAVIOUR>`, `<HARD_RULES>`, and `<PROCESS>` containing one or more `<PHASE id="N" name="X">`
- [ ] All semantic tags balanced and use only the closed attribute set (`avoid`, `always`, `when`, `name`, `id`, `priority`); every `<PHASE>` carries an `id=`
- [ ] YAML frontmatter untouched — `name`, `description`, `tools`, `model`, `maxTurns` fields per Anthropic subagent spec

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation:**

- [ ] Tool restrictions not loosened without explicit rationale
- [ ] Model not downgraded without confirming task doesn't need current model
- [ ] Specialized domain knowledge in system prompt preserved

**Structural:**

- [ ] `maxTurns` not increased beyond 20 without justification
- [ ] Scope of subagent not broadened (single-purpose agents are better than general-purpose)
- [ ] Reference file ≤200 line limit not violated; >100-line files have a `## Contents` TOC

---

## Validation Loop Instructions

Execute this loop for each generated or improved subagent:

1. Evaluate the subagent against ALL criteria above, including the **Canonical Semantic-Tag Convention** strictness tiers
2. **For improve operations:** verify each suggestion in the improvement plan has a WHY field citing a source doc — no suggestion may lack a source reference
3. If ANY hard-fail criterion fails: identify the specific failure, fix the subagent, restart evaluation
4. Surface every warn-tier finding (non-canonical attribute names) without blocking — the user decides whether to fix
5. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
6. Only proceed to writing subagents when ALL hard-fail and quality criteria pass

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.

---

## Fixture Corpus Expected Verdicts

The fixture corpus at `${CLAUDE_SKILL_DIR}/assets/fixtures/` is the regression test for the strictness tiers. Each fixture is annotated in `assets/fixtures/MANIFEST.md` with its expected verdict. Running the validation loop against the corpus MUST produce exactly the verdict below for each fixture — any deviation means the strictness-tier text above is ambiguous and must be tightened.

| Fixture | Defect | Expected verdict |
|---------|--------|------------------|
| `compliant-with-trigger.md` | None — all mandatory tags present, `<TRIGGER>` also present, balanced, canonical attributes | **pass** |
| `compliant-without-trigger.md` | `<TRIGGER>` absent (subagent variant — optional) | **pass** (silence on optional tag) |
| `missing-behaviour.md` | `<BEHAVIOUR>` absent | **hard-fail** (missing mandatory tag) |
| `missing-hard-rules.md` | `<HARD_RULES>` and `<RULES>` both absent | **hard-fail** (missing mandatory tag) |
| `missing-process.md` | `<PROCESS>` absent | **hard-fail** (missing mandatory tag) |
| `missing-phase.md` | `<PROCESS>` present but contains zero `<PHASE>` | **hard-fail** (missing mandatory tag) |
| `unbalanced-tag.md` | `<PROCESS>` opened, never closed | **hard-fail** (unbalanced tags) |
| `malformed-attribute.md` | `<PHASE>` attribute value missing its quotes | **hard-fail** (malformed attribute syntax) |
| `non-canonical-attribute.md` | `<BEHAVIOUR>` carries a `mood=` attribute | **warn** (non-canonical attribute name) — passes otherwise |
| `rules-alias.md` | Uses legacy `<RULES>` instead of `<HARD_RULES>`; all else compliant | **pass** (alias satisfies the `<HARD_RULES>` check) |
