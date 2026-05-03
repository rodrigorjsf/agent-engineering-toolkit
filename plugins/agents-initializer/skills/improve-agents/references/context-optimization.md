# Context Optimization

Token-budget and attention guidance for AGENTS.md / CLAUDE.md files.
Source: research-context-engineering-comprehensive.md.

Hard limits live in `validation-criteria.md`. Bloated files cause Claude to ignore actual instructions. (Anthropic Best Practices)

## Attention Budget

Context is finite with diminishing returns. Transformers form n² pairwise relationships, so attention stretches as context grows. Goal: smallest set of high-signal tokens that maximize the desired outcome. Recall accuracy decreases as context grows ("context rot"). (Anthropic Engineering: Effective Context Engineering)

## Lost in the Middle

Place the most important instructions in the first 20% and last 20% of each file. Performance is highest at start and end; degrades for information buried in the middle. (Liu et al., arXiv:2307.03172)

## Quality Over Quantity

Apply the deletion test: "Would removing this cause the agent to make mistakes? If not, cut it." Full include/exclude categories: see `what-not-to-include.md`. **Specificity goldilocks**: ✅ "Use 2-space indentation"; "Run `npm test` before committing"; "API handlers live in `src/api/handlers/`". ❌ "Format code properly"; "Test your changes"; "Keep files organized".

*Source: research-context-engineering-comprehensive.md lines 113-134*

## Context Poisoning Vectors

Detect and remove: stale file paths; contradictions (drop the weaker rule); over-specification (rules already followed; delete or convert to hook); failed-approach accumulation (defensive rules added after incidents); high-churn data (versions, file counts, team names). Treat CLAUDE.md like code: review when things go wrong, prune regularly. (Anthropic Best Practices)

*Source: research-context-engineering-comprehensive.md lines 213-253*

## JIT Documentation

Move from always-consumed to on-demand: skills (description loaded; body on invocation), path-scoped rules (load on file match), subdirectory configs (load when working there), `@path/to/import` (expands when parent loads), domain docs in `docs/` (agent navigates when relevant). Maintain lightweight identifiers; load data into context at runtime. (Anthropic Engineering: Effective Context Engineering)

*Source: research-context-engineering-comprehensive.md lines 138-208, 451-461*
