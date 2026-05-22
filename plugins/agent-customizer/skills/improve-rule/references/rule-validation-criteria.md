# Rule Validation Criteria

Quality checklist for generated and improved `.claude/rules/*.md` rule files.
---

## Hard Limits (Auto-fail if violated)

Any rule file violating these criteria must be fixed before proceeding:

| Criterion | Threshold |
|-----------|-----------|
| Rule length | ≤ 50 lines |
| YAML frontmatter | Valid YAML if present |
| `paths:` field | Required; array format; valid glob patterns |
| Contradictions with other rules | 0 |


---

## Quality Checks (All must pass)

- [ ] All instructions actionable and verifiable (not "write clean code")
- [ ] One scope per file (no mixing of testing and code style in same rule)
- [ ] Rules have `paths:` frontmatter with specific glob patterns
- [ ] Glob patterns match only the intended file types (not `**/*` unless truly global); in a monorepo, service-scoped rules must use a service-path prefix (`services/api/**/*.go`), not a language-only glob (`**/*.go`)
- [ ] No overlap with existing rules (same instruction not in multiple files)
- [ ] No standard conventions Claude already knows from training
- [ ] No long explanations — rules are instructions, not documentation
- [ ] Evidence citations present: rule instructions justify their existence with reference to project conventions or docs (not just "best practice")
- [ ] Prompt engineering strategy applied: rule uses zero-shot imperative instructions only (no examples, no tutorials, no explanations)

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation:**

- [ ] Path scope not broadened without rationale (specific glob not replaced with `**/*`)
- [ ] Existing coverage not reduced (rules not deleted when they apply to real scenarios)
- [ ] Custom project-specific instructions preserved

**Structural:**

- [ ] Line count reduction doesn't remove actionable instructions (only bloat removed)
- [ ] Single file not split into too many files (aim for 1 topic = 1 file, not 1 instruction = 1 file)

---

## Validation Loop Instructions

Execute this loop for each generated or improved rule file:

1. Evaluate the rule against ALL criteria above
2. If ANY criterion fails: identify the specific failure, fix the rule, restart evaluation
3. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
4. Only proceed to writing rules when ALL criteria pass

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.
