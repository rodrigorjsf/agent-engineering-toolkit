---
name: init-agents
description: "Initializes optimized AGENTS.md hierarchy for projects. Uses subagent-driven codebase analysis to generate minimal, scoped files following progressive disclosure — based on the ETH Zurich 'Evaluating AGENTS.md' study showing that minimal developer-style files outperform comprehensive auto-generated ones."
---

# Initialize AGENTS.md

Generate an evidence-based AGENTS.md file hierarchy for this project. Instead of one bloated file, create minimal per-scope files that load on-demand.

## Why This Approach

Research shows that auto-generated comprehensive AGENTS.md files **reduce** agent task success by ~3% while **increasing cost by 20%+** (Evaluating AGENTS.md, ETH Zurich, 2026). Developer-written **minimal** files improve success by ~4%. This skill generates files that mimic what an experienced developer would write: only non-obvious tooling and conventions.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **NEVER** generate a single file with everything — use hierarchical progressive disclosure
- **NEVER** include directory/file structure listings (research proves these don't help agents navigate)
- **NEVER** include obvious language conventions the model already knows
- **NEVER** exceed 200 lines per file (Anthropic recommendation)
- **EVERY** instruction must pass: "Would removing this cause the agent to make mistakes?" If no, cut it.
- Root file target: **15-40 lines**
- Scope files target: **10-30 lines**
- Domain files: only when non-standard patterns are detected
</RULES>

## Process

### Preflight Check

Check if `AGENTS.md` exists in the current working directory.

**If it already exists:**

1. Inform the user: "AGENTS.md already exists in this project. Switching to the improve workflow to optimize your existing configuration."
2. Invoke the `improve-agents` skill and follow its complete process.
3. **STOP** — do not proceed to Phase 1 or any subsequent phase of this init skill.

**If it does not exist:**
Proceed to Phase 1 below.

### Phase 1: Codebase Analysis

Delegate to the `codebase-analyzer` agent with this task:

> Analyze the project at the current working directory. Return ONLY non-standard, non-obvious information that would cause an agent to make mistakes if it didn't know them. Be ruthlessly minimal.

The agent runs on Sonnet with read-only tools (Read, Grep, Glob, Bash) in an isolated context. Wait for it to complete and parse its structured output.
Require the parsed output to surface non-default config overrides, repo-wide critical constraints, and any cross-scope prerequisites needed for the root file.

### Phase 2: Scope Detection

Delegate to the `scope-detector` agent with this task:

> Detect scopes in the project at the current working directory. Only flag scopes with genuinely different tooling or conventions. A simple single-package project should have ZERO additional scopes. Check shared/library packages for unique constraints even if they are not user-facing, and treat repo-internal tooling directories as root/domain-doc candidates unless they truly need their own config file.

Wait for it to complete and parse its structured output.
Require the parsed output to state explicitly when a simple single-package project needs zero additional scopes.

### Phase 3: Generate Files

#### Phase 3a: Hierarchy Decisions

Drop any references from Phases 1–2. Read these references:

- `${CLAUDE_SKILL_DIR}/references/progressive-disclosure-guide.md` — file hierarchy decisions
- `${CLAUDE_SKILL_DIR}/references/what-not-to-include.md` — content exclusion criteria

Decide which file types to generate (root, scope, domain) and what content belongs in each tier.

#### Phase 3b: Generate Files

Drop Phase 3a references. Read this reference:

- `${CLAUDE_SKILL_DIR}/references/context-optimization.md` — token budget guidelines

Using ONLY the information from Phase 1 and Phase 2, generate the file hierarchy:

#### Root AGENTS.md

Read `${CLAUDE_SKILL_DIR}/assets/templates/root-agents-md.md`. Fill its placeholders using ONLY the analysis output from Phase 1 and Phase 2. Follow the HTML comment instructions in the template to determine which sections to include or remove. Remove any section that would be empty. Target: 15-40 lines.

#### Scope AGENTS.md (per detected scope)

If scopes were detected, read `${CLAUDE_SKILL_DIR}/assets/templates/scoped-agents-md.md` for each scope. Only include scope-specific content that differs from root.

#### Domain Files (only if non-standard patterns detected)

If the codebase-analyzer identified non-standard domain patterns, read `${CLAUDE_SKILL_DIR}/assets/templates/domain-doc.md` and generate a file per domain.

### Phase 4: Self-Validation

Read `${CLAUDE_SKILL_DIR}/references/validation-criteria.md` and execute its **Validation Loop Instructions** against every generated file.

The loop evaluates all hard limits and quality checks, fixes any failures, and re-evaluates — maximum 3 iterations. Do not proceed to Phase 5 until ALL criteria pass for ALL files.
For init flows, treat output-size targets as required validation gates: the root file MUST finish within 15-40 lines and each scoped file MUST finish within 10-30 lines. If a monorepo root exceeds target, move scope-specific detail down or trim non-essential context and rerun the validation loop.

### Phase 5: Present and Write

1. Show the user ALL generated files with their content before writing
2. Explain briefly why each file exists and what evidence supports its content
3. Include a concise validation summary: iteration count, final root line count, scoped file count, and any fixes made during self-validation
4. Ask for confirmation before writing files
5. Write all files to the project
