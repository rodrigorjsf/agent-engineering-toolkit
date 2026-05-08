# Validation Criteria

Quality checklist for improved and newly created `.cursor/rules/*.mdc` files, plus the AGENTS.md migration sub-flow output.
Source: Industry Research (research-context-engineering-comprehensive.md), file-evaluator.md.

---

## Hard Limits (Auto-fail)

≤200 lines per rule file; ≤150-200 instructions per file; 0 contradictions between rules; 0 stale file-path references; 0 invalid `.mdc` frontmatter fields (only `description`, `alwaysApply`, `globs`).

---

## Quality Checks

**Content**: every instruction actionable (not vague like "write clean code"); package manager only if non-standard; non-standard build/test commands documented; non-default config overrides included when analysis found them; one concern per rule.

**Progressive disclosure**: cross-cutting domain content lives in `description:`-mode rules, not inlined into always-apply rules.

**Exclusions**: no tool-enforceable rules (use hooks); no duplication across rules; no directory listings; no standard language conventions; no long explanations or tutorials.

**Placement**: critical instructions at start or end of each rule (avoid lost-in-the-middle).

---

## `.mdc`-Specific Checks

- Frontmatter contains ONLY `description`, `alwaysApply`, `globs`.
- `globs:`-mode rules: use `globs:`, set `alwaysApply: false`.
- `description:`-mode rules: use `description:`, omit `globs:`, set `alwaysApply: false`.
- `alwaysApply: true` rules: reserved for content the agent must see on every conversation.
- Activation mode matches content nature (pattern-relative → `globs`; topic-attractor → `description`; critical tooling → `alwaysApply`).

---

## IMPROVE Operation — Also Check

**Information Preservation**: critical project info retained (domain concepts, security/compliance); custom commands/scripts kept; existing activation-mode decomposition not flattened back; non-obvious architectural decisions carried forward.

**Structural**: rules that should stay separate not merged (each concern its own rule); scope widened where original lacked coverage. In high-quality rule sets, unrelated churn is avoided.

**Structural:**

- [ ] Rules not merged that should stay separate (each concern gets its own rule)
- [ ] Scope widened rather than narrowed where the original had too little coverage
- [ ] In high-quality rule sets, unrelated churn is avoided: no extra files or rules unless they fix a documented criterion


**Quality calibration:** A rule scoring ≥ 7/10 that is already within the 200-line budget must NOT be restructured purely to reduce line count — quality and information preservation take precedence over line minimization.

---

## Migration Sub-Flow Output Schema (when AGENTS.md present)

Validate `file-evaluator`'s AGENTS.md block classification before generating any rule:

- Every block has exactly one destination among `alwaysApply: true`, `globs: [...]`, `description: "..."`, `discard`.
- Every `globs:` block lists at least one glob pattern.
- Every `description:` block carries a single-sentence topic attractor (not a paragraph).
- Every `discard` block carries a one-sentence reason naming the bloat/staleness/duplication indicator.
- No block left unclassified; no block carries two destinations (split mixed-concern blocks).

**Non-destruction invariant**: original AGENTS.md is never modified or deleted; only new `.mdc` files are written; the user-facing notification is presented after new rules are applied.

---

## Validation Loop

For each improved or newly created rule (and migration sub-flow output): evaluate against ALL criteria; if any fail, fix and restart. Maximum 3 iterations — if still failing, surface remaining issues. Apply only when all criteria pass. Hard limits are hard limits.
