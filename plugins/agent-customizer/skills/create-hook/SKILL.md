---
name: create-hook
description: "Creates new hook configurations for Claude Code lifecycle events, grounded in the docs corpus. Covers all hook event types with JSON schema compliance. Use when creating a new hook from scratch."
---

# Create Hook

Generates a new hook configuration for a Claude Code lifecycle event, with correct JSON schema, handler type, and exit code behavior grounded in the docs corpus.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **NEVER** create hooks with invalid event names — only events from the 22-event list in hook-events-reference.md are valid
- **NEVER** use broad matchers (`"*"`) for blocking hooks — overly broad matchers block too many operations
- **NEVER** hardcode secrets in command strings — use environment variables (e.g., `$MY_SECRET`)
- **EVERY** hook must use the correct handler type for its purpose: `command` for deterministic checks, `http` for external endpoints, `prompt` or `agent` only when judgment is needed
- **EVERY** hook must use a handler type supported by the selected event — verify this against the handler support matrix in `hook-events-reference.md`
- **EVERY** `command` hook must document the decision path used by the script: exit `2` + stderr for blocking, or exit `0` with JSON decision output when applicable
- **EVERY** hook configuration must produce valid JSON before writing
</RULES>

## Process

### Preflight Check

Check if hooks already exist for the target event in:

- `.claude/settings.json`
- `.claude/settings.local.json`
- Plugin `hooks/hooks.json`

**If the exact same event + matcher combination already exists:**

1. Inform the user: "A hook for `{event}` with this matcher already exists."
2. Suggest using `/agent-customizer:improve-hook` to evaluate and optimize it instead.
3. **STOP** — do not proceed. The user should either choose a different matcher/event combination or use the improve skill.

**If no hook exists for this event+matcher combination:**
Proceed to Phase 1 below.

### Phase 1: Codebase Analysis

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand existing hook configurations. Focus on: hooks defined in `.claude/settings.json`, `.claude/settings.local.json`, and plugin `hooks/hooks.json`; project hook scripts in `.claude/hooks/`; plugin hook scripts in `scripts/`; event types currently in use; handler types used (command/http/prompt/agent); and any gaps in lifecycle event coverage. Also read root `CLAUDE.md`, `README.md`, and any service-level README files to understand non-standard build commands, tooling, or conventions that hook scripts should use. Also identify project layout: whether this is a monorepo with multiple service packages (indicated by workspace files like `pnpm-workspace.yaml`, a `package.json` with a `workspaces` field, multiple `go.mod` files in subdirectories, or multiple `pyproject.toml` files in subdirectories) or a single-package project, and report any service directory paths for use in hook script path resolution.

The agent runs on Sonnet with read-only tools (Read, Grep, Glob, Bash) in an isolated context. Wait for it to complete and parse its structured output.

### Phase 2: Generate Hook

#### Phase 2a: Load Context

Drop any references from Phase 1. Read these references:

- `${CLAUDE_SKILL_DIR}/references/hook-authoring-guide.md` — when to use hooks, 4 handler types, exit code semantics, blocking vs non-blocking behavior
- `${CLAUDE_SKILL_DIR}/references/hook-events-reference.md` — all 22 valid events, matcher fields per event, full JSON schema

Verify the selected event supports the requested handler type using the handler support matrix. If unsupported, stop and ask the user to change the event or handler choice. Determine target location (`.claude/settings.json`, `.claude/settings.local.json`, or `hooks/hooks.json`) and hook script paths.

#### Phase 2b: Apply Patterns

Drop Phase 2a references. Read this reference:

- `${CLAUDE_SKILL_DIR}/references/prompt-engineering-strategies.md` — hook-specific prompting (zero-shot only for hooks)

Read `${CLAUDE_SKILL_DIR}/assets/templates/hook-config.md` and fill its placeholders using:

- User requirements for the new hook (event, purpose, handler type)
- Phase 1 analysis output (existing hooks, coverage gaps)
- Decisions from Phase 2a (event validation, target location, handler type)

For blocking pre-write hooks, translate the user intent into an explicit write-tool matcher instead of a wildcard or omitted matcher. Use a concrete matcher pattern for write-capable tools in the target environment (for example `Write|Edit|Create`) and keep it specific to the operations that should block.

In a monorepo with multiple service packages, hook script paths must be workspace-relative (e.g., `packages/api/scripts/validate.sh`, not just `scripts/validate.sh`). Confirm the correct path from the Phase 1 analysis before writing.

Generate the complete hook configuration:

1. Hook JSON block — to be merged into the `hooks` key of the selected target file
2. Shell script (if `command` type):
   - Project/local hook: write to `.claude/hooks/{name}.sh` with executable permissions
   - Plugin hook: write to `scripts/{name}.sh` with executable permissions and reference it with `${CLAUDE_PLUGIN_ROOT}/scripts/{name}.sh`

**Important**: The hook JSON must be merged into the selected target file, not replace it. Read the current target file first and produce the merged result.

### Phase 3: Self-Validation

Read `${CLAUDE_SKILL_DIR}/references/hook-validation-criteria.md` and execute its **Validation Loop Instructions** against the generated hook configuration.

The loop evaluates all hard limits and quality checks, fixes any failures, and re-evaluates — maximum 3 iterations. Do not proceed to Phase 4 until ALL criteria pass.

### Phase 4: Present and Write

1. Show the user the complete hook configuration (JSON + shell script if applicable)
2. Cite the evidence from reference files that informed key decisions:
   - Which event was chosen and why
   - Why this handler type (command/http/prompt/agent)
   - What the exit code behavior means for this event
3. Ask for confirmation before writing any files
4. On approval:
   - Merge hook JSON into the selected target file
   - Write shell script to `.claude/hooks/{name}.sh` or `scripts/{name}.sh` and set executable (`chmod +x`)
