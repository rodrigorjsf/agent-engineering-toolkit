# Context Optimization

Token-budget and attention guidance for `.cursor/rules/*.mdc` and AGENTS.md files.
Source: Industry Research — research-context-engineering-comprehensive.md.

Hard limits live in `validation-criteria.md`. Bloated files cause the model to miss important instructions: if Cursor keeps doing something despite a rule against it, the file is probably too long. (Industry Research)

---

## Attention Budget

Context is finite with diminishing returns; every new token depletes the attention budget. Transformers form n² pairwise relationships, so attention stretches as context grows. Goal: smallest set of high-signal tokens that maximize the desired outcome. As context grows, recall accuracy decreases ("context rot"). (Industry Research, Effective Context Engineering)

---

## Lost in the Middle

Place the most important instructions in the first 20% and last 20% of each file. Performance is highest at start and end; degrades for information buried in the middle. (Liu et al., arXiv:2307.03172)

---

## Quality Over Quantity

Apply the deletion test: "Would removing this cause the agent to make mistakes? If not, cut it." Full include/exclude categories: see `what-not-to-include.md`. **Specificity goldilocks**: ✅ "Use 2-space indentation"; "Run `npm test` before committing"; "API handlers live in `src/api/handlers/`". ❌ "Format code properly"; "Test your changes"; "Keep files organized".

*Source: Industry Research — research-context-engineering-comprehensive.md lines 113-134*

---

## Context Poisoning Vectors

Detect and remove: stale file paths (check existence; remove or update); contradictions (drop the weaker rule); over-specification (rules already followed; delete or convert to hook); failed-approach accumulation (defensive rules added after incidents); high-churn data (versions, file counts, team names — remove or replace with a pointer). Treat configuration files like code: review when things go wrong, prune regularly. (Industry Research)

*Source: Industry Research — research-context-engineering-comprehensive.md lines 213-253*

---

## JIT Documentation

Move from always-consumed to on-demand: skills (description at start, body on invocation), path-scoped rules (load on file match), subdirectory configs (load when working there), domain docs in `docs/` (agent navigates when relevant). Maintain lightweight identifiers; load data into context at runtime. (Industry Research, Effective Context Engineering)

*Source: Industry Research — research-context-engineering-comprehensive.md lines 138-208, 451-461*
