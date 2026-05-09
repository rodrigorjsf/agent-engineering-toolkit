---
name: improve-cursor
description: 'Evaluates and improves existing `.cursor/rules/*.mdc` files. Non-destructive AGENTS.md migration when present — decomposes into modular rules, original untouched.'
---

# Improve Cursor Rules

Evaluate existing `.cursor/rules/*.mdc` files and apply improvements. When the project has a legacy `AGENTS.md`, run a non-destructive migration sub-flow proposing new modular rules from its content. Industry Research (ETH "Evaluating context files", 2026): bloated rules reduce success ~3% and increase cost ~20%.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **ALWAYS** evaluate before modifying; present changes before applying
- **NEVER** add content without removing more (net reduction is the goal)
- **NEVER** exceed 200 lines per `.mdc` file after improvements
- **NEVER** modify or delete the user's existing `AGENTS.md` — migration is non-destructive by contract
- **PRESERVE** all genuinely useful instructions — only remove waste
- **CONVERT** always-loaded rules to auto-attached (`globs`) or agent-requested (`description`) when they only apply in specific contexts
- **MAXIMIZE** on-demand loading — minimize always-loaded content
- `.mdc` frontmatter: ONLY `description`, `alwaysApply`, `globs` — no other fields
</RULES>

## Process

### Preflight Check

Detect:
- `.cursor/rules/` containing `.mdc` or `.md` → **has_rules**
- `AGENTS.md` at root or any subdirectory → **has_agents_md**

If neither: inform "No Cursor rules found. Run `init-cursor` to generate an optimized `.cursor/rules/*.mdc` hierarchy." and STOP. Otherwise, proceed with both flags.

### Phase 1: Current State Analysis

Read `references/evaluation-criteria.md` for scoring rubric, bloat/staleness indicators, and Deletion Test.

Delegate to `file-evaluator`, building task dynamically from flags:

- **has_rules** — evaluate every `.cursor/rules/` file (`.mdc` and `.md`) for: files >200 lines; bloat (directory listings, obvious conventions, vague instructions); stale references; activation-mode mismatches (`alwaysApply: true` rules that should be `globs:` or `description:`); invalid `.mdc` frontmatter (only `description`, `alwaysApply`, `globs` allowed).
- **has_agents_md AND has_rules** — same checks, plus classify each AGENTS.md content block by destination activation mode: `alwaysApply: true`, `globs: [...]`, `description: "..."`, or `discard` with one-sentence reason.
- **has_agents_md only** — classify AGENTS.md content blocks only.

The agent runs in an isolated context with read-only access. Wait for the structured output.

### Phase 2: Codebase Comparison

Delegate to `codebase-analyzer`: analyze the project for (1) tooling commands in `.cursor/rules/` that no longer work; (2) workspace packages with distinct tooling lacking a `globs:`-mode rule; (3) file patterns with non-obvious conventions lacking auto-attached `.cursor/rules/*.mdc` (convention and domain-critical); (4) cross-cutting domain areas not covered by `description:`-mode rules. Return only actionable findings.

### Phase 3: Generate Improvement Plan

#### Phase 3a: Content Decisions

Drop Phases 1–2 references. Read:

- `references/progressive-disclosure-guide.md` — rule decomposition tiers and activation-mode mapping
- `references/what-not-to-include.md` — exclusion criteria + Deletion Test

Identify **Removals** and **Redundancy Eliminations** (Deletion Test; document WHY citing source). Do not plan refactoring yet.

#### Phase 3b: Rules and Budget

Drop Phase 3a references. Read:

- `references/context-optimization.md` — token budget guidelines
- `references/cursor-rules-system.md` — `.cursor/rules/` conventions, `.mdc` format, activation modes

Plan **Refactoring** (convert pattern-specific always-apply → `globs:`; always-loaded → agent-requested; fix invalid frontmatter; consolidate rules) and **Additions** (only when genuinely missing). Templates: `cursor-rule-always.mdc`, `cursor-rule-globs.mdc`, `cursor-rule-description.mdc`, `skill.md`, `hook-config.md`.

#### Phase 3c: Automation Migrations

Drop Phase 3b references. Read:

- `references/automation-migration-guide.md` — automation migration decision criteria

Apply the decision flowchart to each flagged candidate; merge into Refactoring.

### Phase Migrate AGENTS.md (conditional sub-flow)

Run only when `has_agents_md` is true; skip otherwise. The sub-flow consumes `file-evaluator`'s `AGENTS.md Block Classification` output and translates it into new `.cursor/rules/*.mdc` files. **Non-destructive: the original AGENTS.md is never modified or deleted.**

1. **Validate classification schema** (per `validation-criteria.md` § Migration Sub-Flow Output Schema) — on schema failure, surface errors and stop.
2. **Group blocks by destination** — `alwaysApply: true`, `globs:` (grouped by overlapping patterns), `description:` (grouped by topic), `discard`.
3. **Generate one new rule file per group** — pick the matching template from `assets/templates/`; fill with migrated block content; kebab-case `.mdc` filenames under `.cursor/rules/`.
4. **Apply only new rule creations** — never touch the original AGENTS.md or any pre-existing rule.
5. **Notify verbatim**: "Migration sub-flow complete. The original `AGENTS.md` file has been left intact by design. After validating that the new rules behave as expected, you must remove the original AGENTS.md manually (`rm AGENTS.md`) — this skill never deletes it."
6. **List discarded blocks** with their one-sentence reasons; user can override individual discards.

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

Read `references/improvement-card-template.md` and follow it exactly. Migration sub-flow writes new rule files; never touches original AGENTS.md.
