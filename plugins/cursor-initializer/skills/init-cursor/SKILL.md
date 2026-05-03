---
name: init-cursor
description: "Initializes a rules-first .cursor/rules/*.mdc hierarchy for projects without existing Cursor configuration. Uses subagent-driven codebase analysis and a four-tier rule decomposition heuristic to generate the minimum set of rules each with the correct activation mode."
---

# Initialize Cursor Rules

Generate an evidence-based, rules-first `.cursor/rules/*.mdc` hierarchy for this project. The Cursor distribution treats `.cursor/rules/` as the canonical surface for project conventions; this skill never generates legacy monolithic context files.

## Why This Approach

Industry Research (ETH "Evaluating context files", 2026) found that auto-generated comprehensive configuration files **reduce** agent task success by ~3% while **increasing cost by 20%+**. Developer-written **minimal** files improve success by ~4%. This skill generates rules that mimic what an experienced developer would write — only non-obvious tooling and conventions, decomposed by activation mode.

Cursor's `.cursor/rules/*.mdc` system supports four orthogonal activation modes that map cleanly to one-concern-per-rule:

- **Always** (`alwaysApply: true`) — loaded on every conversation; reserved for critical tooling
- **Auto-attached** (`globs: [...]`) — loaded when matching files enter context
- **Agent-requested** (`description: "..."`) — loaded when the agent decides the topic is relevant
- **Manual** — loaded only when the user @-mentions the rule

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **NEVER** generate legacy monolithic context files (root or scoped); the Cursor distribution is rules-first
- **NEVER** include directory or file structure listings (Industry Research shows these don't help agents navigate)
- **NEVER** include obvious language conventions the model already knows
- **NEVER** exceed 200 lines per `.mdc` file
- **EVERY** instruction must pass: "Would removing this cause the agent to make mistakes?" If no, cut it.
- `.mdc` frontmatter: ONLY `description`, `alwaysApply`, `globs` — no other fields
- `.cursor/rules/` files: focused, metadata-scoped, one concern per file
- For trivial single-package projects with no non-obvious tooling, **zero rules** is the canonical passing output
</RULES>

## Process

### Preflight Check

Check whether the project has a `.cursor/rules/` directory containing any `.mdc` or `.md` files.

**If it exists:**

1. Inform the user: "Existing Cursor rules were found in this project. Switching to the improve workflow to optimize your current configuration."
2. Invoke the `improve-cursor` skill and follow its complete process.
3. **STOP** — do not proceed to Phase 1.

**If it does not exist:**
Proceed to Phase 1 below. Note: this skill does not check for legacy monolithic context files — the user can run `improve-cursor` separately to migrate any legacy context-file content into rules.

### Phase 1: Codebase Analysis

Delegate to the `codebase-analyzer` agent with this task:

> Analyze the project at the current working directory. Return ONLY non-standard, non-obvious information that would cause the agent to make mistakes if it didn't know them. Be ruthlessly minimal.

The agent runs in an isolated context with read-only access. Wait for it to complete and parse its structured output. Require the parsed output to surface any non-default config overrides (for example coverage addopts, strict type-checking, or line-length overrides) so they can be carried into a tier-1 rule when relevant.

### Phase 2: Rule Domain Detection

Delegate to the `rule-domain-detector` agent with this task:

> Apply the four-tier rule decomposition heuristic — (tier 1) tooling-non-obvious → (tier 2) file-pattern → (tier 3) monorepo-scope → (tier 4) on-demand cross-cutting / domain — to the project at the current working directory. For each justified rule, return its name, activation_mode (one of alwaysApply, globs, description), rationale, and the corresponding globs_patterns or description_text. Empty list is the canonical passing output for trivial single-package projects with no non-obvious tooling.

Wait for it to complete and parse its structured output.

### Phase 3: Generate Rule Files

#### Phase 3a: Decompose by Activation Mode

Drop any references from Phases 1–2. Read these references:

- `references/progressive-disclosure-guide.md` — rule decomposition tiers and activation-mode mapping
- `references/cursor-rules-system.md` — `.cursor/rules/` conventions, `.mdc` format, activation modes

Assign each suggested rule an activation mode (`alwaysApply`, `globs`, or `description`) and select the matching template.

#### Phase 3b: Filter Content and Generate

Drop Phase 3a references. Read these references:

- `references/what-not-to-include.md` — content exclusion criteria
- `references/context-optimization.md` — token budget guidelines

Using ONLY the information from Phase 1 and Phase 2, generate one `.mdc` file per suggested rule. For each rule, use the activation-mode assignment from Phase 3a to select the matching template:

- `activation_mode == alwaysApply` → read `assets/templates/cursor-rule-always.mdc`
- `activation_mode == globs` → read `assets/templates/cursor-rule-globs.mdc`
- `activation_mode == description` → read `assets/templates/cursor-rule-description.mdc`

Fill placeholders with content sourced from Phase 1 and Phase 2 only. File naming: kebab-case `.mdc` files in `.cursor/rules/`.

If `rule-domain-detector` returned an empty `Suggested Rules` list, generate **zero** rule files and skip directly to Phase 4 with a one-line note that the project's tooling is fully covered by the agent's defaults.

### Phase 4: Self-Validation

Read `references/validation-criteria.md` and execute its **Validation Loop Instructions** against every generated `.mdc` file.

Check both general criteria AND the rules-first structural checks:

- `.mdc` files use ONLY valid frontmatter fields (`description`, `alwaysApply`, `globs`)
- Activation mode is appropriate for each rule's content
- Always-loaded content is minimal — every line in an `alwaysApply: true` rule is critical
- For simple single-package projects, zero `.cursor/rules/*.mdc` files is the default passing outcome unless the rule-domain-detector found a justified rule

Maximum 3 iterations.

### Phase 5: Present and Write

1. Show the user ALL generated rule files with their content before writing
2. Explain briefly why each rule exists and which tier of the four-tier heuristic it came from
3. Include a concise validation summary: iteration count, generated rule count, and any fixes made during self-validation
4. Highlight which rules are always-loaded (`alwaysApply: true`) vs. on-demand (`globs`-based, agent-requested)
5. Ask for confirmation before writing files
6. Create `.cursor/rules/` directory if any rules were generated, then write the files
7. If zero rules were generated, do not create the `.cursor/rules/` directory; report the empty-set result and stop
