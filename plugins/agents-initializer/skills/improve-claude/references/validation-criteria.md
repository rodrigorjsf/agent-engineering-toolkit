# Validation Criteria

Quality checklist for generated and improved AGENTS.md / CLAUDE.md files.
Source: improve-claude/SKILL.md:143-160, improve-agents/SKILL.md:108-122, file-evaluator.md:23-59.

---

## Hard Limits (Auto-fail)

≤200 lines per file; ≤150-200 instructions per file; 0 contradictions; 0 language-specific rules in root; 0 stale file-path references.

## Recommended Targets (Advisory)

Within 200-line hard limit: root 15-40 lines; scope 10-30 lines (one topic per file).

---

## Quality Checks

**Content**: every instruction actionable; non-standard package manager / commands / config values documented; cross-scope build prerequisites at root; progressive disclosure applied; one scope per file.

**Exclusions**: no tool-enforceable rules in CLAUDE.md (use hooks); no duplication; no directory listings; no standard language conventions; no long explanations.

**Placement**: critical instructions at start or end (avoid lost-in-the-middle).

---

## IMPROVE — Also Check

**Information Preservation**: critical project info retained (domain concepts, security/compliance); custom commands/scripts kept; existing progressive disclosure not flattened; non-obvious architectural decisions carried forward.

**Structural**: files that should remain separate not merged; scope widened where original lacked coverage.

---

## Structural Checks

Root: one-liner + package manager (if non-standard) + build commands (if non-standard) + pointers. Domain content in separate files. Pointers point to existing files. **CLAUDE.md**: `.claude/rules/` files have `paths:` when scoped to file patterns; minimal content in always-loaded locations. **AGENTS.md**: subdirectory AGENTS.md for monorepo package scoping (no `.claude/rules/` equivalent).

---

## Validation Loop

For each generated or improved file: evaluate against ALL criteria; if any fail, fix and restart. Maximum 3 iterations — if still failing, surface remaining issues. Apply only when all criteria pass. Hard limits are hard limits.
