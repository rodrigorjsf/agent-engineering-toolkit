# Skill Listing Budget

**Summary**: Claude Code caps total skill metadata injected into the system prompt via `skillListingBudgetFraction`; skills exceeding the budget lose their descriptions silently, breaking auto-invocation.
**Sources**: skills-listing-budget.md
**Last updated**: 2026-05-09

---

Claude Code v2.1.129 introduced `skillListingBudgetFraction`, a setting that caps the total skill metadata injected into the system prompt. When the budget is exceeded, lowest-priority skills lose their descriptions entirely — no warning, no changelog mention (source: skills-listing-budget.md).

## Settings

| Setting | Default | Description |
|---|---|---|
| `skillListingBudgetFraction` | `0.01` | Caps total skill metadata at this fraction of the context window |
| `skillListingMaxDescChars` | `1536` | Per-skill character limit before truncation |

Both are set in `~/.claude/settings.json` as decimal values, not percentages. `0.02` means 2% (source: skills-listing-budget.md).

```json
{
  "skillListingBudgetFraction": 0.02,
  "skillListingMaxDescChars": 2048
}
```

## Budget Math

On Sonnet 4.6's 200K context window:

- **1% default** → ~2,000 tokens for all skill metadata
- **Capacity** → approximately 15–25 skills before truncation kicks in

When the budget is exceeded, lowest-priority full descriptions are dropped first. Skills used less frequently lose visibility; frequently-used skills retain their full descriptions (source: skills-listing-budget.md).

## Impact on Auto-Invocation

Skills are auto-invoked when Claude matches a user's request against the skill's `description` field. If the description is truncated or dropped due to budget pressure:

- Claude cannot match the skill to relevant tasks
- The skill effectively disappears from auto-invocation
- No error is surfaced — it silently fails

This makes budget management a correctness concern, not just a performance one. See [[claude-code-skills]] for the `description` field's role in matching.

## Solutions (Priority Order)

1. **Disable unused skills** — run `/skills` to uncheck tools not in active use. Free, zero token cost; recommended first step.
2. **Tighten descriptions** — trim to 100–150 characters, front-load match keywords. Sustainable, free, improves searchability.
3. **Raise the budget fraction** — e.g., `0.02` for 2%. Costs ~3K tokens on **every** session. Use as last resort only.

The preferred fix is description optimization — raising the budget trades persistent per-session token spend for a problem solvable at the source (source: skills-listing-budget.md).

## Project ceiling (this repo)

This repo enforces a project-level ceiling on every `SKILL.md` `description:` field:

| Range | Status |
|---|---|
| 110–150 chars | Target band |
| ≤ 200 chars | Hard ceiling |
| > 200 chars | Forbidden without `description-budget-exception:` field inside frontmatter (≤ 400 chars hard cap) |

Enforced via `.claude/rules/skill-description-budget.md` (auto-loaded for `**/SKILL.md`) and self-validation steps in every skill that authors `SKILL.md` files. See ADR-0007 for the rationale and trade-offs.

## Connection to Progressive Disclosure

`skillListingBudgetFraction` is the enforcement mechanism that makes [[progressive-disclosure]] practically necessary. Each skill's metadata (name + description) loads at session start as the "Always" tier. The budget cap is the hard limit that forces short, keyword-dense descriptions and selective skill enablement. See [[progressive-disclosure]] for the three-tier loading model.

## Related pages

- [[claude-code-skills]]
- [[progressive-disclosure]]
- [[context-engineering]]
- [[skill-authoring]]
