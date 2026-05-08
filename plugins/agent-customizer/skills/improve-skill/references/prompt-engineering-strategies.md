# Prompt Engineering Strategies

Evidence-based prompting strategies for artifact authoring, organized by artifact type.
Source: prompt-engineering-guide.md, claude-prompting-best-practices.md, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md`

---

## Contents

- Universal principles (apply to all artifact types)
- Strategy matrix (technique selection by artifact type)
- Per-artifact-type recommendations
- Anti-patterns (what to avoid)
- Context budget principles

---

## Universal Principles

- **Clarity over cleverness** — write instructions a colleague with no context could follow ("brilliant but new employee").
- **Role definition first** — open skill bodies and subagent prompts with a one-sentence role; skip in rules/hooks where zero-shot suffices.
- **XML tags for complex structure** — disambiguate prompts that mix instructions, context, examples, and inputs (`<instructions>`, `<context>`, `<example>`).
- **Critical instructions at start or end** — the "lost-in-the-middle" effect degrades performance; place key rules in the first/last 20% of each file.
- **Describe desired behavior, not prohibited behavior** — prefer "smooth flowing prose" over "do not use markdown".
- **Behavioral discipline & safe persuasion** — see `behavioral-guidelines.md` for the four principles and seven persuasion patterns; both apply here verbatim.

*Source: claude-prompting-best-practices.md lines 1-100; prompt-engineering-guide.md lines 1-80; karpathy-guidelines.instructions.md; persuasion-principles.md*

---

## Strategy Matrix (Skills)

For SKILL.md authoring: role prompting on the opening line, zero-shot for most phases, few-shot examples reserved for phases with strict output format, XML structuring for multi-section bodies, self-check in the final phase, parallel tool calls in multi-step phases. Chain-of-thought is avoided in skill bodies because it slows execution.

*Source: prompt-engineering-guide.md lines 80-200; claude-prompting-best-practices.md lines 50-160.*

---

## Per-Artifact Recommendations

### Skills (SKILL.md)

- Open body with a 1-2 sentence role definition; zero-shot most phases; reserve few-shot for strict output formats.
- Use progressive disclosure: each phase loads only its required references; load curated material before asking for synthesis.
- Make constraints concrete (scope limits, output shape, stop conditions); keep each phase ≤10 lines with depth in references.
- Final phase self-check: verify all criteria in `skill-validation-criteria.md`, including Karpathy-style discipline and the persuasion ethical constraint.

*Source: claude-prompting-best-practices.md lines 373-380; prompt-engineering-guide.md lines 20-80. Hooks/rules/subagents recommendations are out of scope for improve-skill — see the broader strategies doc.*

---

## Anti-Patterns

Avoid these prompting anti-patterns: aggressive triggers ("CRITICAL: You MUST always..."), vague instructions ("be thorough"), few-shot examples in rules (token waste on every session), over-explaining what the model already knows, prescriptive step-by-step plans (use "think thoroughly" instead), contradictory instructions across phases, and burying critical rules in the middle of long contexts (lost-in-the-middle effect — keep them in the first/last 20%).

*Source: claude-prompting-best-practices.md lines 50-100; prompt-engineering-guide.md lines 100-200*

---

## Context Budget Principles

Every token competes with conversation history. Apply the deletion test from `skill-evaluation-criteria.md` to every instruction; prefer pointers to detailed content over inlining; reserve progressive disclosure for long artifacts (skill bodies, subagent prompts) and zero-shot for short ones (rules, validation criteria).

*Source: karpathy-guidelines.instructions.md; claude-prompting-best-practices.md lines 32-50*
