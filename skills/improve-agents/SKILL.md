---
name: improve-agents
description: "Evaluates and improves existing AGENTS.md files in projects. Identifies bloat, contradictions, stale references, and missing scopes — then applies progressive disclosure refactoring based on the ETH Zurich study and context engineering research."
---

# Improve AGENTS.md

Evaluate existing AGENTS.md files against evidence-based quality criteria and apply improvements to optimize context usage, reduce token waste, and improve agent performance.

## Why This Matters

The ETH Zurich study found that **unnecessary requirements in context files make tasks harder**. Every token in AGENTS.md is loaded on every request. Bloated files cause agents to:

- Spend more steps exploring (cost +20%)
- Follow irrelevant instructions that distract from the actual task
- Lose important instructions in the noise ("lost in the middle" effect)

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
- **NEVER** exceed 200 lines per file after improvements
- **PRESERVE** all genuinely useful instructions — only remove waste
- **SPLIT** bloated files into scope-specific files using progressive disclosure
- **VERIFY** that file path references in content still point to existing files
</RULES>

## Process

### Phase 1: Current State Analysis

Read `references/evaluation-criteria.md` for the complete scoring rubric, bloat indicators table, and staleness detection patterns. Use this to inform the evaluation and to understand the expected output format.

Read `references/file-evaluator.md` and follow its evaluation instructions to evaluate all AGENTS.md files in the project at the current working directory.

Check for:

1. Files over 200 lines
2. Bloat indicators (directory listings, obvious conventions, vague instructions)
3. Stale references (file paths that don't exist, commands that aren't in package.json)
4. Contradictions between files
5. Progressive disclosure opportunities (content that should be in separate files)
6. Missing scope-specific files

Build a structured assessment with specific line numbers and content for each issue.

### Phase 2: Codebase Comparison

Read `references/codebase-analyzer.md` and follow its codebase analysis instructions. Focus on:

1. Verifying that tooling commands documented in AGENTS.md files still work
2. Identifying scopes that have distinct tooling but lack their own AGENTS.md
3. Detecting new domain areas not covered by existing documentation

Return ONLY actionable findings.

### Phase 3: Generate Improvement Plan

Read these reference documents for improvement guidance:

- `references/progressive-disclosure-guide.md` — hierarchy decisions
- `references/what-not-to-include.md` — content exclusion criteria
- `references/context-optimization.md` — token budget guidelines
- `references/automation-migration-guide.md` — automation migration decision criteria

Based on both analyses, create an improvement plan. Categorize actions:

#### Removal Actions (highest priority — reduce token waste)

1. **Remove bloat**: Delete directory listings, obvious conventions, vague instructions
2. **Remove stale content**: Delete references to files/commands that no longer exist
3. **Remove duplicates**: Eliminate content duplicated across multiple files
4. **Resolve contradictions**: Pick the correct version and remove the conflicting one

#### Refactoring Actions (split bloated files)

1. **Extract scope-specific content** into subdirectory AGENTS.md files
2. **Extract domain content** into docs/TESTING.md, docs/BUILD.md, etc.
3. **Add progressive disclosure pointers** in root file to new split files
4. **Consolidate fragmented files** that cover the same scope
5. **Migrate automation candidates** — for each instruction flagged in Phase 1 as `HOOK_CANDIDATE`, `RULE_CANDIDATE`, or `SKILL_CANDIDATE`:
   - Classify using the decision flowchart in automation-migration-guide.md
   - Select target mechanism: path-scoped rule (file-pattern convention) or skill (domain knowledge/infrequent workflow)
   - Reclassify `HOOK_CANDIDATE` items: if the behavior is path-specific and under 50 lines → `RULE_CANDIDATE`; if it is a workflow or domain block → `SKILL_CANDIDATE`
   - Estimate token savings using the token impact estimation table in automation-migration-guide.md
   - This is the standalone distribution — suggest only skills and path-scoped rules. Do not suggest hooks or subagents (these require Claude Code). When automation-migration-guide.md references hooks or subagents, substitute with the closest available mechanism.
   - In calibrated mode (overall quality score ≥ 7 with no hard-limit violations), keep migration and extraction suggestions proportional to the confirmed issues. Do not create new files or migrations unless they resolve a failing criterion, and preserve non-issue sections in place.

#### Redundancy Elimination (delete what agents already know)

Apply the instruction test from what-not-to-include.md to each instruction in the evaluated files:

> "Would removing this cause the agent to make mistakes? If not, cut it."

1. **Delete agent-inferable content**: Standard conventions, obvious tooling, information discoverable from code — flagged as `DELETE_CANDIDATE` in Phase 1
2. **Delete vague/generic advice**: Instructions that cannot be verified or acted on
3. **Delete auto-enforced rules**: Formatting or linting rules already enforced by project tooling

For each deletion, document: the specific content being removed, WHY the agent doesn't need it (inference capability or tool enforcement), and the evidence source from what-not-to-include.md.

#### Addition Actions (lowest priority — only if genuinely missing)

1. **Add missing scope files** for detected scopes without configuration
2. **Add missing tooling commands** that the codebase-analyzer identified as non-standard
3. **Add progressive disclosure pointers** to existing documentation

When generating new or restructured files, use these templates for consistent structure:

- Root AGENTS.md: Read `assets/templates/root-agents-md.md`
- Scoped AGENTS.md (monorepo packages): Read `assets/templates/scoped-agents-md.md`
- Domain docs: Read `assets/templates/domain-doc.md`

### Phase 4: Self-Validation

Read `references/validation-criteria.md` and execute its **Validation Loop Instructions** against every improved or newly created file.

For improve operations, also evaluate the **"If This Is an IMPROVE Operation"** section in validation-criteria.md — checking information preservation, custom command retention, and progressive disclosure structure preservation.
In calibrated high-quality cases (overall quality score ≥ 7 and no hard limits), treat unrelated structural churn as a validation failure: if a change rewrites a non-issue section, adds extra files, or increases file count without fixing a documented criterion, revert and choose the smaller fix.

Maximum 3 iterations. Do not proceed to Phase 5 until ALL criteria pass.

### Phase 5: Present and Apply

1. Show a summary overview of all improvements found, grouped by category:
   - **Removals**: X items (bloat: X, stale: X, duplicates: X, contradictions: X)
   - **Refactoring**: X items (scope extraction: X, domain extraction: X, consolidation: X)
   - **Automation Migrations**: X items (rules: X, skills: X)
   - **Redundancy Eliminations**: X items
   - **Additions**: X items
2. Include a concise validation summary: iteration count, final root line count, file-count delta, and what each validation iteration fixed

3. For each suggestion, present a structured card in priority order (Removals → Refactoring → Automation Migrations → Redundancy Eliminations → Additions):

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

4. Apply ONLY the approved changes (options A or B selections):
   - Execute each approved change in dependency order
   - Verify after each change:
     - All files under 200 lines
     - No orphaned references

5. Report final metrics:
   - Total lines before → after
   - Files before → after
   - Estimated token savings
   - Suggestions applied: X of Y (Z deferred)
