---
name: improve-rule
description: "Evaluates and optimizes existing .claude/rules/ files against evidence-based quality criteria from the docs corpus. Checks path scoping, specificity, and overlap. Use when improving an existing rule."
---

# Improve Rule

Evaluate existing `.claude/rules/` files against evidence-based quality criteria and apply improvements to fix line limits, tighten glob patterns, and resolve cross-file contradictions.

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
- **NEVER** broaden path scope without rationale (specific glob → `**/*`)
- **NEVER** delete rules that apply to real scenarios
- **NEVER** exceed 50 lines after improvements
- **NEVER** leave a rule without `paths:` frontmatter after improvements
- **PRESERVE** project-specific custom instructions — only remove generic waste
</RULES>

## Process

### Preflight Check

Check if rule files exist at:

- The user-provided path (if given)
- Any `.md` file anywhere under `.claude/rules/`

**If no rule files found:**

1. Inform the user: "No rule files found at `.claude/rules/`."
2. Suggest using `/agent-customizer:create-rule` to create a new one instead.
3. **STOP**

**If rule files found:**
Proceed to Phase 1 below.

### Phase 1: Evaluate

Delegate to the `rule-evaluator` agent with this task:

> Evaluate rule files in `.claude/rules/`. Check line counts against the 50-line limit, YAML frontmatter validity, missing `paths:` frontmatter as a defect, glob pattern specificity, instruction actionability, one-scope-per-file adherence, and cross-file contradictions/overlaps. Return structured results with severity classifications (AUTO-FAIL/HIGH/MEDIUM/LOW).

- If the user provides a specific rule file → scope to that file (still cross-check others for conflicts).
- If no specific file → evaluate ALL `.md` rule files under `.claude/rules/` recursively.

The agent runs on Sonnet with read-only tools (Read, Grep, Glob, Bash) in an isolated context. Wait for it to complete and parse its structured output.

### Phase 2: Codebase Context

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand the context around rule files. Focus on: all rule files and their topics, glob patterns in use, overlaps between rules, whether glob patterns still match existing files (stale patterns), and conventions in CLAUDE.md that overlap with rules.

Wait for it to complete and parse its structured output.

### Phase 3: Generate Improvement Plan

#### Phase 3a: Diagnose

Drop any references from Phases 1–2. Read these references:

- `${CLAUDE_SKILL_DIR}/references/rule-authoring-guide.md` — when to use rules, path-scoping, glob syntax, anti-patterns
- `${CLAUDE_SKILL_DIR}/references/rule-evaluation-criteria.md` — bloat/staleness indicators, quality rubric

Identify all issues from both agent reports: bloat, stale patterns, missing path-scoping, contradictions. Do not yet write the full improvement plan.

#### Phase 3b: Plan

Drop Phase 3a references. Read this reference:

- `${CLAUDE_SKILL_DIR}/references/prompt-engineering-strategies.md` — rule-specific prompting (zero-shot only)

Based on Phase 3a findings, create improvement plan with categories:

1. **Removals** — bloat (instructions Claude already knows), stale patterns (globs matching no files), duplicates with other rules
2. **Refactoring** — split oversized files, add path-scoping frontmatter, tighten glob patterns, resolve contradictions
3. **Additions** — missing path-scoping for rules that only apply to specific files

If all three categories yield zero items after analysis, conclude: "No improvements needed — artifact is already convention-compliant." and proceed directly to Phase 5 with an empty improvement summary.

### Phase 4: Self-Validation

Read `${CLAUDE_SKILL_DIR}/references/rule-validation-criteria.md` and execute its **Validation Loop Instructions** against the improved rule files.

For improve operations, also evaluate the **"If This Is an IMPROVE Operation"** section. Maximum 3 iterations. Do not proceed to Phase 5 until ALL criteria pass. Additionally, verify that every suggestion in the improvement plan has a WHY field citing a source document — no suggestion may lack a source reference.

### Phase 5: Present and Apply

1. Show a summary overview of all improvements found, grouped by category:
   - **Removals**: X items (bloat: X, stale: X, duplicates: X, contradictions resolved: X)
   - **Refactoring**: X items (splits: X, path-scoping: X, glob tightening: X)
   - **Additions**: X items

2. For each suggestion, present a structured card in priority order (Removals → Refactoring → Additions):

   **WHAT**: The specific content and its current location (file:lines)
   **WHY**: Evidence-based justification with source reference
   **TOKEN IMPACT**: Estimated impact from removing waste or narrowing rule scope so it loads in fewer contexts
   **OPTIONS**:
   - **Option A** (recommended): Primary action
   - **Option B**: Alternative action
   - **Option C**: Keep as-is

   Wait for the user to select an option for each suggestion before proceeding to the next.

   For rule splits, show both the reduced original and the new split file.
   For path-scoping additions, show the glob pattern and which files it matches.
   For contradiction resolution, show both conflicting rules side-by-side.

3. After all suggestions are reviewed, show aggregate impact:
   - **Files missing `paths:`**: before → after
   - **Rules**: before → after
   - **Deferred suggestions**: X items kept as-is

4. Apply ONLY the approved changes.

5. Report final metrics:
   - Total lines before → after
   - Files missing `paths:` before → after
   - Files affected
   - Suggestions applied: X of Y (Z deferred)
