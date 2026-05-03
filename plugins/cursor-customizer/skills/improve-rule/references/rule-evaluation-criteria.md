# Rule Evaluation Criteria

Scoring rubric for assessing existing `.cursor/rules/*.mdc` rule files before improvement.
Source: docs/cursor/rules/rules.md, Industry Research (research-context-engineering-comprehensive.md)

---

## Contents

- Hard limits table (frontmatter validity, line counts)
- Deletion test (ETH Zurich evidence: −3% success / +20% cost)
- Bloat indicators table (broad globs, duplicates, vague instructions, oversized always-apply rules)
- Staleness indicators table (globs matching no files, removed conventions)
- Activation-mode appropriateness table
- Quality assessment (specificity, actionability, scope separation)
- Quality score rubric (5-dimension scoring 1-10)
- Evaluation output template

---

## Hard Limits Table

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| Rule length | ≤ 200 lines | Industry Research: 200-line target for configuration files in this toolkit |
| YAML frontmatter | Valid YAML | docs/cursor/rules/rules.md — Rule anatomy |
| Frontmatter fields | ONLY `description`, `alwaysApply`, `globs` | docs/cursor/rules/rules.md — Rule file format |
| Banned frontmatter key | `paths` MUST NOT appear | Cross-platform leakage |
| Activation-mode well-formedness | One of always / globs / description, with the matching field set | docs/cursor/rules/rules.md — Rule anatomy |
| Instruction actionability | Verifiable, not vague | docs/cursor/rules/rules.md — Best practices |

A rule violating any hard limit is flagged **OVER LIMIT** or **INVALID**.

*Source: docs/cursor/rules/rules.md — Best practices, Rule file format*

---

## Deletion Test

For every instruction, line, and reference, ask: **"Would removing this cause the agent to make mistakes?"** If the answer is no, flag it for removal. ETH Zurich (Feb 2026) measured that LLM-generated agent files reduce success rate by ~3% and increase cost by ~20% — the failure mode is content that looks helpful but adds no decision value. The deletion test is the rubric for separating signal from bloat.

*Source: docs/general-llm/Evaluating-AGENTS-paper.pdf*

---

## Bloat Indicators Table

| Indicator | Why It's Bloat |
|-----------|---------------|
| `**/*` glob on auto-attached rule | Rule loads on most file reads; too broad |
| `alwaysApply: true` rule longer than ~30 lines | Every line burns context budget on every conversation |
| Duplicate instructions across rule files | Contradictions plus wasted tokens on every load |
| Vague instructions ("write clean code") | Not actionable; ignored in practice |
| Standard language conventions the agent already knows | "If the agent already does it, delete it" |
| Long explanations or tutorials | Rules are instructions, not documentation |
| Inlined file content that could be `@path/to/file` reference | Token waste; staleness risk |
| Edge-case instructions for situations that rarely apply | Steals attention from common paths |

*Source: docs/cursor/rules/rules.md — What to avoid in rules*

---

## Staleness Indicators Table

| Indicator | How to Detect |
|-----------|---------------|
| `globs:` pattern matching no existing files | Run glob against current project structure |
| References to removed or renamed tools | Verify tool names are still valid |
| Instructions for conventions no longer used | Check if convention is still in use |
| Globs pointing to deleted or moved directories | Verify directory paths exist |
| `@path/to/file` references to deleted files | Resolve every `@`-reference |

*Source: Industry Research: stale paths poison context*

---

## Activation-Mode Appropriateness Table

| Content Nature | Correct Mode | Common Mistake |
|----------------|--------------|----------------|
| Critical tooling command, project-wide constraint | `alwaysApply: true` | Buried in a description-mode rule the agent rarely attaches |
| Convention tied to a file pattern (test files, generated code, monorepo packages) | `globs:` | Always-apply, wasting context on non-matching tasks |
| Cross-cutting / domain topic (auth, observability, accessibility) | `description:` | Always-apply, when the agent only needs it on relevant tasks |
| User-controlled template or snippet | Manual (no frontmatter trigger) | Auto-attached with overly broad globs |

*Source: docs/cursor/rules/rules.md — Rule anatomy*

---

## Quality Assessment

| Question | Good | Bad |
|----------|------|-----|
| Instructions specific enough to verify? | "Use 2-space indentation" | "Format code properly" |
| One concern per file? | One topic per rule file | Multiple unrelated topics in one file |
| Globs specific enough? | `src/api/**/*.ts` | `**/*` |
| Activation mode matches content nature? | Auto-attached for pattern-specific conventions | Always-apply for content the agent rarely needs |
| `alwaysApply: true` rule short? | ≤ 30 lines of critical bullets | Long always-apply rule |
| References instead of inlined file content? | `@components/Button.tsx` | Whole file body pasted into the rule |
| No overlap with other rules? | Each rule covers a distinct topic | Same instruction in 3 rule files |

*Source: docs/cursor/rules/rules.md — Best practices*

---

## Quality Score Rubric

| Dimension | 8-10 (Good) | 4-7 (Mixed) | 1-3 (Bad) |
|-----------|-------------|-------------|-----------|
| Activation-mode fit | Mode matches content nature | Mismatch on a few rules | Always-apply abuse or wrong mode for most rules |
| Instruction Actionability | All instructions verifiable | Mix of specific and vague | Mostly vague |
| Scope Separation | One topic per file; no overlap | Some overlap | Everything in one file |
| Conciseness | ≤200 lines; always-apply rules tight | Some over limit or bloated always-apply | Multiple files far over limit |
| Consistency | 0 contradictions across files | 1 contradiction | 2+ contradictions |
| **Overall** | | | |

*Source: docs/cursor/rules/rules.md — Best practices; Industry Research on context budgets*

---

## Evaluation Output Template

```
## Rule Evaluation Results

### Files Found
| File | Lines | Activation Mode | Status |
|------|-------|-----------------|--------|
| `code-style.mdc` | 220 | always | FAIL Over 200 lines and wrong activation mode |
| `api-design.mdc` | 28 | globs (`src/api/**/*.ts`) | PASS |

### Per-File Issues

#### `code-style.mdc` (220 lines — over 200-line limit; always-apply too long)

**Bloat Issues:**
- Lines 30-45: Testing conventions — should be in separate `testing.mdc`
- Lines 80-150: Standard language conventions the agent already knows

**Staleness Issues:**
- Line 12: References `src/helpers/` — directory was removed

**Activation-Mode Issues:**
- Always-apply for content that should be `description:`-mode (cross-cutting auth conventions)

### Quality Score
| Dimension | Score (1-10) | Notes |
|-----------|-------------|-------|
| Activation-mode fit | 4 | code-style.mdc wrong mode; api-design.mdc correct |
| Instruction Actionability | 7 | Most instructions specific |
| Scope Separation | 4 | code-style.mdc covers two topics |
| Conciseness | 4 | code-style.mdc 220 lines |
| Consistency | 8 | No contradictions |
| **Overall** | **5** | Split code-style.mdc, demote to description-mode, remove stale ref |
```
