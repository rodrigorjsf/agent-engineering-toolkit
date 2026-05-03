# What NOT to Include

Evidence-based exclusion table for AGENTS.md and `.cursor/rules/*.mdc` content.
Sources: Industry Research (ETH "Evaluating context files", a-guide-to-agents.md, hooks/automate-workflow-with-hooks.md)

---

## Exclusion Evidence Table

| Content Type | Why to Exclude | Evidence Quote | Source |
|-------------|----------------|---------------|--------|
| Directory/file structure listings | Agents use grep/glob to navigate; static lists become stale instantly | "Not effective at providing repository overview" | Industry Research (ETH) |
| Standard language conventions | Agent training data already includes these | Agent "already knows these from training data" | Industry Research |
| Codebase overview paragraphs | Increases exploration steps without improving navigation success | "Increases steps without improving navigation" | Industry Research (ETH) |
| Vague guidance ("write clean code") | Cannot be acted on; wastes attention budget without guiding behavior | "Not actionable, wastes attention budget" | Industry Research (a-guide-to-agents.md) |
| File path references | Paths change constantly; stale paths actively mislead the agent | "File paths change constantly... actively poisons context" | Industry Research |
| Everything in one file (all topics) | Exceeds ~150-200 instruction attention budget; creates ball-of-mud | "Ball of mud problem, exceeds attention budget" | Industry Research |
| Obvious tooling ("use git for version control") | Agent already knows standard tooling from training | Agent already does this correctly without extra instruction | Industry Research |
| Duplicated information across files | Consumes tokens on every request; creates contradiction risk | "Wastes tokens on every request" | Industry Research |
| Version numbers and release names | High-churn content; stale immediately after updates | "Information that changes frequently" (explicit ❌ Exclude) | Industry Research |
| Long explanations and tutorials | Context is for instructions, not education | Listed in explicit ❌ Exclude column | Industry Research |
| Detailed API documentation | Link to external docs instead of inlining | Listed in explicit ❌ Exclude column | Industry Research |
| Anything the agent can infer from code | Agent reads code directly; redundant instructions waste tokens | Anything the agent can infer by reading code should stay out of configuration files | Industry Research |
| Hook-enforced behaviors (formatting, file blocking, notifications) | Hooks handle these deterministically; config file instructions are redundant and may conflict with hook execution. **Migrate** to hook configuration for zero context cost | Hooks provide deterministic control over agent behavior instead of repeated context instructions | Industry Research (Hooks Guide) |

*Source: Industry Research — research-context-engineering-comprehensive.md:113-121; ETH Evaluating-AGENTS-paper.md abstract*

### Exclusion Actions

Not all excluded content should be deleted — some should migrate to on-demand mechanisms:

| Exclusion Category | Action | Mechanism |
|-------------------|--------|-----------|
| Hook-enforced behaviors | **Migrate** | `.cursor/hooks.json` (zero context cost, deterministic enforcement) |
| Path-specific conventions | **Migrate** | `.cursor/rules/*.mdc` with `globs:` (loads on file match only) |
| Domain knowledge blocks >50 lines | **Migrate** | Skill (auto-invocable, ~100 token startup cost) |
| Agent-inferable content | **Delete** | No migration — agents discover via tools |
| Stale, vague, or duplicate content | **Delete** | No migration value |

---

## The Instruction Test

Apply this test to each line before including it:

> **"Would removing this cause the agent to make mistakes? If not, cut it."**
> — Industry Research

If the instruction passes this test, include it. If it fails (agent would do the right thing anyway), delete it.

---

## Common Traps

**Auto-generated files trap**: Never use `/init` or initialization scripts to generate AGENTS.md or `.cursor/rules/*` from generic boilerplate. Auto-generated files "flood the file with things that are 'useful for most scenarios' but would be better progressively disclosed. Generated files prioritize comprehensiveness over restraint." — a-guide-to-agents.md

**Ball-of-mud growth**: Each time the agent does something wrong, adding a rule feels productive. After hundreds of iterations over months, the file becomes unmaintainable and hurts agent performance. Refactor instead.

**Comprehensive-over-restrained mindset**: More content feels safer but performs worse. "Unnecessary requirements from context files make tasks harder." — ETH Zurich, Evaluating AGENTS.md (abstract)

---

## What TO Include Instead

| What to document | Why it belongs here |
|-----------------|-------------------|
| One-sentence project description | Anchors all agent decisions |
| Non-standard package manager | Without this, agent defaults to wrong tooling |
| Non-standard build/test commands | Agent cannot guess custom scripts |
| Non-obvious architectural decisions | Agent would otherwise make different choices |
| Domain concepts (not file paths) | More stable than paths; safer to document |
| Progressive disclosure pointers | "See docs/TESTING.md" keeps root file minimal |
