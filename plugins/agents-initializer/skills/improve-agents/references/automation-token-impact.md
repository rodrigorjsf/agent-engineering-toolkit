# Automation Token Impact

Migration-candidate signals and per-mechanism token-impact estimation.
Load only when Phase 1 has flagged an instruction block as a migration candidate.
Source: context-aware-improve-optimization.prd.md, analysis-evaluating-agents-paper.md, research-context-engineering-comprehensive.md.

For mechanism comparison and the decision flowchart, see `automation-mechanism-comparison.md`.

---

## Migration Candidate Indicators

- Mentions specific file patterns → path-scoped rule (`.claude/rules/` with `paths:`)
- Formatting / blocking / notification behaviors → hook (`command` if deterministic across multiple files), unless better as a path-scoped rule
- "Always" / "never" enforcement semantics → hook (`PreToolUse`), only when global, not per-pattern
- Domain knowledge blocks >50 lines → skill
- Workflow invoked in <20% of sessions → skill (`disable-model-invocation: true`)
- Inferable from code (directory listings, codebase overviews, standard conventions) → DELETE
- Duplicated across 2+ files → consolidate to single source
- Version numbers / team names / release info (high-churn) → DELETE or replace with memory pointer

*Source: analysis-evaluating-agents-paper.md lines 36-52; Anthropic Best Practices*

---

## Token Impact Estimation

| Migration | Saved (always-loaded) | Added (on-demand) | Net |
|---|---|---|---|
| Instruction → Hook | ~20-50 per rule | 0 | Pure savings |
| Instruction → Path-scoped rule | ~20-50 per rule | 0 until match | Pure savings (most sessions) |
| Block → Skill (`user-invocable: false`) | Full block | ~100 (name + description) | Block − 100 |
| Block → Skill (`disable-model-invocation: true`) | Full block | 0 | Pure savings |
| Block → Skill (`context: fork`) | Full block | 0 | Pure savings |
| Redundant → DELETE | Full | 0 | Pure savings |
| Duplicated → single source | (N−1) × content | 0 | Scales with copies |

Present token-impact estimates alongside migration recommendations so users can prioritize high-impact changes.

*Source: research-context-engineering-comprehensive.md; analysis-skill-authoring-best-practices.md lines 19-46; DESIGN-GUIDELINES.md Guideline 10 (~20-50 tokens saved per converted rule); skill startup ~100 tokens; path-scoped rules load on-demand via `paths:`; ≤200 lines per file.*
