# Subagent Evaluation Criteria

Scoring rubric for assessing existing Cursor subagent definitions before improvement.
Source: docs/cursor/subagents/subagents-guide.md, docs/adr/0002-product-strict-research-foundation.md

---

## Contents

- Hard limits table (frontmatter validity, required fields)
- Bloat indicators table
- Staleness indicators table
- Quality assessment
- Quality score rubric (5-dimension scoring 1-10)
- Evaluation output template

---

## Hard Limits Table

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| `name` field | Present; lowercase letters and hyphens only; ≤64 chars | Cursor subagents documentation (configuration fields) |
| `description` field | Present, non-empty, ≤1024 chars, specific | Cursor subagents documentation (configuration fields) |
| `model` field | Exactly `inherit` | ADR-0002 product-strict frontmatter contract |
| `readonly` field | Exactly `true` | ADR-0002 product-strict frontmatter contract |
| Frontmatter key set | Exactly `name`, `description`, `model`, `readonly` | ADR-0002 product-strict frontmatter contract |
| System prompt (markdown body) | Present and task-specific | Cursor subagents documentation (best practices) |

A subagent violating any hard limit is flagged **INVALID** regardless of other quality.

*Source: docs/cursor/subagents/subagents-guide.md; docs/adr/0002-product-strict-research-foundation.md*

---

## Deletion Test

For every instruction, line, and reference, ask: **"Would removing this cause the agent to make mistakes?"** If the answer is no, flag it for removal. ETH Zurich (Feb 2026) measured that LLM-generated agent files reduce success rate by ~3% and increase cost by ~20% — the failure mode is content that looks helpful but adds no decision value. The deletion test is the rubric for separating signal from bloat.

*Source: docs/general-llm/Evaluating-AGENTS-paper.pdf*

---

## Bloat Indicators Table

| Indicator | Why It's Bloat |
|-----------|---------------|
| Generic system prompt ("you are a helpful AI") | No specialization; defeats the purpose of a subagent |
| Multi-thousand-word system prompts | Slower runtime; harder to maintain; obscures the routing signal |
| Redundant boilerplate paragraphs (warm-ups, polite framing) | Wastes context budget without changing behavior |
| Aggressive delegation phrasing ("CRITICAL: MUST use") | Overtriggers for unrelated requests; normal language preferred |
| Duplicate subagent with the same purpose as a built-in role | Built-in subagents already cover exploration / shell / browser; do not recreate |
| Vague "use for general tasks" descriptions | Cursor cannot route to the subagent reliably |

*Source: docs/cursor/subagents/subagents-guide.md (anti-patterns to avoid)*

---

## Staleness Indicators Table

| Indicator | How to Detect |
|-----------|---------------|
| Frontmatter contains a foreign-platform tool-allowlist key | Inspect the frontmatter for any key beyond the allowed four |
| Frontmatter contains a foreign-platform turn-cap key | Inspect the frontmatter for any key beyond the allowed four |
| Frontmatter contains a foreign-platform path-scope key | Inspect the frontmatter for any key beyond the allowed four |
| `model` value is a literal alias (small-fast, balanced, large-reasoning) | Inspect the `model` value; the only allowed value is `inherit` |
| `model` value is a specific model ID prefix | Inspect the `model` value; the only allowed value is `inherit` |
| `readonly` value is missing or `false` for an analysis subagent | Inspect the `readonly` value; analysis subagents must be `true` |
| Instructions tell the subagent to spawn other subagents | Search the prompt body for nested-launch language; project convention restricts this |

*Source: docs/cursor/subagents/subagents-guide.md (configuration fields, best practices); docs/adr/0002-product-strict-research-foundation.md*

---

## Quality Assessment

| Question | Good | Bad |
|----------|------|-----|
| Task-specific system prompt? | Role + process + output format defined | Generic "helpful AI" prompt |
| Frontmatter shape correct? | Exactly the four allowed keys | Extra keys or foreign-platform fields present |
| `model` set to `inherit`? | Yes — predictable across plan tiers | Literal alias or specific model ID |
| `readonly` set to `true`? | Yes — analysis posture by default | Missing or `false` without justification |
| Description specific enough for routing? | Triggers specified ("Use when...", "Use after...") | Generic description; poor delegation |
| Context isolation justified? | Subagent prevents context pollution | Subagent used when a slash command works |

*Source: docs/cursor/subagents/subagents-guide.md (best practices)*

---

## Quality Score Rubric

| Dimension | 8-10 (Good) | 4-7 (Mixed) | 1-3 (Bad) |
|-----------|-------------|-------------|-----------|
| Task Specificity | Role + process + checklist + output defined | Partial structure | Generic or missing prompt |
| Frontmatter Shape | Exactly the four allowed keys | One foreign field present | Multiple foreign fields or wrong values |
| Routing Quality | Specific description with triggers | Vague description | Missing or generic |
| Readonly Posture | `readonly: true` with matching prompt scope | `readonly: true` but prompt implies writes | Missing or `false` without justification |
| Context Isolation | Subagent use justified; prevents pollution | Questionable necessity | Duplicates inline capability |
| **Overall** | | | |

*Source: docs/cursor/subagents/subagents-guide.md (best practices, anti-patterns)*

---

## Evaluation Output Template

```
## Subagent Evaluation Results

### Agents Found
| Name | Model | Readonly | Frontmatter Keys | Status |
|------|-------|----------|------------------|--------|
| `code-reviewer` | inherit | true | name, description, model, readonly | OK |
| `legacy-importer` | sonnet | — | name, description, model, tool-allowlist | INVALID — foreign frontmatter |

### Issues

**Bloat Issues:**
- System prompt is 1,800 words of warm-ups; consolidate to a focused role + process + output format.

**Staleness Issues:**
- `model` value is a literal alias; replace with `inherit`.
- Frontmatter contains a foreign-platform tool-allowlist key; remove it.

**Quality Issues:**
- description: "Reviews code" — missing trigger; add "Use when..." phrasing.

### Quality Score
| Dimension | Score (1-10) | Notes |
|-----------|--------------|-------|
| Task Specificity | 6 | Has role, missing process and output format |
| Frontmatter Shape | 2 | Foreign key present; wrong model value |
| Routing Quality | 4 | Description too vague for delegation |
| Readonly Posture | 3 | Field absent; prompt implies read-only |
| Context Isolation | 7 | Subagent use justified |
| **Overall** | **4** | Fix frontmatter, description, prompt structure |
```
