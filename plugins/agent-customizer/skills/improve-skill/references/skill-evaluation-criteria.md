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

For every instruction, line, and reference, ask: **"Would removing this cause the agent to make mistakes?"** If no, flag for removal. ETH Zurich (Feb 2026) measured that LLM-generated agent files reduce success rate by ~3% and increase cost by ~20% — content that looks helpful but adds no decision value is the failure mode. The deletion test separates signal from bloat.

*Source: docs/general-llm/Evaluating-AGENTS-paper.pdf*

---

## Bloat Indicators

Flag as bloat: detailed reference content inlined in SKILL.md (should be in `references/`); all references loaded in phase 1 instead of progressively; inline bash analysis in a plugin skill body (must delegate to registered agents); redundant phase instructions; over-specified tool restrictions for simple tasks; explanations of standard practices the model already knows; hardcoded project-specific paths instead of `${CLAUDE_SKILL_DIR}`.

*Source: skills/skill-authoring-best-practices.md lines 11-60*

---

## Staleness Indicators

Detect staleness via: deprecated frontmatter field names, references to removed features/tools, outdated model names (use aliases `haiku`/`sonnet`/`opus`), hardcoded file paths that no longer exist, and redundant explicit defaults like `user-invocable: true`.

*Source: skills/skill-authoring-best-practices.md lines 146-167*

---

## Progressive Disclosure Assessment

Good: SKILL.md stays focused on phase overview with file references; each phase loads only its relevant references; supporting files are cited explicitly so Claude knows what to load; body stays ≤500 lines. Bad: monolithic SKILL.md with all guidance inlined, phase 1 loading every reference, files that exist but are never referenced.

*Source: skills/skill-authoring-best-practices.md lines 251-300*

---

## Quality Score Rubric

Score each of the five dimensions on a 1–10 scale; 8–10 indicates clean execution, 4–7 mixed, 1–3 bad. Dimensions: **Conciseness** (SKILL.md ≤500 lines, minimal bloat), **Accuracy** (zero stale references), **Progressive Disclosure** (references loaded per-phase, not upfront), **Description Quality** (specific what + when + trigger terms), **Evidence Grounding** (sources cited per phase). Aggregate to an Overall score and call out the dominant remediation theme.

*Source: Evaluating-AGENTS-paper.md lines 1-100*

---

## Evaluation Output Template

Report back with: (1) **Files Found** table — file path, line count, hard-limit status; (2) **Per-File Issues** — bloat, staleness, and progressive-disclosure findings with line ranges; (3) **Quality Score** — score per dimension with a one-line rationale and an Overall score. Keep the report focused on what changes; the rubric definition lives above.
