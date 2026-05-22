# Rule Validation Criteria

Quality checklist for generated and improved `.cursor/rules/*.mdc` rule files.

---

## Hard Limits (Auto-fail if violated)

Any rule file violating these criteria must be fixed before proceeding:

| Criterion | Threshold |
|-----------|-----------|
| Rule length | ≤ 200 lines |
| YAML frontmatter | Valid YAML |
| Frontmatter fields | ONLY `description`, `alwaysApply`, `globs` are valid; ALL others are AUTO-FAIL |
| Banned frontmatter key | A `paths` key MUST NOT appear; it belongs to a different platform's convention |
| Activation-mode well-formedness | `alwaysApply: true` must omit `globs`; `globs:` rules must set `alwaysApply: false`; `description:`-only rules must omit `globs` and set `alwaysApply: false` |
| Contradictions with other rules | 0 |
| Stale file path references | 0 |


---

## Quality Checks (All must pass)

- [ ] All instructions actionable and verifiable (not "write clean code")
- [ ] One concern per file (no mixing of unrelated topics)
- [ ] Activation mode chosen matches the content's nature: critical tooling → `alwaysApply: true`; pattern-relative → `globs`; topic-attractor → `description`
- [ ] `alwaysApply: true` rules are short — every line is critical for every conversation
- [ ] Glob patterns specific (not `**/*` unless truly global); in a monorepo, use a package-path prefix (`services/api/**/*.go`), not a language-only glob (`**/*.go`)
- [ ] No overlap with existing rules (same instruction not in multiple files)
- [ ] No standard language conventions the agent already knows from training
- [ ] No long explanations or tutorials — rules are instructions, not documentation
- [ ] Files referenced via `@path/to/file` rather than copied inline where practical
- [ ] Evidence citations present: rule instructions justify their existence with reference to project conventions
- [ ] Prompt engineering strategy applied: rule uses zero-shot imperative instructions only (no examples, no tutorials, no explanations)
- [ ] Critical instructions appear at the start or end of the rule body, not buried in the middle

---

## `.mdc`-Specific Checks

- [ ] Frontmatter contains ONLY `description`, `alwaysApply`, and `globs` — any other key is AUTO-FAIL
- [ ] No `paths` frontmatter key anywhere in the file
- [ ] `globs:`-mode rules use `globs:` and set `alwaysApply: false`
- [ ] `description:`-mode rules use `description:`, omit `globs:`, and set `alwaysApply: false`
- [ ] `alwaysApply: true` rules are reserved for content the agent must see on every conversation
- [ ] Filename is kebab-case and ends in `.mdc`

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation:**

- [ ] Activation mode not weakened without rationale (auto-attached not silently demoted to manual)
- [ ] Existing coverage not reduced (rules not deleted when they apply to real scenarios)
- [ ] Custom project-specific instructions preserved
- [ ] Glob scope not broadened without rationale (specific glob not replaced with `**/*`)

**Structural:**

- [ ] Line count reduction doesn't remove actionable instructions (only bloat removed)
- [ ] Single file not split into too many files (aim for 1 topic = 1 file, not 1 instruction = 1 file)
- [ ] Activation-mode change is justified by content nature, not convenience

---

## Validation Loop Instructions

Execute this loop for each generated or improved rule file:

1. Evaluate the rule against ALL criteria above
2. If ANY criterion fails: identify the specific failure, fix the rule, restart evaluation
3. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
4. Only proceed to writing rules when ALL criteria pass

**Do not skip criteria for "minor" violations.** Hard limits are hard limits. A `paths` frontmatter key, a non-permitted frontmatter field, or a length over 200 lines is automatic re-entry into generation.
