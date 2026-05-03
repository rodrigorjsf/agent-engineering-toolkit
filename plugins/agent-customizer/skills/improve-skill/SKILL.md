---
name: improve-skill
description: "Evaluates and optimizes existing SKILL.md files against evidence-based quality criteria from the docs corpus. Identifies bloat, staleness, and missed best practices. Use when improving an existing skill."
---

# Improve Skill

Evaluate an existing SKILL.md file against evidence-based quality criteria and apply improvements to optimize token usage, reduce bloat, and align with proven patterns.

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
- **NEVER** remove evidence-grounded references or citations
- **NEVER** flatten progressive disclosure into inline content
- **NEVER** exceed 500 lines in SKILL.md or 200 lines in reference files after improvements
- **PRESERVE** all genuinely useful skill phases and instructions — only remove waste
- **PRESERVE** or strengthen the ethical constraint: persuasion cues support legitimate work only, never safety bypass
</RULES>

## Process

### Preflight Check

Check if a skill exists at:

- The user-provided path
- `.claude/skills/{name}/SKILL.md`
- `plugins/*/skills/{name}/SKILL.md`

**If no skill found:**

1. Inform the user: "No skill found at the specified path."
2. Suggest using `/agent-customizer:create-skill` to create a new one instead.
3. **STOP**

**If skill found:**
Proceed to Phase 1 below.

### Phase 1: Evaluate

Delegate to the `skill-evaluator` agent with this task:

> Evaluate the skill at `{target-path}`. Read the SKILL.md and all files in the skill directory. Check hard limits (body ≤500 lines, references ≤200 lines, frontmatter valid), structural quality (progressive disclosure, phase structure, reference loading), and token efficiency. Return structured evaluation results with severity classifications (AUTO-FAIL/HIGH/MEDIUM/LOW) and quality scores per dimension.

The agent runs on Sonnet with read-only tools (Read, Grep, Glob, Bash) in an isolated context. Wait for it to complete and parse its structured output.

### Phase 2: Codebase Context

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand the context around the skill being improved. Focus on: which agents the skill delegates to and whether those agents still exist, naming conventions for similar skills, any other skills that overlap in purpose, and the plugin structure.

Wait for it to complete and parse its structured output.

### Phase 3: Generate Improvement Plan

#### Phase 3a: Diagnose

Drop Phases 1–2 references. Read:

- `${CLAUDE_SKILL_DIR}/references/skill-authoring-guide.md` — core principles, structure, progressive disclosure, anti-patterns
- `${CLAUDE_SKILL_DIR}/references/skill-evaluation-criteria.md` — bloat/staleness indicators, quality rubric

Identify issues from both agent reports. Do not write the plan yet.

#### Phase 3b: Plan

Drop Phase 3a references. Read:

- `${CLAUDE_SKILL_DIR}/references/behavioral-guidelines.md` — Karpathy-aligned behavior and safe persuasion patterns for skills
- `${CLAUDE_SKILL_DIR}/references/prompt-engineering-strategies.md` — skill-specific prompting strategies

Create improvement plan: **Removals** (bloat: inlined content, over-specified instructions; stale: broken agent refs, removed tools; duplicates); **Refactoring** (progressive disclosure, phase consolidation, reference paths); **Additions** (missing sections — suggest Hard Rules/Preflight only for user-facing skills, not analysis-only). If all categories yield zero items, conclude "No improvements needed" and proceed to Phase 5.

### Phase 4: Self-Validation

Read `${CLAUDE_SKILL_DIR}/references/skill-validation-criteria.md` and execute its **Validation Loop Instructions** against the improved skill.

For improve operations, also evaluate the **"If This Is an IMPROVE Operation"** section. Maximum 3 iterations. Do not proceed to Phase 5 until ALL criteria pass.

### Phase 5: Present and Apply

1. Show a summary overview of all improvements found, grouped by category:
   - **Removals**: X items (bloat: X, stale: X, duplicates: X)
   - **Refactoring**: X items (progressive disclosure: X, phase structure: X, reference paths: X)
   - **Additions**: X items

2. For each suggestion, present a structured card in priority order (Removals → Refactoring → Additions):

   **WHAT**: The specific content and its current location (file:lines)
   **WHY**: Evidence-based justification with source reference
   **TOKEN IMPACT**: Estimated tokens saved from always-loaded context
   **OPTIONS**:
   - **Option A** (recommended): Primary action
   - **Option B**: Alternative action
   - **Option C**: Keep as-is — "Preserve in current location. Trade-off: continues consuming ~X tokens per session"

   Wait for the user to select an option for each suggestion before proceeding to the next.
   If the user selects "Keep as-is", preserve the content in its exact current location.

3. After all suggestions are reviewed, show aggregate token impact analysis:
   - **Total lines**: before → after
   - **Removed tokens**: total waste eliminated
   - **Deferred suggestions**: X items kept as-is

4. Apply ONLY the approved changes (options A or B selections).

5. Report final metrics:
   - Lines before → after
   - Files affected
   - Estimated token savings per session
   - Suggestions applied: X of Y (Z deferred)
