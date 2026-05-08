# Evaluation Criteria

Scoring rubric for assessing existing AGENTS.md / CLAUDE.md files before improvement. IMPROVE skills only.
Source: file-evaluator.md, research-context-engineering-comprehensive.md.

The canonical Hard Limits Table, Bloat Indicators, Staleness Indicators, Progressive Disclosure Assessment, Quality Score Rubric, and Evaluation Output Template all live in `agents/file-evaluator.md` (the subagent that produces the structured evaluation report). The Migration Candidate Indicators table lives in `automation-token-impact.md`. This file holds only criteria specific to the IMPROVE workflow.

## Instruction Specificity Assessment

Goldilocks: ✅ specific and actionable: "Use 2-space indentation"; ❌ too vague: "Format code properly"; ❌ too specific: "File `src/auth/handlers.ts` handles JWT" (path goes stale). Standard-command-form like "Run `npm test`" is valid form but should still be excluded per `what-not-to-include.md` (the command is the language default).

**Config-enforcement distinction**: rules already enforced by config files ("Strict mode" with `tsconfig.json` `"strict": true`) → DELETE. Project decisions not in config ("Use `unknown` over `any`; validate with `zod`") → keep.

*Source: research-context-engineering-comprehensive.md lines 131-134*

## Calibrated Improvement Mode

When overall quality score ≥7/10 with no hard-limit violations: at most one actionable suggestion per identified issue (not per paragraph); default to keeping content as-is for borderline cases (dimension ≥6 with ambiguous evidence); focus on clear violations only — no speculative improvements; a 7-9/10 file exits with surgical targeted changes, not a full restructure. Progressive-disclosure extraction candidates (10+ lines AND 3+ rules) suggested only when they resolve a failing criterion or remove clearly non-root content. Preserve non-issue sections; favor issue-local edits over structural churn. If the file still exceeds the root line target after issue-local fixes, allow one additional low-churn extraction focused on the lowest-value remaining block. Domain-specific blocks meeting the 10+ line / 3+ rule threshold but under 50 lines extract to a domain-doc (not `SKILL_CANDIDATE`); the 50-line threshold applies only to `SKILL_CANDIDATE`.
