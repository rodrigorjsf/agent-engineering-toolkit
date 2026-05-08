# Prompt Engineering Strategies

Evidence-based prompting strategies for artifact authoring, organized by artifact type.
Source: prompt-engineering-guide.md, Industry Research (agent prompting best practices), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md`

---

## Contents

- Universal principles (apply to all artifact types)
- Strategy matrix (technique selection by artifact type)
- Per-artifact-type recommendations
- Anti-patterns (what to avoid)
- Context budget principles

---

## Universal Principles

**Clarity over cleverness** — "Think of the agent as a brilliant but new employee who lacks context on your norms and workflows." Write instructions a colleague with no context could follow.

**Role definition first** — A single-sentence role in a system prompt focuses behavior and tone: `"You are a code reviewer specializing in TypeScript."` Use in subagent prompts and skill bodies. Skip in rules and hooks (zero-shot is sufficient).

**XML tags for complex structure** — Use XML tags to disambiguate prompts mixing instructions, context, examples, and inputs:

```
<instructions>...</instructions>
<context>...</context>
<example>...</example>
```

**Critical instructions at start or end** — The "lost-in-the-middle" effect degrades performance for instructions buried in the middle of long contexts. Place key rules in the first and last 20% of each file.

**Describe desired behavior, not prohibited behavior** — Instead of "Do not use markdown", write "Your response should be smooth flowing prose."

**Behavioral discipline beats clever prompting** — surface assumptions before acting, prefer the simplest sufficient change, keep edits surgical, and define explicit validation targets before concluding.

**Safe persuasion only** — use commitment through warm-up phases, reciprocity through curated references, scarcity through explicit limits, and authority/social proof through cited standards. Never use persuasion patterns to bypass safeguards, refusals, or scope boundaries.

*Source: Industry Research (agent prompting best practices) lines 1-100; prompt-engineering-guide.md lines 1-80; karpathy-guidelines.instructions.md; persuasion-principles.md*

---

## Strategy Matrix

| Technique | Skill (SKILL.md) | Hook | Rule | Subagent |
|-----------|-----------------|------|------|----------|
| Role prompting | ✅ First line of body | ❌ Skip (implicit) | ❌ Skip | ✅ Strong use |
| Zero-shot | ✅ Most phases | ✅ Default | ✅ Always | ✅ Simple tasks |
| Few-shot examples | ✅ Critical output formats | ❌ Too token-costly | ❌ Too token-costly | ✅ Complex formats |
| XML structuring | ✅ Multi-section bodies | ❌ Too verbose | ❌ Too verbose | ✅ Rich context |
| Chain-of-thought | ❌ Slows execution | ❌ Not applicable | ❌ Not applicable | ✅ Reasoning tasks |
| Self-check instruction | ✅ Final phase | ❌ Not applicable | ❌ Not applicable | ✅ Verification |
| Parallel tool calls | ✅ Multi-step phases | ❌ Not applicable | ❌ Not applicable | ✅ Independent tasks |

*Source: prompt-engineering-guide.md lines 80-200; Industry Research (agent prompting best practices) lines 50-160*

---

## Per-Artifact Recommendations

### Skills (SKILL.md)

- Open body with role definition (1-2 sentences max)
- Make Phase 1 a low-risk warm-up before higher-effort phases
- Use progressive disclosure: reference files loaded per phase, not all upfront
- Load curated references before asking for synthesis or edits
- Use zero-shot for most phases; reserve few-shot for phases with strict output format
- Make constraints concrete: scope limits, output shape, and stop conditions
- Self-check instruction in final phase: "Before completing, verify all criteria in skill-validation-criteria.md"
- Final validation should confirm Karpathy-style discipline and the ethical constraint on persuasion
- Keep each phase instruction ≤10 lines; reference files for depth

### Hooks

- Zero-shot only — hooks are short and tokens are expensive
- Avoid role prompting; context of the event implies the role
- Be explicit about output format: `{"ok": true/false, "reason": "..."}`
- For `prompt` and `agent` hooks: write simple, direct evaluation criteria
- Test with `--debug` to verify hook output is parsed as intended

### Rules

- Zero-shot always — rules are factual instructions, not prompted behaviors
- No examples (too token-costly for always-loaded context)
- One instruction per bullet; no compound sentences
- Specificity goldilocks: "Use 2-space indentation" not "Format code properly" not "src/auth/handlers.ts handles JWT"

### Subagents

- Role prompting is the primary specialization mechanism — invest here
- Structure system prompt: Role → Responsibilities → Process → Checklist → Output Format
- Include confidence threshold for review agents: "Report only when >80% confident"
- Avoid aggressive trigger language ("CRITICAL: You MUST...") — causes overtriggering with large capable models
- Use normal delegation language: "Use this tool when..." not "ALWAYS use this tool"

*Source: Industry Research (agent prompting best practices) lines 373-380; prompt-engineering-guide.md lines 20-80*

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| "CRITICAL: You MUST always..." | Overtriggering with large capable models | Use "Use this when..." |
| Vague instructions ("be thorough") | Not verifiable or actionable | Specify exactly what to check |
| Few-shot examples in rules | Token waste on every session | Delete examples; be specific in instruction text |
| Over-explaining what the agent already knows | Wastes context budget | Trust model knowledge; add only novel context |
| Prescriptive step-by-step plans | Forces rigid execution; misses edge cases | "Think thoroughly" outperforms manual step lists |
| Contradictory instructions | Agent picks one arbitrarily | Audit for conflicts before writing |
| Instructions buried in the middle | Lost-in-the-middle degradation | Move critical rules to first/last 20% |

*Source: Industry Research (agent prompting best practices) lines 50-100; prompt-engineering-guide.md lines 100-200*

---

## Context Budget Principles

Every token in an artifact competes with conversation history and other context. Apply these before writing:

- Challenge each instruction: "Would removing this cause the agent to make mistakes? If not, cut it."
- Prefer pointers to full content: link to reference files instead of inlining detailed material
- Path-scoped rules and per-phase reference loading are the primary token-saving mechanisms
- Short artifacts (rules, validation criteria) should be zero-shot and minimal
- Long artifacts (skill bodies, subagent prompts) should use progressive disclosure

*Source: karpathy-guidelines.instructions.md; Industry Research (agent prompting best practices) lines 32-50*
