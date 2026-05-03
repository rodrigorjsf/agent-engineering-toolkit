---
name: improve-claude
description: "Evaluates and improves existing CLAUDE.md files and .claude/rules/ in projects. Identifies bloat, contradictions, stale references, and missing scopes — then applies progressive disclosure refactoring using Claude Code's full configuration system."
---

# Improve CLAUDE.md

Evaluate existing CLAUDE.md and `.claude/rules/` and apply improvements. ETH Zurich (Feb 2026): bloated files reduce success ~3% and increase cost ~20% — operative rubric is the Deletion Test in `evaluation-criteria.md`.

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
- **NEVER** exceed 200 lines per file after improvements
- **PRESERVE** all genuinely useful instructions — only remove waste
- **SPLIT** bloated files via Claude Code hierarchy (subdir CLAUDE.md, .claude/rules/, domain files)
- **VERIFY** that file path references still point to existing files
- **CONVERT** behavioral rules to path-scoped `.claude/rules/` when they only apply to specific file patterns
- **MAXIMIZE** on-demand loading; minimize always-loaded content
- **ROOT TARGET: 15-40 lines** — one-sentence description, non-standard tooling, import boundaries, pointers; everything else on-demand
</RULES>

## Process

### Phase 1: Current State Analysis

Read `${CLAUDE_SKILL_DIR}/references/evaluation-criteria.md` for scoring rubric, bloat/staleness indicators, and Deletion Test.

Delegate to `file-evaluator`:

> Evaluate all CLAUDE.md and `.claude/rules/` files at CWD. Check >200 lines; bloat; stale references; contradictions; progressive-disclosure opportunities (content for separate files or path-scoped rules); missing scope-specific files; rules lacking path-scoping; root-CLAUDE.md content applying only to specific file patterns. Return structured assessment with line numbers. Flag automation candidates as `HOOK_CANDIDATE`, `RULE_CANDIDATE`, `SKILL_CANDIDATE`, or `SUBAGENT_CANDIDATE`.

Sonnet, read-only, isolated context. Wait and parse output.

### Phase 2: Codebase Comparison

Delegate to `codebase-analyzer`:

> Analyze the project. Verify tooling commands in CLAUDE.md still work; identify scopes with distinct tooling lacking CLAUDE.md (including library/shared packages with unique constraints — zero-dep, dual exports, conditional imports, server-only markers); detect file patterns with non-obvious conventions lacking path-scoped `.claude/rules/` (convention AND domain-critical — privacy/security/compliance); detect new domain areas not covered. Return ONLY actionable findings.

Wait and parse output.

### Phase 3: Generate Improvement Plan

Read these references:

- `${CLAUDE_SKILL_DIR}/references/progressive-disclosure-guide.md` — hierarchy decisions
- `${CLAUDE_SKILL_DIR}/references/what-not-to-include.md` — exclusion criteria + Deletion Test
- `${CLAUDE_SKILL_DIR}/references/context-optimization.md` — token budget guidelines
- `${CLAUDE_SKILL_DIR}/references/claude-rules-system.md` — `.claude/rules/` conventions and path-scoping
- `${CLAUDE_SKILL_DIR}/references/automation-mechanism-comparison.md` — mechanism selection (always)
- `${CLAUDE_SKILL_DIR}/references/automation-token-impact.md` — only when Phase 1 flagged automation candidates

Categorize per references: **Removals** (bloat / stale / duplicates / contradictions); **Refactoring** (scope/rule/domain extraction / consolidation / add path-scoping where lacking / automation migration via `automation-mechanism-comparison.md` flowchart — prefer path-scoped rule over hook for concise file-pattern formatting in a high-quality file unless deterministic enforcement is required); **Redundancy Eliminations** (Deletion Test; cite evidence per deletion); **Additions** (only when genuinely missing — scope files including library/shared packages; non-standard tooling; convention/domain-critical rules path-scoped).

In calibrated mode (score ≥ 7, no hard-limit violations), keep suggestions proportional to confirmed issues.

Templates under `${CLAUDE_SKILL_DIR}/assets/templates/`: `root-claude-md.md`, `scoped-claude-md.md`, `claude-rule.md`, `domain-doc.md`, `skill.md`, `hook-config.md`.

### Phase 4: Self-Validation

Read `${CLAUDE_SKILL_DIR}/references/validation-criteria.md` and execute its **Validation Loop Instructions** against every improved or newly created file. Apply the **IMPROVE** section and CLAUDE.md-specific Structural Checks (path-scoping, minimal always-loaded content). In calibrated high-quality cases, treat unrelated structural churn as failure — revert and choose the smaller fix. Maximum 3 iterations.

### Phase 5: Present and Apply

Follow `${CLAUDE_SKILL_DIR}/references/improvement-card-template.md` exactly.
