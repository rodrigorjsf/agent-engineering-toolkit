---
name: create-hook
description: 'Creates new Cursor hook configs grounded in the native event model: event, handler, matcher, exit-code behavior. Use when creating a new Cursor hook.'
---

# Create Hook

Generates a new hook configuration for a Cursor lifecycle event, with correct JSON shape, handler type, and exit-code behavior grounded in `docs/cursor/hooks/hooks-guide.md`.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **NEVER** create hooks with event names outside the Cursor-native vocabulary listed in `references/hook-events-reference.md`
- **NEVER** omit the matcher on a blocking hook when the event supports one — overly permissive matchers fire on every occurrence
- **NEVER** hardcode secrets in any configuration field — use environment variables and quote them at use sites in the script
- **EVERY** hook must use a handler type valid for Cursor: `command` (default) or `prompt` only
- **EVERY** `command` hook must document the decision path used by the script: exit `2` + stderr for blocking, or exit `0` with JSON decision output (e.g., `permission`, `additional_context`, `updated_input`)
- **EVERY** security-critical blocking hook (`beforeMCPExecution`, `beforeShellExecution`, `beforeReadFile`) must set `"failClosed": true`
- **EVERY** hook configuration must produce valid JSON before writing
</RULES>

## Process

### Preflight Check

Check whether hooks already exist for the target event in:

- `<project-root>/.cursor/hooks.json` (project scope)
- `~/.cursor/hooks.json` (user scope)

**If the exact same event + matcher combination already exists:**

1. Inform the user: "A hook for `{event}` with this matcher already exists."
2. Suggest using `/cursor-customizer:improve-hook` to evaluate and optimize it instead.
3. **STOP** — do not proceed. The user should either choose a different matcher/event combination or use the improve skill.

**If no hook exists for this event+matcher combination:**
Proceed to Phase 1 below.

### Phase 1: Codebase Analysis

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand existing hook configurations. Focus on: hooks defined in `<project-root>/.cursor/hooks.json` and `~/.cursor/hooks.json` (when accessible); project hook scripts under `.cursor/hooks/`; user-scope hook scripts under `~/.cursor/hooks/`; the event names currently in use; the handler types used (`command` vs `prompt`); and any gaps in lifecycle-event coverage. Also identify project layout: whether this is a monorepo with multiple service packages or a single-package project, and report any service directory paths for use in hook script path resolution.

The agent runs read-only with `model: inherit` in an isolated context. Wait for it to complete and parse its structured output.

### Phase 2: Generate Hook

Before generating, read these reference documents:

- `references/hook-authoring-guide.md` — when to use hooks, two handler types, exit-code semantics, blocking vs non-blocking behavior, security
- `references/hook-events-reference.md` — Cursor-native event vocabulary, matcher fields per event, full JSON schema, handler-type support matrix
- `references/prompt-engineering-strategies.md` — hook-specific prompting (zero-shot only for hooks)

Read `assets/templates/hook-config.md` and fill its placeholders using:

- User requirements for the new hook (event, purpose, handler type)
- Phase 1 analysis output (existing hooks, coverage gaps)
- Evidence from the reference files above

For blocking hooks (e.g., `preToolUse`, `beforeShellExecution`, `beforeReadFile`, `subagentStart`, `beforeSubmitPrompt`, `beforeMCPExecution`), translate the user intent into a concrete matcher when the event supports one:

- `preToolUse` blocking write or delete tools → matcher like `Write|Delete`
- `beforeShellExecution` blocking network commands → matcher like `curl|wget|nc`
- `subagentStart` gating specific subagent types → matcher like `explore|shell`

If the event has no matcher field (per `references/hook-events-reference.md`), omit the matcher entirely — never set one on an event that does not support it.

Before choosing the handler, verify in `references/hook-events-reference.md` that the selected event supports it. Cursor exposes `command` and `prompt` only; if the user requested any other handler, stop and explain that Cursor's native model has only those two types.

For security-critical blocking hooks (`beforeMCPExecution`, `beforeShellExecution`, `beforeReadFile`), set `"failClosed": true` on the hook definition so a crash, timeout, or invalid-JSON response blocks the action instead of failing open.

Choose the target location based on the requested scope:

- `<project-root>/.cursor/hooks.json` — committed project hook (working dir = project root)
- `~/.cursor/hooks.json` — user-only hook (working dir = `~/.cursor/`)

In a monorepo with multiple service packages, hook script paths must be workspace-relative (e.g., `.cursor/hooks/api/validate.sh`, not just `validate.sh`). Confirm the correct path from the Phase 1 analysis before writing.

Generate the complete hook configuration:

1. Hook JSON block — to be merged into the `hooks` key of the selected target file
2. Shell script (if `command` type):
   - Project hook: write to `.cursor/hooks/{name}.sh` with executable permissions; the path inside `hooks.json` is `.cursor/hooks/{name}.sh` (relative to project root)
   - User hook: write to `~/.cursor/hooks/{name}.sh` with executable permissions; the path inside `hooks.json` is `./hooks/{name}.sh` (relative to `~/.cursor/`)

**Important**: The hook JSON must be merged into the selected target file, not replace it. Read the current target file first and produce the merged result. If the target file does not yet exist, generate it with `version: 1` and the new event entry.

### Phase 3: Self-Validation

Read `references/hook-validation-criteria.md` and execute its **Validation Loop Instructions** against the generated hook configuration.

The loop evaluates all hard limits, quality checks, and security gap checks (command injection via unescaped variables, path traversal, secret exposure in logs), fixes any failures, and re-evaluates — maximum 3 iterations. Do not proceed to Phase 4 until ALL criteria pass.

### Phase 4: Present and Write

1. Show the user the complete hook configuration (JSON + shell script if applicable)
2. Cite the evidence from reference files that informed key decisions:
   - Which event was chosen and why
   - Why this handler type (`command` vs `prompt`)
   - What the exit-code behavior means for this event, including whether `failClosed: true` was set
3. Ask for confirmation before writing any files
4. On approval:
   - Merge the hook JSON into the selected target file (creating it with `version: 1` if missing)
   - Write the shell script to `.cursor/hooks/{name}.sh` (project) or `~/.cursor/hooks/{name}.sh` (user) and set executable (`chmod +x`)
