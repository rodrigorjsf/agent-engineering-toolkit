# Evaluation Criteria

Scoring rubric for assessing existing AGENTS.md files and `.cursor/rules/*` files before improvement. Used by IMPROVE skills only.
Source: file-evaluator.md, research-context-engineering-comprehensive.md.

The canonical Hard Limits Table, Bloat Indicators, Staleness Indicators, Progressive Disclosure Assessment, Quality Score Rubric, and Evaluation Output Template all live in `agents/file-evaluator.md` (the subagent that produces the structured evaluation report). The Migration Candidate Indicators table lives in `automation-migration-guide.md`. This file holds only the criteria specific to the IMPROVE workflow that aren't already covered by those references.

---

## Contents

- Instruction specificity assessment (goldilocks zone, examples)
- Cursor-specific evaluation deltas (`.mdc` activation modes)

---

## Instruction Specificity Assessment

Goldilocks zone — ✅ specific and actionable: "Use 2-space indentation"; ❌ too vague: "Format code properly" (not verifiable); ❌ too specific: "File `src/auth/handlers.ts` handles JWT" (will go stale on a path reference). Standard-command-form examples like "Run `npm test`" are valid form but should still be excluded per `what-not-to-include.md` because the command is the language default.

*Source: research-context-engineering-comprehensive.md lines 131-134*

---

## Cursor-Specific Evaluation Deltas

In addition to the general criteria above and in `file-evaluator.md`, evaluate `.cursor/rules/*.mdc` files for:

- **Activation-mode mismatches** — `alwaysApply: true` rules that should use `globs:` (file-pattern-specific) or `description:` (cross-cutting domain agent-requested)
- **Invalid frontmatter** — `.mdc` frontmatter must contain only `description`, `alwaysApply`, `globs`. Any other field is invalid.
- **Always-loaded bloat** — content under `alwaysApply: true` that doesn't pass the every-task-needed test should migrate to a `globs:` or `description:` rule.

When AGENTS.md is also present, classify each AGENTS.md content block by destination activation mode (`alwaysApply: true` / `globs: [...]` / `description: "..."` / `discard` with one-sentence reason). The migration sub-flow consumes that classification.
