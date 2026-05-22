# What NOT to Include

Evidence-based exclusion table for AGENTS.md content.

---

## Exclusion Evidence Table

| Content Type | Why to Exclude | Evidence Quote |
|-------------|----------------|---------------|
| Directory/file structure listings | Agents use grep/glob to navigate; static lists become stale instantly | "Not effective at providing repository overview" |
| Standard language conventions | Agent training data already includes these | Agent "already knows these from training data" |
| Codebase overview paragraphs | Increases exploration steps without improving navigation success | "Increases steps without improving navigation" |
| Vague guidance ("write clean code") | Cannot be acted on; wastes attention budget without guiding behavior | "Not actionable, wastes attention budget" |
| File path references | Paths change constantly; stale paths actively mislead the agent | "File paths change constantly... actively poisons context" |
| Everything in one file (all topics) | Exceeds ~150-200 instruction attention budget; creates ball-of-mud | "Ball of mud problem, exceeds attention budget" |
| Obvious tooling ("use git for version control") | Agent already knows standard tooling from training | "If Claude already does it correctly, delete it" |
| Duplicated information across files | Consumes tokens on every request; creates contradiction risk | "Wastes tokens on every request" |
| Version numbers and release names | High-churn content; stale immediately after updates | "Information that changes frequently" (explicit ❌ Exclude) |
| Long explanations and tutorials | Context is for instructions, not education | Listed in explicit ❌ Exclude column |
| Detailed API documentation | Link to external docs instead of inlining | Listed in explicit ❌ Exclude column |
| Anything the agent can infer from code | Agent reads code directly; redundant instructions waste tokens | "Anything Claude can figure out by reading code" |


### Exclusion Actions

Not all excluded content should be deleted — some should migrate to on-demand mechanisms:

| Exclusion Category | Action | Mechanism |
|-------------------|--------|-----------|
| Path-specific conventions | **Migrate** | Subdirectory AGENTS.md (scoped to that area) |
| Domain knowledge blocks >50 lines | **Migrate** | Separate domain doc in `docs/` (referenced by pointer) |
| Agent-inferable content | **Delete** | No migration — agents discover via tools |
| Stale, vague, or duplicate content | **Delete** | No migration value |

---

## The Instruction Test

Apply this test to each line before including it:

> **"Would removing this cause the agent to make mistakes? If not, cut it."**
> — Anthropic Best Practices

If the instruction passes this test, include it. If it fails (agent would do the right thing anyway), delete it.
If a vague line can be rewritten into one concrete project-specific constraint that would prevent mistakes, clarify it in place; otherwise delete it.

---

## Common Traps

**Auto-generated files trap**: Never use `/init` or initialization scripts to generate AGENTS.md/CLAUDE.md. Auto-generated files "flood the file with things that are 'useful for most scenarios' but would be better progressively disclosed. Generated files prioritize comprehensiveness over restraint." — a-guide-to-agents.md

**Ball-of-mud growth**: Each time the agent does something wrong, adding a rule feels productive. After hundreds of iterations over months, the file becomes unmaintainable and hurts agent performance. Refactor instead.

**Comprehensive-over-restrained mindset**: More content feels safer but performs worse. "Unnecessary requirements from context files make tasks harder." — ETH Zurich, Evaluating AGENTS.md (abstract)

**Architectural path trap**: Architectural constraints that reference file paths are NOT the same as directory listings. Test: would removing this cause an architectural mistake? A constraint like "Services must not import from `routes/` — keep separation strict" is essential even with a path reference. A bare listing of `routes/`, `services/`, `lib/` with no behavioral constraint is bloat. Keep the constraint; remove the listing.
If a file-path reference is stale and not part of a necessary architectural constraint, delete it rather than swapping in another brittle path.

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
