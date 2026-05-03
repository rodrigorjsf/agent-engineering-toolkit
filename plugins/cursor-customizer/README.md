# cursor-customizer

Rules-first, product-strict creation and improvement of individual Cursor artifacts (rules, hooks, skills, subagents) for projects already initialized for Cursor. Sibling of `cursor-initializer` — the initializer bootstraps the project; this customizer operates on it after the fact.

The plugin will cover all four Cursor artifact types through eight skills: `create-rule`, `create-hook`, `create-skill`, `create-subagent`, `improve-rule`, `improve-hook`, `improve-skill`, and `improve-subagent`. This release ships the foundation only — skills land in upcoming slices.

## Cost and Model Guidance

This plugin analyzes your entire codebase and evaluates artifacts against the documentation corpus before generating or improving them.
Execution cost scales with project size and the number of artifacts — a large project with many existing skills, hooks, and rules can be expensive to run.

**Recommended model:** a frontier reasoning model delivers the best analysis quality for this workload.
**Viable alternative:** a frontier balanced model with high effort produces decent results at lower cost.

**Usage pattern:** run each skill once per artifact, or when the artifact or its source documentation has changed significantly.
Not on every session.

The long-term benefit is that every future agent session becomes cheaper and more accurate after
well-structured artifacts are in place. Treat each creation or improvement run as a one-time investment — not routine work.

## Why This Plugin Exists

### The Problem with Ungrounded Artifact Authoring

Developers often write Cursor artifacts from scratch, relying on memory, scattered examples, or generic prompts instead of current source docs. That produces bloated skills, unsafe hooks, vague rules, and weak subagent prompts that look plausible but drift from the documented platform behavior.

The risk is measurable. The ETH Zurich study **"Evaluating AGENTS.md"** (February 2026) evaluated multiple coding agents across hundreds of real-world tasks:

| Setting | Task Success Impact | Cost Impact |
|---------|---------------------|-------------|
| No config file | Baseline | Baseline |
| LLM-generated config file | **-3% success rate** | **+20% cost** |
| Developer-written minimal file | **+4% success rate** | +19% cost |

**Key findings:**

- Auto-generated guidance tends to repeat what the model already knows, which wastes attention budget.
- Extra requirements make tasks harder because the model follows irrelevant instructions anyway.
- Minimal, developer-written guidance performs better because it captures the few non-obvious details that matter.
- The same failure mode applies to artifact authoring: generic prompts produce generic artifacts.

### The Evidence-Based Solution

This plugin turns the Cursor documentation corpus and the supporting industry research into reusable authoring workflows:

1. **Distilled reference files** keep each guidance file under 200 lines and load them only when needed.
2. **Source attribution** traces every reference back to current source docs, including the entries that will be registered in `docs-drift-manifest.md`.
3. **Five-phase orchestration** gives each skill a consistent flow: preflight, analysis, generation, validation, and presentation.
4. **Self-validation loops** check output against artifact-specific criteria before presenting it.
5. **Evidence citations** keep generated artifacts grounded instead of relying on folklore or stale examples.

## Architecture

### Subagent-Driven Design

The plugin uses Cursor-native read-only subagents to keep the orchestrator focused on authoring decisions instead of exploratory reading. This release introduces only the shared `artifact-analyzer`; per-type evaluators land alongside their respective artifact-type slices.

| Subagent | Role | Used By |
|----------|------|---------|
| `artifact-analyzer` | Catalogs the project's existing artifact landscape: skills under `.cursor/skills/` and `.agents/skills/`, subagents under `.cursor/agents/`, rules under `.cursor/rules/*.mdc`, hook configurations, naming conventions, integration points | All skills (planned) |
| `rule-evaluator` | Evaluates `.cursor/rules/*.mdc` files against docs-derived quality criteria | `improve-rule` (planned) |
| `hook-evaluator` | Evaluates Cursor hook configurations against docs-derived quality criteria | `improve-hook` (planned) |
| `skill-evaluator` | Evaluates `SKILL.md` files against docs-derived quality criteria | `improve-skill` (planned) |
| `subagent-evaluator` | Evaluates Cursor subagent definitions against docs-derived quality criteria | `improve-subagent` (planned) |
| `docs-drift-checker` | Verifies reference files against source docs for content drift | Quality gate and documentation audits (planned) |

#### Subagent Metadata

Each agent file follows Cursor's native subagent format:

```yaml
---
name: artifact-analyzer
description: "Analyze a Cursor project's existing artifact landscape — skills, subagents, rules, hook configurations, naming conventions, and integration patterns. Use when creating or improving an individual Cursor artifact."
model: inherit
readonly: true
---
```

Key design decisions:

- **`model: inherit`** — Cursor agents inherit the model from the parent context.
- **`readonly: true`** — boolean flag (not a tool whitelist); analysis agents cannot perform writes.
- **Frontmatter is exactly four fields** — `name`, `description`, `model`, `readonly`. No additional fields.
- **Isolated context** keeps each agent focused on one artifact type or verification job.

#### Create Workflow

```text
Phase 1: Preflight        -> Check whether the artifact already exists
Phase 2: Context Analysis -> artifact-analyzer scans current project patterns
Phase 3: Generation       -> Load references from the documentation corpus and apply templates
Phase 4: Self-Validation  -> Check against artifact-specific criteria, loop up to 3 times
Phase 5: Presentation     -> Show the result with evidence citations before writing
```

#### Improve Workflow

```text
Phase 1: Evaluate       -> Type-specific evaluator assesses the existing artifact
Phase 2: Compare        -> Cross-reference current docs-backed best practices
Phase 3: Plan           -> Generate removals, refactors, and additions
Phase 4: Self-Validate  -> Check the plan against validation criteria
Phase 5: Present        -> Show the proposed changes with evidence before applying
```

## Skills

> **Status:** populated by upcoming slices. This foundation release ships zero skills and only the shared `artifact-analyzer` subagent. The eight skills below are the planned scope:
>
> - `create-rule` — generate a new `.cursor/rules/*.mdc` rule with the correct activation mode.
> - `create-hook` — generate a Cursor hook configuration for a chosen lifecycle event.
> - `create-skill` — generate a new `SKILL.md` package for `.cursor/skills/` (or `.agents/skills/` when portability is requested).
> - `create-subagent` — generate a Cursor subagent definition with read-only defaults.
> - `improve-rule` — evaluate and optimize an existing `.cursor/rules/*.mdc` rule.
> - `improve-hook` — evaluate and optimize an existing Cursor hook configuration.
> - `improve-skill` — evaluate and optimize an existing `SKILL.md`.
> - `improve-subagent` — evaluate and optimize an existing Cursor subagent definition.

## Installation

### Cursor IDE (Native Plugin System)

For local development and testing, load this repository through Cursor's local plugin directory:

```bash
# Clone the repository
git clone https://github.com/rodrigorjsf/agent-engineering-toolkit.git ~/src/agent-engineering-toolkit

# Register as a local Cursor plugin marketplace
mkdir -p ~/.cursor/plugins/local
ln -s ~/src/agent-engineering-toolkit ~/.cursor/plugins/local/agent-engineering-toolkit
```

Then restart Cursor (or run **Developer: Reload Window**). The repo root `.cursor-plugin/marketplace.json` exposes the `cursor-customizer` plugin alongside `cursor-initializer`.

## Usage

Once skills land in subsequent slices, invoke them by their plugin-namespaced name. The planned invocations are:

```text
# cursor-customizer — create new artifacts (planned)
/cursor-customizer:create-rule
/cursor-customizer:create-hook
/cursor-customizer:create-skill
/cursor-customizer:create-subagent

# cursor-customizer — improve existing artifacts (planned)
/cursor-customizer:improve-rule
/cursor-customizer:improve-hook
/cursor-customizer:improve-skill
/cursor-customizer:improve-subagent
```

## Research Foundation

The plugin distills two source families.

### Cursor Official Documentation

- **[Cursor Rules](../../docs/cursor/rules.md)** — `.mdc` format, activation modes, scoping conventions.
- **[Cursor Hooks Guide](../../docs/cursor/hooks/hooks-guide.md)** — hook event model, handler types, configuration format.
- **[Cursor Agent Skills Guide](../../docs/cursor/skills/agent-skills-guide.md)** — `SKILL.md` package shape, discovery paths, bundled-resource conventions.
- **[Cursor Subagents Guide](../../docs/cursor/subagents/subagents-guide.md)** — Cursor-native subagent format, `readonly` semantics, model-inheritance behavior.

### Industry Research

- **["Evaluating AGENTS.md"](../../docs/general-llm/Evaluating-AGENTS-paper.md)** (ETH Zurich, Feb 2026) — minimal, developer-written guidance outperforms LLM-generated artifacts; directory listings actively harm context quality.
- **["Lost in the Middle"](https://arxiv.org/abs/2307.03172)** (TACL 2023) — models perform worst on information buried in the middle of long contexts; informs reference-file size limits and progressive disclosure.
- **"Effective Context Engineering"** — context-rot research; informs the per-skill reference-file pattern, attention-budget reasoning, and conditional reference loading.

## Anti-Patterns This Plugin Avoids

> **Status:** placeholder. The full anti-pattern table is populated alongside the artifact-type slices, where each anti-pattern is paired with concrete evidence from the corresponding source document. The intended categories are bloat, vagueness, missed activation modes, no validation loop, no improve path, stale references, and one-prompt-strategy-fits-all.

| Anti-Pattern | Evidence | What We Do Instead |
|--------------|----------|-------------------|
| _(populated by artifact-type slices)_ | _(populated by artifact-type slices)_ | _(populated by artifact-type slices)_ |

## Repository Structure

```text
plugins/cursor-customizer/
├── .cursor-plugin/
│   └── plugin.json                  # Plugin manifest (name, version, description)
├── docs-drift-manifest.md           # Registry: per-skill reference files -> source docs
├── agents/
│   └── artifact-analyzer.md         # Project artifact landscape analysis (Cursor-native format)
└── skills/                          # populated by upcoming artifact-type slices
```

A plugin-level conventions file at the plugin root captures author-facing conventions and the boundary with `cursor-initializer`; it is co-located with the manifest and the drift registry.

After upcoming slices land, the tree will grow with one directory per skill under `skills/` (each containing its own `SKILL.md`, `references/`, and `assets/templates/`) and one evaluator subagent per artifact type under `agents/`, plus a `docs-drift-checker` subagent for the quality gate.

## License

MIT
