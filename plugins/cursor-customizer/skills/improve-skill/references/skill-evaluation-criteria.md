# Skill Evaluation Criteria

Scoring rubric for assessing existing Cursor SKILL.md packages before improvement.
Source: docs/cursor/skills/agent-skills-guide.md

---

## Contents

- Hard limits table (file length, frontmatter, phases)
- Deletion test (ETH Zurich evidence: −3% success / +20% cost)
- Bloat indicators table (inlined content, over-specification)
- Staleness indicators table (deprecated fields, outdated paths)
- Foreign-platform dialect (auto-fail)
- Progressive disclosure assessment (phases, reference loading)
- Quality score rubric (5-dimension scoring 1-10)
- Evaluation output template

---

## Hard Limits Table

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| SKILL.md body length | ≤ 500 lines | Agent Skills best practice: keep SKILL.md focused |
| Reference files | ≤ 200 lines each | reference-files convention |
| Reference files >100 lines | Must include a `## Contents` table of contents | reference-files convention |
| `description` field | Present, non-empty, ≤ 1024 chars | Agent Skills specification |
| `name` field | Present, non-empty, 1-64 chars, kebab-case, matches parent folder | Agent Skills specification |
| Frontmatter fields | Restricted to the six recognised by the Agent Skills standard | Agent Skills specification |
| Phase structure | At least one clear phase defined | Agent Skills authoring patterns |

A skill violating any hard limit is flagged **OVER LIMIT** regardless of content quality.

*Source: docs/cursor/skills/agent-skills-guide.md "Frontmatter fields" and "Optional directories"*

---

## Deletion Test

For every instruction, line, and reference, ask: **"Would removing this cause the agent to make mistakes?"** If the answer is no, flag it for removal. ETH Zurich (Feb 2026) measured that LLM-generated agent files reduce success rate by ~3% and increase cost by ~20% — the failure mode is content that looks helpful but adds no decision value. The deletion test is the rubric for separating signal from bloat.

*Source: docs/general-llm/Evaluating-AGENTS-paper.pdf*

---

## Bloat Indicators Table

| Indicator | Why It Is Bloat |
|-----------|---------------|
| Detailed reference content inlined in SKILL.md | Should be in `references/` subdirectory; loaded on demand |
| All references loaded in phase 1 (not progressive) | Wastes context budget; load references only in the relevant phase |
| Inline bash analysis commands in plugin skill body | Plugin skills MUST delegate to registered subagents; inline bash is a convention violation |
| Redundant phase instructions (same guidance repeated) | Dilutes attention; each phase should add distinct value |
| Over-specified tool restrictions for simple tasks | Correct tool access should be inferred from task type |
| Explaining standard practices the agent already knows | Agents are already capable; add only novel context |
| Hardcoded absolute or project-relative paths for bundled files | Will go stale; bundled paths must be relative to the skill root |

*Source: docs/cursor/skills/agent-skills-guide.md "Optional directories"*

---

## Staleness Indicators Table

| Indicator | How to Detect |
|-----------|---------------|
| Deprecated frontmatter fields | Check field names against the six-field Agent Skills standard |
| References to removed features or subagents | Verify subagent names and tool features still exist in the project |
| Outdated discovery paths | Confirm bundled-path references resolve relative to the skill root |
| Hardcoded file paths in SKILL.md body | Check that referenced bundled paths actually exist |
| Foreign-platform dialect | See dedicated section below — auto-fail |

*Source: docs/cursor/skills/agent-skills-guide.md "SKILL.md file format"*

---

## Foreign-Platform Dialect (Auto-fail)

The Cursor distribution is product-strict. Apply the following allowlists to the entire skill tree. Anything outside an allowlist is foreign-platform dialect and requires removal during improvement.

| Check | Allowlist (anything else fails) |
|-------|---------------------------------|
| Frontmatter fields | Only the six recognised by the Agent Skills standard: `name`, `description`, `license`, `compatibility`, `metadata`, `disable-model-invocation` |
| Bundled-path references | Relative paths from the skill root only; no string-substitution variables of any form (no `${...}` or `$NAME` forms inside bundled paths) |
| Discovery-path references | Only `.cursor/`, `.agents/`, and `~/.cursor/` are recognised; no references to discovery directories or memory files belonging to other agent platforms |
| Documentation citations | Local Cursor docs and vendor-neutral research only; no citations to product documentation for other agent platforms |

---

## Progressive Disclosure Assessment

| Question | Good | Bad |
|----------|------|-----|
| Does SKILL.md stay focused on phase overview? | Phases are concise with file references | All guidance inlined in SKILL.md |
| Are references loaded per phase, not all upfront? | Each phase reads only its relevant references | Phase 1 loads all references |
| Are supporting files referenced explicitly? | "Read the relevant supporting file for this phase" | Files exist but never referenced |
| Is SKILL.md body under 500 lines? | Clean entry point with external depth | Monolithic, all content inline |

*Source: docs/cursor/skills/agent-skills-guide.md "Optional directories"*

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

---

## Evaluation Output Template

```
## Skill Evaluation Results

### Files Found
| File | Lines | Status |
|------|-------|--------|
| `./SKILL.md` | 342 | Within 500-line limit |

### Per-File Issues

#### `./SKILL.md`

**Bloat Issues:**
- Lines 45-100: Reference content inlined (should be in references/ subdirectory)

**Staleness Issues:**
- Line 12: bundled path uses absolute form — switch to relative-from-skill-root

**Foreign-Platform Dialect:**
- Line 7: frontmatter field outside the six-field Agent Skills allowlist

**Progressive Disclosure Issues:**
- Phase 1 loads all 5 reference files at once; load per phase

### Quality Score
| Dimension | Score (1-10) | Notes |
|-----------|-------------|-------|
| Conciseness | 5 | 342 lines, some bloat |
| Accuracy | 8 | 1 stale path |
| Progressive Disclosure | 4 | All refs loaded in phase 1 |
| Description Quality | 7 | Good but missing trigger terms |
| Evidence Grounding | 6 | Some references but inconsistent |
| **Overall** | **6** | Needs progressive disclosure fix |
```
