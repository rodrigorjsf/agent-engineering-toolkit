---
name: improve-cursor
description: "Evaluates and improves existing .cursor/rules/*.mdc files. When AGENTS.md is present in the target project, runs a non-destructive migration sub-flow that decomposes its content into modular rules without touching the original file."
---

# Improve Cursor Rules

Evaluate existing `.cursor/rules/*.mdc` files against evidence-based quality criteria and apply improvements to optimize context usage, reduce token waste, and improve Cursor agent performance. When the target project has a legacy `AGENTS.md`, run a non-destructive migration sub-flow that proposes new modular rules from its content while leaving the original file untouched.

## Why This Matters

Industry Research (ETH "Evaluating context files", 2026) found that **unnecessary requirements in context files make tasks harder**. Every always-loaded rule consumes tokens on every request. Bloated or poorly-scoped rules cause agents to:

- Spend more steps exploring (cost +20%)
- Follow irrelevant instructions that distract from the actual task
- Lose important instructions in the noise ("lost in the middle" effect)

Cursor's rule system offers powerful activation modes — but only if rules are properly scoped. An `alwaysApply: true` rule with content that should be auto-attached by globs wastes tokens on every conversation where those files aren't relevant.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **ALWAYS** evaluate before modifying — never change files without analysis
- **ALWAYS** present changes to the user before applying them
- **NEVER** add content without removing more (net reduction is the goal)
- **NEVER** exceed 200 lines per `.mdc` file after improvements
- **NEVER** modify or delete the user's existing `AGENTS.md` — the migration sub-flow is non-destructive by contract
- **PRESERVE** all genuinely useful instructions — only remove waste
- **SPLIT** bloated rules using Cursor's activation modes (`alwaysApply`, `globs`, `description`)
- **VERIFY** that file path references in content still point to existing files
- **CONVERT** always-loaded rules to auto-attached (`globs`) or agent-requested (`description`) when they only apply to specific contexts
- **MAXIMIZE** on-demand loading — minimize always-loaded content
- `.mdc` frontmatter: ONLY `description`, `alwaysApply`, `globs` — no other fields
</RULES>

## Process

### Preflight Check

Check whether the project has:

- A `.cursor/rules/` directory containing `.mdc` or `.md` files — record as **has_rules**
- An `AGENTS.md` file at the root or any subdirectory — record as **has_agents_md**

**If neither exists:** Inform the user: "No Cursor rules found. Run `init-cursor` to generate an optimized `.cursor/rules/*.mdc` hierarchy from scratch." **STOP.**

Otherwise, proceed to Phase 1 with `has_rules` and `has_agents_md` flags set.

### Phase 1: Current State Analysis

Read `references/evaluation-criteria.md` for the scoring rubric and bloat / staleness indicators.

Build the `file-evaluator` task dynamically based on what was found.

**If `has_rules` only (no AGENTS.md):** Delegate to the `file-evaluator` agent with this task:

> Evaluate all `.cursor/rules/` files (`.mdc` and `.md`) in the project at the current working directory. Check for:
>
> 1. Files over 200 lines
> 2. Bloat indicators (directory listings, obvious conventions, vague instructions)
> 3. Stale references (file paths that don't exist, commands that aren't in the manifest)
> 4. Activation-mode mismatches (`alwaysApply: true` rules that should use `globs:` or `description:`)
> 5. Invalid `.mdc` frontmatter (only `description`, `alwaysApply`, `globs` are valid)
>
> Return a structured assessment with specific line numbers and content for each issue.

**If `has_agents_md` and `has_rules`:** Delegate to the `file-evaluator` agent with this task:

> Evaluate all `.cursor/rules/` files (`.mdc` and `.md`) AND classify all AGENTS.md content blocks in the project at the current working directory. For `.cursor/rules/` files check for:
>
> 1. Files over 200 lines
> 2. Bloat indicators
> 3. Stale references
> 4. Activation-mode mismatches
> 5. Invalid `.mdc` frontmatter
>
> Additionally, classify each AGENTS.md content block by destination activation mode: `alwaysApply: true`, `globs: [...]`, `description: "..."`, or `discard` with a one-sentence reason.
>
> Return both outputs in the structured assessment.

**If `has_agents_md` and not `has_rules`:** Delegate to the `file-evaluator` agent with this task:

> Classify all AGENTS.md content blocks in the project at the current working directory. For each block, output its destination activation mode: `alwaysApply: true`, `globs: [...]`, `description: "..."`, or `discard` with a one-sentence reason. Return only the AGENTS.md block classification section of the structured assessment.

The agent runs in an isolated context with read-only access. Wait for it to complete and parse its structured output.

### Phase 2: Codebase Comparison

Delegate to the `codebase-analyzer` agent with this task:

> Analyze the project at the current working directory. Focus on:
>
> 1. Verifying that tooling commands documented in existing `.cursor/rules/` still work
> 2. Detecting workspace packages with distinct tooling that lack their own `globs:`-mode rule (zero-dependency rules, dual exports, conditional imports, server-only markers)
> 3. Detecting file patterns with non-obvious conventions that lack auto-attached `.cursor/rules/*.mdc` — including BOTH convention rules (code style, test patterns) AND domain-critical rules (privacy, security, compliance)
> 4. Detecting cross-cutting domain areas not covered by existing `description:`-mode rules
>
> Return ONLY actionable findings.

Wait for it to complete and parse its structured output.

### Phase 3: Generate Improvement Plan

Read these reference documents:

- `references/progressive-disclosure-guide.md` — rule decomposition tiers and activation-mode mapping
- `references/what-not-to-include.md` — content exclusion criteria
- `references/context-optimization.md` — token budget guidelines
- `references/cursor-rules-system.md` — `.cursor/rules/` conventions, `.mdc` format, activation modes
- `references/automation-migration-guide.md` — automation migration decision criteria (skill vs. hook vs. rule vs. subagent)

Based on both subagent reports, create the improvement plan.

#### Removal Actions (highest priority — reduce token waste)

1. **Remove bloat**: Delete directory listings, obvious conventions, vague instructions
2. **Remove stale content**: Delete references to files / commands that no longer exist
3. **Remove duplicates**: Eliminate content duplicated across rules
4. **Resolve contradictions**: Pick the correct version and remove the conflicting one

#### Refactoring Actions (optimize loading behavior)

1. **Convert pattern-specific always-apply rules** to `.cursor/rules/*.mdc` with `globs:` frontmatter (auto-attached)
2. **Convert always-loaded rules** to agent-requested (add `description`, set `alwaysApply: false`) when the agent can decide relevance
3. **Fix invalid `.mdc` frontmatter** — remove unsupported fields, ensure only `description`, `alwaysApply`, `globs` are used
4. **Consolidate fragmented rules** that cover the same concern
5. **Migrate automation candidates** — for each instruction flagged as `HOOK_CANDIDATE`, `RULE_CANDIDATE`, or `SKILL_CANDIDATE`:
   - Classify using the decision flowchart in `references/automation-migration-guide.md`
   - Select target mechanism: hook (`.cursor/hooks.json` — deterministic enforcement), `.cursor/rules/*.mdc` with globs (file-pattern convention), skill (domain knowledge / infrequent workflow), or subagent (isolated analysis)
   - Estimate token savings using the token impact estimation table
   - In calibrated high-quality cases, keep migration and extraction suggestions proportional to the confirmed issues. Do not create new files or rules unless they resolve a documented criterion, and preserve non-issue sections in place.

#### Redundancy Elimination (delete what agents already know)

Apply the instruction test from `references/what-not-to-include.md`:

> "Would removing this cause the agent to make mistakes? If not, cut it."

1. **Delete agent-inferable content**: Standard conventions, obvious tooling, information discoverable from code
2. **Delete vague / generic advice**: Instructions that cannot be verified or acted on
3. **Delete auto-enforced rules**: Formatting or linting rules already enforced by project tooling

For each deletion, document: the specific content being removed, WHY the agent doesn't need it, and the evidence source.

#### Addition Actions (lowest priority — only if genuinely missing)

1. **Add missing tooling rules** for non-default tooling that the codebase-analyzer flagged
2. **Create missing `globs:`-mode rules** for file patterns with non-obvious conventions — include both convention rules and domain-critical rules auto-attached to sensitive file patterns
3. **Create missing `description:`-mode rules** for cross-cutting domain topics surfaced by the codebase-analyzer

When generating new or restructured rule files, select the template that matches each rule's activation mode:

- `alwaysApply: true` rule → read `assets/templates/cursor-rule-always.mdc`
- `globs:`-mode rule → read `assets/templates/cursor-rule-globs.mdc`
- `description:`-mode rule → read `assets/templates/cursor-rule-description.mdc`
- Skills (from automation migration) → read `assets/templates/skill.md`
- Hook configs (from automation migration) → read `assets/templates/hook-config.md`

### Phase Migrate AGENTS.md (conditional sub-flow)

**Run this sub-flow ONLY when `has_agents_md` is true.** When `has_agents_md` is false, skip this entire phase.

This sub-flow consumes `file-evaluator`'s structured AGENTS.md classification output (the `AGENTS.md Block Classification` section) and translates it into new `.cursor/rules/*.mdc` files. It is non-destructive: the original AGENTS.md file is never modified or deleted.

#### Sub-flow steps

1. **Validate the classification output schema** — every block has exactly one destination among `alwaysApply: true`, `globs: [...]`, `description: "..."`, or `discard`; every `discard` block has a one-sentence reason; every `globs:` block has at least one pattern; every `description:` block has a single-sentence topic attractor. If validation fails, surface the schema errors to the user and stop the sub-flow.

2. **Group blocks by destination** — collect all `alwaysApply: true` blocks, all `globs:` blocks (grouped by overlapping patterns), all `description:` blocks (grouped by topic), and all `discard` blocks.

3. **Generate one new rule file per group** — select the matching template from `assets/templates/` (`cursor-rule-always.mdc`, `cursor-rule-globs.mdc`, or `cursor-rule-description.mdc`) and fill it with the migrated block content. File naming: kebab-case `.mdc` files placed under `.cursor/rules/`.

4. **Apply only the new rule creations** — write the generated rule files. Do **not** touch the original AGENTS.md. Do **not** modify any pre-existing rule.

5. **Notify the user explicitly** — after applying the new rule creations, present this notification verbatim:

   > Migration sub-flow complete. The original `AGENTS.md` file has been left intact by design. After validating that the new rules behave as expected, you must remove the original AGENTS.md manually (`rm AGENTS.md`) — this skill never deletes it.

6. **List discarded blocks with reasons** — for transparency, show the user every block that was classified `discard`, along with the one-sentence reason from `file-evaluator`. The user can override individual discards if they disagree.

### Phase 4: Self-Validation

Read `references/validation-criteria.md` and execute its **Validation Loop Instructions** against every improved or newly created `.mdc` file, plus the migration sub-flow output if it ran.

For improve operations, also evaluate the **"If This Is an IMPROVE Operation"** section. For Cursor rules, also check:

- `.mdc` files use ONLY valid frontmatter (`description`, `alwaysApply`, `globs`)
- Activation mode is appropriate for each rule's content
- Always-loaded content is minimal

For the migration sub-flow output, also check the migration-sub-flow schema criteria documented in `references/validation-criteria.md`.

In calibrated high-quality cases, treat unrelated structural churn as a validation failure: if a change rewrites a non-issue section, adds extra files or rules, or increases file count without fixing a documented criterion, revert and choose the smaller fix.

For the migration sub-flow output, also check the migration-sub-flow schema criteria documented in `references/validation-criteria.md`.

In calibrated high-quality cases, treat unrelated structural churn as a validation failure: if a change rewrites a non-issue section, adds extra files or rules, or increases file count without fixing a documented criterion, revert and choose the smaller fix.

For the migration sub-flow output, also check the migration-sub-flow schema criteria documented in `references/validation-criteria.md`.

In calibrated high-quality cases, treat unrelated structural churn as a validation failure: if a change rewrites a non-issue section, adds extra files or rules, or increases file count without fixing a documented criterion, revert and choose the smaller fix.

Maximum 3 iterations.

### Phase 5: Present and Apply

1. Show a summary overview of all improvements found, grouped by category. Include a **Migration** row only if the migration sub-flow ran:
   - **Removals**: X items (bloat: X, stale: X, duplicates: X, contradictions: X)
   - **Refactoring**: X items (rule conversion: X, activation mode fix: X, consolidation: X)
   - **Automation Migrations**: X items (hooks: X, rules: X, skills: X, subagents: X)
   - **Redundancy Eliminations**: X items
   - **Additions**: X items
   - **Migration sub-flow** (only if it ran): X new rules created from AGENTS.md, X discarded blocks

2. Include a concise validation summary: iteration count, file-count delta, rule-count delta, and what each validation iteration fixed

3. For each suggestion, present a structured card in priority order (Removals → Refactoring → Automation Migrations → Redundancy Eliminations → Additions → Migration sub-flow):

   **WHAT**: The specific content and its current location (file:lines)
   **WHY**: Evidence-based justification with source reference
   **TOKEN IMPACT**: Estimated tokens saved from always-loaded context
   **OPTIONS**:
   - **Option A** (recommended): Primary action
   - **Option B**: Alternative action
   - **Option C**: Keep as-is — "Preserve in current location. Trade-off: continues consuming ~X tokens per session"
   - *(Additional options when applicable)*

   Wait for the user to select an option for each suggestion before proceeding to the next.
   If the user selects "Keep as-is", preserve the content in its exact current location — no modification.

4. After all suggestions are reviewed, show aggregate token impact analysis:
   - **Always-loaded tokens**: before → after
   - **On-demand tokens**: before → after
   - **Removed tokens**: total waste eliminated
   - **Deferred suggestions**: X items kept as-is (user chose to preserve)

5. Apply ONLY the approved changes (options A or B selections):
   - Execute each approved change in dependency order
   - For the migration sub-flow, write the new rule files but never touch the original AGENTS.md
   - Verify after each change:
     - All `.mdc` files under 200 lines
     - No orphaned references
     - `.mdc` files have valid frontmatter (only `description`, `alwaysApply`, `globs`)

6. Report final metrics:
   - Total lines before → after across `.cursor/rules/`
   - Always-loaded lines before → after
   - Rules before → after
   - Estimated token savings per session
   - Suggestions applied: X of Y (Z deferred)
   - If the migration sub-flow ran: confirmation that AGENTS.md was not modified, plus the manual-removal notification
