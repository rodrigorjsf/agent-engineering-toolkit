# Design Guidelines

Every design decision in this plugin traces to published research or official documentation. This document maps each guideline to its evidence source, explains what it means in practice, and identifies which artifacts implement it.

## Core Principle: Minimal Files Outperform Comprehensive Ones

The ETH Zurich study ["Evaluating AGENTS.md"](docs/general-llm/Evaluating-AGENTS-paper.pdf) (February 2026) tested 138 benchmark instances across multiple coding agents and found:

| Configuration                    | Success Impact | Cost Impact |
| -------------------------------- | -------------- | ----------- |
| No config file                   | Baseline       | Baseline    |
| LLM-generated comprehensive file | **-3%**        | **+20%**    |
| Developer-written minimal file   | **+4%**        | +19%        |

Auto-generated files hurt performance because agents follow every instruction — compliance is guaranteed, usefulness is not. Each unnecessary instruction competes for the agent's attention budget.

**In practice**: Every generated instruction must pass the test: *"Would removing this cause the agent to make mistakes?"* If not, cut it.

**Implemented in**: All 4 init skills (root file target: 15-40 lines), all 4 improve skills (removal as highest-priority action), `references/what-not-to-include.md`, `references/validation-criteria.md`

---

## Guideline 1: Progressive Disclosure

**Source**: [Anthropic — Memory & CLAUDE.md](https://docs.anthropic.com/en/docs/claude-code/memory) | [A Guide to AGENTS.md](docs/general-llm/a-guide-to-agents.md)

Organize configuration files in a hierarchy that loads content only when relevant:

| Tier              | Loading Behavior                           | Target Size     | Example                    |
| ----------------- | ------------------------------------------ | --------------- | -------------------------- |
| Root file         | Always loaded                              | 15-40 lines     | `CLAUDE.md`, `AGENTS.md`   |
| Subdirectory file | On-demand (when working in that directory) | 10-30 lines     | `packages/api/CLAUDE.md`   |
| Path-scoped rule  | On-demand (when reading matching files)    | Focused         | `.claude/rules/testing.md` |
| Domain doc        | On-demand (agent navigates there)          | Under 200 lines | `docs/TESTING.md`          |
| Skill             | On-demand (invoked by name)                | Under 500 lines | `/improve-claude`          |

The root file carries a per-session token cost regardless of task relevance. Every line moved from root to an on-demand tier saves attention budget for every task.

**Implemented in**: `references/progressive-disclosure-guide.md`, `references/context-optimization.md`, all init and improve skills (file hierarchy generation)

---

## Guideline 2: The 200-Line Budget

**Source**: [Anthropic — Best Practices](https://docs.anthropic.com/en/docs/claude-code/best-practices) | [Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | [docs/research-context-engineering-comprehensive.md](docs/general-llm/research-context-engineering-comprehensive.md)

Frontier LLMs follow ~150-200 instructions with reasonable consistency. Beyond that, adherence drops as instructions compete for attention. This budget is shared across all always-loaded sources: root CLAUDE.md, unconditional rules, and skill descriptions.

**Hard limits enforced by this plugin**:

- No generated file exceeds 200 lines
- Root files target 15-40 lines
- Scope files target 10-30 lines

**Implemented in**: `references/validation-criteria.md` (hard-fail check), self-validation loop in all 8 skills

---

## Guideline 3: Lost-in-the-Middle Effect

**Source**: [Liu et al., "Lost in the Middle" (TACL 2023)](https://arxiv.org/abs/2307.03172) | [docs/research-context-engineering-comprehensive.md](docs/general-llm/research-context-engineering-comprehensive.md)

Models retrieve information best from the beginning and end of context, worst from the middle. Critical instructions must appear at the top of configuration files; secondary information at the bottom. Never bury key rules in the middle of a long file.

**In practice**: Root files place the project description and critical non-standard tooling first. Domain-specific details live in separate files loaded on-demand, avoiding the middle-of-context problem entirely.

**Implemented in**: All template files (`assets/templates/root-*.md`), progressive disclosure hierarchy

---

## Guideline 4: Agent Inference Capabilities

**Source**: [ETH Zurich study](docs/general-llm/Evaluating-AGENTS-paper.pdf) | [Anthropic — Best Practices](https://docs.anthropic.com/en/docs/claude-code/best-practices) | [docs/analysis/analysis-evaluating-agents-paper.md](docs/analysis/analysis-evaluating-agents-paper.md)

Agents discover codebase structure through tools (`glob`, `grep`, `read`) as efficiently as from documentation. Codebase overviews and directory listings add tokens without improving navigation performance.

**What agents can infer (exclude from config files)**:

- Project structure and file locations
- Standard language conventions (TypeScript strict mode, Python PEP 8)
- Common framework patterns (Spring Boot conventions, React component structure)
- Package dependencies and their APIs
- Build commands when using standard tooling (npm, cargo, go)

**What agents cannot infer (include in config files)**:

- Non-standard package manager choice (e.g., `uv` instead of `pip`)
- Non-standard build/test commands
- Non-obvious architectural decisions
- Domain terminology mappings
- CI/CD constraints and security restrictions

**Implemented in**: `references/what-not-to-include.md`, `references/codebase-analyzer.md` (detects only non-standard patterns), all init skills

---

## Guideline 5: Context Poisoning Prevention

**Source**: [docs/general-llm/research-context-engineering-comprehensive.md](docs/general-llm/research-context-engineering-comprehensive.md) | [A Guide to AGENTS.md](docs/general-llm/a-guide-to-agents.md) | [docs/analysis/analysis-research-llm-context-optimization.md](docs/analysis/analysis-research-llm-context-optimization.md)

Stale information in config files is worse than no information. When a documented file path changes, agents look in the wrong place with high confidence. When contradictory instructions exist across files, agents pick one arbitrarily without warning.

**Prevention strategies this plugin applies**:

| Poisoning Vector            | Mitigation                                                    |
| --------------------------- | ------------------------------------------------------------- |
| Stale file paths            | Describe capabilities, not structures                         |
| Stale commands              | Verify commands exist in package.json/Makefile during improve |
| Contradictions across files | Cross-file contradiction detection in improve Phase 1         |
| Ball-of-mud accumulation    | Redundancy analysis with mandatory user approval              |
| Frequently-changing info    | Exclude from config files entirely                            |

**Implemented in**: `references/file-evaluator.md` (staleness + automation opportunity detection), improve skills Phase 1-2 (verification), `references/what-not-to-include.md` (exclusion actions with migration paths)

---

## Guideline 6: Subagent Isolation for Context Integrity

**Source**: [Anthropic — Sub-agents](https://docs.anthropic.com/en/docs/claude-code/sub-agents) | [docs/subagents/research-subagent-best-practices.md](docs/general-llm/subagents/research-subagent-best-practices.md) | [docs/subagents/creating-custom-subagents.md](docs/claude-code/subagents/creating-custom-subagents.md)

Subagents run in isolated context windows. Each receives only its system prompt plus basic environment details — not the parent conversation history. This isolation preserves the orchestrator's context budget for high-quality file generation.

**Plugin subagent design rules**:

| Rule                                                  | Rationale                               | Source                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Read-only tools only (`Read`, `Grep`, `Glob`, `Bash`) | Prevents unintended modifications       | [Sub-agent docs](https://docs.anthropic.com/en/docs/claude-code/sub-agents)                                              |
| Sonnet model                                          | Cost-efficient for analysis tasks       | [docs/subagents/research-subagent-best-practices.md](docs/general-llm/subagents/research-subagent-best-practices.md)                 |
| maxTurns: 15-20                                       | Prevents runaway execution              | [docs/subagents/creating-custom-subagents.md](docs/claude-code/subagents/creating-custom-subagents.md)                               |
| Structured output format                              | High signal, low noise for orchestrator | [docs/analysis/analysis-research-subagent-best-practices.md](docs/analysis/analysis-research-subagent-best-practices.md) |
| Confidence-based filtering (>80%)                     | Reduces noise in evaluation output      | [docs/analysis/analysis-research-subagent-best-practices.md](docs/analysis/analysis-research-subagent-best-practices.md) |

**Implemented in**: `plugins/agents-initializer/agents/` (3 agent definitions), `.claude/rules/agent-files.md`

---

## Guideline 7: Skill Authoring Standards

**Source**: [Anthropic — Skills](https://docs.anthropic.com/en/docs/claude-code/skills) | [Skill Authoring Best Practices](docs/shared/skill-authoring-best-practices.md) | [docs/analysis/analysis-skill-authoring-best-practices.md](docs/analysis/analysis-skill-authoring-best-practices.md)

Skills are the primary progressive disclosure mechanism. Descriptions consume ~100 tokens at startup; full content loads only when invoked.

**Standards this plugin follows**:

| Constraint          | Limit                     | Source                                                                          |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| Skill name          | ≤64 characters            | [Skill Authoring Best Practices](docs/shared/skill-authoring-best-practices.md) |
| Description         | ≤1024 characters          | [Skill Authoring Best Practices](docs/shared/skill-authoring-best-practices.md) |
| SKILL.md body       | <500 lines                | [Skill Authoring Best Practices](docs/shared/skill-authoring-best-practices.md) |
| Reference depth     | Max 1 level from SKILL.md | [Skill Authoring Best Practices](docs/shared/skill-authoring-best-practices.md) |
| Reference file size | ≤200 lines                | [Anthropic — Memory](https://docs.anthropic.com/en/docs/claude-code/memory)     |

**Degrees of freedom** match task fragility: high freedom for judgment-based tasks (code review), low freedom for destructive operations (file deletion, database migrations).

**Implemented in**: `.claude/rules/plugin-skills.md`, `.claude/rules/standalone-skills.md`, `.claude/rules/reference-files.md`, all 8 SKILL.md files

---

## Guideline 8: Self-Validation Loop

**Source**: [Anthropic — Prompting Best Practices](docs/claude-code/claude-prompting-best-practices.md) | [docs/analysis/analysis-claude-prompting-best-practices.md](docs/analysis/analysis-claude-prompting-best-practices.md)

The generate-review-refine pattern catches errors before they reach the user. Every skill runs a validation loop (max 3 iterations) that checks all generated files against hard limits and quality criteria before presenting them.

**Validation checks**:

- File length ≤200 lines (hard fail)
- Zero contradictions across files
- Zero stale references (paths verified, commands verified)
- Zero bloat indicators (directory listings, standard conventions, vague instructions)
- Progressive disclosure compliance (no domain-specific rules in root file)
- Information preservation (improve only — no critical info lost)

**Implemented in**: Phase 4 of all 8 skills, `references/validation-criteria.md`

---

## Guideline 9: Prompt Engineering by Context

**Source**: [Prompt Engineering Guide](docs/general-llm/prompt-engineering-guide.md) | [docs/analysis/analysis-prompt-engineering-guide.md](docs/analysis/analysis-prompt-engineering-guide.md)

Different artifact types require different prompting strategies. Advanced reasoning models (Opus 4.6) perform worse with explicit chain-of-thought and few-shot examples — their internal reasoning already handles these steps.

| Artifact               | Strategy                                   | Rationale                                          |
| ---------------------- | ------------------------------------------ | -------------------------------------------------- |
| Skill (analysis phase) | Implicit CoT ("think thoroughly")          | Opus performs better without explicit step-by-step |
| Skill (output phase)   | Direct instructions, templates             | Precision matters; minimize variation              |
| Subagent system prompt | Role → Process → Checklist → Output Format | Matches lost-in-the-middle constraint              |
| Rule                   | Direct assertion, no CoT                   | Rules are commands, not reasoning prompts          |
| Hook                   | Fast, deterministic, no LLM reasoning      | Hooks execute programmatically                     |
| Reference file         | Structured guidance with tables            | Compact, scannable, high information density       |

**Implemented in**: All SKILL.md files (phase structure), agent definitions (system prompt structure), `.claude/rules/` (direct assertions)

---

## Guideline 10: On-Demand Context Loading

**Source**: [Anthropic — Skills](https://docs.anthropic.com/en/docs/claude-code/skills) | [Anthropic — Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) | [docs/analysis/analysis-automate-workflow-with-hooks.md](docs/analysis/analysis-automate-workflow-with-hooks.md)

Behaviors that don't apply to every task should load into context only when needed. Three mechanisms achieve this:

| Mechanism                                         | Context Cost                                           | Enforcement            | Best For                               |
| ------------------------------------------------- | ------------------------------------------------------ | ---------------------- | -------------------------------------- |
| Skill (`user-invocable: false`)                   | ~100 tokens description at startup; body on invocation | Advisory (LLM decides) | Infrequent workflows, domain knowledge |
| Skill (`disable-model-invocation: true`)          | Zero passive cost                                      | Manual invocation only | Heavy workflows, rare operations       |
| Hook (`PreToolUse`, `PostToolUse`, `Stop`)        | Zero context cost                                      | Deterministic (100%)   | Rules that must always hold            |
| Path-scoped rule (`.claude/rules/` with `paths:`) | Zero until matching file accessed                      | Advisory, scoped       | File-pattern-specific conventions      |

Converting a behavioral instruction from CLAUDE.md to a hook removes it from the context budget entirely while guaranteeing enforcement. Each converted rule saves ~20-50 tokens from always-loaded context.

**Implemented in**: Improve skills (Phase 3 refactoring actions — including automation migration item), `references/context-optimization.md`, `references/claude-rules-system.md`, `references/automation-migration-guide.md`

---

## Guideline 11: Distribution Parity with Platform Awareness

**Source**: [Agent Skills Open Standard](docs/claude-code/skills/research-claude-code-skills-format.md) | Project architecture decision

The toolkit ships three distributions with aligned capabilities but platform-specific skill names and analysis mechanisms:

| Aspect           | Plugin (Claude Code)                      | Plugin (Cursor IDE)                        | Standalone (npx skills add)               |
| ---------------- | ----------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| Analysis         | Delegates to named subagents              | Delegates to named subagents               | Reads reference docs, runs inline         |
| Hooks support    | Full (suggest hooks in improve)           | Full (`.cursor/hooks.json` format)         | None (standalone tools lack hooks)        |
| Subagent support | Full (suggest subagents)                  | Full (Cursor agent format)                 | None                                      |
| Rules support    | Full (`.claude/rules/` with path-scoping) | Full (`.cursor/rules/*.mdc` with globs)    | Partial (suggest rules as separate files) |
| Skills support   | Full                                      | Full                                       | Full                                      |
| Output quality   | Identical                                 | Identical                                  | Identical                                 |

Shared references are copied (not symlinked) into each skill directory. When a reference is intentionally shared, all copies of that shared reference must stay in sync; platform-specific references may diverge when the target artifact system differs.

**Implemented in**: `.claude/rules/plugin-skills.md`, `.claude/rules/cursor-plugin-skills.md`, `.claude/rules/standalone-skills.md`, `.claude/rules/reference-files.md`, CLAUDE.md (sync convention)

---

## Guideline 12: Mandatory User Approval for Destructive Changes

**Source**: Project design decision backed by [ETH Zurich study](docs/general-llm/Evaluating-AGENTS-paper.pdf) | [A Guide to AGENTS.md](docs/general-llm/a-guide-to-agents.md)

The plugin never removes, migrates, or restructures information without explicit user consent. Every improvement is presented with:

1. **What** changes (specific content identified)
2. **Why** it should change (evidence-based justification with doc reference)
3. **Options** (at least 3, including "keep as-is")
4. **Approval gate** (user accepts or rejects each suggestion individually)

Rejected suggestions preserve the original content in its current location. No information is lost under any circumstance.

**Implemented in**: Phase 5 of all 4 improve skills (per-suggestion approval with 3+ options), validation criteria (information preservation check)

---

## Guideline 13: Automation Migration Decision Framework

**Source**: [Anthropic — Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) | [Anthropic — Skills](https://docs.anthropic.com/en/docs/claude-code/skills) | [ETH Zurich Study](docs/general-llm/Evaluating-AGENTS-paper.pdf) | [docs/analysis/analysis-automate-workflow-with-hooks.md](docs/analysis/analysis-automate-workflow-with-hooks.md)

Instructions in CLAUDE.md/AGENTS.md that are infrequently relevant to the current task should migrate to on-demand mechanisms. The decision criteria map each content type to the most appropriate mechanism based on context cost, enforcement guarantee, and platform compatibility.

| Content Type                                         | Best Mechanism                             | Context Cost           | Evidence                                   |
| ---------------------------------------------------- | ------------------------------------------ | ---------------------- | ------------------------------------------ |
| Always-applicable universal rules (<5 lines)         | CLAUDE.md root                             | Per-session            | research-context-engineering-comprehensive.md |
| Path-specific conventions (5-50 lines)               | `.claude/rules/` with `paths:`             | On-demand              | analysis-how-claude-remembers-a-project.md |
| Infrequent workflows/domain knowledge (50-500 lines) | Skill (`user-invocable: false`)            | ~100 tokens at startup | extend-claude-with-skills.md               |
| Heavy/rare workflows with side effects               | Skill (`disable-model-invocation: true`)   | Zero                   | extend-claude-with-skills.md               |
| Must-enforce behavioral rules                        | Hook (`PreToolUse`/`PostToolUse`/`Stop`)   | Zero                   | analysis-automate-workflow-with-hooks.md   |
| Enforcement needing LLM judgment                     | Hook (`type: "prompt"` or `type: "agent"`) | Zero                   | automate-workflow-with-hooks.md            |
| Information agents can infer from code               | DELETE — do not document                   | Negative (saves)       | analysis-evaluating-agents-paper.md        |

Distribution awareness: Plugin suggests all mechanisms; standalone suggests skills + rules only (hooks and subagents are Claude Code-specific).

**Implemented in**: Improve skills Phase 3 (Automation Migration classification + Redundancy Elimination), `references/automation-migration-guide.md` (decision criteria — loaded in Phase 3), `references/file-evaluator.md` (Automation Opportunity Indicators — Phase 1 detection), `references/evaluation-criteria.md` (Automation Opportunity scoring dimension), `references/what-not-to-include.md` (Exclusion Actions + instruction test)

---

## Guideline 14: Init Preflight Redirect

**Source**: [ETH Zurich Study](docs/general-llm/Evaluating-AGENTS-paper.pdf) | Project design decision | PRD Phase 2

Init skills must check for existing target files before proceeding with generation. Running init on a project that already has configuration files wastes subagent runs and risks overwriting user customizations.

**Decision criteria**:

| Condition                                | Action                                  | Rationale                                                                          |
| ---------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| Target file (CLAUDE.md/AGENTS.md) exists | Redirect to corresponding improve skill | Preserves existing customizations; improve workflow optimizes rather than replaces |
| Target file does not exist               | Proceed with normal init flow           | Clean project needs full generation                                                |

**Implementation pattern**: A `### Preflight Check` section sits between `## Process` and `### Phase 1` in all init SKILL.md files. The check uses plain English conditional logic ("If it already exists") consistent with the conditional patterns already in Phase 3 of init skills.

**Implemented in**: All 4 init skills (plugin and standalone distributions)

---

## Guideline 15: Migration Artifact Templates

**Source**: Project design decision | [Anthropic — Skills](https://docs.anthropic.com/en/docs/claude-code/skills) | [Anthropic — Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) | PRD Phase 6

When a user approves an automation migration in Phase 5, the improve skill must generate a complete target artifact — not just remove the source content. Three template files provide the structure for these generated artifacts.

**Template types and distribution scope**:

| Template | Location | Distributions | Generates |
| -------- | -------- | ------------- | --------- |
| `skill.md` | `assets/templates/skill.md` | All 4 improve skills | `.claude/skills/[name]/SKILL.md` |
| `hook-config.md` | `assets/templates/hook-config.md` | Plugin improve skills only | JSON snippet for `.claude/settings.json` |
| `claude-rule.md` (extended) | `assets/templates/claude-rule.md` | All 4 improve skills | `.claude/rules/[topic].md` |

**Template conventions**:

- HTML comment metadata block (`<!-- TEMPLATE: ... -->`) — placement, naming, line targets, and embedded rules
- Bracket placeholder syntax (`[placeholder-name]`) — consistent across all templates
- `<!-- CONDITIONAL: ... -->` blocks — optional frontmatter fields or sections included only when applicable
- Source attribution comment (`<!-- Migrated from [source-file]:lines [N-M] -->`) — every migrated artifact traces to its origin
- Migration guidance block (`<!-- MIGRATION: ... -->`) in `claude-rule.md` — separate from init-time guidance; applies only in improve context

**Distribution awareness**:

- `hook-config.md` exists only in plugin improve skill directories — hooks require Claude Code and are not available in standalone distributions
- Standalone improve SKILL.md files reference `skill.md` and `claude-rule.md` only; never `hook-config.md`
- Init skill template directories do NOT include migration-specific templates or the extended `claude-rule.md`

**Quality constraint**: Generated artifacts must meet the same quality standards as hand-authored files. The improve skill's self-validation phase (Phase 4) applies to migration-generated artifacts.

**Implemented in**: `assets/templates/skill.md` (all 4 improve skills), `assets/templates/hook-config.md` (plugin improve skills), `assets/templates/claude-rule.md` extended with `<!-- MIGRATION: -->` block (all 4 improve skills), Phase 3 template loading lists in all 4 improve SKILL.md files

---

## Research Foundation

All design decisions trace to these sources:

### Academic Research

| Document                                                                    | Key Finding                                                     | Location                                                  |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| [Evaluating AGENTS.md](docs/general-llm/Evaluating-AGENTS-paper.pdf) (ETH Zurich, 2026) | Auto-generated files reduce success by 3%, increase cost by 20% | `docs/general-llm/Evaluating-AGENTS-paper.md`                         |
| [Lost in the Middle](https://arxiv.org/abs/2307.03172) (TACL 2023)          | Models perform worst on mid-context information                 | Referenced in `docs/general-llm/research-context-engineering-comprehensive.md` |

### Anthropic Official Documentation

| Document            | Key Principle                                               | URL                                                                                                |
| ------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Context Engineering | "Find the smallest possible set of high-signal tokens"      | [anthropic.com](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) |
| CLAUDE.md Memory    | Under 200 lines per file; hierarchical loading              | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/memory)                        |
| Best Practices      | "If Claude already does it correctly, delete it"            | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/best-practices)                |
| Skills              | Progressive disclosure; description budget at 2% of context | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/skills)                        |
| Sub-agents          | Isolated context; read-only tools; structured output        | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/sub-agents)                    |
| Hooks               | Deterministic enforcement; zero context cost                | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/hooks)                         |

### Practitioner Guides

| Document                                                                        | Key Contribution                                | Location       |
| ------------------------------------------------------------------------------- | ----------------------------------------------- | -------------- |
| [A Guide to AGENTS.md](docs/general-llm/a-guide-to-agents.md)                               | Progressive disclosure patterns, domain files   | `docs/`        |
| [A Guide to AGENTS.md](docs/general-llm/a-guide-to-agents.md)                               | CLAUDE.md hierarchy, instruction budget (merged) | `docs/general-llm/` |
| [Prompt Engineering Guide](docs/general-llm/prompt-engineering-guide.md)                    | Context engineering strategies by artifact type | `docs/`        |
| [Skill Authoring Best Practices](docs/shared/skill-authoring-best-practices.md) | Skill size limits, degrees of freedom           | `docs/shared/` & `docs/claude-code/skills/` |

### Analysis Corpus

Sixteen analysis documents in `docs/analysis/` provide deep extraction of key findings from each source above. Each analysis identifies actionable patterns for skill authoring, subagent design, hook implementation, and context optimization.

---

## Self-Application Record

This plugin applies its own guidelines to its configuration. Phase 9 (Self-Application) audited root CLAUDE.md, plugin CLAUDE.md, `.claude/rules/`, and settings files against the criteria in this document. Changes applied:

- Removed 6 duplicated constraints from plugin CLAUDE.md (covered by path-scoped rules in `.claude/rules/plugin-skills.md` and `.claude/rules/agent-files.md`)
- Deleted `git-commits.md` rule (`paths: **/*` defeated path-scoping; content absorbed into root CLAUDE.md)
- Deleted `documentation-sync.md` rule (PostToolUse hook provides deterministic enforcement per Guideline 10)
- Cleaned stale permission entries from `settings.local.json`

---

*Last updated: 2026-04-06*
*Maintained in sync with project implementations via documentation sync mechanism*
