# What NOT to Include

Evidence-based exclusion guide for AGENTS.md and CLAUDE.md.
Sources: ETH Zurich paper (Evaluating AGENTS.md), Anthropic Best Practices, a-guide-to-agents.md.

---

## Exclusions

Exclude these categories: directory/file structure listings (agents use grep/glob; static lists go stale — ETH Zurich); standard language conventions (already in training data); codebase overview paragraphs (increase exploration steps without improving navigation — ETH Zurich); vague guidance like "write clean code" (not actionable — wastes attention); file path references (paths change constantly and actively poison context); everything in one file (exceeds the ~150-200 instruction attention budget); obvious tooling ("use git for version control"); duplicated information across files (wastes tokens per request, creates contradictions); version numbers / release names (high-churn, stale instantly); long explanations or tutorials (context is for instructions, not education); detailed API documentation (link out instead); anything inferable from code; hook-enforced behaviors (formatting, file blocking, notifications) — migrate to a hook for deterministic enforcement at zero context cost.

*Source: init-agents/SKILL.md:106-116 expanded; research-context-engineering-comprehensive.md:113-121; Evaluating-AGENTS-paper.md abstract*

### Exclusion Actions

Not all excluded content should be deleted — some should migrate. **Migrate** hook-enforced behaviors to a hook (zero context cost, deterministic), path-specific conventions to `.claude/rules/` with `paths:`, and domain knowledge blocks >50 lines to a skill with `user-invocable: false` (~100 token startup cost). **Delete** agent-inferable content (agents discover via tools) and stale/vague/duplicate content.

---

## The Instruction Test

Apply to each candidate line: **"Would removing this cause the agent to make mistakes? If not, cut it."** (Anthropic Best Practices). If a vague line can be rewritten into one concrete project-specific constraint that would prevent mistakes, clarify it in place; otherwise delete it.

---

## Common Traps

- **Auto-generated files** — never run `/init` or scripts to generate AGENTS.md/CLAUDE.md; they flood the file with content "useful for most scenarios" instead of restraining to truly-needed instructions (a-guide-to-agents.md).
- **Ball-of-mud growth** — adding a rule each time the agent errs feels productive but accumulates into an unmaintainable file that hurts performance. Refactor instead.
- **Comprehensive-over-restrained mindset** — more content feels safer but performs worse. "Unnecessary requirements from context files make tasks harder." (ETH Zurich, Evaluating AGENTS.md abstract)
- **Architectural path trap** — file-path references inside architectural constraints are not the same as bare directory listings. Keep the constraint ("Services must not import from `routes/`"), remove bare listings. If a path reference is stale and not load-bearing on an architectural rule, delete it.

---

## What TO Include Instead

One-sentence project description (anchors all agent decisions); non-standard package manager (otherwise the agent defaults wrong); non-standard build/test commands (cannot be guessed); non-obvious architectural decisions; domain concepts (not file paths — they're more stable); progressive disclosure pointers like "See docs/TESTING.md" to keep the root file minimal.
