---
name: improve-subagent
description: 'Evaluates and optimizes existing Cursor subagent definitions: native frontmatter (name, description, model, readonly), prompt structure. Use when improving one.'
---

# Improve Subagent

Evaluate an existing Cursor subagent definition against evidence-based quality criteria and apply improvements to fix frontmatter, sharpen the routing description, and strengthen the system prompt.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **ALWAYS** evaluate before modifying — never change subagents without analysis.
- **ALWAYS** present changes to the user before applying them.
- **NEVER** loosen the `readonly` posture (true → false) without explicit user rationale.
- **NEVER** introduce a frontmatter key outside the four allowed: `name`, `description`, `model`, `readonly`.
- **NEVER** change the `model` value to anything other than `inherit`.
- **NEVER** broaden subagent scope (single-purpose subagents are better than general-purpose).
- **PRESERVE** specialized domain knowledge in system prompts — only remove generic boilerplate.
</RULES>

## Process

### Preflight Check

Check if a subagent exists at:

- The user-provided path
- `.cursor/agents/{name}.md`
- `plugins/*/agents/{name}.md`

**If no subagent found:**

1. Inform the user: "No subagent found at the specified path."
2. Suggest using `/cursor-customizer:create-subagent` to create a new one instead.
3. **STOP**

**If subagent found:**
Proceed to Phase 1 below.

### Phase 1: Evaluate

Delegate to the `subagent-evaluator` agent with this task:

> Evaluate the subagent definition at `{target-path}`. Check YAML frontmatter validity, the four-key contract (only `name`, `description`, `model`, `readonly` allowed; `model` must be `inherit`; `readonly` must be `true`), name format (kebab-case, ≤64 characters, distinct from every other project subagent), description specificity for routing (action-oriented, ≤1024 characters, includes a "Use when..." trigger), system prompt structure (role, constraints, process, output format, self-verification), and any instructions that tell the subagent to spawn other subagents (forbidden by project convention). Return structured results with severity classifications (AUTO-FAIL/HIGH/MEDIUM/LOW).

- If the user provides a specific subagent file → scope to that file.
- If no specific file → evaluate ALL subagents in `.cursor/agents/` and `plugins/*/agents/`.

The `subagent-evaluator` runs read-only with `model: inherit` in an isolated context. Wait for it to complete and parse its structured output.

### Phase 2: Project Context

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand the context around Cursor subagent definitions. Focus on: all subagents in `.cursor/agents/` and `plugins/*/agents/` (name, description, `model`, `readonly`), which skills delegate to which subagents, any subagents with similar purposes (potential consolidation), and naming conventions. Return the structured artifact-inventory output.

The `artifact-analyzer` runs read-only with `model: inherit` in an isolated context. Wait for it to complete and parse its structured output.

### Phase 3: Generate Improvement Plan

Read these reference documents:

- `references/subagent-authoring-guide.md` — when to use a subagent, system prompt structure, the four-key frontmatter contract, description-as-routing-signal, anti-patterns.
- `references/subagent-evaluation-criteria.md` — bloat / staleness indicators, quality rubric.
- `references/subagent-config-reference.md` — full Cursor-native frontmatter specification, model and readonly handling, orchestration patterns.
- `references/prompt-engineering-strategies.md` — subagent-specific prompting.

Based on the evaluator output and the reference documents, create an improvement plan with categories:

1. **Removals** — generic system prompt boilerplate, overtriggering language, redundant instructions, foreign-platform frontmatter keys.
2. **Refactoring** — fix `model` to `inherit`, fix `readonly` to `true`, sharpen description for routing specificity, restructure system prompt sections, tighten name to kebab-case.
3. **Additions** — missing self-verification section, missing explicit output format, missing constraints block.

If all three categories yield zero items after analysis, conclude: "No improvements needed — artifact is already convention-compliant." and proceed directly to Phase 5 with an empty improvement summary.

### Phase 4: Self-Validation

Read `references/subagent-validation-criteria.md` and execute its **Validation Loop Instructions** against the improved subagent definition.

For improve operations, also evaluate the **"If This Is an IMPROVE Operation"** section. Maximum 3 iterations. Do not proceed to Phase 5 until ALL criteria pass.

### Phase 5: Present and Apply

1. Show a summary overview of all improvements found, grouped by category:
   - **Removals**: X items (foreign frontmatter keys: X, generic boilerplate: X, overtriggering: X)
   - **Refactoring**: X items (model fix: X, readonly fix: X, description: X, prompt structure: X)
   - **Additions**: X items (self-verification: X, output format: X, constraints block: X)

2. For each suggestion, present a structured card in priority order (Removals → Refactoring → Additions):

   **WHAT**: The specific content and its current location (file:lines).
   **WHY**: Evidence-based justification with source reference.
   **TOKEN IMPACT**: Estimated tokens saved per invocation.
   **OPTIONS**:
   - **Option A** (recommended): Primary action.
   - **Option B**: Alternative action.
   - **Option C**: Keep as-is.

   Wait for the user to select an option for each suggestion before proceeding to the next.

   For frontmatter changes, show before/after frontmatter blocks.
   For description rewrites, show before/after with the routing signal highlighted.
   For system prompt rewrites, show diff of the prompt sections.
   Warn if the subagent is referenced by skills — list which skills delegate to it.

3. After all suggestions are reviewed, show aggregate impact:
   - **System prompt lines**: before → after.
   - **Frontmatter keys**: before → after (must converge to the four allowed keys).
   - **Deferred suggestions**: X items kept as-is.

4. Apply ONLY the approved changes.
   - Refuse any approval that would introduce a frontmatter key outside the allowed four, or change `model` away from `inherit`. Surface the conflict to the user and offer to translate into a Cursor-native form.

5. Report final metrics:
   - Lines before → after.
   - Frontmatter keys before → after.
   - Suggestions applied: X of Y (Z deferred).
