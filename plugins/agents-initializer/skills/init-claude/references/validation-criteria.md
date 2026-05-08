# Validation Criteria

Quality checklist for generated and improved AGENTS.md / CLAUDE.md files.
Source: improve-claude/SKILL.md:143-160, improve-agents/SKILL.md:108-122, file-evaluator.md:23-59

---

## Hard Limits (Auto-fail if violated)

Any file violating these must be fixed before proceeding: ≤200 lines per file (Anthropic Docs); ≤150-200 instructions per file (HumanLayer — frontier LLMs follow this many with reasonable consistency); 0 contradictions within or between files (Claude picks arbitrarily); 0 language-specific rules in root (domain rules belong in separate files); 0 stale file-path references (paths change constantly and actively poison context).

## Recommended Targets (Advisory)

Directional goals (not auto-fail) for IMPROVE operations within the 200-line hard limit: root file 15-40 lines (derived from "absolute minimum" guidance); scope file 10-30 lines (one topic per file).

---

## Quality Checks (All must pass)

**Content**: every instruction is actionable (not vague); non-standard package manager / commands / config values documented; cross-scope build prerequisites at root level; progressive disclosure applied (domain docs referenced, not inlined); one scope per file.

**Exclusions**: no tool-enforceable rules in CLAUDE.md (use hooks instead); no duplication across files; no directory/file structure listings; no standard language conventions the model already knows; no long explanations or tutorials (link out instead).

**Placement**: critical instructions at start or end of file (avoid the lost-in-the-middle zone).

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation**: critical project info retained (domain concepts, security/compliance notes); custom commands/scripts from the original kept; existing progressive disclosure structure not flattened back into root; non-obvious architectural decisions carried forward.

**Structural**: files that should remain separate are not merged (each scope gets its own file); scope widened where the original had too little coverage.

---

## Structural Checks

Root file: one-liner + package manager (if non-standard) + build commands (if non-standard) + pointers. Domain content lives in separate files, not inline. Progressive disclosure pointers point to files that actually exist. **CLAUDE.md-specific**: `.claude/rules/` files have `paths:` frontmatter when scoped to file patterns; minimal content in always-loaded locations (`./CLAUDE.md`, `.claude/rules/*.md` without `paths:`). **AGENTS.md-specific**: subdirectory AGENTS.md files used for monorepo package scoping (no `.claude/rules/` equivalent).

---

## Validation Loop Instructions

Execute this loop for each generated or improved file:

1. Evaluate the file against ALL criteria above
2. If ANY criterion fails: identify the specific failure, fix the file, restart evaluation
3. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
4. Only proceed to writing files when ALL criteria pass for ALL files

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.
