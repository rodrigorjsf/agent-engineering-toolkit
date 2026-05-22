# Validation Criteria

Quality checklist for generated `.cursor/rules/*.mdc` files.

---

## Hard Limits (Auto-fail if violated)

Any rule file violating these criteria must be fixed before proceeding:

| Criterion | Threshold |
|-----------|-----------|
| Rule file length | ≤ 200 lines — 200-line target for configuration files in this toolkit |
| Instruction count | ≤ 150-200 — "~150-200 instructions with reasonable consistency" |
| Contradictions between rules | 0 — conflicting instructions make the model choose inconsistently |
| Stale file path references | 0 — "File paths change constantly... actively poisons context" |
| Invalid `.mdc` frontmatter fields | 0 — only `description`, `alwaysApply`, `globs` are valid |

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

## Empty-Set Outcome

For trivial single-package projects with no non-obvious tooling, `rule-domain-detector` returns an empty `Suggested Rules` list. In that case:

- [ ] Generate ZERO `.cursor/rules/*.mdc` files
- [ ] Do not create the `.cursor/rules/` directory
- [ ] Report the empty-set result to the user with a one-line note that the project's tooling is fully covered by the agent's defaults

This is the **canonical passing outcome** for trivial projects — not a failure.

---

## Validation Loop Instructions

Execute this loop for each generated rule file:

1. Evaluate the file against ALL criteria above
2. If ANY criterion fails: identify the specific failure, fix the file, restart evaluation
3. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
4. Only proceed to writing files when ALL criteria pass for ALL files

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.
