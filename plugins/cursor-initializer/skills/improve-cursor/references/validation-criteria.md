# Validation Criteria

Quality checklist for improved and newly created `.cursor/rules/*.mdc` files, plus the AGENTS.md migration sub-flow output.
Source: Industry Research (research-context-engineering-comprehensive.md), file-evaluator.md

---

## Hard Limits (Auto-fail if violated)

Any rule file violating these criteria must be fixed before proceeding:

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| Rule file length | ≤ 200 lines | Industry Research: 200-line target for configuration files in this toolkit |
| Instruction count | ≤ 150-200 | Industry Research: "~150-200 instructions with reasonable consistency" |
| Contradictions between rules | 0 | Industry Research: conflicting instructions make the model choose inconsistently |
| Stale file path references | 0 | Industry Research: "File paths change constantly... actively poisons context" |
| Invalid `.mdc` frontmatter fields | 0 | Only `description`, `alwaysApply`, `globs` are valid |

---

## Quality Checks (All must pass)

- [ ] Every instruction is actionable (not vague like "write clean code")
- [ ] Package manager mentioned only if non-standard (pnpm, bun, yarn; omit if npm)
- [ ] Build / test commands included only if non-standard
- [ ] Non-default config overrides included when analysis found them
- [ ] Progressive disclosure applied: cross-cutting domain content lives in `description:`-mode rules, not inlined into always-apply rules
- [ ] No information that tools can enforce (linting, formatting → use hooks instead)
- [ ] No duplication of content across rules
- [ ] No directory or file structure listings
- [ ] No standard language conventions the model already knows
- [ ] No long explanations or tutorials (link to external docs instead)
- [ ] Critical instructions appear at start or end of each rule (not buried in middle)
- [ ] One concern per rule

---

## `.mdc`-Specific Checks

- [ ] Frontmatter contains ONLY `description`, `alwaysApply`, and `globs` — no other fields
- [ ] `globs:`-mode rules use `globs:` and set `alwaysApply: false`
- [ ] `description:`-mode rules use `description:`, omit `globs:`, and set `alwaysApply: false`
- [ ] `alwaysApply: true` rules are reserved for content the agent must see on every conversation
- [ ] Activation mode of each rule matches the content's nature (pattern-relative → globs; topic-attractor → description; critical tooling → alwaysApply)

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation:**

- [ ] Critical project information preserved (domain concepts, security notes, compliance requirements)
- [ ] Custom commands / scripts referenced in the original rules are retained
- [ ] Existing activation-mode decomposition not flattened back into a single always-apply rule
- [ ] Non-obvious architectural decisions carried forward (not deleted as "bloat")

**Structural:**

- [ ] Rules not merged that should stay separate (each concern gets its own rule)
- [ ] Scope widened rather than narrowed where the original had too little coverage
- [ ] In high-quality rule sets, unrelated churn is avoided: no extra files or rules unless they fix a documented criterion


**Quality calibration:** A rule scoring ≥ 7/10 that is already within the 200-line budget must NOT be restructured purely to reduce line count — quality and information preservation take precedence over line minimization.

---

## Migration Sub-Flow Output Schema (only when AGENTS.md is present)

When the migration sub-flow runs, validate `file-evaluator`'s AGENTS.md block classification output before generating any rule:

- [ ] Every classified block has exactly one destination among:
  - `alwaysApply: true`
  - `globs: [...]`
  - `description: "..."`
  - `discard`
- [ ] Every `globs:` block lists at least one glob pattern
- [ ] Every `description:` block carries a single-sentence topic attractor (not a paragraph)
- [ ] Every `discard` block carries a one-sentence reason naming the bloat / staleness / duplication indicator that triggered the discard
- [ ] No block is left unclassified
- [ ] No block carries two destinations simultaneously (a mixed-concern block must be split)

**Sub-flow non-destruction invariant:**

- [ ] The original AGENTS.md file is never modified or deleted by the sub-flow
- [ ] Only newly created `.mdc` rule files are written; no pre-existing rule is modified by the sub-flow
- [ ] The user-facing notification ("you must remove the original AGENTS.md manually") is presented after the new rules are applied

---

## Validation Loop Instructions

Execute this loop for each improved or newly created rule file, and for the migration sub-flow output if it ran:

1. Evaluate against ALL criteria above
2. If ANY criterion fails: identify the specific failure, fix the file or sub-flow output, restart evaluation
3. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
4. Only apply changes when ALL criteria pass

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.
