---
name: create-skill
description: "Creates new SKILL.md files with references, templates, and frontmatter grounded in the docs corpus. Uses subagent-driven codebase analysis and evidence-based guidance. Use when creating a new Claude Code skill from scratch."
---

# Create Skill

Generates a new SKILL.md file with supporting references and templates, grounded in the docs corpus and project conventions.

## Behavioral Guidelines

- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.

## Hard Rules

<RULES>
- **NEVER** create skills that explain what Claude already knows (language syntax, obvious conventions)
- **NEVER** inline reference content in SKILL.md body — use the `references/` subdirectory
- **NEVER** exceed 500 lines in the SKILL.md body
- **EVERY** reference file must be ≤ 200 lines with source attribution
- **EVERY** skill must use `${CLAUDE_SKILL_DIR}` for all bundled file references (not hardcoded paths)
- **EVERY** skill description must be third-person and include a "Use when..." trigger phrase
- **EVERY** generated skill must preserve the ethical constraint: persuasion cues support legitimate work only, never safety bypass
</RULES>

## Process

### Preflight Check

Check if a skill with the same name already exists at:

- `.claude/skills/{requested-name}/SKILL.md`
- `plugins/*/skills/{requested-name}/SKILL.md`

**If a skill already exists at either location:**

1. Inform the user: "A skill named `{requested-name}` already exists."
2. Suggest using `/agent-customizer:improve-skill` to evaluate and optimize it instead.
3. **STOP** — do not proceed. The user should either choose a different name or use the improve skill.

**If no skill exists with that name:**
Proceed to Phase 1 below.

### Phase 1: Codebase Analysis

Delegate to the `artifact-analyzer` agent with this task:

> Analyze the project to understand existing skills, naming conventions, and integration patterns. Focus on: existing skill directory structure, naming patterns, which skills delegate to agents, plugin conventions in CLAUDE.md files, and any skill that is similar to `{requested-name}` in purpose. Also identify the project layout: whether this is a monorepo with multiple service packages (indicated by workspace files like `pnpm-workspace.yaml`, a `package.json` with a `workspaces` field, multiple `go.mod` files in subdirectories, or multiple `pyproject.toml` files in subdirectories) or a single-package project, and report any service directory paths for use in scope resolution.

The agent runs on Sonnet with read-only tools (Read, Grep, Glob, Bash) in an isolated context. Wait for it to complete and parse its structured output.

### Phase 2: Generate Skill

#### Phase 2a: Load Context

Drop any references from Phase 1. Read these references:

- `${CLAUDE_SKILL_DIR}/references/skill-authoring-guide.md` — core principles, structure rules, progressive disclosure, anti-patterns
- `${CLAUDE_SKILL_DIR}/references/skill-format-reference.md` — frontmatter fields, name validation, string substitution variables

Decide skill structure: phases, reference file names, and whether `assets/templates/` is needed.

#### Phase 2b: Apply Patterns

Drop Phase 2a references. Read these references:

- `${CLAUDE_SKILL_DIR}/references/behavioral-guidelines.md` — Karpathy-aligned behavior and safe persuasion patterns for skills
- `${CLAUDE_SKILL_DIR}/references/prompt-engineering-strategies.md` — per-artifact prompting strategies for skills

Read `${CLAUDE_SKILL_DIR}/assets/templates/skill-md.md` and fill its placeholders using:

- User requirements for the new skill
- Phase 1 analysis output (naming conventions, existing patterns, plugin context)
- Evidence from the reference files above

If Phase 1 detects a monorepo or multi-service layout, make the generated phases name the target service, package, or workspace explicitly and use project-relative paths or globs for that scope. Do not leave multi-service boundaries implicit.

Generate the complete skill directory structure:

1. `SKILL.md` — primary skill file with frontmatter and phase definitions
2. `references/` — create only reference files that include initial source attribution sections (no empty stubs without attribution)
3. `assets/templates/` — create stub template files if the skill generates output files

   For validator-type skills that only report findings without generating output files, `assets/templates/` may be omitted.

### Phase 3: Self-Validation

Read `${CLAUDE_SKILL_DIR}/references/skill-validation-criteria.md` and execute its **Validation Loop Instructions** against the generated skill.

If Phase 1 detected a monorepo or multi-service layout, add one extra validation pass: confirm the generated phases name the target service, package, or workspace explicitly and use project-relative paths or globs for that scope.

The loop evaluates all hard limits and quality checks, fixes any failures, and re-evaluates — maximum 3 iterations. Do not proceed to Phase 4 until ALL criteria pass.

### Phase 4: Present and Write

1. Show the user the complete generated skill directory (SKILL.md + any stub references/templates)
2. Cite the evidence from reference files that informed key decisions (frontmatter choices, phase structure, reference selections)
3. Ask for confirmation before writing any files
4. On approval, write all files to the target location
