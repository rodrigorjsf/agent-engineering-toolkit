# Docs Drift Manifest — agents-initializer

Centralized registry of all reference file → source doc mappings for drift detection.
Updated: 2026-05-03

## How to Use

The `docs-drift-checker` agent reads this manifest and verifies that each reference file's
attributed source docs still exist and that the cited line ranges contain content consistent
with the reference file's claims. Run via the `quality-gate` skill (Phase 3: Docs Drift)
or manually.

---

## Reference File Registry

| Reference File | Source Docs | Status |
|----------------|-------------|--------|
| `init-agents/references/context-optimization.md` | `docs/general-llm/research-context-engineering-comprehensive.md` | baseline |
| `init-agents/references/progressive-disclosure-guide.md` | `docs/general-llm/a-guide-to-agents.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | baseline |
| `init-agents/references/validation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md` (lines 23-59) | baseline |
| `init-agents/references/what-not-to-include.md` | `docs/general-llm/research-context-engineering-comprehensive.md` (lines 112-121), `docs/general-llm/Evaluating-AGENTS-paper.md` (abstract, inline citations) | baseline |
| `init-claude/references/claude-rules-system.md` | `docs/claude-code/memory/how-claude-remembers-a-project.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | XC-2 trim |
| `init-claude/references/context-optimization.md` | `docs/general-llm/research-context-engineering-comprehensive.md` | XC-2 trim |
| `init-claude/references/progressive-disclosure-guide.md` | `docs/general-llm/a-guide-to-agents.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | XC-2 trim |
| `init-claude/references/validation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md` (lines 23-59) | XC-2 trim |
| `init-claude/references/what-not-to-include.md` | `docs/general-llm/research-context-engineering-comprehensive.md` (lines 112-121), `docs/general-llm/Evaluating-AGENTS-paper.md` (abstract, inline citations) | XC-2 trim |
| `improve-agents/references/automation-mechanism-comparison.md` | `.claude/PRPs/prds/completed/context-aware-improve-optimization.prd.md`, `docs/analysis/analysis-automate-workflow-with-hooks.md`, `docs/analysis/analysis-skill-authoring-best-practices.md`, `docs/analysis/analysis-how-claude-remembers-a-project.md` | XC-2 split (was automation-migration-guide.md) |
| `improve-agents/references/automation-token-impact.md` | `.claude/PRPs/prds/completed/context-aware-improve-optimization.prd.md`, `docs/analysis/analysis-evaluating-agents-paper.md`, `docs/general-llm/research-context-engineering-comprehensive.md` | XC-2 split (was automation-migration-guide.md); load only when Phase 1 returns automation candidates |
| `improve-agents/references/context-optimization.md` | `docs/general-llm/research-context-engineering-comprehensive.md` | XC-2 trim |
| `improve-agents/references/evaluation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md`, `docs/general-llm/research-context-engineering-comprehensive.md` | XC-2 trim |
| `improve-agents/references/improvement-card-template.md` | `plugins/agents-initializer/skills/improve-agents/SKILL.md` (extracted Phase 5) | XC-2 added |
| `improve-agents/references/progressive-disclosure-guide.md` | `docs/general-llm/a-guide-to-agents.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | XC-2 trim |
| `improve-agents/references/validation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md` (lines 23-59) | XC-2 trim |
| `improve-agents/references/what-not-to-include.md` | `docs/general-llm/research-context-engineering-comprehensive.md` (lines 112-121), `docs/general-llm/Evaluating-AGENTS-paper.md` (abstract, inline citations) | XC-2 trim |
| `improve-claude/references/automation-mechanism-comparison.md` | `.claude/PRPs/prds/completed/context-aware-improve-optimization.prd.md`, `docs/analysis/analysis-automate-workflow-with-hooks.md`, `docs/analysis/analysis-skill-authoring-best-practices.md`, `docs/analysis/analysis-how-claude-remembers-a-project.md` | XC-2 split (was automation-migration-guide.md) |
| `improve-claude/references/automation-token-impact.md` | `.claude/PRPs/prds/completed/context-aware-improve-optimization.prd.md`, `docs/analysis/analysis-evaluating-agents-paper.md`, `docs/general-llm/research-context-engineering-comprehensive.md` | XC-2 split (was automation-migration-guide.md); load only when Phase 1 returns automation candidates |
| `improve-claude/references/claude-rules-system.md` | `docs/claude-code/memory/how-claude-remembers-a-project.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | XC-2 trim |
| `improve-claude/references/context-optimization.md` | `docs/general-llm/research-context-engineering-comprehensive.md` | XC-2 trim |
| `improve-claude/references/evaluation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md`, `docs/general-llm/research-context-engineering-comprehensive.md` | XC-2 trim |
| `improve-claude/references/improvement-card-template.md` | `plugins/agents-initializer/skills/improve-claude/SKILL.md` (extracted Phase 5) | XC-2 added |
| `improve-claude/references/progressive-disclosure-guide.md` | `docs/general-llm/a-guide-to-agents.md`, `docs/general-llm/research-context-engineering-comprehensive.md` (inline citations) | XC-2 trim |
| `improve-claude/references/validation-criteria.md` | `plugins/agents-initializer/agents/file-evaluator.md` (lines 23-59) | XC-2 trim |
| `improve-claude/references/what-not-to-include.md` | `docs/general-llm/research-context-engineering-comprehensive.md` (lines 112-121), `docs/general-llm/Evaluating-AGENTS-paper.md` (abstract, inline citations) | XC-2 trim |

---

## Source Doc Index

| Source Doc | Referenced By (count) |
|------------|----------------------|
| `plugins/agents-initializer/agents/file-evaluator.md` | 6 |
| `.claude/PRPs/prds/completed/context-aware-improve-optimization.prd.md` | 4 |
| `docs/analysis/analysis-automate-workflow-with-hooks.md` | 2 |
| `docs/analysis/analysis-evaluating-agents-paper.md` | 2 |
| `docs/analysis/analysis-how-claude-remembers-a-project.md` | 2 |
| `docs/analysis/analysis-skill-authoring-best-practices.md` | 2 |
| `docs/claude-code/memory/how-claude-remembers-a-project.md` | 2 |
| `docs/general-llm/a-guide-to-agents.md` | 6 |
| `docs/general-llm/Evaluating-AGENTS-paper.md` | 6 |
| `docs/general-llm/research-context-engineering-comprehensive.md` | 16 |
| `plugins/agents-initializer/skills/improve-agents/SKILL.md` (extracted Phase 5) | 1 |
| `plugins/agents-initializer/skills/improve-claude/SKILL.md` (extracted Phase 5) | 1 |
