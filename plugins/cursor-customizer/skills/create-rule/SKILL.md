---
name: create-rule
description: 'Creates a new `.cursor/rules/*.mdc` rule with correct activation mode (always/globs/description) and frontmatter. Use when adding a Cursor rule to an initialized project.'
---

# Create Rule

Generates a new `.cursor/rules/*.mdc` rule with the correct activation-mode frontmatter and minimal, specific instructions grounded in the Cursor docs corpus.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **NEVER** create rules longer than 200 lines
- **NEVER** create rules for standard conventions the agent already knows (e.g., "write clean code")
- **NEVER** use overly broad globs (`**/*`) on auto-attached rules unless truly global scope is required
- **NEVER** use any frontmatter key other than `description`, `alwaysApply`, `globs`
- **NEVER** include a `paths` frontmatter key — it belongs to a different platform's convention and is invalid here
- **EVERY** generated rule MUST set exactly one well-formed activation mode (always / globs / description)
- **EVERY** instruction must be specific and verifiable — not vague guidance
- **ONE** concern per rule file — do not bundle unrelated instructions
</RULES>

## Process

### Preflight Check

Confirm the project is already initialized for Cursor (`.cursor/rules/` directory exists or the user is creating the first rule). Then check for conflicts:

- Same filename (e.g., `.cursor/rules/{topic}.mdc` already exists)
- Existing rule with overlapping globs that would create contradiction or duplication
- Existing rule covering the same topic via `description:`-mode

**If a conflicting or duplicate rule already exists:**

1. Inform the user: "A rule covering `{topic}` or overlapping globs already exists."
2. Suggest using `/cursor-customizer:improve-rule` to evaluate and optimize it instead.
3. **STOP** — do not proceed. The user should either choose a different topic/scope or use the improve skill.

**If no conflicting rule exists:**
Proceed to Phase 1 below.

### Phase 1: Project Context Analysis

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand existing rules in `.cursor/rules/`. Focus on: rule filenames and topics, activation modes in use, glob patterns in use, any overlaps or contradictions between rules, gaps where a rule would add value, and the conventions in any present `AGENTS.md` files that could inform rule content. Also identify the project layout: whether this is a monorepo with multiple service packages (indicated by workspace files like `pnpm-workspace.yaml`, a `package.json` with a `workspaces` field, multiple `go.mod` files in subdirectories, or multiple `pyproject.toml` files in subdirectories) or a single-package project, and report any service directory paths for use in glob scoping.

The agent runs in an isolated context with read-only access. Wait for it to complete and parse its structured output.

### Phase 2: Activation-Mode Selection and Generation

Before generating, read these reference documents:

- `references/rule-authoring-guide.md` — when to use rules, frontmatter contract, the four activation modes, glob syntax, and anti-patterns
- `references/prompt-engineering-strategies.md` — rule-specific prompting (zero-shot, no examples in rules)

Map the user's intent to one activation mode using the rules-authoring guide:

- **Critical tooling / project-wide constraint** → `alwaysApply: true` → read `assets/templates/cursor-rule-always.mdc`
- **Pattern-relative convention** (test files, generated code, monorepo packages, sensitive-handler files) → `globs:` → read `assets/templates/cursor-rule-globs.mdc`
- **Cross-cutting / domain topic the agent should pull in by name** (authentication, observability, accessibility, API design) → `description:` → read `assets/templates/cursor-rule-description.mdc`

Fill the chosen template's placeholders using:

- User requirements for the new rule (topic, target globs or description sentence, instructions)
- Phase 1 analysis output (existing rules, gaps, potential contradictions)
- Evidence from the reference files above

Generate a single rule:

- Frontmatter contains ONLY the three permitted fields and matches the chosen activation mode
- Body ≤ 200 lines (significantly shorter for `alwaysApply: true` — every line loads on every conversation)
- In a monorepo with `globs:`-mode, scope the glob to the relevant package subtree (e.g., `services/api/**/*.go`), not a language-only glob (`**/*.go`)

Write target: `.cursor/rules/{topic-name}.mdc` (kebab-case).

### Phase 3: Self-Validation

Read `references/rule-validation-criteria.md` and execute its **Validation Loop Instructions** against the generated rule.

The loop evaluates all hard limits and quality checks, fixes any failures, and re-evaluates — maximum 3 iterations. Failed checks re-enter Phase 2's generation step. Additionally, cross-check against ALL existing rule files in `.cursor/rules/` for contradictions and overlapping globs. Do not proceed to Phase 4 until ALL criteria pass.

### Phase 4: Present and Write

1. Show the user the complete generated rule file
2. Cite the evidence from reference files that informed key decisions:
   - Why this activation mode (what content nature drove the choice)
   - Why this glob pattern or description sentence (what scope it targets and why)
   - Why each instruction is necessary (what mistake it prevents)
3. Ask for confirmation before writing any files
4. On approval, write the rule file to `.cursor/rules/{topic-name}.mdc`
