# What NOT to Include

Evidence-based exclusion guide for AGENTS.md and CLAUDE.md.
Sources: ETH Zurich (Evaluating AGENTS.md), Anthropic Best Practices, a-guide-to-agents.md.

---

## Exclusions

Exclude: directory/file structure listings (agents use grep/glob; static lists go stale); standard language conventions (already in training data); codebase overview paragraphs (increase exploration steps without improving navigation); vague guidance ("write clean code"); file path references (paths churn and poison context); everything in one file (exceeds the ~150-200 instruction attention budget); obvious tooling ("use git for version control"); duplicated information across files; version numbers / release names (high-churn); long explanations or tutorials; detailed API documentation (link out); anything inferable from code; hook-enforced behaviors (formatting, file blocking, notifications) — migrate to a hook.

*Source: init-agents/SKILL.md:106-116; research-context-engineering-comprehensive.md:113-121; Evaluating-AGENTS-paper.md abstract*

### Exclusion Actions

Not all excluded content should be deleted — some should migrate. **Migrate** hook-enforced behaviors → hook (zero cost, deterministic); path-specific conventions → `.claude/rules/` with `paths:`; domain knowledge >50 lines → skill (`user-invocable: false`, ~100 token startup). **Delete** agent-inferable content and stale/vague/duplicate content.

---

## The Instruction Test

Apply to each candidate line: **"Would removing this cause the agent to make mistakes? If not, cut it."** (Anthropic). If a vague line can be rewritten into one concrete project-specific constraint that would prevent mistakes, clarify it in place; otherwise delete it.

---

## Common Traps

- **Auto-generated files** — never run `/init` or scripts to generate AGENTS.md/CLAUDE.md; they flood the file with content "useful for most scenarios" instead of restraining to truly-needed instructions.
- **Ball-of-mud growth** — adding a rule each time the agent errs accumulates into an unmaintainable file. Refactor instead.
- **Comprehensive-over-restrained mindset** — more content feels safer but performs worse. "Unnecessary requirements from context files make tasks harder." (ETH Zurich abstract)
- **Architectural path trap** — file-path references inside architectural constraints differ from bare directory listings. Keep the constraint ("Services must not import from `routes/`"), remove bare listings.

---

## What TO Include Instead

One-sentence project description; non-standard package manager; non-standard build/test commands; non-obvious architectural decisions; domain concepts (not file paths — they're more stable); progressive-disclosure pointers like "See docs/TESTING.md".
