# Subagent Validation Criteria

Quality checklist for generated and improved Claude Code subagent definitions.
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

| Criterion | Threshold |
|-----------|-----------|
| YAML frontmatter | Valid YAML syntax |
| `name` field | Lowercase letters and hyphens only |
| `description` field | Present and non-empty |
| `model` field | Recognized alias or full model ID |
| `maxTurns` | 15 for analysis agents; 20 for evaluators; values outside 15–20 require justification |
| System prompt | Not empty; task-specific |


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

**Legacy `<RULES>` alias**: a `<RULES>` block satisfies the mandatory `<HARD_RULES>` check exactly as `<HARD_RULES>` does — its presence is neither a warn nor a hard-fail. Report it as a `<HARD_RULES>` alias candidate (informational), not as a violation. No mass rename; migrate each `<RULES>` occurrence to `<HARD_RULES>` only when the file is next touched for other reasons.

### Strictness tiers (apply verbatim — the verdict must be deterministic)

| Tier | Trigger | Action |
|------|---------|--------|
| **Hard-fail** | Any mandatory tag missing (`<BEHAVIOUR>`, `<HARD_RULES>` or `<RULES>` alias, `<PROCESS>`, or `<PROCESS>` with zero `<PHASE>`) | Stop; fix before proceeding |
| **Hard-fail** | Unbalanced tags — any opening tag without a matching closing tag, or a close with no open | Stop; fix before proceeding |
| **Hard-fail** | Malformed attribute syntax — an attribute value missing its quotes, a stray `=`, or an unterminated quote | Stop; fix before proceeding |
| **Warn** | A non-canonical attribute name (outside `avoid` / `always` / `when` / `name` / `id` / `priority`) — typo guard | Surface a warning; do not block |
| **Silent** | Absence of `<TRIGGER>` or any other optional tag | No finding; proceed |
| **Informational** | Legacy `<RULES>` tag present — alias for `<HARD_RULES>` | Surface as alias candidate; do not fail or warn |

A self-closing tag (`<TRIGGER ... />`) counts as balanced. `<PHASE>` missing its mandatory `id=` is a hard-fail (a mandatory attribute is absent, not malformed).


### Structured violation report format

When evaluating a target subagent body, report every finding using this format:

```
VIOLATION REPORT — <target-path>
──────────────────────────────────
[HARD-FAIL] Missing mandatory tag: <BEHAVIOUR> — required for subagents
[HARD-FAIL] Unbalanced tag: <PROCESS> opened at line 35, no closing tag found
[HARD-FAIL] Malformed attribute: <PHASE id=1 name="x"> — attribute value `1` missing quotes
[WARN]      Non-canonical attribute: <BEHAVIOUR mood="high"> — `mood` is outside the closed set
[INFO]      Legacy alias: <RULES> at line 18 — satisfies <HARD_RULES> check; candidate for organic retrofit to <HARD_RULES>
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

Note: `<TRIGGER>` absent in a subagent body is NOT a violation — it produces no report entry.

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

**Canonical Tag Vocabulary:**

- [ ] Target subagent body uses all mandatory tags (`<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` with at least one `<PHASE>`); `<TRIGGER>` absence is silent — not a finding
- [ ] All tags in target subagent body are balanced (no unmatched open/close)
- [ ] All attribute syntax in target subagent body is well-formed (no missing quotes, no stray `=`)
- [ ] Non-canonical attributes in target subagent body surfaced as warnings (not hard-fails)
- [ ] Legacy `<RULES>` in target subagent body reported as informational alias candidate (not a fail)

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

The strictness tiers above are exercised by a regression corpus shipped with the
sibling `create-subagent` skill at
`plugins/agent-customizer/skills/create-subagent/assets/fixtures/` (see its
`MANIFEST.md`). `improve-subagent` does not ship its own copy — the
strictness-tier logic is identical, so the `create-subagent` corpus is the single
regression test for both. The table below documents the expected verdict for each
fixture so the contract is visible here too; running the validation loop against
any body MUST produce exactly these verdicts.

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
| `rules-alias.md` | Uses legacy `<RULES>` instead of `<HARD_RULES>`; all else compliant | **pass** (alias satisfies the `<HARD_RULES>` check); surface informational alias candidate |
