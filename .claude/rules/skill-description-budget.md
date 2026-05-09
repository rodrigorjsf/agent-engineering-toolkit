---
paths:
  - "**/SKILL.md"
---
# Skill Description Budget

Every `SKILL.md` in this repository must comply with the project-level description budget to prevent Claude Code's `skillListingBudgetFraction` (default 1%) from silently dropping skills. See ADR-0007 and `wiki/knowledge/skill-listing-budget.md`.

## Character limits

| Range | Guidance |
|---|---|
| 110–150 chars | Target band — keyword-dense, fits all distributions under the default budget |
| 151–200 chars | Acceptable — still within ceiling; prefer shorter if triggers are preserved |
| > 200 chars | **Forbidden** without an explicit exception field inside the frontmatter |
| > 400 chars | **Hard fail** — no exception permitted |

Skills already under 110 chars must not be inflated to meet the floor.

## Exception field

If enumerated trigger phrases are required for discovery and shortening them measurably degrades auto-invocation, an exception is permitted. The exception field goes **inside** the frontmatter — never as an HTML comment above `---` (that breaks frontmatter parsing):

```yaml
---
name: <skill-name>
description: <up to 400 chars>
description-budget-exception: <one-line reason, e.g. "enumerated trigger phrases required for discovery">
---
```

YAML parsers tolerate unknown frontmatter keys. The `description-budget-exception:` key is validated by the audit script — the field must start on its own line with no leading whitespace.

## Authoring heuristic

1. Start with the verb that names the action: "Reviews", "Generates", "Audits", "Triages".
2. List 1–3 trigger keywords, comma-separated.
3. Add a "Use when…" clause naming the scenario in ≤8 words.
4. Drop marketing prose, feature lists, and adjectives ("comprehensive", "thorough", "detailed").
5. Drop redundant restatements of the skill name.
6. Front-load the most distinctive keyword in the first 50 chars.
7. Measure with Python YAML — single-line `awk` misses `description: >` multi-line scalars:
   ```sh
   python3 -c "import yaml,re,sys; t=open('SKILL.md').read(); m=re.match(r'^---\n(.*?)\n---', t, re.S); fm=yaml.safe_load(m.group(1)); print(len(fm['description']))"
   ```

## Self-validation (authoring skills)

Every skill that authors or modifies `SKILL.md` files must include a description budget self-check in its self-validation phase:

1. Parse the proposed `description:` via YAML (handle `>` and `|` multi-line scalars).
2. If length > 200 chars and `description-budget-exception:` is absent → reject and rewrite.
3. If length > 400 chars under any condition → hard fail.
4. Front-load the most distinctive keyword in the first 50 chars.
5. Reference this rule, `[[skill-listing-budget]]`, and ADR-0007 in the validation output.

This rule covers: `.claude/skills/**`, `plugins/*/skills/**`, `skills/**`.
Separate budgets apply to agent `description:` fields, hook definitions, and `.cursor/rules/` descriptions.
