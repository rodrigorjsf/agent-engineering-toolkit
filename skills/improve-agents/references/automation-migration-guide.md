# Automation Migration Guide

Decision criteria for migrating instructions from CLAUDE.md/AGENTS.md to on-demand mechanisms.
Source: context-aware-improve-optimization.prd.md, analysis-skill-authoring-best-practices.md, analysis-how-claude-remembers-a-project.md, research-context-engineering-comprehensive.md

---

## Contents

- Decision flowchart (classify content type → select mechanism)
- Content type to mechanism mapping (9 content types with evidence)
- Migration candidate indicators (signals that content should migrate)
- Mechanism comparison (context cost, enforcement, best for)
- Distribution-aware recommendations (plugin vs. standalone)
- Token impact estimation (savings per mechanism type)
- Evidence citations

---

## Decision Flowchart

When evaluating an instruction block for migration, follow this decision path:

1. **Is it always needed for every task and under 5 lines?** → Keep in AGENTS.md root
2. **Can the agent infer it from code?** → DELETE — do not document
3. **Is it path-specific and under 50 lines?** → Subdirectory AGENTS.md for the relevant scope
4. **Is it a workflow or domain block (50-500 lines)?** → Skill (`user-invocable: false`)
5. **Is it heavy, rare, or has side effects?** → Skill (`disable-model-invocation: true`)
6. **Is it context-heavy isolated analysis?** → Skill (`context: fork`)
7. **Is it domain content for a monorepo package?** → Subdirectory AGENTS.md in that package root
8. **None of the above?** → Keep in current location; reassess in next improvement cycle

*Source: context-aware-improve-optimization.prd.md lines 346-358*

---

## Content Type to Mechanism Mapping

Classify each instruction block by content type, then recommend the corresponding mechanism:

| Content Type | Best Mechanism | Evidence Source |
|---|---|---|
| Always-applicable universal rules (<5 lines) | AGENTS.md root | research-context-engineering-comprehensive.md |
| Package or scope-specific conventions (5-50 lines) | Subdirectory AGENTS.md in the relevant package | analysis-how-claude-remembers-a-project.md |
| Domain knowledge or workflows (50-500 lines) | Skill (`user-invocable: false`) | extend-claude-with-skills.md |
| Heavy workflows with side effects | Skill (`disable-model-invocation: true`) | extend-claude-with-skills.md |
| Isolated, context-heavy analysis | Skill (`context: fork`) | extend-claude-with-skills.md |
| Infrequently-needed deep reference | On-demand reference linked from SKILL.md | analysis-skill-authoring-best-practices.md |
| Information agents can infer from code | DELETE — do not document | analysis-evaluating-agents-paper.md |

*Source: context-aware-improve-optimization.prd.md lines 348-358*

---

## Migration Candidate Indicators

Use these signals to identify instructions that should migrate from always-loaded to on-demand:

| Indicator | What It Suggests | Threshold |
|---|---|---|
| Instructions specific to one package or scope | Subdirectory AGENTS.md candidate | Any package-scoped content → suggest subdirectory AGENTS.md |
| Domain knowledge blocks >50 lines | Skill candidate | >50 lines of domain content → suggest skill |
| Workflow instructions invoked <20% of sessions | Low-frequency skill | Low usage → suggest `disable-model-invocation: true` |
| Content agents can infer from code | DELETE candidate | Directory listings, codebase overviews, standard conventions |
| Instructions duplicated across files | Consolidation candidate | Same content in 2+ files → single source of truth |
| Version numbers, team names, release info | DELETE or pointer | High-churn content → remove |

*Source: analysis-evaluating-agents-paper.md lines 36-52, Anthropic Best Practices*

---

## Mechanism Comparison

Compare all available on-demand mechanisms when recommending a migration:

| Mechanism | Context Cost | Enforcement | Best For |
|---|---|---|---|
| Skill (`user-invocable: false`) | ~100 tokens (name + description at startup) | Advisory — LLM decides when to invoke | Infrequent workflows, domain knowledge |
| Skill (`disable-model-invocation: true`) | Zero passive cost | Manual only — user invokes via slash command | Heavy/rare workflows with side effects |
| Skill (`context: fork`) | Zero parent cost | Isolated — runs in forked context | Context-heavy isolated analysis |
| Subdirectory AGENTS.md | Loaded when agent enters that directory | Scoped to package or subdirectory | Monorepo package-specific conventions |
| Domain doc (`docs/TOPIC.md`) | Zero (loaded on demand via pointer) | Advisory — referenced from root AGENTS.md | Deep domain content too large for root |

*Source: analysis-skill-authoring-best-practices.md lines 19-46, research-context-engineering-comprehensive.md*

---

## AGENTS.md Scope

This guide targets the cross-platform AGENTS.md ecosystem. Recommend only mechanisms that work with any AI coding tool:

| Mechanism | Available | Notes |
|---|---|---|
| Skills | Yes | Supported by any platform that reads AGENTS.md |
| Subdirectory AGENTS.md | Yes | Standard monorepo scoping convention |
| Domain docs (`docs/`) | Yes | Referenced via progressive disclosure pointers |

Suggest only the mechanisms listed above. Tool-specific or platform-specific mechanisms are out of scope for AGENTS.md improvement suggestions.

*Source: DESIGN-GUIDELINES.md Guideline 11, project architecture*

---

## Token Impact Estimation

Estimate savings when recommending each migration type:

| Migration Type | Tokens Saved (Always-Loaded) | Tokens Added (On-Demand) | Net Impact |
|---|---|---|---|
| Block → Skill (`user-invocable: false`) | Full block size | ~100 (name + description) | Net = block size − 100 |
| Block → Skill (`disable-model-invocation: true`) | Full block size | 0 | Pure savings |
| Block → Skill (`context: fork`) | Full block size | 0 (isolated context) | Pure savings |
| Content → Subdirectory AGENTS.md | Full content size | 0 (only loaded in that scope) | Pure savings for root |
| Redundant content → DELETE | Full content size | 0 | Pure savings |
| Duplicated content → single source | (N−1) × content size | 0 | Scales with copies |

Present token impact estimates alongside migration recommendations to help users prioritize high-impact changes first.

*Source: research-context-engineering-comprehensive.md, analysis-skill-authoring-best-practices.md lines 19-46*

---

## Evidence Citations

| Claim | Source |
|---|---|
| Codebase overviews do not help agents navigate | analysis-evaluating-agents-paper.md lines 36-41 |
| Agent obedience turns unnecessary instructions into active cost | analysis-evaluating-agents-paper.md lines 42-52 |
| Skill startup cost: ~100 tokens for name + description only | analysis-skill-authoring-best-practices.md lines 19-23 |
| Reference depth: max 1 level from SKILL.md | analysis-skill-authoring-best-practices.md lines 131-143 |
| ≤200 lines per config file; ~150-200 instruction limit | research-context-engineering-comprehensive.md |
| Subdirectory AGENTS.md for monorepo scoping | research-context-engineering-comprehensive.md |
