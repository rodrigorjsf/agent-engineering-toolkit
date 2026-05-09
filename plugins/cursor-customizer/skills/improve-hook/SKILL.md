---
name: improve-hook
description: 'Evaluates and optimizes existing Cursor hook configs: native events, matcher specificity, exit-code handling, security. Use when improving an existing hook.'
---

# Improve Hook

Evaluate existing Cursor hook configurations against evidence-based quality criteria and apply improvements to fix invalid event names, tighten matchers, and eliminate security gaps.

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
- **NEVER** weaken existing blocking behavior (exit `2` → exit `0`; `failClosed: true` → `false`) without explicit user approval
- **NEVER** broaden matchers unintentionally (specific regex → permissive regex or omitted matcher)
- **NEVER** remove valid hooks while fixing structure
- **EVERY** improved hook must produce valid JSON and use only Cursor-native event names from `references/hook-events-reference.md`
</RULES>

## Process

### Preflight Check

Check whether hooks exist in:

- The user-provided path (if given)
- `<project-root>/.cursor/hooks.json` (project scope)
- `~/.cursor/hooks.json` (user scope)

**If no hooks found:**

1. Inform the user: "No hook configurations found in the project."
2. Suggest using `/cursor-customizer:create-hook` to create a new one instead.
3. **STOP**

**If hooks found:**
Proceed to Phase 1 below.

### Phase 1: Evaluate

Delegate to the `hook-evaluator` agent with this task:

> Evaluate hook configurations in `<project-root>/.cursor/hooks.json` and (when accessible) `~/.cursor/hooks.json`. Check JSON validity, event names against the Cursor-native event vocabulary, handler types (`command` or `prompt`), matcher specificity, matcher applicability per event, exit-code behavior, command-script existence and plausibility, and security gaps. For `command` handlers, read the referenced script files (resolved relative to the configuration scope's working directory: project root for project hooks, `~/.cursor/` for user hooks) to verify exit-code handling. Flag any script that always exits 0 (has no non-zero exit path) and lacks an explicit comment documenting that always-exit-0 is intentional — for `afterFileEdit`, `afterShellExecution`, `afterMCPExecution`, `postToolUse`, `postToolUseFailure`, and other observation-only events, always-exit-0 is acceptable only when explicitly documented; for blocking events (`preToolUse`, `beforeShellExecution`, `beforeMCPExecution`, `beforeReadFile`, `beforeSubmitPrompt`, `subagentStart`), always-exit-0 is never acceptable. Return structured results with severity classifications (AUTO-FAIL/HIGH/MEDIUM/LOW).

- If the user provides a specific event/matcher to improve, scope evaluation to that hook.
- If no specific hook provided, evaluate ALL hooks in the project.
- If any hook file is malformed JSON, report the parse error to the user and stop — do not attempt to evaluate a broken file.

The agent runs read-only with `model: inherit` in an isolated context. Wait for it to complete and parse its structured output.

### Phase 2: Codebase Context

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand the context around hook configurations. Focus on: all hooks defined in `<project-root>/.cursor/hooks.json` and `~/.cursor/hooks.json` (when accessible); project hook scripts under `.cursor/hooks/`; user hook scripts under `~/.cursor/hooks/`; event coverage gaps; and the matcher patterns already used in the project.

Wait for it to complete and parse its structured output.

### Phase 3: Generate Improvement Plan

Read these reference documents:

- `references/hook-authoring-guide.md` — when to use hooks, two handler types, exit codes, security
- `references/hook-evaluation-criteria.md` — bloat / staleness indicators, quality rubric
- `references/hook-events-reference.md` — Cursor-native event vocabulary, matchers, JSON schema
- `references/prompt-engineering-strategies.md` — hook-specific prompting

Based on both agent reports, create an improvement plan with categories:

1. **Removals** — invalid event names (not in Cursor's vocabulary), redundant hooks, observation-only hooks replaceable by rules
2. **Refactoring** — tighten overly permissive matchers, fix exit-code misuse, correct script paths, add `failClosed: true` to security-critical blocking hooks
3. **Additions** — missing error handling, missing events for key tool-use patterns

If all three categories yield zero items after analysis, conclude: "No improvements needed — artifact is already convention-compliant." and proceed directly to Phase 5 with an empty improvement summary.

### Phase 4: Self-Validation

Read `references/hook-validation-criteria.md` and execute its **Validation Loop Instructions** against the improved hook configurations.

For improve operations, also evaluate the **"If This Is an IMPROVE Operation"** section. Maximum 3 iterations. Do not proceed to Phase 5 until ALL criteria pass. Additionally, verify that every suggestion in the improvement plan has a WHY field citing a source document — no suggestion may lack a source reference.

### Phase 5: Present and Apply

1. Show a summary overview of all improvements found, grouped by category:
   - **Removals**: X items (invalid event names: X, redundant: X)
   - **Refactoring**: X items (matchers: X, exit codes: X, script-path fixes: X, `failClosed` additions: X)
   - **Additions**: X items

2. For each suggestion, present a structured card in priority order (Removals → Refactoring → Additions):

   **WHAT**: The specific hook entry and its current location (file:key path)
   **WHY**: Evidence-based justification with source reference
   **TOKEN IMPACT**: Estimated impact (hooks fire on every matching event — overly permissive matchers run on every occurrence)
   **OPTIONS**:
   - **Option A** (recommended): Primary action
   - **Option B**: Alternative action
   - **Option C**: Keep as-is

   Wait for the user to select an option for each suggestion before proceeding to the next.
   Warn if any option would weaken blocking behavior (exit `2` → exit `0`, or `failClosed: true` → `false`).

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
