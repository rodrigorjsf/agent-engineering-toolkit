---
paths:
  - "[glob pattern matching relevant files]"
---
<!-- TEMPLATE: .claude/rules/ Path-Scoped Rule. Placement: .claude/rules/[topic-name].md.
     `paths:` REQUIRED — without it, the rule loads unconditionally (token waste).
     One topic per file with descriptive filename. Only non-obvious conventions.
     Two valid categories: (1) convention rules — file-pattern-specific coding conventions;
     (2) domain-critical rules — security/privacy/compliance for sensitive patterns.
     Do NOT create for: project-wide (use root CLAUDE.md), scope-wide (use subdirectory CLAUDE.md), or obvious patterns.
     MIGRATION: `paths:` must target the patterns the original instruction applied to;
     rewrite content as concise verifiable instructions; add `<!-- Migrated from [source]:lines [N-M] -->` after frontmatter.
-->

# [Topic Name]

- [Specific, verifiable instruction]
- [Specific, verifiable instruction]
