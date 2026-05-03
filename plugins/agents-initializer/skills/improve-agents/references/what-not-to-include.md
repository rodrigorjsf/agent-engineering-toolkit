# What NOT to Include

Exclusion guide for AGENTS.md and CLAUDE.md.
Sources: ETH Zurich (Evaluating AGENTS.md), Anthropic Best Practices, a-guide-to-agents.md.

## Exclusions

Exclude: directory/file structure listings; standard language conventions; codebase overview paragraphs (increase exploration without improving navigation — ETH); vague guidance ("write clean code"); file path references (paths churn and poison context); everything in one file (~150-200 instruction attention budget); obvious tooling ("use git"); duplicates; version numbers / release names; long explanations or tutorials; detailed API documentation (link out); anything inferable from code; hook-enforced behaviors — migrate to a hook.

*Source: init-agents/SKILL.md:106-116; research-context-engineering-comprehensive.md:113-121; Evaluating-AGENTS-paper.md abstract*

### Exclusion Actions

Not all excluded content should be deleted. **Migrate** hook-enforced → hook (zero cost, deterministic); path-specific → `.claude/rules/` with `paths:`; domain knowledge >50 lines → skill (`user-invocable: false`, ~100 token startup). **Delete** agent-inferable, stale, vague, duplicate.

## The Instruction Test

For each line: **"Would removing this cause the agent to make mistakes? If not, cut it."** (Anthropic). If a vague line can be rewritten as a concrete project-specific constraint, clarify in place; otherwise delete.

## Common Traps

- **Auto-generated files** — never `/init` or scripts; they flood with content "useful for most scenarios" instead of restraining to needed instructions.
- **Ball-of-mud growth** — adding a rule each time the agent errs accumulates into an unmaintainable file. Refactor instead.
- **Comprehensive-over-restrained mindset** — "Unnecessary requirements from context files make tasks harder." (ETH abstract)
- **Architectural path trap** — file-path references inside architectural constraints differ from bare directory listings. Keep the constraint, remove bare listings.

## What TO Include Instead

One-sentence project description; non-standard package manager; non-standard build/test commands; non-obvious architectural decisions; domain concepts (not file paths); progressive-disclosure pointers ("See docs/TESTING.md").
