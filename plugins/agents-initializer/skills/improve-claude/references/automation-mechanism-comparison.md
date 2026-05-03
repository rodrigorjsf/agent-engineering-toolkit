# Automation Mechanism Comparison

Routing instructions to on-demand automation mechanisms.
Source: context-aware-improve-optimization.prd.md, analysis-automate-workflow-with-hooks.md, analysis-skill-authoring-best-practices.md, analysis-how-claude-remembers-a-project.md.

Load `automation-token-impact.md` only when Phase 1 flags an instruction block as a migration candidate.

---

## Decision Flowchart

Stop at the first match:

1. Always needed and <5 lines → keep in CLAUDE.md/AGENTS.md root
2. Agent can infer from code → DELETE
3. Path-specific and <50 lines → `.claude/rules/` with `paths:`
4. Deterministic rule broader than a single path → hook (`command`)
5. Enforcement requires LLM judgment → hook (`prompt` or `agent`)
6. Workflow or domain block 50–500 lines → skill (`user-invocable: false`)
7. Heavy, rare, or has side effects → skill (`disable-model-invocation: true`)
8. Context-heavy isolated analysis → skill (`context: fork`)
9. None of the above → keep in current location; reassess next cycle

*Source: context-aware-improve-optimization.prd.md lines 346-358*

---

## Mechanism Comparison

| Mechanism | Context Cost | Enforcement | Best For |
|---|---|---|---|
| Skill (`user-invocable: false`) | ~100 tokens | Advisory — LLM-invoked | Infrequent workflows |
| Skill (`disable-model-invocation: true`) | Zero | Manual — user-invoked | Heavy/rare with side effects |
| Skill (`context: fork`) | Zero parent | Isolated forked | Context-heavy analysis |
| Hook (`command`) | Zero | Deterministic 100% | Formatting, file blocking |
| Hook (`prompt`) | Zero | LLM single-turn | Decisions needing judgment |
| Hook (`agent`) | Zero | LLM multi-turn | Codebase verification |
| Hook (`http`) | Zero | Webhook | Audit logging |
| Path-scoped rule (`paths:`) | Zero until match | Advisory, scoped | File-pattern conventions |
| Subagent (`skills: preload`) | Isolated | Delegated | Parallel/heavy analysis |
| Auto memory | First 200 lines startup | System-managed | Cross-session learnings |

Hook events: `PreToolUse` (block via `hookSpecificOutput.permissionDecision`), `PostToolUse`, `Stop`, `SessionStart`, `UserPromptSubmit`, plus 17 others. Path-scoped rules accept negation: `paths: ["src/**/*.ts", "!src/**/*.test.ts"]`.

*Source: analysis-automate-workflow-with-hooks.md lines 21-130, 433-445*

---

## Distribution-Aware

Skills, path-scoped rules — plugin and standalone. Hooks, subagents — plugin only (require Claude Code). Auto memory — mention only. Filter to supported mechanisms before generating suggestions.

*Source: DESIGN-GUIDELINES.md Guideline 11*
