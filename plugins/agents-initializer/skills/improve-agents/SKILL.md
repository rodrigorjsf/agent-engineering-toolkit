---
name: improve-agents
description: "Evaluates and improves existing AGENTS.md files in projects. Identifies bloat, contradictions, stale references, and missing scopes — then applies progressive disclosure refactoring based on the ETH Zurich study and context engineering research."
---

# Improve AGENTS.md

Evaluate existing AGENTS.md files against evidence-based criteria and apply improvements. ETH Zurich (Feb 2026): bloated files reduce success ~3% and increase cost ~20% — operative rubric is the Deletion Test in `evaluation-criteria.md`.

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
- **SPLIT** bloated files into scope-specific files using progressive disclosure
- **VERIFY** that file path references in content still point to existing files
</RULES>

## Process

### Phase 1: Current State Analysis

Read `${CLAUDE_SKILL_DIR}/references/evaluation-criteria.md` for the scoring rubric, bloat indicators, staleness detection, and Deletion Test.

Delegate to the `file-evaluator` agent:

> Evaluate all AGENTS.md files at the current working directory. Check files >200 lines, bloat indicators, stale references, contradictions, progressive disclosure opportunities, and missing scope-specific files. Return a structured assessment with line numbers and content per issue. Flag automation candidates as `HOOK_CANDIDATE`, `RULE_CANDIDATE`, `SKILL_CANDIDATE`, or `SUBAGENT_CANDIDATE`.

The agent runs on Sonnet with read-only tools in an isolated context. Wait for it and parse the structured output.

### Phase 2: Codebase Comparison

Delegate to the `codebase-analyzer` agent:

> Analyze the project at the current working directory. Verify tooling commands in AGENTS.md still work; identify scopes with distinct tooling but lacking AGENTS.md; detect new domain areas not covered. Return ONLY actionable findings.

Wait for it and parse the structured output.

### Phase 3: Generate Improvement Plan

#### Phase 3a: Content Decisions

Drop any references from Phases 1–2. Read these references:

- `${CLAUDE_SKILL_DIR}/references/progressive-disclosure-guide.md` — hierarchy decisions
- `${CLAUDE_SKILL_DIR}/references/what-not-to-include.md` — exclusion criteria + Deletion Test wording

Identify all **Removals** (bloat / stale / duplicates / contradictions) and **Redundancy Eliminations** (apply the Deletion Test to each instruction; document content removed and the cited evidence source).

#### Phase 3b: Budget and Additions

Drop Phase 3a references. Read this reference:

- `${CLAUDE_SKILL_DIR}/references/context-optimization.md` — token budget guidelines

Plan **Refactoring** (scope extraction / domain extraction / consolidation) and **Additions** (only when genuinely missing). Use templates: `root-agents-md.md`, `scoped-agents-md.md`, `domain-doc.md`, `claude-rule.md`, `skill.md`, `hook-config.md` (all under `${CLAUDE_SKILL_DIR}/assets/templates/`). In calibrated mode (overall score ≥ 7, no hard-limit violations), keep suggestions proportional to confirmed issues — no speculative restructure or new files.

#### Phase 3c: Automation Migration

Drop Phase 3b references. Read these references:

- `${CLAUDE_SKILL_DIR}/references/automation-mechanism-comparison.md` — mechanism selection (always)
- `${CLAUDE_SKILL_DIR}/references/automation-token-impact.md` — only when Phase 1 returned automation candidates

Apply the decision flowchart in `automation-mechanism-comparison.md` to each flagged candidate. Merge into the Refactoring category. Skip `automation-token-impact.md` if Phase 1 returned no automation candidates.

### Phase 4: Self-Validation

Read `${CLAUDE_SKILL_DIR}/references/validation-criteria.md` and execute its **Validation Loop Instructions** against every improved or newly created file. Apply the **"If This Is an IMPROVE Operation"** section (information preservation, custom-command retention, structure preserved). In calibrated high-quality cases (score ≥ 7, no hard limits), treat unrelated structural churn as a validation failure — revert and choose the smaller fix. Maximum 3 iterations.

### Phase 5: Present and Apply

Read `${CLAUDE_SKILL_DIR}/references/improvement-card-template.md` and follow it exactly.
