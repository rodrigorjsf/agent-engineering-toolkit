# Validation Criteria

Quality checklist for generated and improved AGENTS.md files.
Source: improve-agents/SKILL.md:108-122, file-evaluator.md:23-59

---

## Hard Limits (Auto-fail if violated)

Any file violating these criteria must be fixed before proceeding:

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| File length | ≤ 200 lines | Anthropic Docs: "Target under 200 lines per CLAUDE.md file" |
| Instruction count | ≤ 150-200 | HumanLayer: "~150-200 instructions with reasonable consistency" |
| Contradictions (within or between files) | 0 | Anthropic: "Claude may pick one arbitrarily" |
| Language-specific rules in root | 0 | Domain rules belong in separate files |
| Stale file path references | 0 | "File paths change constantly... actively poisons context" |

## Recommended Targets (Advisory)

Directional goals — not auto-fail triggers. Apply during IMPROVE operations when within the 200-line hard limit:

| Target | Range | Note |
|--------|-------|------|
| Root file length | 15-40 lines | Derived from "absolute minimum" guidance |
| Scope file length | 10-30 lines | One topic per file guideline |

---

## Quality Checks (All must pass)

- [ ] Every instruction is actionable (not vague like "write clean code")
- [ ] Package manager specified if non-standard (pnpm, bun, yarn; omit if npm)
- [ ] Non-standard commands documented (build, test, lint, migrate — e.g., `alembic upgrade head`, `prisma migrate deploy`)
- [ ] Non-standard configuration values documented (e.g., `addopts = "--cov=src"`, `strict = true`, line-length overrides)
- [ ] Cross-scope build prerequisites at root level (e.g., WASM must build before web — document ordering at root)
- [ ] Progressive disclosure applied: domain docs referenced, not inlined
- [ ] No information that tools can enforce (linting, formatting rules → rely on tooling enforcement)
- [ ] No duplication of content across files in the hierarchy
- [ ] No directory/file structure listings
- [ ] No standard language conventions the model already knows
- [ ] No long explanations or tutorials (link to external docs instead)
- [ ] Critical instructions appear at start or end of file (not buried in middle)
- [ ] One scope per file (TypeScript rules in one file, testing rules in another)

---

## If This Is an IMPROVE Operation — Also Check

**Information Preservation:**

- [ ] Critical project information preserved (domain concepts, security notes, compliance requirements)
- [ ] Custom commands/scripts referenced in the original file are retained
- [ ] Existing progressive disclosure structure not flattened back into root
- [ ] Non-obvious architectural decisions carried forward (not deleted as "bloat")

**Structural:**

- [ ] Files not merged that should stay separate (each scope gets its own file)
- [ ] Scope widened rather than narrowed where the original had too little coverage

---

## Structural Checks

- [ ] Root file: one-liner + package manager (if non-standard) + build commands (if non-standard) + pointers
- [ ] Domain content lives in separate files, not inline
- [ ] Progressive disclosure pointers point to files that actually exist
- [ ] **AGENTS.md-specific**: Subdirectory AGENTS.md files used for monorepo package scoping

---

## Validation Loop Instructions

Execute this loop for each generated or improved file:

1. Evaluate the file against ALL criteria above
2. If ANY criterion fails: identify the specific failure, fix the file, restart evaluation
3. Maximum 3 iterations — if still failing after 3 attempts, surface the remaining issues to the user
4. Only proceed to writing files when ALL criteria pass for ALL files

**Do not skip criteria for "minor" violations.** Hard limits are hard limits.
