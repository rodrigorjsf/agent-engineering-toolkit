# Normative Source Matrix

> **Status**: Active
> **Source**: [PRD #56 — Repository Compliance Program](https://github.com/rodrigorjsf/agent-engineering-toolkit/issues/56), Phase 1
> **Scope**: Authority model for all repository distributions and artifact types

This document defines which documentation sources are authoritative for every (scope × artifact type) combination in the repository. Validators resolve their source bundles from this matrix — no guesswork required.

---

## Contents

- [Purpose and Precedence Model](#purpose-and-precedence-model)
- [Scope Registry](#scope-registry)
- [Normative Source Catalog](#normative-source-catalog)
- [Artifact Type Registry](#artifact-type-registry)
- [Normative Matrix](#normative-matrix)
- [Contamination Rules](#contamination-rules)
- [Named Source Bundles](#named-source-bundles)
- [Excluded Sources](#excluded-sources)

---

## Purpose and Precedence Model

When multiple sources could apply to an artifact, use this precedence order:

| Tier | Category | Role | Example |
|------|----------|------|---------|
| 1 | Platform-specific docs | Defines artifact behavior | `docs/cursor/rules/rules.md` for `.mdc` format |
| 2 | Shared open standards | Cross-platform contracts | Agent Skills specification for SKILL.md format |
| 3 | Project design guidance | Project-wide constraints | `DESIGN-GUIDELINES.md` for line budgets |
| 4 | General-LLM research | Supporting context only | ETH Zurich study for minimalism rationale |

**Rules**:
- Higher-tier sources override lower-tier on conflicts
- Project rules (`.claude/rules/`, `.github/instructions/`) enforce Tier 1-3 constraints — they are project-level normative
- Analysis docs (`docs/analysis/`) are Tier 4 — they accelerate understanding but never serve as sole authority
- Tier 4 sources may inform WHY a constraint exists but never override WHAT the constraint is

---

## Scope Registry

| Scope ID | Distribution | Directory | Platform | Plugin Type |
|----------|-------------|-----------|----------|-------------|
| `agents-initializer` | Claude Code plugin | `plugins/agents-initializer/` | Claude Code | `.claude-plugin` |
| `agent-customizer` | Claude Code plugin | `plugins/agent-customizer/` | Claude Code | `.claude-plugin` |
| `cursor-initializer` | Cursor IDE plugin | `plugins/cursor-initializer/` | Cursor | `.cursor-plugin` |
| `cursor-customizer` | Cursor IDE plugin | `plugins/cursor-customizer/` | Cursor | `.cursor-plugin` |
| `standalone` | Portable skills | `skills/` | Any AI tool | None |
| `repository-global` | Governance artifacts | Root, `.claude/rules/`, `.github/instructions/`, `docs/` | All | N/A |

---

## Normative Source Catalog

### Platform-Specific Sources (Tier 1)

| Source ID | Scope | Canonical Path | Description |
|-----------|-------|----------------|-------------|
| `CLAUDE-HOOKS` | Claude | `docs/claude-code/hooks/` | Claude hook lifecycle, events, JSON I/O |
| `CLAUDE-PLUGINS` | Claude | `docs/claude-code/plugins/` | Claude plugin creation, manifest, distribution |
| `CLAUDE-SKILLS` | Claude | `docs/claude-code/skills/` | Claude skills format, discovery, invocation |
| `CLAUDE-SUBAGENTS` | Claude | `docs/claude-code/subagents/` | Claude subagent creation, isolation, orchestration |
| `CLAUDE-MEMORY` | Claude | `docs/claude-code/memory/` | CLAUDE.md hierarchy, auto memory, path-scoped rules |
| `CLAUDE-PROMPTING` | Claude | `docs/claude-code/claude-prompting-best-practices.md` | Claude-specific prompting techniques |
| `CURSOR-RULES` | Cursor | `docs/cursor/rules/` | Cursor rules system, `.mdc` format, path scoping |
| `CURSOR-SKILLS` | Cursor | `docs/cursor/skills/` | Cursor skills implementation, SKILL.md invocation |
| `CURSOR-SUBAGENTS` | Cursor | `docs/cursor/subagents/` | Cursor subagents, isolation, parallel execution |
| `CURSOR-HOOKS` | Cursor | `docs/cursor/hooks/` | Cursor hooks, JSON stdio, agent loop observation |
| `CURSOR-PLUGIN` | Cursor | `docs/cursor/plugin/` | Cursor plugin structure, manifest, bundling |
| `CURSOR-TOOLS` | Cursor | `docs/cursor/tools/` | Cursor browser, search, terminal, worktrees |
| `CURSOR-PRACTICES` | Cursor | `docs/cursor/best-practices/` | Cursor agent best practices, Plan Mode |

### Shared Standards (Tier 2)

| Source ID | Canonical Path | Description |
|-----------|----------------|-------------|
| `SHARED-SKILLS-STD` | `docs/shared/skills-standard/` | Agent Skills open standard specification (agentskills.io) |
| `SHARED-AUTHORING` | `docs/shared/skill-authoring-best-practices.md` | Universal skill writing guide |

### Project Design Guidance (Tier 3)

| Source ID | Canonical Path | Description |
|-----------|----------------|-------------|
| `PROJECT-DESIGN-GUIDELINES` | `DESIGN-GUIDELINES.md` | Evidence-based design principles with implementation traceability |

### General-LLM Research (Tier 4 — Supporting Only)

| Source ID | Canonical Path | Description |
|-----------|----------------|-------------|
| `GENERAL-AGENTS-PAPER` | `docs/general-llm/Evaluating-AGENTS-paper.md` | ETH Zurich study on AGENTS.md effectiveness |
| `GENERAL-CONTEXT` | `docs/general-llm/research-context-engineering-comprehensive.md` | Context optimization, attention budget, lost-in-the-middle |
| `GENERAL-CONTEXT-ROT` | `docs/general-llm/research-context-rot-and-management.md` | Context rot, window management, RAG quality |
| `GENERAL-SUBAGENTS` | `docs/general-llm/subagents/research-subagent-best-practices.md` | Universal subagent patterns |
| `GENERAL-AGENTS-GUIDE` | `docs/general-llm/a-guide-to-agents.md` | AGENTS.md minimalism, instruction budget |
| `GENERAL-WORKFLOWS` | `docs/general-llm/research-agent-workflows-and-patterns.md` | Agent workflow patterns |
| `GENERAL-PROMPTING` | `docs/general-llm/prompt-engineering-guide.md` | Prompt engineering techniques catalog |
| `GENERAL-MULTILINGUAL` | `docs/general-llm/research-multilingual-performance.md` | Language tokenization, self-translate strategy |
| `GENERAL-WHITESPACE` | `docs/general-llm/research-whitespace-and-formatting.md` | BPE tokenizer behavior, formatting impact |

### Analysis Documents (Tier 4 — Interpretive Only)

| Source ID | Canonical Path | Analyzes |
|-----------|----------------|----------|
| `ANALYSIS-CLAUDE-*` | `docs/analysis/analysis-{claude-topic}.md` | Claude-specific source interpretations |
| `ANALYSIS-CURSOR-*` | (none currently) | Cursor source interpretations (if created) |
| `ANALYSIS-CROSS-*` | `docs/analysis/analysis-a-guide-to-agents.md` | Cross-platform source interpretations |
| `ANALYSIS-GENERAL-*` | `docs/analysis/analysis-evaluating-agents-paper.md` etc. | General-LLM research interpretations |

### Project Rules (Normative — enforce Tier 1-3 constraints)

| Rule ID | Canonical Path | Governs |
|---------|----------------|---------|
| `rule:plugin-skills` | `.claude/rules/plugin-skills.md` | Claude plugin SKILL.md files |
| `rule:cursor-plugin-skills` | `.claude/rules/cursor-plugin-skills.md` | Cursor plugin SKILL.md files |
| `rule:standalone-skills` | `.claude/rules/standalone-skills.md` | Standalone SKILL.md files |
| `rule:agent-files` | `.claude/rules/agent-files.md` | Claude agent definitions |
| `rule:cursor-agent-files` | `.claude/rules/cursor-agent-files.md` | Cursor agent definitions |
| `rule:reference-files` | `.claude/rules/reference-files.md` | All reference files |
| `rule:readme-files` | `.claude/rules/readme-files.md` | All README files |

<!-- RAG rules and reindex hook removed per ADR-0004. -->

### Review Instructions (Normative — review-time enforcement)

| Instruction ID | Canonical Path | Governs |
|----------------|----------------|---------|
| `instr:skill-files` | `.github/instructions/skill-files.instructions.md` | All SKILL.md files |
| `instr:agent-definitions` | `.github/instructions/agent-definitions.instructions.md` | All agent definitions |
| `instr:reference-files` | `.github/instructions/reference-files.instructions.md` | All reference files |
| `instr:template-files` | `.github/instructions/template-files.instructions.md` | All template files |
| `instr:plugin-config` | `.github/instructions/plugin-config.instructions.md` | Plugin manifests, CLAUDE.md, DESIGN-GUIDELINES |
| `instr:rules` | `.github/instructions/rules.instructions.md` | Rule files in `.claude/rules/` |
| `instr:documentation` | `.github/instructions/documentation.instructions.md` | All `docs/` files |
| `instr:prp-artifacts` | `.github/instructions/prp-artifacts.instructions.md` | PRD and plan files |
| `instr:readme-files` | `.github/instructions/readme-files.instructions.md` | README files |

---

## Artifact Type Registry

| Artifact Type | File Pattern | Present In |
|---------------|-------------|------------|
| `skill` | `*/SKILL.md` | All 5 scopes |
| `agent` | `agents/*.md` | agents-initializer, cursor-initializer, agent-customizer |
| `reference` | `references/*.md` | All 4 distribution scopes |
| `template` | `assets/templates/*.md`, `*.mdc` | All 4 distribution scopes |
| `plugin-manifest` | `plugin.json`, `marketplace.json` | agents-initializer, cursor-initializer, agent-customizer |
| `config-file` | `CLAUDE.md`, `AGENTS.md` | All 5 scopes |
| `readme` | `README.md` | All 5 scopes |
| `rule` | `.claude/rules/*.md` | repository-global |
| `instruction` | `.github/instructions/*.md` | repository-global |
| `docs` | `docs/**/*.md` | repository-global |

---

## Normative Matrix

### agents-initializer (Claude Code Plugin)

| Artifact | Primary Sources | Secondary Sources | Project Rules | Forbidden Sources |
|----------|----------------|-------------------|---------------|-------------------|
| `skill` | `CLAUDE-SKILLS`, `CLAUDE-PLUGINS` | `SHARED-SKILLS-STD`, `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES` | `rule:plugin-skills`, `instr:skill-files` | `CURSOR-*`, standalone inline patterns |
| `agent` | `CLAUDE-SUBAGENTS` | `GENERAL-SUBAGENTS`, `PROJECT-DESIGN-GUIDELINES` | `rule:agent-files`, `instr:agent-definitions` | `CURSOR-SUBAGENTS`, `readonly`/`inherit` fields |
| `reference` | `CLAUDE-MEMORY`, `CLAUDE-SKILLS` | `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES` | `rule:reference-files`, `instr:reference-files` | `CURSOR-RULES` (.mdc guidance) |
| `template` | `CLAUDE-MEMORY`, `CLAUDE-SKILLS` | `PROJECT-DESIGN-GUIDELINES` | `instr:template-files` | `CURSOR-RULES` (.mdc templates), `globs:`/`alwaysApply` frontmatter |
| `plugin-manifest` | `CLAUDE-PLUGINS` | — | `instr:plugin-config` | `CURSOR-PLUGIN` manifest fields |
| `config-file` | `CLAUDE-MEMORY` | `PROJECT-DESIGN-GUIDELINES`, `GENERAL-AGENTS-GUIDE` | `instr:plugin-config` | `CURSOR-RULES`, `.mdc` format |
| `readme` | `CLAUDE-PLUGINS` | `PROJECT-DESIGN-GUIDELINES` | `rule:readme-files`, `instr:readme-files` | Cursor-only skills, standalone-only content |

### agent-customizer (Claude Code Plugin)

| Artifact | Primary Sources | Secondary Sources | Project Rules | Forbidden Sources |
|----------|----------------|-------------------|---------------|-------------------|
| `skill` | `CLAUDE-SKILLS`, `CLAUDE-PLUGINS` | `SHARED-SKILLS-STD`, `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES` | `rule:plugin-skills`, `instr:skill-files` | `CURSOR-*`, standalone inline patterns |
| `agent` | `CLAUDE-SUBAGENTS` | `GENERAL-SUBAGENTS`, `PROJECT-DESIGN-GUIDELINES` | `rule:agent-files`, `instr:agent-definitions` | `CURSOR-SUBAGENTS`, `readonly`/`inherit` fields |
| `reference` | `CLAUDE-SKILLS`, `CLAUDE-HOOKS`, `CLAUDE-SUBAGENTS` | `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES` | `rule:reference-files`, `instr:reference-files` | `CURSOR-RULES`, `CURSOR-HOOKS` |
| `template` | `CLAUDE-SKILLS`, `CLAUDE-HOOKS` | `PROJECT-DESIGN-GUIDELINES` | `instr:template-files` | `CURSOR-RULES` (.mdc templates) |
| `plugin-manifest` | `CLAUDE-PLUGINS` | — | `instr:plugin-config` | `CURSOR-PLUGIN` manifest fields |
| `config-file` | `CLAUDE-MEMORY` | `PROJECT-DESIGN-GUIDELINES`, `GENERAL-AGENTS-GUIDE` | `instr:plugin-config` | `CURSOR-RULES`, `.mdc` format |
| `readme` | `CLAUDE-PLUGINS` | `PROJECT-DESIGN-GUIDELINES` | `rule:readme-files`, `instr:readme-files` | Cursor-only content |

### cursor-initializer (Cursor Plugin)

| Artifact | Primary Sources | Secondary Sources | Project Rules | Forbidden Sources |
|----------|----------------|-------------------|---------------|-------------------|
| `skill` | `CURSOR-SKILLS`, `CURSOR-PLUGIN` | `SHARED-SKILLS-STD`, `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES` | `rule:cursor-plugin-skills`, `instr:skill-files` | `CLAUDE-*`, `${CLAUDE_SKILL_DIR}`, inline bash patterns |
| `agent` | `CURSOR-SUBAGENTS` | `GENERAL-SUBAGENTS`, `PROJECT-DESIGN-GUIDELINES` | `rule:cursor-agent-files`, `instr:agent-definitions` | `CLAUDE-SUBAGENTS`, `tools:`/`maxTurns:` fields |
| `reference` | `CURSOR-RULES`, `CURSOR-SKILLS` | `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES` | `rule:reference-files`, `instr:reference-files` | `CLAUDE-MEMORY` (`paths:` guidance) |
| `template` | `CURSOR-RULES`, `CURSOR-SKILLS` | `PROJECT-DESIGN-GUIDELINES` | `instr:template-files` | `paths:` frontmatter, Claude hook templates |
| `plugin-manifest` | `CURSOR-PLUGIN` | — | `instr:plugin-config` | `CLAUDE-PLUGINS` manifest fields |
| `config-file` | `CURSOR-RULES`, `CURSOR-PRACTICES` | `PROJECT-DESIGN-GUIDELINES`, `GENERAL-AGENTS-GUIDE` | `instr:plugin-config` | `CLAUDE-MEMORY`, `.claude/rules/` patterns |
| `readme` | `CURSOR-PLUGIN` | `PROJECT-DESIGN-GUIDELINES` | `rule:readme-files`, `instr:readme-files` | Claude-only skills, standalone-only content |

### cursor-customizer (Cursor Plugin)

| Artifact | Primary Sources | Secondary Sources | Project Rules | Forbidden Sources |
|----------|----------------|-------------------|---------------|-------------------|
| `skill` | `CURSOR-SKILLS`, `CURSOR-PLUGIN` | `SHARED-SKILLS-STD`, `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES` | `rule:cursor-plugin-skills`, `instr:skill-files` | `CLAUDE-*`, `${CLAUDE_SKILL_DIR}`, inline bash patterns |
| `agent` | `CURSOR-SUBAGENTS` | `GENERAL-SUBAGENTS`, `PROJECT-DESIGN-GUIDELINES` | `rule:cursor-agent-files`, `instr:agent-definitions` | `CLAUDE-SUBAGENTS`, `tools:`/`maxTurns:` fields |
| `reference` | `CURSOR-RULES`, `CURSOR-SKILLS` | `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES` | `rule:reference-files`, `instr:reference-files` | `CLAUDE-MEMORY` (`paths:` guidance) |
| `template` | `CURSOR-RULES`, `CURSOR-SKILLS` | `PROJECT-DESIGN-GUIDELINES` | `instr:template-files` | `paths:` frontmatter, Claude hook templates |
| `plugin-manifest` | `CURSOR-PLUGIN` | — | `instr:plugin-config` | `CLAUDE-PLUGINS` manifest fields |
| `config-file` | `CURSOR-RULES`, `CURSOR-PRACTICES` | `PROJECT-DESIGN-GUIDELINES`, `GENERAL-AGENTS-GUIDE` | `instr:plugin-config` | `CLAUDE-MEMORY`, `.claude/rules/` patterns |
| `readme` | `CURSOR-PLUGIN` | `PROJECT-DESIGN-GUIDELINES` | `rule:readme-files`, `instr:readme-files` | Claude-only skills, standalone-only content |

### standalone (Portable Skills)

| Artifact | Primary Sources | Secondary Sources | Project Rules | Forbidden Sources |
|----------|----------------|-------------------|---------------|-------------------|
| `skill` | `SHARED-SKILLS-STD` | `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES` | `rule:standalone-skills`, `instr:skill-files` | `CLAUDE-*`, `CURSOR-*`, agent delegation, Task tool |
| `reference` | `SHARED-AUTHORING` | `PROJECT-DESIGN-GUIDELINES`, `GENERAL-AGENTS-GUIDE` | `rule:reference-files`, `instr:reference-files` | `CLAUDE-HOOKS`, `CURSOR-HOOKS` (hook/subagent guidance) |
| `template` | `SHARED-SKILLS-STD` | `PROJECT-DESIGN-GUIDELINES` | `instr:template-files` | `.mdc` templates, hook-config templates, `paths:`/`globs:` forbidden in neutral-skill templates; allowed in platform-targeted-skill templates per ADR-0005 |
| `readme` | `SHARED-SKILLS-STD` | `PROJECT-DESIGN-GUIDELINES` | `rule:readme-files`, `instr:readme-files` | Cursor-only skills (init-cursor, improve-cursor), plugin content |

### repository-global (Governance Artifacts)

| Artifact | Primary Sources | Secondary Sources | Project Rules | Forbidden Sources |
|----------|----------------|-------------------|---------------|-------------------|
| `rule` | `CLAUDE-MEMORY` | `PROJECT-DESIGN-GUIDELINES` | `instr:rules` | — |
| `instruction` | `PROJECT-DESIGN-GUIDELINES` | `SHARED-AUTHORING` | — | — |
| `config-file` (root) | `CLAUDE-MEMORY`, `PROJECT-DESIGN-GUIDELINES` | `GENERAL-AGENTS-GUIDE` | `instr:plugin-config` | — |
| `docs` | Per-subdirectory scope (see catalog) | `PROJECT-DESIGN-GUIDELINES` | `instr:documentation` | Completed PRPs, historical plans |
| `readme` (root) | `PROJECT-DESIGN-GUIDELINES` | — | `rule:readme-files`, `instr:readme-files` | Per-plugin detail |

---

## Contamination Rules

### Claude ↔ Cursor Isolation

| Boundary | Claude Artifacts | Cursor Artifacts |
|----------|-----------------|------------------|
| Agent frontmatter | `tools`, `model: sonnet`, `maxTurns` | `readonly: true`, `model: inherit` |
| Rule format | `.claude/rules/*.md` with `paths:` frontmatter | `.cursor/rules/*.mdc` with `globs:`/`alwaysApply` |
| Bundled file refs | `${CLAUDE_SKILL_DIR}/references/...` | Relative paths: `references/...` |
| Skill analysis | Delegates to named agents | Delegates to named agents (Cursor-native) |
| Output targets | `.claude/rules/`, `CLAUDE.md` | `.cursor/rules/`, `AGENTS.md` |

**Violation**: Any Claude-specific field in a Cursor artifact or vice versa.

### Plugin ↔ Standalone Isolation

| Boundary | Plugin Skills | Standalone Skills |
|----------|--------------|-------------------|
| Analysis | MUST delegate to registered agents | MUST use inline bash commands |
| Agent references | Required (codebase-analyzer, scope-detector, etc.) | Forbidden (no agent names) |
| Migration suggestions | All 4 mechanisms (hooks, rules, skills, subagents) | Only skills and path-scoped rules |
| Dependencies | Task tool, plugin infrastructure | Self-contained, any AI tool |

**Violation**: Agent delegation in standalone skills or inline bash analysis in plugin skills.

### Init ↔ Improve Lifecycle

| Boundary | Init Skills | Improve Skills |
|----------|------------|----------------|
| Templates | No migration templates, no provenance comments | Migration templates WITH provenance comments |
| Hook templates | Never | Plugin improve skills only (not standalone) |
| Output | Fresh generation | Evaluation + migration of existing artifacts |

### Distribution Output Targets

| Skill | Output Artifacts |
|-------|-----------------|
| `init-claude`, `improve-claude` | `.claude/rules/*.md`, `CLAUDE.md` |
| `init-cursor`, `improve-cursor` | `.cursor/rules/*.mdc`, `AGENTS.md` |
| `init-agents`, `improve-agents` | `AGENTS.md` only (portable) |
| Standalone create/improve | Platform-appropriate artifacts |

---

## Named Source Bundles

Validators load one of these bundles based on scope. Each bundle lists the source IDs to include.

### `claude-plugin-bundle`

For `agents-initializer` and `agent-customizer` scopes:
- **Primary**: `CLAUDE-SKILLS`, `CLAUDE-PLUGINS`, `CLAUDE-SUBAGENTS`, `CLAUDE-MEMORY`, `CLAUDE-HOOKS`
- **Secondary**: `SHARED-SKILLS-STD`, `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES`
- **Project**: `rule:plugin-skills`, `rule:agent-files`, `rule:reference-files`, `rule:readme-files`, `instr:skill-files`, `instr:agent-definitions`, `instr:reference-files`, `instr:template-files`, `instr:plugin-config`, `instr:readme-files`
- **Supporting**: `GENERAL-AGENTS-PAPER`, `GENERAL-CONTEXT`, `GENERAL-SUBAGENTS`
- **Forbidden**: All `CURSOR-*` sources

### `cursor-plugin-bundle`

For `cursor-initializer` and `cursor-customizer` scopes:
- **Primary**: `CURSOR-SKILLS`, `CURSOR-PLUGIN`, `CURSOR-SUBAGENTS`, `CURSOR-RULES`, `CURSOR-HOOKS`, `CURSOR-PRACTICES`
- **Secondary**: `SHARED-SKILLS-STD`, `SHARED-AUTHORING`, `PROJECT-DESIGN-GUIDELINES`
- **Project**: `rule:cursor-plugin-skills`, `rule:cursor-agent-files`, `rule:reference-files`, `rule:readme-files`, `instr:skill-files`, `instr:agent-definitions`, `instr:reference-files`, `instr:template-files`, `instr:plugin-config`, `instr:readme-files`
- **Supporting**: `GENERAL-AGENTS-PAPER`, `GENERAL-CONTEXT`, `GENERAL-SUBAGENTS`
- **Forbidden**: All `CLAUDE-*` sources

### `standalone-bundle`

For `standalone` scope:
- **Primary**: `SHARED-SKILLS-STD`, `SHARED-AUTHORING`
- **Secondary**: `PROJECT-DESIGN-GUIDELINES`, `GENERAL-AGENTS-GUIDE`
- **Project**: `rule:standalone-skills`, `rule:reference-files`, `rule:readme-files`, `instr:skill-files`, `instr:reference-files`, `instr:template-files`, `instr:readme-files`
- **Supporting**: `GENERAL-AGENTS-PAPER`, `GENERAL-CONTEXT`
- **Forbidden**: All `CLAUDE-*` sources, all `CURSOR-*` sources, hook/subagent-specific guidance
- **Two-layer split (ADR-0005)**: Skill body (SKILL.md prose, `references/`) must source only `SHARED-*` and `GENERAL-*` IDs; templates (`assets/templates/`) MAY use platform-specific source IDs if and only if the skill's `name` field declares that platform target.

### `agent-customizer-bundle`

Extends `claude-plugin-bundle` with:
- **Additional Project**: `instr:rules` (agent-customizer creates/improves rules)
- **Additional Primary**: `CLAUDE-HOOKS` (agent-customizer creates/improves hooks)

### `governance-bundle`

For `repository-global` scope:
- **Primary**: `PROJECT-DESIGN-GUIDELINES`, `CLAUDE-MEMORY`
- **Secondary**: `SHARED-AUTHORING`, `GENERAL-AGENTS-GUIDE`
- **Project**: `instr:rules`, `instr:documentation`, `instr:plugin-config`, `instr:readme-files`, `instr:prp-artifacts`
- **Supporting**: All `GENERAL-*` sources
- **Forbidden**: Completed PRPs, historical plans, `next-steps.md`

---

## Excluded Sources

These artifacts are **never** normative authority for compliance validation:

| Excluded Path | Reason |
|---------------|--------|
| `docs/plans/` | Historical design documents — superseded by implemented code and current docs |
| `.claude/PRPs/plans/completed/` | Completed implementation checklists — the code is the authority |
| `.claude/PRPs/prds/completed/` | Completed product requirements — superseded by implementation |
| `.claude/PRPs/reports/` | Implementation reports — record of past work, not ongoing authority |
| `next-steps.md` | Personal session task tracking — not project normative |
| `docs/analysis/*` (as sole authority) | Analysis docs interpret sources — the original source is the authority |
