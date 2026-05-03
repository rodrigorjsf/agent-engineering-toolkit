# Context Optimization

Evidence-based instructions for managing token budgets and attention in agent configuration files.
Source: Industry Research — research-context-engineering-comprehensive.md

---

## Contents

- Hard limits (lines per file, instruction count, contradictions)
- The attention budget (finite resource, n-squared constraint)
- Lost in the middle (placement strategy for critical instructions)
- Quality over quantity checklist (include/exclude decision table)
- Context poisoning vectors (detection and removal)
- JIT documentation patterns (on-demand loading strategies)
- Key citations

---

## Hard Limits

| Limit | Value | Source |
|-------|-------|--------|
| Lines per configuration file | ≤ 200 | Industry Research: 200-line target for configuration files in this toolkit |
| Instructions per file | ≤ 150-200 | Industry Research: "Frontier LLMs can follow ~150-200 instructions with reasonable consistency." |
| Contradictions between files | 0 | Industry Research: conflicting instructions make the model choose inconsistently. |

> Industry Research generalizes here: bloated configuration files cause the model to miss important instructions.
> — Industry Research

> Industry Research generalizes here: if a configuration file keeps growing, the model may ignore an instruction even when it is present.
> — Industry Research

---

## The Attention Budget

Context is a **finite resource with diminishing marginal returns**. Do not treat it as unlimited.

> "LLMs have an 'attention budget' that they draw on when parsing large volumes of context. Every new token introduced depletes this budget by some amount."
> — Industry Research, Effective Context Engineering

Architectural reason: Transformers create **n² pairwise relationships** for n tokens — attention gets stretched thin as context grows. Models trained on shorter sequences have fewer parameters for long-range dependencies.

**Key principle**: *"Good context engineering means finding the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome."* — Industry Research

> Context rot: "As the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases." — Industry Research

---

## Lost in the Middle

Critical instructions must be at the **start or end** of files, not buried in the middle.

> Performance is "highest when relevant information is at the beginning or end of the context... degrades significantly for information in the middle of long contexts."
> — Liu et al., Lost in the Middle (arXiv:2307.03172)

**Apply this when generating files:** Place the most important instructions in the first 20% and last 20% of each configuration file.

---

## Quality Over Quantity Checklist

For each instruction line, ask: **"Would removing this cause the agent to make mistakes? If not, cut it."**
— Industry Research

| ✅ Include | ❌ Exclude |
|-----------|-----------|
| Bash commands the agent cannot guess | Anything the agent can figure out by reading code |
| Code style rules that differ from defaults | Standard language conventions already known |
| Testing instructions (non-standard) | Detailed API documentation (link instead) |
| Non-obvious architectural decisions | Long explanations or tutorials |
| Developer environment quirks | File-by-file descriptions of the codebase |
| Non-standard tooling | Self-evident practices ("write clean code") |

**Instruction specificity goldilocks:**

- ✅ "Use 2-space indentation" vs. ❌ "Format code properly"
- ✅ "Run `npm test` before committing" vs. ❌ "Test your changes"
- ✅ "API handlers live in `src/api/handlers/`" vs. ❌ "Keep files organized"

*Source: Industry Research — research-context-engineering-comprehensive.md lines 113-134*

---

## Context Poisoning Vectors

Detect and remove these before generating or improving configuration files:

| Poison vector | Detection | Fix |
|---------------|-----------|-----|
| Stale file paths | Check if referenced paths actually exist | Remove or update |
| Contradictions | Compare instructions across all files | Remove the weaker/older rule |
| Over-specification | Count lines; check if agent already follows rule | Delete or convert to hook |
| Failed approach accumulation | Look for rules added defensively after incidents | Remove rules that shouldn't be needed |
| High-churn information | Look for version numbers, file counts, team names | Remove or move to a pointer |

> Treat configuration files like code: review them when things go wrong, prune them regularly. — Industry Research

*Source: Industry Research — research-context-engineering-comprehensive.md lines 213-253*

---

## JIT Documentation Patterns

Use these patterns to move content from always-consumed to on-demand locations:

| Pattern | How it works | Token impact |
|---------|-------------|-------------|
| Skills | Description loaded at start; full body loaded on invocation | On-demand |
| Path-scoped rules | Trigger only when matching files are read | On-demand |
| Subdirectory config files | Load when working in that directory | On-demand |
| `@path/to/import` | Expands when parent file loads | Controlled |
| Domain docs (e.g., `docs/TESTING.md`) | Agent navigates when relevant | On-demand |

> "Rather than pre-processing all relevant data up front, agents maintain lightweight identifiers and use these references to dynamically load data into context at runtime."
> — Industry Research, Effective Context Engineering

*Source: Industry Research — research-context-engineering-comprehensive.md lines 138-208, 451-461*

---

## Key Citations

| Claim | Source |
|-------|--------|
| ≤200 lines per file | Industry Research (Agent Skills Standard) |
| ~150-200 instruction limit | Industry Research (HumanLayer) |
| n² attention constraint / context rot | Industry Research (Effective Context Engineering) |
| Lost-in-the-middle effect | Industry Research, Liu et al., arXiv:2307.03172 |
| Quality over quantity heuristic | Industry Research |
| JIT documentation strategy | Industry Research, Effective Context Engineering |
