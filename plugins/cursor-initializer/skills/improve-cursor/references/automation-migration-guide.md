# Automation Migration Guide

Decision criteria for migrating instructions (including legacy AGENTS.md content the migration sub-flow processes) into on-demand `.cursor/rules/*.mdc` mechanisms.
Source: context-aware-improve-optimization.prd.md, analysis-automate-workflow-with-hooks.md, analysis-skill-authoring-best-practices.md, analysis-how-claude-remembers-a-project.md.

---

## Decision Flowchart

Stop at the first match:

1. Always needed and <5 lines → `.cursor/rules/*.mdc` with `alwaysApply: true`
2. Agent can infer from code → DELETE
3. Deterministic rule (no judgment) → hook (`.cursor/hooks.json`)
4. Enforcement requires LLM judgment → hook (`prompt`)
5. Path-specific and <50 lines → `.cursor/rules/` with `globs:`
6. Workflow or domain block 50–500 lines → skill (auto-invocable)
7. Heavy, rare, or has side effects → skill (`disable-model-invocation: true`)
8. None of the above → keep in current location; reassess next cycle

*Source: context-aware-improve-optimization.prd.md lines 346-358*

---

## Migration Candidate Indicators

- Mentions specific file patterns → path-scoped rule (`.cursor/rules/` with `globs:`)
- Formatting / blocking / notification behaviors → hook (`.cursor/hooks.json`)
- "Always" / "never" enforcement semantics → hook (`preToolUse`)
- Domain knowledge blocks >50 lines → skill
- Workflow invoked in <20% of sessions → skill (`disable-model-invocation: true`)
- Inferable from code → DELETE
- Duplicated across 2+ files → consolidate to single source
- Version numbers / team names / release info → DELETE or replace with memory pointer

*Source: analysis-evaluating-agents-paper.md lines 36-52, Industry Research*

---

## Mechanism Comparison

| Mechanism | Context Cost | Enforcement | Best For |
|---|---|---|---|
| Skill (auto-invocable) | ~100 tokens | Advisory — LLM-invoked | Infrequent workflows |
| Skill (`disable-model-invocation: true`) | Zero passive | Manual only | Heavy/rare with side effects |
| Hook (`.cursor/hooks.json` `command`) | Zero | Deterministic 100% | Formatting, file blocking |
| Hook (`.cursor/hooks.json` `prompt`) | Zero | LLM-judged | Decisions needing judgment |
| Path-scoped rule (`.cursor/rules/` `globs:`) | Zero until match | Advisory, scoped | File-pattern conventions |
| Subagent (Task tool) | Isolated | Delegated | Parallel/heavy analysis |

Hook events: `preToolUse`, `postToolUse`, `postToolUseFailure`, `stop`, `sessionStart`, `beforeShellExecution`. Block by returning `{"decision": "block"}` from a `prompt` hook. `globs:` accepts string or array (e.g., `["src/**/*.ts", "!src/**/*.test.ts"]`).

*Source: analysis-automate-workflow-with-hooks.md lines 21-130, 433-445*

---

## Distribution-Aware Recommendations

Skills, path-scoped rules — plugin and standalone. Hooks, subagents — plugin only (require Cursor plugin). Check distribution type before generating; filter to supported mechanisms.

---

## Token Impact Estimation

| Migration | Saved (always-loaded) | Added (on-demand) | Net |
|---|---|---|---|
| Instruction → Hook | ~20-50 per rule | 0 | Pure savings |
| Instruction → Path-scoped rule | ~20-50 per rule | 0 until match | Pure savings (most sessions) |
| Block → Skill (auto-invocable) | Full block | ~100 (name + description) | Block − 100 |
| Block → Skill (`disable-model-invocation: true`) | Full block | 0 | Pure savings |
| Redundant → DELETE | Full | 0 | Pure savings |
| Duplicated → single source | (N−1) × content | 0 | Scales with copies |

Present token-impact estimates alongside migration recommendations.

*Source: research-context-engineering-comprehensive.md, analysis-skill-authoring-best-practices.md lines 19-46*
