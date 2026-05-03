# Skill Evaluation Criteria

Scoring rubric for assessing existing SKILL.md files before improvement.
Source: skills/skill-authoring-best-practices.md, Evaluating-AGENTS-paper.md

---

## Contents

- Hard limits table (file length, frontmatter, phases)
- Deletion test (ETH Zurich evidence: −3% success / +20% cost)
- Bloat indicators table (inlined content, over-specification)
- Staleness indicators table (deprecated fields, outdated paths)
- Progressive disclosure assessment (phases, reference loading)
- Quality score rubric (5-dimension scoring 1-10)
- Evaluation output template

---

## Hard Limits Table

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| SKILL.md body length | ≤ 500 lines | Anthropic: "Keep SKILL.md under 500 lines" |
| Reference files | ≤ 200 lines each | `.claude/rules/reference-files.md` — hard limit |
| Reference files >100 lines | Must include a `## Contents` TOC | skill-authoring-best-practices.md line 403 |
| `description` field | Present, non-empty, ≤ 1024 chars | Required for skill discovery and Agent Skills spec |
| `name` field | Present, non-empty, 1-64 chars, kebab-case | Agent Skills specification |
| Phase structure | At least one clear phase defined | Anthropic skill authoring patterns |

A skill violating any hard limit is flagged **OVER LIMIT** regardless of content quality.

*Source: skills/skill-authoring-best-practices.md line 259; `.claude/rules/reference-files.md`*

---

## Deletion Test

For every instruction, line, and reference, ask: **"Would removing this cause the agent to make mistakes?"** If the answer is no, flag it for removal. ETH Zurich (Feb 2026) measured that LLM-generated agent files reduce success rate by ~3% and increase cost by ~20% — the failure mode is content that looks helpful but adds no decision value. The deletion test is the rubric for separating signal from bloat.

*Source: docs/general-llm/Evaluating-AGENTS-paper.pdf*

---

## Bloat Indicators Table

| Indicator | Why It's Bloat |
|-----------|---------------|
| Detailed reference content inlined in SKILL.md | Should be in `references/` subdirectory; loaded on demand |
| All references loaded in phase 1 (not progressive) | Wastes context budget; load references only in relevant phase |
| Inline bash analysis commands in plugin skill body | Plugin skills MUST delegate to registered agents; inline bash is a convention violation |
| Redundant phase instructions (same guidance repeated) | Dilutes attention; each phase should add distinct value |
| Over-specified tool restrictions for simple tasks | Correct tool access should be inferred from task type |
| Explaining standard practices Claude already knows | "Claude is already very smart — add only novel context" |
| Hardcoded project-specific paths (not using `${CLAUDE_SKILL_DIR}`) | Will go stale; breaks skill portability |

*Source: skills/skill-authoring-best-practices.md lines 11-60*

---

## Staleness Indicators Table

| Indicator | How to Detect |
|-----------|---------------|
| Deprecated frontmatter fields | Check if field names match current specification |
| References to removed features or tools | Verify tool names and API features are still valid |
| Outdated model names in `model` field | Compare against current model aliases (`haiku`, `sonnet`, `opus`) |
| Hardcoded file paths in SKILL.md body | Check if referenced paths actually exist |
| `user-invocable: true` (was the default, now explicit) | Remove redundant explicit defaults |

*Source: skills/skill-authoring-best-practices.md lines 146-167*

---

## Progressive Disclosure Assessment

| Question | Good | Bad |
|----------|------|-----|
| Does SKILL.md stay focused on phase overview? | Phases are concise with file references | All guidance inlined in SKILL.md |
| Are references loaded per phase, not all upfront? | Each phase reads only its relevant references | Phase 1 loads all references |
| Are supporting files referenced explicitly? | "Read the relevant supporting file for this phase" | Files exist but never referenced |
| Is SKILL.md body under 500 lines? | Clean entry point with external depth | Monolithic, all content inline |

*Source: skills/skill-authoring-best-practices.md lines 251-300*

---

## Quality Score Rubric

Score each dimension 1–10 based on observed issues:

| Dimension | 8-10 (Good) | 4-7 (Mixed) | 1-3 (Bad) |
|-----------|-------------|-------------|-----------|
| Conciseness | ≤500 lines SKILL.md, minimal bloat | 500-800 lines, some bloat | >800 lines, heavy bloat |
| Accuracy | 0 stale references | 1-2 stale refs | 3+ stale refs |
| Progressive Disclosure | References loaded per-phase | Some misplaced loading | All inlined upfront |
| Description Quality | Specific what + when + triggers | Vague or incomplete | Missing or generic |
| Evidence Grounding | References cited per phase | Some references | No references |
| **Overall** | | | |

*Source: Evaluating-AGENTS-paper.md lines 1-100*

---

## Evaluation Output Template

```
## Skill Evaluation Results

### Files Found
| File | Lines | Status |
|------|-------|--------|
| `./SKILL.md` | 342 | ⚠️ Over 500-line recommendation |

### Per-File Issues

#### `./SKILL.md`

**Bloat Issues:**
- Lines 45-100: Reference content inlined (should be in references/ subdirectory)

**Staleness Issues:**
- Line 12: `model: claude-3-sonnet` — use alias `sonnet` instead

**Progressive Disclosure Issues:**
- Phase 1 loads all 5 reference files at once; load per phase

### Quality Score
| Dimension | Score (1-10) | Notes |
|-----------|-------------|-------|
| Conciseness | 5 | 342 lines, some bloat |
| Accuracy | 8 | 1 stale model name |
| Progressive Disclosure | 4 | All refs loaded in phase 1 |
| Description Quality | 7 | Good but missing trigger terms |
| Evidence Grounding | 6 | Some references but inconsistent |
| **Overall** | **6** | Needs progressive disclosure fix |
```
