# What NOT to Include

Exclusion guide for AGENTS.md and `.cursor/rules/*.mdc`.
Sources: Industry Research (ETH "Evaluating context files", a-guide-to-agents.md, hooks/automate-workflow-with-hooks.md).

---

## Exclusions

Exclude: directory/file structure listings (static lists go stale — ETH); standard language conventions (already in training data); codebase overview paragraphs (increase exploration steps without improving navigation — ETH); vague guidance ("write clean code"); file path references (paths churn and poison context); everything in one file (exceeds ~150-200 instruction attention budget); obvious tooling ("use git for version control"); duplicated information across files; version numbers / release names (high-churn); long explanations or tutorials; detailed API documentation (link out); anything inferable from code; hook-enforced behaviors (formatting, file blocking, notifications) — migrate to a hook.

*Source: Industry Research — research-context-engineering-comprehensive.md:113-121; ETH Evaluating-AGENTS-paper.md abstract*

### Exclusion Actions

Not all excluded content should be deleted — some should migrate. **Migrate** hook-enforced behaviors → `.cursor/hooks.json` (zero cost, deterministic); path-specific conventions → `.cursor/rules/*.mdc` with `globs:`; domain knowledge >50 lines → skill (~100 token startup). **Delete** agent-inferable and stale/vague/duplicate content.

---

## The Instruction Test

Apply to each candidate line: **"Would removing this cause the agent to make mistakes? If not, cut it."** (Industry Research). If a vague line can be rewritten into one concrete project-specific constraint, clarify in place; otherwise delete.

---

## Common Traps

- **Auto-generated files** — never run `/init` or scripts to generate from generic boilerplate; they flood the file with content "useful for most scenarios" instead of restraining to truly-needed instructions.
- **Ball-of-mud growth** — adding a rule each time the agent errs accumulates into an unmaintainable file. Refactor instead.
- **Comprehensive-over-restrained mindset** — more content feels safer but performs worse. "Unnecessary requirements from context files make tasks harder." (ETH Zurich abstract)

---

## What TO Include Instead

One-sentence project description; non-standard package manager; non-standard build/test commands; non-obvious architectural decisions; domain concepts (not file paths — they're more stable); progressive-disclosure pointers like "See docs/TESTING.md".
