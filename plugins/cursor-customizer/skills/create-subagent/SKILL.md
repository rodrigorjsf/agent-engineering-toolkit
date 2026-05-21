---
name: create-subagent
description: "Creates new Cursor subagent definitions with the four-key Cursor-native frontmatter (name, description, model: inherit, readonly: true). Includes role-prompting heuristics and prompt-structure patterns. Use when creating a new Cursor subagent from scratch."
---

# Create Subagent

Generates a new Cursor subagent definition with the four-key Cursor-native frontmatter, a focused system prompt, and an explicit output format. Output is grounded in the Cursor subagents documentation and ADR-0002 product-strict guarantees.

<TRIGGER when="creating a new Cursor subagent from scratch" />

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
- **NEVER** create subagents with generic system prompts ("you are a helpful AI assistant").
- **NEVER** emit any frontmatter key outside the four allowed: `name`, `description`, `model`, `readonly`.
- **NEVER** emit a `model` value other than `inherit`.
- **NEVER** emit a `readonly` value other than `true` for an analysis or evaluator subagent.
- **EVERY** subagent must include: role definition, constraints, process steps, output format, and self-verification.
- **EVERY** description must include a specific "Use when..." trigger phrase so Cursor's agent can route correctly.
- **DESCRIPTION** must be ≤1024 characters; **NAME** must be kebab-case and distinct from every existing project subagent.
- **PROJECT SUBAGENTS** MUST NOT instruct the subagent to spawn other subagents — return findings to the parent agent only.
</HARD_RULES>

<PROCESS>

  <PREFLIGHT name="name-collision-check">
  Check whether a subagent with the requested name already exists at:

  - `.cursor/agents/{requested-name}.md`
  - `plugins/*/agents/{requested-name}.md`

  **If a subagent already exists with that name:**

  1. Inform the user: "A subagent named `{requested-name}` already exists."
  2. Suggest using `/cursor-customizer:improve-subagent` to evaluate and optimize it instead.
  3. **STOP** — do not proceed. The user should either choose a different name or use the improve skill.

  **If no subagent exists with that name:**
  Proceed to Phase 1 below.
  </PREFLIGHT>

  <PHASE id="1" name="project-context-analysis">
  Delegate to the `artifact-analyzer` agent with this task:

  > Analyze the project to understand existing Cursor subagents. Focus on: subagent names and roles in `.cursor/agents/` and `plugins/*/agents/`, the description and `readonly` posture of each, which skills delegate to which subagents, and naming conventions. Flag any subagents similar in purpose to `{requested-name}`. Also identify the project layout: whether this is a monorepo with multiple service packages or a single-package project, and report any service directory paths for use in scope resolution.

  The `artifact-analyzer` runs read-only with `model: inherit` in an isolated context. Wait for it to complete and parse its structured output.
  </PHASE>

  <PHASE id="2" name="generate-subagent">
  Before generating, read these reference documents:

  - `references/subagent-authoring-guide.md` — when to use a subagent, system prompt structure, the four-key frontmatter contract, description-as-routing-signal, anti-patterns, verification-agent pattern.
  - `references/subagent-config-reference.md` — full Cursor-native frontmatter specification, model field handling, readonly field handling, file locations, orchestration patterns.
  - `references/prompt-engineering-strategies.md` — subagent-specific prompting (role prompting, structured output, confidence filtering).

  <REFERENCES load="on-demand">
  - subagent-authoring-guide.md
  - subagent-config-reference.md
  - prompt-engineering-strategies.md
  </REFERENCES>

  Read `assets/templates/subagent-definition.md` and fill its placeholders using:

  - User requirements for the new subagent (role, purpose, scope).
  - Phase 1 analysis output (existing subagents, naming conventions, delegation patterns).
  - Evidence from the reference files above.

  Frontmatter posture (non-negotiable):

  - `model: inherit` — the customizer never embeds a literal model alias or specific model ID.
  - `readonly: true` — generated subagents are analysis and evaluator roles by default; they report findings to the parent agent.

  If Phase 1 detects a monorepo or multi-service layout, make the generated system prompt name the relevant services, workspaces, and scope boundaries the subagent should inspect. Do not leave multi-service targets implicit.

  Determine target location:

  - `.cursor/agents/{name}.md` — project-level subagent (project scope).
  - `plugins/{plugin}/agents/{name}.md` — plugin-scoped subagent (restricted to plugin context).
  </PHASE>

  <PHASE id="3" name="self-validation">
  Read `references/subagent-validation-criteria.md` and execute its **Validation Loop Instructions** against the generated subagent definition.

  In addition to the shared criteria, enforce two scenario-sensitive checks before proceeding:

  - The frontmatter contains exactly the four allowed keys with the required values (`model: inherit`, `readonly: true`). No other key, no other model value, no other readonly value.
  - If Phase 1 detected a monorepo or multi-service layout, confirm the generated prompt names the relevant services, workspaces, or scope boundaries explicitly.

  The loop evaluates all hard limits and quality checks — including the canonical semantic-tag strictness tiers — fixes any failures, and re-evaluates: maximum 3 iterations. Do not proceed to Phase 4 until ALL criteria pass.
  </PHASE>

  <PHASE id="4" name="present-and-write">
  1. Show the user the complete generated subagent definition.
  2. Cite the evidence from reference files that informed key decisions:
     - Why this scope and role (heuristic from `subagent-authoring-guide.md`).
     - Why the description has these triggers (routing signal from the authoring guide).
     - Why the system prompt has these sections (structure from prompt-engineering strategies).
  3. If the user requested any frontmatter key outside the allowed four (or any model value other than `inherit`), refuse and cite `subagent-validation-criteria.md`. Offer to translate the request into a Cursor-native form.
  4. Ask for confirmation before writing any files.
  5. On approval, write the subagent definition to the target location.
  </PHASE>

</PROCESS>

<VALIDATION loop="max-iterations:3">
Read `references/subagent-validation-criteria.md` and loop the generated subagent through every hard limit, quality check, and canonical semantic-tag strictness tier until all pass.
</VALIDATION>
