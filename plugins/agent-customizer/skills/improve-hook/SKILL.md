---
name: improve-hook
description: "Evaluates and optimizes existing hook configurations against evidence-based quality criteria from the docs corpus. Checks event types, schema compliance, and security. Use when improving an existing hook."
---

# Improve Hook

Evaluate existing hook configurations against evidence-based quality criteria and apply improvements to fix invalid events, tighten matchers, and eliminate security issues.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **ALWAYS** evaluate before modifying — never change hooks without analysis
- **ALWAYS** present changes to the user before applying them
- **NEVER** weaken existing blocking behavior (exit 2 → exit 0) without explicit user approval
- **NEVER** broaden matchers unintentionally (specific regex → `"*"`)
- **NEVER** remove valid hooks while fixing structure
- **EVERY** improved hook must produce valid JSON
</RULES>

## Process

### Preflight Check

Check if hooks exist in:

- The user-provided path (if given)
- `.claude/settings.json` (hooks key)
- `.claude/settings.local.json` (hooks key)
- Plugin `hooks/hooks.json`

**If no hooks found:**

1. Inform the user: "No hook configurations found in the project."
2. Suggest using `/agent-customizer:create-hook` to create a new one instead.
3. **STOP**

**If hooks found:**
Proceed to Phase 1 below.

### Phase 1: Evaluate

Delegate to the `hook-evaluator` agent with this task:

> Evaluate hook configurations in `.claude/settings.json`, `.claude/settings.local.json`, and plugin `hooks/hooks.json`. Check JSON validity, event names against the 22-event list, handler types, matcher specificity, exit code behavior, command script existence, and security (no hardcoded secrets). For `command` handlers, read the referenced script files (relative to project root) to verify exit code handling. Flag any script that always exits 0 (has no non-zero exit path) and lacks an explicit comment documenting that always-exit-0 is intentional — for PostToolUse hooks, always-exit-0 is acceptable only when explicitly documented (e.g., "# exit 0 intentional: PostToolUse is non-blocking"); for PreToolUse hooks, always-exit-0 is never acceptable. Return structured results with severity classifications (AUTO-FAIL/HIGH/MEDIUM/LOW).

- If the user provides a specific event/matcher to improve, scope evaluation to that hook.
- If no specific hook provided, evaluate ALL hooks in the project.
- If any hook file is malformed JSON, report the parse error to the user and stop — do not attempt to evaluate a broken file.

The agent runs on Sonnet with read-only tools (Read, Grep, Glob, Bash) in an isolated context. Wait for it to complete and parse its structured output.

### Phase 2: Codebase Context

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand the context around hook configurations. Focus on: all hooks defined in `.claude/settings.json`, `.claude/settings.local.json`, and `hooks/hooks.json`; project hook scripts in `.claude/hooks/`; plugin hook scripts in `scripts/`; event coverage gaps; and the matcher patterns already used in the project.

Wait for it to complete and parse its structured output.

### Phase 3: Generate Improvement Plan

#### Phase 3a: Diagnose

Drop any references from Phases 1–2. Read these references:

- `${CLAUDE_SKILL_DIR}/references/hook-authoring-guide.md` — when to use hooks, 4 handler types, exit codes, security
- `${CLAUDE_SKILL_DIR}/references/hook-evaluation-criteria.md` — bloat/staleness indicators, quality rubric

Identify all issues from both agent reports: invalid events, redundant hooks, exit code misuse, security problems. Do not yet write the full improvement plan.

#### Phase 3b: Plan

Drop Phase 3a references. Read these references:

- `${CLAUDE_SKILL_DIR}/references/hook-events-reference.md` — all 22 events, matchers, JSON schema
- `${CLAUDE_SKILL_DIR}/references/prompt-engineering-strategies.md` — hook-specific prompting

Based on Phase 3a findings, create improvement plan with categories:

1. **Removals** — invalid events, redundant hooks, observation-only hooks replaceable by rules
2. **Refactoring** — tighten overly broad matchers, fix exit code misuse, correct script paths
3. **Additions** — missing error handling, missing events for key tool use patterns

If all three categories yield zero items after analysis, conclude: "No improvements needed — artifact is already convention-compliant." and proceed directly to Phase 5 with an empty improvement summary.

### Phase 4: Self-Validation

Read `${CLAUDE_SKILL_DIR}/references/hook-validation-criteria.md` and execute its **Validation Loop Instructions** against the improved hook configurations.

For improve operations, also evaluate the **"If This Is an IMPROVE Operation"** section. Maximum 3 iterations. Do not proceed to Phase 5 until ALL criteria pass. Additionally, verify that every suggestion in the improvement plan has a WHY field citing a source document — no suggestion may lack a source reference.

### Phase 5: Present and Apply

1. Show a summary overview of all improvements found, grouped by category:
   - **Removals**: X items (invalid events: X, redundant: X)
   - **Refactoring**: X items (matchers: X, exit codes: X, script paths: X)
   - **Additions**: X items

2. For each suggestion, present a structured card in priority order (Removals → Refactoring → Additions):

   **WHAT**: The specific hook entry and its current location (file:key path)
   **WHY**: Evidence-based justification with source reference
   **TOKEN IMPACT**: Estimated impact (hooks fire on tool use — broad matchers run on every tool call)
   **OPTIONS**:
   - **Option A** (recommended): Primary action
   - **Option B**: Alternative action
   - **Option C**: Keep as-is

   Wait for the user to select an option for each suggestion before proceeding to the next.
   Warn if any option would weaken blocking behavior (exit 2 → exit 0).

3. After all suggestions are reviewed:
   - Show the complete merged JSON after all approved changes (not just diff)
   - For hook script changes, show the script diff
   - Show aggregate impact summary

4. Apply ONLY the approved changes.
   - Always read current state before writing — never overwrite; merge changes.

5. Report final metrics:
   - Hooks before → after
   - Security issues resolved
   - Suggestions applied: X of Y (Z deferred)
