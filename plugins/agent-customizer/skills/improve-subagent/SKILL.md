---
name: improve-subagent
description: "Evaluates and optimizes existing subagent definitions against evidence-based quality criteria from the docs corpus. Checks frontmatter, tool restrictions, and prompt quality. Use when improving an existing subagent."
---

# Improve Subagent

Evaluate an existing subagent definition against evidence-based quality criteria and apply improvements to tighten tool restrictions, fix model selection, and strengthen system prompts.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **ALWAYS** evaluate before modifying — never change subagents without analysis
- **ALWAYS** present changes to the user before applying them
- **NEVER** loosen tool restrictions without explicit rationale
- **NEVER** downgrade model without confirming the task doesn't require current model capabilities
- **NEVER** increase maxTurns beyond 20 without justification; never exceed 30 under any circumstances
- **PRESERVE** specialized domain knowledge in system prompts — only remove generic waste
</RULES>

## Process

### Preflight Check

Check if a subagent exists at:

- The user-provided path
- `.claude/agents/{name}.md`
- `plugins/*/agents/{name}.md`

**If no subagent found:**

1. Inform the user: "No subagent found at the specified path."
2. Suggest using `/agent-customizer:create-subagent` to create a new one instead.
3. **STOP**

**If subagent found:**
Proceed to Phase 1 below.

### Phase 1: Evaluate

Delegate to the `subagent-evaluator` agent with this task:

> Evaluate the subagent definition at `{target-path}`. Check YAML frontmatter validity, required fields (name, description, model, maxTurns), name format (lowercase+hyphens), model appropriateness for task, tool restriction (minimum-necessary principle), system prompt structure (role, process, output format, self-verification), and description specificity for routing. Return structured results with severity classifications (AUTO-FAIL/HIGH/MEDIUM/LOW).

- If the user provides a specific agent file → scope to that file.
- If no specific file → evaluate ALL agents in `.claude/agents/` and `plugins/*/agents/`.

The agent runs on Sonnet with read-only tools (Read, Grep, Glob, Bash) in an isolated context. Wait for it to complete and parse its structured output.

### Phase 2: Codebase Context

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand the context around subagent definitions. Focus on: all agents and their roles, which skills delegate to which agents, tool restrictions in use, model choices across agents, any agents with similar purposes (potential consolidation), and naming conventions.

Wait for it to complete and parse its structured output.

### Phase 3: Generate Improvement Plan

#### Phase 3a: Diagnose

Drop any references from Phases 1–2. Read these references:

- `${CLAUDE_SKILL_DIR}/references/subagent-authoring-guide.md` — when to use subagents, system prompt structure, model selection, tool restriction, anti-patterns
- `${CLAUDE_SKILL_DIR}/references/subagent-evaluation-criteria.md` — bloat/staleness indicators, quality rubric

Identify all issues from both agent reports: generic boilerplate, model mismatches, overtriggering, missing output format. Do not yet write the full improvement plan.

#### Phase 3b: Plan

Drop Phase 3a references. Read these references:

- `${CLAUDE_SKILL_DIR}/references/subagent-config-reference.md` — YAML frontmatter fields, model IDs, orchestration patterns, plugin restrictions
- `${CLAUDE_SKILL_DIR}/references/prompt-engineering-strategies.md` — subagent-specific prompting

Based on Phase 3a findings, create improvement plan with categories:

1. **Removals** — generic system prompt boilerplate, overtriggering language, redundant instructions
2. **Refactoring** — tighten tool list to minimum-necessary, fix model selection, add structured output format, improve description for routing specificity
3. **Additions** — missing self-verification section, missing explicit output format, missing constraints block

If all three categories yield zero items after analysis, conclude: "No improvements needed — artifact is already convention-compliant." and proceed directly to Phase 5 with an empty improvement summary.

### Phase 4: Self-Validation

Read `${CLAUDE_SKILL_DIR}/references/subagent-validation-criteria.md` and execute its **Validation Loop Instructions** against the improved subagent definition.

For improve operations, also evaluate the **"If This Is an IMPROVE Operation"** section. Maximum 3 iterations. Do not proceed to Phase 5 until ALL criteria pass.

### Phase 5: Present and Apply

1. Show a summary overview of all improvements found, grouped by category:
   - **Removals**: X items (generic boilerplate: X, overtriggering: X)
   - **Refactoring**: X items (tool restrictions: X, model: X, description: X, output format: X)
   - **Additions**: X items (self-verification: X, output format: X)

2. For each suggestion, present a structured card in priority order (Removals → Refactoring → Additions):

   **WHAT**: The specific content and its current location (file:lines)
   **WHY**: Evidence-based justification with source reference
   **TOKEN IMPACT**: Estimated tokens saved per invocation
   **OPTIONS**:
   - **Option A** (recommended): Primary action
   - **Option B**: Alternative action
   - **Option C**: Keep as-is

   Wait for the user to select an option for each suggestion before proceeding to the next.

   For tool restriction changes, show before/after tool lists.
   For model changes, cite the selection heuristic (haiku for exploration, sonnet for analysis, opus for complex reasoning).
   For system prompt rewrites, show diff of the prompt sections.
   Warn if the agent is referenced by skills — list which skills delegate to it.

3. After all suggestions are reviewed, show aggregate impact:
   - **System prompt lines**: before → after
   - **Tool count**: before → after
   - **Deferred suggestions**: X items kept as-is

4. Apply ONLY the approved changes.
   - Warn if plugin restrictions apply (no hooks/mcpServers/permissionMode in plugin agents).

5. Report final metrics:
   - Lines before → after
   - Tools before → after
   - Suggestions applied: X of Y (Z deferred)
