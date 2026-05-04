# Docs Drift Manifest — Standalone Skills

Centralized registry of all reference file → source doc mappings for drift detection
across all skills in the `skills/` standalone distribution.
Updated: 2026-04-20

## Contents

1. [How to Use](#how-to-use)
2. [Reference File Registry](#reference-file-registry)
3. [Source Doc Index](#source-doc-index)

## How to Use

The `docs-drift-checker` agent reads this manifest and verifies that each reference file's
attributed source docs still exist and that the cited line ranges contain content consistent
with the reference file's claims. Run via the `quality-gate` skill (Phase 3: Docs Drift)
or manually.

---

## Reference File Registry

| Reference File | Source Docs | Status |
|----------------|-------------|--------|
| `init-agents/references/codebase-analyzer.md` | `plugins/agents-initializer/agents/codebase-analyzer.md` | baseline |
| `init-agents/references/context-optimization.md` | `docs/general-llm/research-context-engineering-comprehensive.md` | diverged-from-init-claude — hook phrasing replaced with "rely on tooling enforcement" (XC-11/#115) |
| `init-agents/references/progressive-disclosure-guide.md` | `docs/general-llm/a-guide-to-agents.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | diverged-from-init-claude — CLAUDE.md-specific hierarchy section removed, claudeMdExcludes block removed, .claude/rules/ row removed from hierarchy table (XC-11/#115) |
| `init-agents/references/scope-detector.md` | `plugins/agents-initializer/agents/scope-detector.md` | baseline |
| `init-agents/references/validation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md` (lines 23-59) | diverged-from-init-claude — CLAUDE.md-specific rows deleted, hook phrasing replaced with "rely on tooling enforcement", improve-claude source ref removed (XC-11/#115) |
| `init-agents/references/what-not-to-include.md` | `docs/general-llm/research-context-engineering-comprehensive.md` (lines 112-121), `docs/general-llm/Evaluating-AGENTS-paper.md` (abstract) | diverged-from-init-claude — Hook row removed from exclusion table, migration table rewritten to AGENTS.md-only targets (subdirectory AGENTS.md, docs/), hooks/automate-workflow-with-hooks.md source removed (XC-11/#115) |
| `init-claude/references/claude-rules-system.md` | `docs/claude-code/memory/how-claude-remembers-a-project.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | baseline |
| `init-claude/references/codebase-analyzer.md` | `plugins/agents-initializer/agents/codebase-analyzer.md` | baseline |
| `init-claude/references/context-optimization.md` | `docs/general-llm/research-context-engineering-comprehensive.md` | baseline |
| `init-claude/references/progressive-disclosure-guide.md` | `docs/general-llm/a-guide-to-agents.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | baseline |
| `init-claude/references/scope-detector.md` | `plugins/agents-initializer/agents/scope-detector.md` | baseline |
| `init-claude/references/validation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md` (lines 23-59) | baseline |
| `init-claude/references/what-not-to-include.md` | `docs/general-llm/research-context-engineering-comprehensive.md` (lines 112-121), `docs/general-llm/Evaluating-AGENTS-paper.md` (abstract) | baseline |
| `improve-agents/references/automation-migration-guide.md` | `.claude/PRPs/prds/completed/context-aware-improve-optimization.prd.md`, `docs/analysis/analysis-automate-workflow-with-hooks.md`, `docs/analysis/analysis-skill-authoring-best-practices.md`, `docs/analysis/analysis-how-claude-remembers-a-project.md` | baseline |
| `improve-agents/references/codebase-analyzer.md` | `plugins/agents-initializer/agents/codebase-analyzer.md` | baseline |
| `improve-agents/references/context-optimization.md` | `docs/general-llm/research-context-engineering-comprehensive.md` | baseline |
| `improve-agents/references/evaluation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md`, `docs/general-llm/research-context-engineering-comprehensive.md` | baseline |
| `improve-agents/references/file-evaluator.md` | `plugins/agents-initializer/agents/file-evaluator.md` | baseline |
| `improve-agents/references/progressive-disclosure-guide.md` | `docs/general-llm/a-guide-to-agents.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | baseline |
| `improve-agents/references/validation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md` (lines 23-59) | baseline |
| `improve-agents/references/what-not-to-include.md` | `docs/general-llm/research-context-engineering-comprehensive.md` (lines 112-121), `docs/general-llm/Evaluating-AGENTS-paper.md` (abstract) | baseline |
| `improve-claude/references/automation-migration-guide.md` | `.claude/PRPs/prds/completed/context-aware-improve-optimization.prd.md`, `docs/analysis/analysis-automate-workflow-with-hooks.md`, `docs/analysis/analysis-skill-authoring-best-practices.md`, `docs/analysis/analysis-how-claude-remembers-a-project.md` | baseline |
| `improve-claude/references/claude-rules-system.md` | `docs/claude-code/memory/how-claude-remembers-a-project.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | baseline |
| `improve-claude/references/codebase-analyzer.md` | `plugins/agents-initializer/agents/codebase-analyzer.md` | baseline |
| `improve-claude/references/context-optimization.md` | `docs/general-llm/research-context-engineering-comprehensive.md` | baseline |
| `improve-claude/references/evaluation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md`, `docs/general-llm/research-context-engineering-comprehensive.md` | baseline |
| `improve-claude/references/file-evaluator.md` | `plugins/agents-initializer/agents/file-evaluator.md` | baseline |
| `improve-claude/references/progressive-disclosure-guide.md` | `docs/general-llm/a-guide-to-agents.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | baseline |
| `improve-claude/references/validation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md` (lines 23-59) | baseline |
| `improve-claude/references/what-not-to-include.md` | `docs/general-llm/research-context-engineering-comprehensive.md` (lines 112-121), `docs/general-llm/Evaluating-AGENTS-paper.md` (abstract) | baseline |
| `create-hook/references/artifact-analyzer.md` | `plugins/agent-customizer/agents/artifact-analyzer.md` | baseline |
| `create-hook/references/hook-authoring-guide.md` | `docs/claude-code/hooks/automate-workflow-with-hooks.md`, `docs/claude-code/hooks/claude-hook-reference-doc.md` | baseline |
| `create-hook/references/hook-events-reference.md` | `docs/claude-code/hooks/claude-hook-reference-doc.md` | baseline |
| `create-hook/references/hook-validation-criteria.md` | `docs/claude-code/hooks/claude-hook-reference-doc.md`, `docs/claude-code/hooks/automate-workflow-with-hooks.md` | baseline |
| `create-hook/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-rule/references/artifact-analyzer.md` | `plugins/agent-customizer/agents/artifact-analyzer.md` | baseline |
| `create-rule/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-rule/references/rule-authoring-guide.md` | `docs/claude-code/memory/how-claude-remembers-a-project.md` | baseline |
| `create-rule/references/rule-validation-criteria.md` | `docs/claude-code/memory/how-claude-remembers-a-project.md` | baseline |
| `create-skill/references/artifact-analyzer.md` | `plugins/agent-customizer/agents/artifact-analyzer.md` | baseline |
| `create-skill/references/behavioral-guidelines.md` | self-contained — no external source documents; all content is inline with ✅/❌ examples | baseline |
| `create-skill/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-skill/references/skill-authoring-guide.md` | `docs/shared/skill-authoring-best-practices.md`, `docs/claude-code/skills/extend-claude-with-skills.md`, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-skill/references/skill-format-reference.md` | `docs/claude-code/skills/research-claude-code-skills-format.md` (lines 90-125), `docs/claude-code/skills/extend-claude-with-skills.md` (lines 169-199) | baseline |
| `create-skill/references/skill-validation-criteria.md` | `docs/shared/skill-authoring-best-practices.md`, `docs/claude-code/skills/extend-claude-with-skills.md`, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-subagent/references/artifact-analyzer.md` | `plugins/agent-customizer/agents/artifact-analyzer.md` | baseline |
| `create-subagent/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-subagent/references/subagent-authoring-guide.md` | `docs/general-llm/subagents/research-subagent-best-practices.md`, `docs/claude-code/subagents/creating-custom-subagents.md` | baseline |
| `create-subagent/references/subagent-config-reference.md` | `docs/claude-code/subagents/creating-custom-subagents.md`, `docs/claude-code/subagents/claude-orchestrate-of-claude-code-sessions.md` | baseline |
| `create-subagent/references/subagent-validation-criteria.md` | `docs/claude-code/subagents/creating-custom-subagents.md`, `docs/general-llm/subagents/research-subagent-best-practices.md` | baseline |
| `improve-hook/references/artifact-analyzer.md` | `plugins/agent-customizer/agents/artifact-analyzer.md` | baseline |
| `improve-hook/references/hook-authoring-guide.md` | `docs/claude-code/hooks/automate-workflow-with-hooks.md`, `docs/claude-code/hooks/claude-hook-reference-doc.md` | baseline |
| `improve-hook/references/hook-evaluation-criteria.md` | `docs/claude-code/hooks/claude-hook-reference-doc.md`, `docs/claude-code/hooks/automate-workflow-with-hooks.md` | baseline |
| `improve-hook/references/hook-evaluator.md` | `plugins/agent-customizer/agents/hook-evaluator.md` | baseline |
| `improve-hook/references/hook-events-reference.md` | `docs/claude-code/hooks/claude-hook-reference-doc.md` | baseline |
| `improve-hook/references/hook-validation-criteria.md` | `docs/claude-code/hooks/claude-hook-reference-doc.md`, `docs/claude-code/hooks/automate-workflow-with-hooks.md` | baseline |
| `improve-hook/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-rule/references/artifact-analyzer.md` | `plugins/agent-customizer/agents/artifact-analyzer.md` | baseline |
| `improve-rule/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-rule/references/rule-authoring-guide.md` | `docs/claude-code/memory/how-claude-remembers-a-project.md` | baseline |
| `improve-rule/references/rule-evaluation-criteria.md` | `docs/claude-code/memory/how-claude-remembers-a-project.md` | baseline |
| `improve-rule/references/rule-evaluator.md` | `plugins/agent-customizer/agents/rule-evaluator.md` | baseline |
| `improve-rule/references/rule-validation-criteria.md` | `docs/claude-code/memory/how-claude-remembers-a-project.md` | baseline |
| `improve-skill/references/artifact-analyzer.md` | `plugins/agent-customizer/agents/artifact-analyzer.md` | baseline |
| `improve-skill/references/behavioral-guidelines.md` | self-contained — no external source documents; all content is inline with ✅/❌ examples | baseline |
| `improve-skill/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-skill/references/skill-authoring-guide.md` | `docs/shared/skill-authoring-best-practices.md`, `docs/claude-code/skills/extend-claude-with-skills.md`, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-skill/references/skill-evaluation-criteria.md` | `docs/shared/skill-authoring-best-practices.md`, `docs/general-llm/Evaluating-AGENTS-paper.md` | baseline |
| `improve-skill/references/skill-evaluator.md` | `plugins/agent-customizer/agents/skill-evaluator.md` | baseline |
| `improve-skill/references/skill-format-reference.md` | `docs/claude-code/skills/research-claude-code-skills-format.md` (lines 90-125), `docs/claude-code/skills/extend-claude-with-skills.md` (lines 169-199) | baseline |
| `improve-skill/references/skill-validation-criteria.md` | `docs/shared/skill-authoring-best-practices.md`, `docs/claude-code/skills/extend-claude-with-skills.md`, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-subagent/references/artifact-analyzer.md` | `plugins/agent-customizer/agents/artifact-analyzer.md` | baseline |
| `improve-subagent/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-subagent/references/subagent-authoring-guide.md` | `docs/general-llm/subagents/research-subagent-best-practices.md`, `docs/claude-code/subagents/creating-custom-subagents.md` | baseline |
| `improve-subagent/references/subagent-config-reference.md` | `docs/claude-code/subagents/creating-custom-subagents.md`, `docs/claude-code/subagents/claude-orchestrate-of-claude-code-sessions.md` | baseline |
| `improve-subagent/references/subagent-evaluation-criteria.md` | `docs/general-llm/subagents/research-subagent-best-practices.md`, `docs/claude-code/subagents/creating-custom-subagents.md` | baseline |
| `improve-subagent/references/subagent-evaluator.md` | `plugins/agent-customizer/agents/subagent-evaluator.md` | baseline |
| `improve-subagent/references/subagent-validation-criteria.md` | `docs/claude-code/subagents/creating-custom-subagents.md`, `docs/general-llm/subagents/research-subagent-best-practices.md` | baseline |

---

## Source Doc Index

| Source Doc | Referenced By (count) |
|------------|----------------------|
| `plugins/agents-initializer/agents/codebase-analyzer.md` | 4 |
| `plugins/agents-initializer/agents/file-evaluator.md` | 8 |
| `plugins/agents-initializer/agents/scope-detector.md` | 2 |
| `plugins/agent-customizer/agents/artifact-analyzer.md` | 8 |
| `plugins/agent-customizer/agents/hook-evaluator.md` | 1 |
| `plugins/agent-customizer/agents/rule-evaluator.md` | 1 |
| `plugins/agent-customizer/agents/skill-evaluator.md` | 1 |
| `plugins/agent-customizer/agents/subagent-evaluator.md` | 1 |
| `.claude/PRPs/prds/completed/context-aware-improve-optimization.prd.md` | 2 |
| `docs/analysis/analysis-automate-workflow-with-hooks.md` | 2 |
| `docs/analysis/analysis-how-claude-remembers-a-project.md` | 2 |
| `docs/analysis/analysis-skill-authoring-best-practices.md` | 2 |
| `docs/claude-code/claude-prompting-best-practices.md` | 8 |
| `docs/claude-code/hooks/automate-workflow-with-hooks.md` | 5 |
| `docs/claude-code/hooks/claude-hook-reference-doc.md` | 7 |
| `docs/claude-code/memory/how-claude-remembers-a-project.md` | 6 |
| `docs/claude-code/skills/extend-claude-with-skills.md` | 4 |
| `docs/claude-code/skills/research-claude-code-skills-format.md` | 2 |
| `docs/claude-code/subagents/claude-orchestrate-of-claude-code-sessions.md` | 2 |
| `docs/claude-code/subagents/creating-custom-subagents.md` | 6 |
| `docs/general-llm/a-guide-to-agents.md` | 6 |
| `docs/general-llm/Evaluating-AGENTS-paper.md` | 8 |
| `.github/instructions/karpathy-guidelines.instructions.md` | 14 |
| `docs/general-llm/persuasion-principles.md` | 14 |
| `docs/general-llm/prompt-engineering-guide.md` | 8 |
| `docs/general-llm/research-context-engineering-comprehensive.md` | 14 |
| `docs/general-llm/subagents/research-subagent-best-practices.md` | 4 |
| `docs/shared/skill-authoring-best-practices.md` | 4 |
