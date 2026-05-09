# Skill description budget ceiling

**Status:** accepted (2026-05-09)

Claude Code's `skillListingBudgetFraction` (default `0.01`, i.e. 1% of the context window) caps total skill metadata injected into the system prompt. When the listing exceeds the budget, lowest-priority skill descriptions are silently dropped — affected skills disappear from auto-invocation without a runtime warning. This repo ships 46 SKILL.md files across four distributions; at default budget on a 200K model (~2K tokens), 85% of those descriptions exceed a sustainable per-skill character count.

This ADR sets a project-level character ceiling on `description:` fields that fits the skill catalogue under the default budget without raising `skillListingBudgetFraction`.

## The constraint

The upstream Claude Code schema allows `description` up to 1024 characters. The `skillListingMaxDescChars` setting (default 1536) adds a per-skill truncation cap. Neither of these prevents the total listing from exceeding `skillListingBudgetFraction` — they are safety valves, not budgeting tools.

On a 200K Sonnet 4.6 session with 46 skills:

| Budget fraction | Approx. token budget | Per-skill headroom (46 skills) |
|---|---|---|
| `0.01` (default) | ~2 000 tokens | ~43 tokens ≈ ~170 chars |
| `0.02` (doubled) | ~4 000 tokens | ~87 tokens ≈ ~340 chars |

Raising to `0.02` costs ~3K tokens per session and burns rate limits faster. The preferred fix is description optimization at the source (source: docs/claude/skills-listing-budget.md).

## Decision

Impose a project-level ceiling on the `description:` field of every `SKILL.md` in this repository:

- **Target band** — 110–150 characters. Sweet spot: keyword-dense, front-loaded, fits all 46 skills comfortably under the default budget.
- **Hard ceiling** — 200 characters. Skills above this break the budget on 200K models and must be rewritten.
- **Exception** — permitted if (1) the skill's trigger phrases are enumerated and (2) removing any trigger measurably degrades discovery. Exceptions are stored as a custom YAML field **inside** the frontmatter (not as an HTML comment above `---`, which breaks frontmatter parsing):
  ```yaml
  ---
  name: <skill-name>
  description: <up to 400 chars>
  description-budget-exception: <one-line reason>
  ---
  ```
- **Absolute cap** — 400 characters even with exception. No skill may exceed this.
- **Scope** — `description:` field of `SKILL.md` only. In: `.claude/skills/**`, `plugins/*/skills/**`, `skills/**`. Out: agent descriptions, hook descriptions, rule descriptions (separate budgets, separate decision).

## Enforcement (two layers)

1. **Canonical rule** — `.claude/rules/skill-description-budget.md` with `paths: ["**/SKILL.md"]`. Referenced by the three existing skill convention rules (`plugin-skills.md`, `cursor-plugin-skills.md`, `standalone-skills.md`).
2. **Authoring skill self-validation** — every skill that authors or modifies `SKILL.md` files (`write-a-skill`, `create-skill` ×3, `improve-skill` ×3, plus all init-/improve- skills) gains a self-validation step that rejects output if `description` > 200 chars and the exception field is absent.

No runtime PostToolUse hook is added — authoring discipline is enforced at skill-authoring time, not at write time. This avoids hook-layer complexity and is consistent with how other project conventions are enforced.

## Rewrite heuristic (Phase C execution)

1. Keep the verb that names the action ("Reviews", "Generates", "Audits", "Triages").
2. List 1–3 trigger keywords separated by commas.
3. State the WHEN with a "Use when…" clause in ≤8 words.
4. Drop marketing prose, feature lists, and adjectives ("comprehensive", "thorough", "detailed").
5. Drop redundant restatements of the skill name.
6. Front-load the most distinctive keyword in the first 50 chars.
7. Verify char count with Python YAML (single-line awk misses `description: >` multi-line scalars).

## Consequences

- **Silent skill loss eliminated** — at 110–150 chars, the 46-skill catalogue fits comfortably under the 2K-token default budget on 200K models.
- **Authoring discipline** — every future skill authoring session enforces the ceiling at validation time; regressions require a deliberate exception field, not an accidental overflow.
- **Prospective authoring** — new skills targeting this repo must comply on creation, not just after an audit.
- **Token cost avoided** — no increase to `skillListingBudgetFraction`; no per-session token overhead.
- **Schema layering** — upstream Claude Code schema (1024 chars) and `skillListingMaxDescChars` (1536) remain unchanged. The 200-char project ceiling layers on top. If upstream tightens, only this ADR needs amending.

## Related

- Source document: `docs/claude/skills-listing-budget.md`
- Wiki page: `[[skill-listing-budget]]`
- Canonical rule: `.claude/rules/skill-description-budget.md`
- Structural precedent: `docs/adr/0006-distribution-content-boundary.md` (cross-distribution authoring rules)
