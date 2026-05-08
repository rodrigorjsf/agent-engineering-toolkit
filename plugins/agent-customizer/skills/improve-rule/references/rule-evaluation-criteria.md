# Rule Evaluation Criteria

Scoring rubric for assessing existing `.claude/rules/*.md` rule files before improvement.
Source: memory/how-claude-remembers-a-project.md

---

## Contents

- Hard limits table (frontmatter validity, line counts)
- Deletion test (ETH Zurich evidence: −3% success / +20% cost)
- Bloat indicators table (broad globs, duplicates, vague instructions)
- Staleness indicators table (paths matching no files, removed conventions)
- Quality assessment (path specificity, actionability, scope separation)
- Quality score rubric (5-dimension scoring 1-10)
- Evaluation output template

---

## Hard Limits Table

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| Rules | `paths:` array present | memory/how-claude-remembers-a-project.md lines 147-164 |
| Rules | ≤ 50 lines | Context budget: loaded when matching files read — project convention |
| YAML frontmatter | Valid YAML if present | memory/how-claude-remembers-a-project.md |
| Instructions | Actionable and verifiable | memory/how-claude-remembers-a-project.md lines 61-75 |

A rule file violating any hard limit is flagged **OVER LIMIT** or **INVALID**.

*Source: memory/how-claude-remembers-a-project.md lines 61-75; 123-145; Project convention — `.github/instructions/rules.instructions.md`*

---

## Deletion Test

For every instruction, line, and reference, ask: **"Would removing this cause the agent to make mistakes?"** If the answer is no, flag it for removal. ETH Zurich (Feb 2026) measured that LLM-generated agent files reduce success rate by ~3% and increase cost by ~20% — the failure mode is content that looks helpful but adds no decision value. The deletion test is the rubric for separating signal from bloat.

*Source: docs/general-llm/Evaluating-AGENTS-paper.pdf*

---

## Bloat Indicators Table

| Indicator | Why It's Bloat |
|-----------|---------------|
| Glob pattern `**/*` (matches everything) | Rule loads on every file read; too broad |
| Duplicate instructions across multiple rule files | Contradictions + wasted tokens on every load |
| Vague instructions ("write clean code") | Not actionable; ignored in practice |
| Standard conventions Claude already knows | "If Claude already does it, delete it" |
| Long explanations or tutorials | Rules are instructions, not documentation |
| Examples in rules | Token waste; be specific instead |

*Source: memory/how-claude-remembers-a-project.md lines 61-75*

---

## Staleness Indicators Table

| Indicator | How to Detect |
|-----------|---------------|
| `paths:` glob matching no existing files | Run glob against current project structure |
| References to removed or renamed tools | Verify tool names are still valid |
| Instructions for conventions no longer used | Check if convention is still in use |
| Paths pointing to deleted or moved directories | Verify directory paths exist |

*Source: memory/how-claude-remembers-a-project.md lines 147-164*

---

## Quality Assessment

| Question | Good | Bad |
|----------|------|-----|
| Instructions specific enough to verify? | "Use 2-space indentation" | "Format code properly" |
| One scope per file? | One topic per rule file | Multiple unrelated topics in one file |
| Glob pattern specific enough? | `src/api/**/*.ts` | `**/*` |
| No overlap with other rules? | Each rule file covers distinct domain | Same instruction in 3 rule files |
| Rule scope narrow enough for the token cost? | Specific globs for real target files | Missing `paths:` or broad scope |

*Source: memory/how-claude-remembers-a-project.md lines 123-145*

---

## Quality Score Rubric

| Dimension | 8-10 (Good) | 4-7 (Mixed) | 1-3 (Bad) |
|-----------|-------------|-------------|-----------|
| Path Specificity | Precise globs matching intended files | Some broad patterns | `**/*` or no path scoping for domain-specific rules |
| Instruction Actionability | All instructions verifiable | Mix of specific and vague | Mostly vague |
| Scope Separation | One topic per file; no overlap | Some overlap | Everything in one rule file |
| Conciseness | ≤50 lines | Some over limit | Multiple files far over limit |
| Consistency | 0 contradictions across files | 1 contradiction | 2+ contradictions |
| **Overall** | | | |

*Source: memory/how-claude-remembers-a-project.md lines 61-75; 123-145*

---

## Evaluation Output Template

```
## Rule Evaluation Results

### Files Found
| File | Lines | Paths Frontmatter | Status |
|------|-------|-------------------|--------|
| `code-style.md` | 52 | None | ❌ Missing `paths:` + over 50-line limit |
| `api-design.md` | 28 | `src/api/**/*.ts` | ✅ |

### Per-File Issues

#### `code-style.md` (52 lines — missing `paths:` and over 50-line limit)

**Bloat Issues:**
- Lines 30-45: Testing conventions — should be in separate `testing.md`

**Staleness Issues:**
- Line 12: References `src/helpers/` — directory was removed

### Quality Score
| Dimension | Score (1-10) | Notes |
|-----------|-------------|-------|
| Path Specificity | 4 | api-design.md good; code-style.md missing `paths:` |
| Instruction Actionability | 7 | Most instructions specific |
| Scope Separation | 4 | code-style.md covers two topics |
| Conciseness | 5 | code-style.md 52 lines (50-line limit) |
| Consistency | 8 | No contradictions |
| **Overall** | **6** | Split code-style.md, remove stale ref |
```
