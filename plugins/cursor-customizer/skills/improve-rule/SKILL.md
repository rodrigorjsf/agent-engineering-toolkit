---
name: improve-rule
description: 'Evaluates and optimizes a single `.cursor/rules/*.mdc` file: frontmatter validity, activation mode, glob specificity, overlaps. Use when improving an existing rule.'
---

# Improve Rule

Evaluate an existing `.cursor/rules/*.mdc` file against evidence-based quality criteria and apply improvements to fix the 200-line limit, repair frontmatter, realign activation mode, tighten globs, and resolve cross-file contradictions.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **ALWAYS** evaluate before modifying — never change rules without analysis
- **ALWAYS** present changes to the user before applying them
- **NEVER** broaden glob scope without rationale (specific glob → `**/*`)
- **NEVER** weaken activation mode (auto-attached → manual) without rationale
- **NEVER** delete rules that apply to real scenarios
- **NEVER** exceed 200 lines after improvements
- **NEVER** introduce a `paths` frontmatter key — `description`, `alwaysApply`, `globs` are the only valid keys
- **PRESERVE** project-specific custom instructions — only remove generic waste
</RULES>

## Process

### Preflight Check

Check if rule files exist at:

- The user-provided path (if given)
- Any `.mdc` or `.md` file under `.cursor/rules/`

**If no rule files found:**

1. Inform the user: "No rule files found at `.cursor/rules/`."
2. Suggest using `/cursor-customizer:create-rule` to create a new one instead.
3. **STOP**

**If rule files found:**
Proceed to Phase 1 below.

### Phase 1: Evaluate

Delegate to the `rule-evaluator` agent with this task:

> Evaluate rule files in `.cursor/rules/`. Check line counts against the 200-line limit, YAML frontmatter validity, frontmatter-field whitelist (`description`, `alwaysApply`, `globs` only), the absence of any `paths` frontmatter key, activation-mode well-formedness, glob specificity, instruction actionability, one-concern-per-file adherence, and cross-file contradictions / overlaps. Return structured results with severity classifications (AUTO-FAIL/HIGH/MEDIUM/LOW).

- If the user provides a specific rule file → scope to that file (still cross-check others for conflicts).
- If no specific file → evaluate ALL `.mdc` and `.md` rule files under `.cursor/rules/` recursively.

The agent runs in an isolated context with read-only access. Wait for it to complete and parse its structured output.

### Phase 2: Project Context

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand the context around rule files. Focus on: all rule files and their topics, activation modes in use, glob patterns in use, overlaps between rules, whether globs still match existing files (stale patterns), and conventions in any present `AGENTS.md` files that overlap with rules.

Wait for it to complete and parse its structured output.

### Phase 3: Generate Improvement Plan

Read these reference documents:

- `references/rule-authoring-guide.md` — when to use rules, frontmatter contract, the four activation modes, glob syntax, anti-patterns
- `references/rule-evaluation-criteria.md` — bloat / staleness indicators, activation-mode appropriateness, quality rubric
- `references/prompt-engineering-strategies.md` — rule-specific prompting (zero-shot only)

Based on both agent reports, create an improvement plan with categories:

1. **Removals** — bloat (instructions the agent already knows), stale globs / `@`-references (matching no files), duplicates with other rules
2. **Refactoring** — split oversized files, fix frontmatter (remove invalid keys, repair activation-mode field set), tighten globs, demote always-apply to a more appropriate activation mode, resolve contradictions
3. **Additions** — missing activation-mode frontmatter for rules that need it; missing glob scoping for rules that should be auto-attached

If all three categories yield zero items after analysis, conclude: "No improvements needed — rule is already convention-compliant." and proceed directly to Phase 5 with an empty improvement summary.

### Phase 4: Self-Validation

Read `references/rule-validation-criteria.md` and execute its **Validation Loop Instructions** against the improved rule files.

For improve operations, also evaluate the **"If This Is an IMPROVE Operation"** section. Failed checks re-enter Phase 3's plan-generation step with the failures as new constraints. Maximum 3 iterations. Do not proceed to Phase 5 until ALL criteria pass. Additionally, verify that every suggestion in the improvement plan has a WHY field citing a source document — no suggestion may lack a source reference.

### Phase 5: Present and Apply

1. Show a summary overview of all improvements found, grouped by category:
   - **Removals**: X items (bloat: X, stale: X, duplicates: X, contradictions resolved: X)
   - **Refactoring**: X items (splits: X, frontmatter fixes: X, activation-mode realignments: X, glob tightening: X)
   - **Additions**: X items

2. For each suggestion, present a structured card in priority order (Removals → Refactoring → Additions):

   **WHAT**: The specific content and its current location (file:lines)
   **WHY**: Evidence-based justification with source reference
   **TOKEN IMPACT**: Estimated impact from removing waste, tightening scope, or demoting always-apply so the rule loads in fewer contexts
   **OPTIONS**:
   - **Option A** (recommended): Primary action
   - **Option B**: Alternative action
   - **Option C**: Keep as-is

   Wait for the user to select an option for each suggestion before proceeding to the next.

   For rule splits, show both the reduced original and the new split file.
   For activation-mode realignments, show the before/after frontmatter and explain which content nature drove the choice.
   For contradiction resolution, show both conflicting rules side-by-side.

3. After all suggestions are reviewed, show aggregate impact:
   - **Files with invalid frontmatter**: before → after
   - **Always-apply rule lines**: before → after
   - **Rules**: before → after
   - **Deferred suggestions**: X items kept as-is

4. Apply ONLY the approved changes. When changing activation mode, select the matching template from `assets/templates/cursor-rule-{always,globs,description}.mdc` to preserve frontmatter shape.

5. Report final metrics:
   - Total lines before → after
   - Files with invalid frontmatter before → after
   - Files affected
   - Suggestions applied: X of Y (Z deferred)
