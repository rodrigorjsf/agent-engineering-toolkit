# Context Optimization

Evidence-based instructions for managing token budgets and attention in agent configuration files.
Source: research-context-engineering-comprehensive.md

---

## Contents

- Hard limits (deferred to validation-criteria)
- The attention budget (finite resource, n-squared constraint)
- Lost in the middle (placement strategy for critical instructions)
- Quality over quantity checklist (deferred to what-not-to-include for full table)
- Context poisoning vectors (detection and removal)
- JIT documentation patterns (on-demand loading strategies)

---

## Hard Limits

Hard limits live in `validation-criteria.md`. Bloated CLAUDE.md files cause Claude to ignore actual instructions: if Claude keeps doing something despite a rule against it, the file is probably too long. (Anthropic Best Practices)

---

## The Attention Budget

Context is a finite resource with diminishing marginal returns; every new token depletes the attention budget. Architecturally, transformers form n² pairwise relationships for n tokens, so attention gets stretched as context grows. Goal: find the smallest set of high-signal tokens that maximize the likelihood of the desired outcome. As context grows, recall accuracy of any single piece decreases ("context rot"). (Anthropic Engineering: Effective Context Engineering)

---

## Lost in the Middle

Place the most important instructions in the first 20% and last 20% of each configuration file. Performance is highest when information sits at the beginning or end of the context and degrades for information buried in the middle of long contexts. (Liu et al., arXiv:2307.03172)

---

## Quality Over Quantity Checklist

Apply the deletion test: "Would removing this cause the agent to make mistakes? If not, cut it." Full include/exclude categories are tabulated in `what-not-to-include.md`. **Specificity goldilocks**: ✅ concrete project-specific rules ("Use 2-space indentation", "Run `npm test` before committing", "API handlers live in `src/api/handlers/`") — ❌ vague directives ("Format code properly", "Test your changes", "Keep files organized").

*Source: research-context-engineering-comprehensive.md lines 113-134*

---

## Context Poisoning Vectors

Detect and remove: stale file paths (check existence; remove or update), contradictions (compare across files; drop the weaker rule), over-specification (rules the agent already follows; delete or convert to a hook), failed-approach accumulation (defensive rules added after incidents that should not be needed), high-churn information (version numbers, file counts, team names — remove or replace with a pointer). Treat CLAUDE.md like code: review when things go wrong, prune regularly. (Anthropic Best Practices)

*Source: research-context-engineering-comprehensive.md lines 213-253*

---

## JIT Documentation Patterns

Move content from always-consumed to on-demand locations: skills (description at start, full body on invocation), path-scoped rules (load when matching files are read), subdirectory config files (load when working in that directory), `@path/to/import` (expands when parent loads, controlled), domain docs in `docs/` (agent navigates when relevant). Rather than pre-processing all data up front, agents maintain lightweight identifiers and load data into context at runtime. (Anthropic Engineering: Effective Context Engineering)

*Source: research-context-engineering-comprehensive.md lines 138-208, 451-461*

---
