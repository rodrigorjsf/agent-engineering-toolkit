---
name: create-subagent
description: "Creates new subagent definitions with YAML frontmatter grounded in the docs corpus. Includes model selection heuristics and tool restriction patterns. Use when creating a new Claude Code subagent from scratch."
---

# Create Subagent

Generates a new subagent definition with correct YAML frontmatter, minimal tool restrictions, and a structured body grounded in the docs corpus.

<TRIGGER when="creating a new Claude Code subagent from scratch" />

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
- **NEVER** create subagents with generic system prompts ("you are a helpful AI assistant")
- **NEVER** grant write tools (`Edit`, `Write`) to read-only analysis or review agents; allow `Bash` only for explicitly read-only commands when needed
- **NEVER** set `maxTurns` > 30 without explicit justification in the system prompt
- **EVERY** subagent must include: role definition, process steps, output format, and self-verification instructions
- **EVERY** `description` must include specific "Use when..." trigger phrases so Claude routes correctly
- **EVERY** generated subagent body must carry the canonical semantic-tag vocabulary (`<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` with `<PHASE>`); `<TRIGGER>` is optional for subagents
- **Agents CANNOT spawn other agents** — the Task tool is unavailable at runtime; warn if user requests this
- Plugin context: `hooks`, `mcpServers`, and `permissionMode` fields are ignored for plugin agents
</HARD_RULES>

<PROCESS>

  <PREFLIGHT name="name-collision-check">
  Check if a subagent with the same name already exists at:

  - `.claude/agents/{requested-name}.md`
  - `plugins/*/agents/{requested-name}.md`

  **If a subagent already exists with that name:**

  1. Inform the user: "A subagent named `{requested-name}` already exists."
  2. Suggest using `/agent-customizer:improve-subagent` to evaluate and optimize it instead.
  3. **STOP** — do not proceed. The user should either choose a different name or use the improve skill.

  **If no subagent exists with that name:**
  Proceed to Phase 1 below.
  </PREFLIGHT>

  <PHASE id="1" name="codebase-analysis">
  Delegate to the `artifact-analyzer` agent with this task:

  > Analyze the project to understand existing subagents. Focus on: agent names and roles in `.claude/agents/` and `plugins/*/agents/`, tool restrictions in use, model choices, `maxTurns` values, which skills delegate to which agents, and naming conventions. Flag any agents similar in purpose to `{requested-name}`. Also identify the project layout: whether this is a monorepo with multiple service packages (indicated by workspace files like `pnpm-workspace.yaml`, a `package.json` with a `workspaces` field, multiple `go.mod` files in subdirectories, or multiple `pyproject.toml` files in subdirectories) or a single-package project, and report any service directory paths for use in scope resolution.

  The agent runs on Sonnet with read-only tools (Read, Grep, Glob, Bash) in an isolated context. Wait for it to complete and parse its structured output.
  </PHASE>

  <PHASE id="2" name="generate-subagent">
  **Load context.** Drop any references from Phase 1. Read these references:

  - `${CLAUDE_SKILL_DIR}/references/subagent-authoring-guide.md` — when to use subagents, system prompt structure, model selection heuristics, tool restriction patterns, anti-patterns
  - `${CLAUDE_SKILL_DIR}/references/subagent-config-reference.md` — YAML frontmatter fields, valid model IDs, tool allowlist/denylist, orchestration patterns, plugin restrictions

  Decide model selection, tool restrictions, and target location.

  **Apply patterns.** Drop the load-context references above. Read this reference:

  - `${CLAUDE_SKILL_DIR}/references/prompt-engineering-strategies.md` — subagent-specific prompting (role prompting, structured output, confidence filtering)

  <REFERENCES load="on-demand">
  - subagent-authoring-guide.md
  - subagent-config-reference.md
  - prompt-engineering-strategies.md
  </REFERENCES>

  Read `${CLAUDE_SKILL_DIR}/assets/templates/subagent-definition.md` and fill its placeholders using:

  - User requirements for the new subagent (role, purpose, tools needed)
  - Phase 1 analysis output (existing agents, naming conventions, delegation patterns)
  - Decisions from Phase 2a (model, tools, target location)

  Apply model selection heuristic:

  - `haiku` — narrow read-only lookup agents with no structured judgment, policy evaluation, or config review
  - `sonnet` — standard analysis, review, and configuration-inspection agents (default for most subagents)
  - `opus` — complex multi-step reasoning only (requires explicit justification)

  Unless the user explicitly asks for a cheaper exploration agent, choose `sonnet` for any agent that inspects configuration, evaluates compliance, or produces structured findings.

  If Phase 1 detects a monorepo or multi-service layout, make the generated system prompt name the relevant services, workspaces, and scope boundaries the agent should inspect. Do not leave multi-service targets implicit.

  Determine target location:

  - `.claude/agents/{name}.md` — project-level agent (accessible everywhere)
  - `plugins/{plugin}/agents/{name}.md` — plugin-scoped agent (restricted to plugin context)
  </PHASE>

  <PHASE id="3" name="self-validation">
  Read `${CLAUDE_SKILL_DIR}/references/subagent-validation-criteria.md` and execute its **Validation Loop Instructions** against the generated subagent definition.

  In addition to the shared criteria, enforce two scenario-sensitive checks before proceeding:

  - Treat `sonnet` as the default for configuration inspection, compliance review, and other structured analysis agents unless the user explicitly asks for a cheaper exploration agent
  - If Phase 1 detected a monorepo or multi-service layout, confirm the generated prompt names the relevant services, workspaces, or scope boundaries explicitly

  The loop evaluates all hard limits, quality checks, and canonical semantic-tag strictness tiers — fixing any failures and re-evaluating — maximum 3 iterations. Do not proceed to Phase 4 until ALL criteria pass.
  </PHASE>

  <PHASE id="4" name="present-and-write">
  1. Show the user the complete generated subagent definition
  2. Cite the evidence from reference files that informed key decisions:
     - Why this model was chosen (heuristic applied)
     - Why these tools are included/excluded (principle of least privilege)
     - What the output format enforces and why
  3. If the user requested plugin-restricted fields (`hooks`, `mcpServers`, `permissionMode`), warn that these fields are ignored in plugin context
  4. Ask for confirmation before writing any files
  5. On approval, write the subagent definition to the target location
  </PHASE>

</PROCESS>

<VALIDATION loop="max-iterations:3">
Read `${CLAUDE_SKILL_DIR}/references/subagent-validation-criteria.md` and loop the generated subagent through every hard limit, quality check, and canonical semantic-tag strictness tier until all pass.
</VALIDATION>
