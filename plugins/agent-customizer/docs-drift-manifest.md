# Docs Drift Manifest

Centralized registry of all reference file → source doc mappings for drift detection.
Updated: 2026-05-03
base_path: plugins/agent-customizer/skills/

## How to Use

The `docs-drift-checker` agent reads this manifest and verifies that each reference file's
attributed source docs still exist and that the cited line ranges contain content consistent
with the reference file's claims. Run via quality gate (Phase 8) or manually.

---

## Reference File Registry

| Reference File | Source Docs | Status |
|----------------|-------------|--------|
| `create-hook/references/hook-authoring-guide.md` | `docs/claude-code/hooks/automate-workflow-with-hooks.md` (exit codes ~393-420), `docs/claude-code/hooks/claude-hook-reference-doc.md` (security lines 2050-2065), `wiki/knowledge/harness-engineering.md` (Hook Output Discipline) | baseline |
| `create-hook/references/hook-events-reference.md` | `docs/claude-code/hooks/claude-hook-reference-doc.md` | baseline |
| `create-hook/references/hook-validation-criteria.md` | `docs/claude-code/hooks/claude-hook-reference-doc.md`, `docs/claude-code/hooks/automate-workflow-with-hooks.md` | baseline — adds silent-success positive check (CF-CLAUDE-CUST-001) |
| `create-hook/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-rule/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-rule/references/rule-authoring-guide.md` | `.github/instructions/rules.instructions.md`, `docs/claude-code/memory/how-claude-remembers-a-project.md` | baseline |
| `create-rule/references/rule-validation-criteria.md` | `.github/instructions/rules.instructions.md`, `docs/claude-code/memory/how-claude-remembers-a-project.md` | baseline |
| `create-skill/references/behavioral-guidelines.md` | self-contained — no external source documents; all content is inline with ✅/❌ examples | baseline |
| `create-skill/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-skill/references/skill-authoring-guide.md` | `docs/shared/skill-authoring-best-practices.md`, `docs/claude-code/skills/extend-claude-with-skills.md`, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-skill/references/skill-format-reference.md` | `docs/claude-code/skills/research-claude-code-skills-format.md` (lines 90-130), `docs/claude-code/skills/extend-claude-with-skills.md` (lines 169-199) | baseline |
| `create-skill/references/skill-validation-criteria.md` | `docs/shared/skill-authoring-best-practices.md` (line 259), `docs/claude-code/skills/extend-claude-with-skills.md`, `.claude/rules/reference-files.md`, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-subagent/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `create-subagent/references/subagent-authoring-guide.md` | `docs/general-llm/subagents/research-subagent-best-practices.md`, `docs/claude-code/subagents/creating-custom-subagents.md`, `wiki/knowledge/harness-engineering.md` (context-firewall opening) | baseline |
| `create-subagent/references/subagent-config-reference.md` | `docs/claude-code/subagents/creating-custom-subagents.md`, `docs/claude-code/subagents/claude-orchestrate-of-claude-code-sessions.md`, `docs/general-llm/subagents/research-subagent-best-practices.md` (line 330-331 for sonnet[1m]) | baseline |
| `create-subagent/references/subagent-validation-criteria.md` | `docs/claude-code/subagents/creating-custom-subagents.md`, `docs/general-llm/subagents/research-subagent-best-practices.md`, `.claude/rules/agent-files.md` (maxTurns convention) | baseline |
| `improve-hook/references/hook-authoring-guide.md` | `docs/claude-code/hooks/automate-workflow-with-hooks.md` (exit codes ~393-420), `docs/claude-code/hooks/claude-hook-reference-doc.md` (security lines 2050-2065), `wiki/knowledge/harness-engineering.md` (Hook Output Discipline) | baseline |
| `improve-hook/references/hook-evaluation-criteria.md` | `docs/claude-code/hooks/claude-hook-reference-doc.md`, `docs/claude-code/hooks/automate-workflow-with-hooks.md`, `docs/general-llm/Evaluating-AGENTS-paper.pdf` (Deletion Test section) | baseline |
| `improve-hook/references/hook-events-reference.md` | `docs/claude-code/hooks/claude-hook-reference-doc.md` | baseline |
| `improve-hook/references/hook-validation-criteria.md` | `docs/claude-code/hooks/claude-hook-reference-doc.md`, `docs/claude-code/hooks/automate-workflow-with-hooks.md` | baseline — adds silent-success positive check (CF-CLAUDE-CUST-001) |
| `improve-hook/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-rule/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-rule/references/rule-authoring-guide.md` | `.github/instructions/rules.instructions.md`, `docs/claude-code/memory/how-claude-remembers-a-project.md` | baseline |
| `improve-rule/references/rule-evaluation-criteria.md` | `.github/instructions/rules.instructions.md`, `docs/claude-code/memory/how-claude-remembers-a-project.md`, `docs/general-llm/Evaluating-AGENTS-paper.pdf` (Deletion Test section) | baseline |
| `improve-rule/references/rule-validation-criteria.md` | `.github/instructions/rules.instructions.md`, `docs/claude-code/memory/how-claude-remembers-a-project.md` | baseline |
| `improve-skill/references/behavioral-guidelines.md` | self-contained — no external source documents; all content is inline with ✅/❌ examples | baseline |
| `improve-skill/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-skill/references/skill-authoring-guide.md` | `docs/shared/skill-authoring-best-practices.md`, `docs/claude-code/skills/extend-claude-with-skills.md`, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-skill/references/skill-evaluation-criteria.md` | `docs/shared/skill-authoring-best-practices.md` (line 259), `docs/general-llm/Evaluating-AGENTS-paper.md`, `docs/general-llm/Evaluating-AGENTS-paper.pdf` (Deletion Test section), `.claude/rules/reference-files.md` | baseline |
| `improve-skill/references/skill-format-reference.md` | `docs/claude-code/skills/research-claude-code-skills-format.md` (lines 90-130), `docs/claude-code/skills/extend-claude-with-skills.md` (lines 169-199) | baseline |
| `improve-skill/references/skill-validation-criteria.md` | `docs/shared/skill-authoring-best-practices.md` (line 259), `docs/claude-code/skills/extend-claude-with-skills.md`, `.claude/rules/reference-files.md`, `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-subagent/references/prompt-engineering-strategies.md` | `docs/general-llm/prompt-engineering-guide.md` (lines 212-215), `docs/claude-code/claude-prompting-best-practices.md` (lines 373-380), `.github/instructions/karpathy-guidelines.instructions.md`, `docs/general-llm/persuasion-principles.md` | baseline |
| `improve-subagent/references/subagent-authoring-guide.md` | `docs/general-llm/subagents/research-subagent-best-practices.md`, `docs/claude-code/subagents/creating-custom-subagents.md`, `wiki/knowledge/harness-engineering.md` (context-firewall opening) | baseline |
| `improve-subagent/references/subagent-config-reference.md` | `docs/claude-code/subagents/creating-custom-subagents.md`, `docs/claude-code/subagents/claude-orchestrate-of-claude-code-sessions.md`, `docs/general-llm/subagents/research-subagent-best-practices.md` (line 330-331 for sonnet[1m]) | baseline |
| `improve-subagent/references/subagent-evaluation-criteria.md` | `docs/general-llm/subagents/research-subagent-best-practices.md`, `docs/claude-code/subagents/creating-custom-subagents.md`, `.claude/rules/agent-files.md` (maxTurns convention), `docs/general-llm/Evaluating-AGENTS-paper.pdf` (Deletion Test section) | baseline |
| `improve-subagent/references/subagent-validation-criteria.md` | `docs/claude-code/subagents/creating-custom-subagents.md`, `docs/general-llm/subagents/research-subagent-best-practices.md`, `.claude/rules/agent-files.md` (maxTurns convention) | baseline |

---

## Source Doc Index

| Source Doc | Referenced By (count) |
|------------|----------------------|
| `docs/claude-code/claude-prompting-best-practices.md` | 8 |
| `docs/claude-code/hooks/automate-workflow-with-hooks.md` | 5 |
| `docs/claude-code/hooks/claude-hook-reference-doc.md` | 7 |
| `docs/claude-code/memory/how-claude-remembers-a-project.md` | 5 |
| `docs/claude-code/skills/extend-claude-with-skills.md` | 6 |
| `docs/claude-code/skills/research-claude-code-skills-format.md` | 2 |
| `docs/claude-code/subagents/claude-orchestrate-of-claude-code-sessions.md` | 2 |
| `docs/claude-code/subagents/creating-custom-subagents.md` | 7 |
| `docs/general-llm/Evaluating-AGENTS-paper.md` | 1 |
| `docs/general-llm/Evaluating-AGENTS-paper.pdf` | 4 |
| `wiki/knowledge/harness-engineering.md` | 4 |
| `.github/instructions/karpathy-guidelines.instructions.md` | 14 |
| `docs/general-llm/persuasion-principles.md` | 14 |
| `docs/general-llm/prompt-engineering-guide.md` | 8 |
| `docs/general-llm/subagents/research-subagent-best-practices.md` | 5 |
| `docs/shared/skill-authoring-best-practices.md` | 5 |
