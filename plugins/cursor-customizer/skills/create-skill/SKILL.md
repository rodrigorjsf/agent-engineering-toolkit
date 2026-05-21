---
name: create-skill
description: "Creates new Cursor SKILL.md packages with references, templates, and frontmatter grounded in the Agent Skills standard. Uses subagent-driven project analysis and evidence-based guidance. Use when creating a new Cursor skill from scratch."
---

# Create Skill

Generates a new Cursor SKILL.md package with supporting references and templates, grounded in the Agent Skills open standard and project conventions.

<TRIGGER when="creating a new Cursor skill from scratch" />

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
- **NEVER** create skills that explain what the agent already knows (language syntax, obvious conventions)
- **NEVER** inline reference content in SKILL.md body — use the `references/` subdirectory
- **NEVER** exceed 500 lines in the SKILL.md body
- **EVERY** reference file must be ≤ 200 lines with source attribution
- **EVERY** bundled-path reference inside SKILL.md must use a relative path from the skill root (e.g., `references/foo.md`, `scripts/deploy.sh`)
- **EVERY** skill description must be third-person, ≤ 1024 chars, and include a "Use when..." trigger phrase
- **EVERY** generated skill must preserve the ethical constraint: persuasion cues support legitimate work only, never safety bypass
- **EVERY** generated SKILL.md body must carry the canonical semantic-tag vocabulary in canonical positions
- **EVERY** new skill whose output is a human-rich agent-executable artifact (plan, PRD, spec, report, prototype, code-review writeup, custom editor) MUST default to an HTML output template — unless the user explicitly says "generate as markdown" (or equivalent), in which case that override always wins
- **NEVER** default to HTML for agent-loaded or tooling-locked artifacts (`SKILL.md`, subagent `.md`, `AGENTS.md`, rules files, `README.md`, commit messages, PR bodies, issue bodies, code comments) — these are Markdown-mandatory regardless of user request phrasing
</HARD_RULES>

<PROCESS>

  <PREFLIGHT name="name-collision-check">
  **Default output path.** Per the Cursor distribution default, new skills are written to `.cursor/skills/<name>/SKILL.md`. The Agent Skills standard also recognises `.agents/skills/<name>/SKILL.md` for cross-tool portability across Agent Skills implementations.

  Before proceeding, state both options to the user:

  - **Default:** `.cursor/skills/<name>/SKILL.md` — Cursor-namespaced; recommended when the skill is Cursor-specific.
  - **Portable alternative:** `.agents/skills/<name>/SKILL.md` — open-standard; choose when the skill should also be discovered by other Agent Skills implementations.

  Proceed with the default path unless the user explicitly requests the portable alternative. Do not silently switch paths.

  **Name collision check.** Check if a skill with the same name already exists at any of:

  - `.cursor/skills/{requested-name}/SKILL.md`
  - `.agents/skills/{requested-name}/SKILL.md`
  - `~/.cursor/skills/{requested-name}/SKILL.md`

  **If a skill already exists at any of those locations:**

  1. Inform the user: "A skill named `{requested-name}` already exists."
  2. Suggest using `/cursor-customizer:improve-skill` to evaluate and optimize it instead.
  3. **STOP** — do not proceed. The user should either choose a different name or use the improve skill.

  **If no skill exists with that name:**
  Proceed to Phase 1 below.
  </PREFLIGHT>

  <PHASE id="1" name="project-analysis">
  Delegate to the `artifact-analyzer` agent with this task:

  > Analyze the project to understand existing skills, naming conventions, and integration patterns. Focus on: existing skill directory structure under `.cursor/skills/` and `.agents/skills/`, naming patterns, which skills delegate to subagents, project conventions, and any skill that is similar to `{requested-name}` in purpose. Also identify the project layout: whether this is a monorepo with multiple service packages (indicated by workspace files like `pnpm-workspace.yaml`, a `package.json` with a `workspaces` field, multiple `go.mod` files in subdirectories, or multiple `pyproject.toml` files in subdirectories) or a single-package project, and report any service directory paths for use in scope resolution.

  The agent runs read-only with Cursor-native frontmatter (`model: inherit`, `readonly: true`) in an isolated context. Wait for it to complete and parse its structured output.
  </PHASE>

  <PHASE id="2" name="generate-skill">
  Before generating, read these reference documents:

  - `references/skill-authoring-guide.md` — core principles, structure rules, progressive disclosure, anti-patterns
  - `references/skill-format-reference.md` — frontmatter fields, name validation, bundled-path conventions

  Decide skill structure: phases, reference file names, and whether `assets/templates/` is needed.

  **Classify output artifact format.** Read `references/artifact-format-routing.md` and apply its routing table to the new skill being generated:

  1. Identify what kind of artifact the new skill will produce (plan/PRD/spec/report/prototype vs. SKILL.md/rule/etc.).
  2. Apply the routing table: human-rich agent-executable artifacts default to **HTML**; agent-loaded and tooling-locked artifacts are **Markdown-mandatory**.
  3. Check for explicit override: if the user said "generate as markdown" (or equivalent), that override wins regardless of artifact type.
  4. If the verdict is **HTML**: copy `assets/templates/html-artifact-skeleton.html` into the new skill's `assets/templates/` directory (rename to match the artifact type, e.g., `plan.html`). The new skill must instruct its own generation phase to populate the canonical semantic tags (`<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` with `<PHASE>`, plus relevant optional tags) inside the HTML `<body>`.
  5. If the verdict is **Markdown**: use `assets/templates/skill-md.md` or a Markdown template appropriate to the artifact type.

  Then read these reference documents:

  - `references/behavioral-guidelines.md` — discipline cues and safe persuasion patterns for skills
  - `references/prompt-engineering-strategies.md` — per-artifact prompting strategies for skills

  <REFERENCES load="on-demand">
  - skill-authoring-guide.md
  - skill-format-reference.md
  - artifact-format-routing.md
  - behavioral-guidelines.md
  - prompt-engineering-strategies.md
  </REFERENCES>

  Read the chosen output template (HTML skeleton or `skill-md.md`) and fill its placeholders using:

  - User requirements for the new skill
  - Phase 1 analysis output (naming conventions, existing patterns, project context)
  - Evidence from the reference files above

  If Phase 1 detects a monorepo or multi-service layout, make the generated phases name the target service, package, or workspace explicitly and use project-relative paths or globs for that scope. Do not leave multi-service boundaries implicit.

  Generate the complete skill directory structure:

  1. `SKILL.md` — primary skill file with Cursor-shaped frontmatter and a body carrying the canonical semantic-tag vocabulary
  2. `references/` — create only reference files that include initial source attribution sections (no empty stubs without attribution)
  3. `assets/templates/` — create the appropriate output template (HTML or Markdown per the routing verdict above); for validator-type skills that only report findings without generating output files, `assets/templates/` may be omitted
  </PHASE>

  <PHASE id="3" name="self-validation">
  Read `references/skill-validation-criteria.md` and execute its **Validation Loop Instructions** against the generated skill.

  If Phase 1 detected a monorepo or multi-service layout, add one extra validation pass: confirm the generated phases name the target service, package, or workspace explicitly and use project-relative paths or globs for that scope.

  The loop evaluates all hard limits and quality checks — including the canonical semantic-tag strictness tiers — fixes any failures, and re-evaluates: maximum 3 iterations. Do not proceed to Phase 4 until ALL criteria pass.
  </PHASE>

  <PHASE id="4" name="present-and-write">
  1. Show the user the complete generated skill directory (SKILL.md + any stub references/templates), including the resolved output path from the preflight choice
  2. Cite the evidence from reference files that informed key decisions (frontmatter choices, phase structure, reference selections)
  3. Ask for confirmation before writing any files
  4. On approval, write all files to the target location
  </PHASE>

</PROCESS>

<VALIDATION loop="max-iterations:3">
Read `references/skill-validation-criteria.md` and loop the generated skill through every hard limit, quality check, and canonical semantic-tag strictness tier until all pass.
</VALIDATION>
