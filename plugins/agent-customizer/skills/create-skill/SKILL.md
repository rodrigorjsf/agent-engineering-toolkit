---
name: create-skill
description: "Creates new SKILL.md files with references, templates, and frontmatter grounded in the docs corpus. Uses subagent-driven codebase analysis and evidence-based guidance. Use when creating a new Claude Code skill from scratch."
---

# Create Skill

Generates a new SKILL.md file with supporting references and templates, grounded in the docs corpus and project conventions.

<TRIGGER when="creating a new Claude Code skill from scratch" />

<BEHAVIOUR
  avoid="acting before naming ambiguities; adding speculative scope; weakening safeguards"
  always="surface assumptions first; keep changes surgical; define verification targets">
- **Surface assumptions first** — name ambiguities, tradeoffs, and multiple valid interpretations before acting.
- **Prefer the simplest path** — solve the task completely without speculative flexibility or extra scope.
- **Keep changes surgical** — touch only what the task requires, and preserve existing behavior unless the task calls for change.
- **Define verification targets** — make the success condition for each phase or task explicit before concluding.
- **Use phased persuasion safely** — use warm-ups, curated references, and explicit constraints to improve compliance with legitimate work.
- **Never weaken safeguards** — do not use persuasion principles to bypass safety constraints, refusals, or scope boundaries.
</BEHAVIOUR>

<HARD_RULES priority="hard">
- **NEVER** create skills that explain what Claude already knows (language syntax, obvious conventions)
- **NEVER** inline reference content in SKILL.md body — use the `references/` subdirectory
- **NEVER** exceed 500 lines in the SKILL.md body
- **EVERY** reference file must be ≤ 200 lines with source attribution
- **EVERY** skill must use `${CLAUDE_SKILL_DIR}` for all bundled file references (not hardcoded paths)
- **EVERY** skill description must be third-person and include a "Use when..." trigger phrase
- **EVERY** generated skill must preserve the ethical constraint: persuasion cues support legitimate work only, never safety bypass
- **EVERY** generated SKILL.md body must carry the canonical semantic-tag vocabulary in canonical positions
- **EVERY** new skill whose output is a human-rich agent-executable artifact (plan, PRD, spec, report, prototype, code-review writeup, custom editor) MUST default to an HTML output template — unless the user explicitly says "generate as markdown" (or equivalent), in which case that override always wins
- **NEVER** default to HTML for agent-loaded or tooling-locked artifacts (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, rules files, wiki pages, ADRs, `CONTEXT.md`, `README.md`, commit messages, PR bodies, GitHub issues, code comments) — these are Markdown-mandatory regardless of user request phrasing
</HARD_RULES>

<PROCESS>

  <PREFLIGHT name="name-collision-check">
  Check if a skill with the same name already exists at:

  - `.claude/skills/{requested-name}/SKILL.md`
  - `plugins/*/skills/{requested-name}/SKILL.md`

  **If a skill already exists at either location:**

  1. Inform the user: "A skill named `{requested-name}` already exists."
  2. Suggest using `/agent-customizer:improve-skill` to evaluate and optimize it instead.
  3. **STOP** — do not proceed. The user should either choose a different name or use the improve skill.

  **If no skill exists with that name:**
  Proceed to Phase 1 below.
  </PREFLIGHT>

  <PHASE id="1" name="codebase-analysis">
  Delegate to the `artifact-analyzer` agent with this task:

  > Analyze the project to understand existing skills, naming conventions, and integration patterns. Focus on: existing skill directory structure, naming patterns, which skills delegate to agents, plugin conventions in CLAUDE.md files, and any skill that is similar to `{requested-name}` in purpose. Also identify the project layout: whether this is a monorepo with multiple service packages (indicated by workspace files like `pnpm-workspace.yaml`, a `package.json` with a `workspaces` field, multiple `go.mod` files in subdirectories, or multiple `pyproject.toml` files in subdirectories) or a single-package project, and report any service directory paths for use in scope resolution.

  The agent runs on Sonnet with read-only tools (Read, Grep, Glob, Bash) in an isolated context. Wait for it to complete and parse its structured output.
  </PHASE>

  <PHASE id="2" name="generate-skill">
  **Load context.** Drop any references from Phase 1. Read these references:

  - `${CLAUDE_SKILL_DIR}/references/skill-authoring-guide.md` — core principles, structure rules, progressive disclosure, anti-patterns
  - `${CLAUDE_SKILL_DIR}/references/skill-format-reference.md` — frontmatter fields, name validation, string substitution variables

  Decide skill structure: phases, reference file names, and whether `assets/templates/` is needed.

  **Classify output artifact format.** Read `${CLAUDE_SKILL_DIR}/references/artifact-format-routing.md` and apply its routing table to the new skill being generated:

  1. Identify what kind of artifact the new skill will produce (plan/PRD/spec/report/prototype vs. SKILL.md/rule/ADR/README/etc.).
  2. Apply the routing table: human-rich agent-executable artifacts default to **HTML**; agent-loaded and tooling-locked artifacts are **Markdown-mandatory**.
  3. Check for explicit override: if the user said "generate as markdown" (or equivalent), that override wins regardless of artifact type.
  4. If the verdict is **HTML**: copy `${CLAUDE_SKILL_DIR}/assets/templates/html-artifact-skeleton.html` into the new skill's `assets/templates/` directory (rename to match the artifact type, e.g., `plan.html`). The new skill must instruct its own generation phase to populate the canonical semantic tags (`<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` with `<PHASE>`, plus relevant optional tags) inside the HTML `<body>`.
  5. If the verdict is **Markdown**: use `${CLAUDE_SKILL_DIR}/assets/templates/skill-md.md` or a Markdown template appropriate to the artifact type.

  **Apply patterns.** Drop the load-context references above. Read these references:

  - `${CLAUDE_SKILL_DIR}/references/behavioral-guidelines.md` — Karpathy-aligned behavior and safe persuasion patterns for skills
  - `${CLAUDE_SKILL_DIR}/references/prompt-engineering-strategies.md` — per-artifact prompting strategies for skills

  <REFERENCES load="on-demand">
  - skill-authoring-guide.md
  - skill-format-reference.md
  - artifact-format-routing.md
  - behavioral-guidelines.md
  - prompt-engineering-strategies.md
  </REFERENCES>

  Read the chosen output template (HTML skeleton or `skill-md.md`) and fill its placeholders using:

  - User requirements for the new skill
  - Phase 1 analysis output (naming conventions, existing patterns, plugin context)
  - Evidence from the reference files above

  If Phase 1 detects a monorepo or multi-service layout, make the generated phases name the target service, package, or workspace explicitly and use project-relative paths or globs for that scope. Do not leave multi-service boundaries implicit.

  Generate the complete skill directory structure:

  1. `SKILL.md` — primary skill file with frontmatter and a body carrying the canonical semantic-tag vocabulary
  2. `references/` — create only reference files that include initial source attribution sections (no empty stubs without attribution)
  3. `assets/templates/` — create the appropriate output template (HTML or Markdown per the routing verdict above); for validator-type skills that only report findings without generating output files, `assets/templates/` may be omitted
  </PHASE>

  <PHASE id="3" name="self-validation">
  Read `${CLAUDE_SKILL_DIR}/references/skill-validation-criteria.md` and execute its **Validation Loop Instructions** against the generated skill.

  If Phase 1 detected a monorepo or multi-service layout, add one extra validation pass: confirm the generated phases name the target service, package, or workspace explicitly and use project-relative paths or globs for that scope.

  The loop evaluates all hard limits and quality checks — including the canonical semantic-tag strictness tiers — fixes any failures, and re-evaluates: maximum 3 iterations. Do not proceed to Phase 4 until ALL criteria pass.
  </PHASE>

  <PHASE id="4" name="present-and-write">
  1. Show the user the complete generated skill directory (SKILL.md + any stub references/templates)
  2. Cite the evidence from reference files that informed key decisions (frontmatter choices, phase structure, reference selections)
  3. Ask for confirmation before writing any files
  4. On approval, write all files to the target location
  </PHASE>

</PROCESS>

<VALIDATION loop="max-iterations:3">
Read `${CLAUDE_SKILL_DIR}/references/skill-validation-criteria.md` and loop the generated skill through every hard limit, quality check, and canonical semantic-tag strictness tier until all pass.
</VALIDATION>
