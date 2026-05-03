# Skill Validation Criteria

Quality checklist for generated and improved SKILL.md files.
Source: skills/skill-authoring-best-practices.md, skills/extend-claude-with-skills.md, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md`

---

## Hard Limits (Auto-fail if violated)

Apply the canonical Hard Limits Table from `skill-evaluation-criteria.md` (body length, reference length, TOC requirement, frontmatter `description`/`name`, phase-structure thresholds), plus this validation-only addition:

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| Contradictions between phases | 0 | Claude picks arbitrarily when contradictions exist |

---

## Quality Checks (All must pass)

**Structure**: self-validation phase reads `references/*validation-criteria.md`; `${CLAUDE_SKILL_DIR}` used for all bundled refs (no hardcoded paths); progressive disclosure applied (references loaded per phase, not upfront); no reference content inlined in SKILL.md body; each phase ≤10 lines with depth in references; reference files cited explicitly.

**Frontmatter**: `description` in third person, includes both what + when to use; `disable-model-invocation: true` set for side-effect workflows (commit, deploy, send).

**Discipline**: behavioral guidelines applied (surface assumptions, simplest path, surgical, validation targets); persuasion cues stay inside the ethical constraint; phase instructions specific and actionable (no "ensure quality").

**Distribution-specific**: plugin skills (`plugins/*/skills/`) delegate analysis to registered agents — no inline bash; standalone skills (`skills/`) include explicit bash commands per analysis step.

**Prompting**: relevant strategy from `prompt-engineering-strategies.md` applied (role prompting for skills, progressive disclosure for phases); evidence citations present for key decisions.

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation:**

- [ ] Evidence-grounded references not removed (citations preserved)
- [ ] Existing phase structure not flattened
- [ ] Progressive disclosure references not collapsed into inline content

**Structural:**

- [ ] Reference file ≤200 line limit not violated by merging content; >100-line files have a `## Contents` TOC
- [ ] `${CLAUDE_SKILL_DIR}` references not broken by renaming or moving files

---

## Validation Loop Instructions

Execute this loop for each generated or improved skill:

1. Evaluate the skill against ALL criteria above
2. **For improve operations:** verify each suggestion in the improvement plan has a WHY field citing a source doc — no suggestion may lack a source reference
3. If ANY criterion fails: identify the specific failure, fix the skill, restart evaluation
4. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
4. Only proceed to writing skills when ALL criteria pass

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.
