---
name: init-claude
description: "Initializes optimized CLAUDE.md hierarchy and .claude/rules/ for projects. Uses subagent-driven codebase analysis to generate minimal, scoped files following progressive disclosure — based on the ETH Zurich 'Evaluating AGENTS.md' study and Anthropic's context engineering best practices."
---

# Initialize CLAUDE.md

Generate an evidence-based CLAUDE.md file hierarchy for this project, leveraging Claude Code's full configuration system: CLAUDE.md files, `.claude/rules/` path-scoped rules, and progressive disclosure pointers.

## Why This Approach

Research shows that auto-generated comprehensive configuration files **reduce** agent task success by ~3% while **increasing cost by 20%+** (Evaluating AGENTS.md, ETH Zurich, 2026). Developer-written **minimal** files improve success by ~4%. This skill generates files that mimic what an experienced developer would write: only non-obvious tooling and conventions.

Claude Code's configuration hierarchy enables powerful progressive disclosure:

- **Root CLAUDE.md** — always loaded, project-wide essentials
- **Subdirectory CLAUDE.md** — loaded on-demand when working in that area
- **`.claude/rules/`** — path-scoped rules triggered only when matching files are read
- **Domain files** — referenced via progressive disclosure pointers

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
- **NEVER** exceed 200 lines per file (Anthropic recommendation: "Target under 200 lines per CLAUDE.md file")
- **EVERY** instruction must pass: "Would removing this cause Claude to make mistakes?" If no, cut it.
- Root CLAUDE.md target: **15-40 lines**
- Scope CLAUDE.md target: **10-30 lines**
- `.claude/rules/` files: **focused, path-scoped, one topic per file**
- Domain files: only when non-standard patterns are detected
</RULES>

## Process

### Preflight Check

Check if `CLAUDE.md` exists in the current working directory.

**If it already exists:**

1. Inform the user: "CLAUDE.md already exists in this project. Switching to the improve workflow to optimize your existing configuration."
2. Invoke the `improve-claude` skill and follow its complete process.
3. **STOP** — do not proceed to Phase 1 or any subsequent phase of this init skill.

**If it does not exist:**
Proceed to Phase 1 below.

### Phase 1: Codebase Analysis

Delegate to the `codebase-analyzer` agent with this task:

> Analyze the project at the current working directory. Return ONLY non-standard, non-obvious information that would cause Claude to make mistakes if it didn't know them. Be ruthlessly minimal.

The agent runs on Sonnet with read-only tools (Read, Grep, Glob, Bash) in an isolated context. Wait for it to complete and parse its structured output.
Require the parsed output to surface non-default config overrides, repo-wide critical constraints, and any cross-scope prerequisites needed for the root file.

### Phase 2: Scope Detection

Delegate to the `scope-detector` agent with this task:

> Detect scopes in the project at the current working directory. Only flag scopes with genuinely different tooling or conventions. A simple single-package project should have ZERO additional scopes. Also identify areas that would benefit from path-scoped .claude/rules/ files. Check shared/library packages in monorepos — even utility packages may need their own scope if they have unique constraints (e.g., zero-dependency rules, dual exports, conditional imports).

Wait for it to complete and parse its structured output.
Require the parsed output to state explicitly when a simple single-package project needs zero additional scopes.

### Phase 3: Generate Files

Before generating, read these reference documents:

- `${CLAUDE_SKILL_DIR}/references/progressive-disclosure-guide.md` — hierarchy decisions and loading tiers
- `${CLAUDE_SKILL_DIR}/references/what-not-to-include.md` — content exclusion criteria
- `${CLAUDE_SKILL_DIR}/references/context-optimization.md` — token budget guidelines
- `${CLAUDE_SKILL_DIR}/references/claude-rules-system.md` — .claude/rules/ conventions and path-scoping

Using ONLY the information from Phase 1 and Phase 2, generate the file hierarchy:

#### Root CLAUDE.md

Read `${CLAUDE_SKILL_DIR}/assets/templates/root-claude-md.md`. Fill placeholders. Remove empty sections. Target: 15-40 lines.

#### Subdirectory CLAUDE.md (per detected scope)

If scopes detected, read `${CLAUDE_SKILL_DIR}/assets/templates/scoped-claude-md.md`. Only scope-specific content differing from root.

#### .claude/rules/ Files (Path-Scoped Rules)

If file-pattern-specific rules detected, read `${CLAUDE_SKILL_DIR}/assets/templates/claude-rule.md`. Consult `${CLAUDE_SKILL_DIR}/references/claude-rules-system.md` for:

- When to create rules files vs using CLAUDE.md
- Path-scoping conventions and glob patterns
- Convention rules vs domain-critical rules categories

#### Domain Files

If non-standard domain patterns detected, read `${CLAUDE_SKILL_DIR}/assets/templates/domain-doc.md`.

### Phase 4: Self-Validation

Read `${CLAUDE_SKILL_DIR}/references/validation-criteria.md` and execute its **Validation Loop Instructions** against every generated file. Check general criteria AND CLAUDE.md-specific structural checks (path-scoping, minimal always-loaded content). For init flows, treat the Hard Rules size targets (root 15-40 lines, scoped 10-30 lines) as required validation gates — if a monorepo root exceeds target, move scope-specific detail into subdirectory CLAUDE.md, rules, or domain files and rerun. Maximum 3 iterations.

### Phase 5: Present and Write

1. Show the user ALL generated files with their content before writing
2. Explain briefly why each file exists and what evidence supports its content
3. Include a concise validation summary: iteration count, final root line count, scoped file count, and any fixes made during self-validation
4. Highlight which files are always-loaded (root CLAUDE.md) vs on-demand (subdirectory, rules)
5. Ask for confirmation before writing files
6. Write all files to the project
7. Create `.claude/rules/` directory if generating rules files
