# Skill Validation Criteria

Quality checklist for generated and improved SKILL.md files.
Source: skills/skill-authoring-best-practices.md, skills/extend-claude-with-skills.md, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md`

---

## Hard Limits (Auto-fail if violated)

Any skill violating these criteria must be fixed before proceeding:

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| SKILL.md body length | ≤ 500 lines | Anthropic: "Keep SKILL.md under 500 lines" |
| Reference files | ≤ 200 lines each | `.claude/rules/reference-files.md` — hard limit |
| Reference files >100 lines | Must include a `## Contents` TOC | skill-authoring-best-practices.md line 403 |
| `description` field | Present; non-empty; ≤ 1024 chars; no XML tags | Agent Skills specification |
| `name` field format | Present; non-empty; lowercase letters, numbers, hyphens only; max 64 chars | Agent Skills specification |
| Contradictions between phases | 0 | Claude picks arbitrarily when contradictions exist |

*Source: skills/skill-authoring-best-practices.md lines 259; skills/extend-claude-with-skills.md lines 183-199; `.claude/rules/reference-files.md`*

---

## Quality Checks (All must pass)

- [ ] Bundled file references use relative `references/` paths (not hardcoded absolute paths)
- [ ] `description` written in third person ("Processes..." not "I process..." or "You can use...")
- [ ] `description` includes what the skill does AND when to use it
- [ ] Progressive disclosure applied: references loaded per phase, not all upfront
- [ ] No reference content inlined in SKILL.md body (should be in `references/` subdirectory)
- [ ] Each phase instruction is concise (≤10 lines); depth lives in reference files
- [ ] Reference files cited explicitly so Claude knows what to load and when
- [ ] `disable-model-invocation: true` set for side-effect workflows (commit, deploy, send)
- [ ] Prompt engineering strategy applied: skill follows relevant strategy from prompt-engineering-strategies.md (role prompting for skills, progressive disclosure for phases)
- [ ] Behavioral guidelines applied: the skill surfaces assumptions before acting, prefers the simplest adequate path, keeps changes surgical, and defines explicit validation targets
- [ ] Persuasion cues, if present, stay inside the ethical constraint: they improve compliance with legitimate work only and never weaken safeguards, refusals, or scope boundaries
- [ ] Phase instructions are specific and actionable — no vague directives like "ensure quality" or "review for completeness"
- [ ] Standalone skill phases include explicit inline bash commands or instructions to read references that contain those commands — no Task-tool delegation.
- [ ] Evidence citations present: key decisions reference source docs (e.g., "per skill-authoring-best-practices.md")

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation:**

- [ ] Evidence-grounded references not removed (citations preserved)
- [ ] Existing phase structure not flattened
- [ ] Progressive disclosure references not collapsed into inline content

**Structural:**

- [ ] Reference file ≤200 line limit not violated by merging content; >100-line files have a `## Contents` TOC
- [ ] Relative `references/` paths not broken by renaming or moving files

---

## Validation Loop Instructions

Execute this loop for each generated or improved skill:

1. Evaluate the skill against ALL criteria above
2. If ANY criterion fails: identify the specific failure, fix the skill, restart evaluation
3. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
4. Only proceed to writing skills when ALL criteria pass

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.
