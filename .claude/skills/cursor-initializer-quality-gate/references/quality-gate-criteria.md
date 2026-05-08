# Quality Gate Criteria — Cursor-Initializer

Complete checklist of expected results and the findings report template for the
cursor-initializer quality gate meta-skill.

Source: `.claude/rules/cursor-plugin-skills.md`, `.claude/rules/reference-files.md`,
`.github/instructions/agent-definitions.instructions.md`,
`.github/instructions/template-files.instructions.md`

## Contents

1. [Expected Results Checklist](#expected-results-checklist)
2. [Severity Classification](#severity-classification)
3. [Report Template](#report-template)

---

## Expected Results Checklist

### Plugin SKILL.md (2 files)

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| P1 | YAML frontmatter: `name` and `description` present | Required | CRITICAL |
| P2 | `name` ≤ 64 chars, pattern `[a-z0-9-]+` | Exact | MAJOR |
| P3 | `description` ≤ 1024 chars, non-empty, no XML tags | Exact | MAJOR |
| P4 | Body < 500 lines | Hard limit | CRITICAL |
| P5 | Uses relative paths for bundled files — NO `${CLAUDE_SKILL_DIR}` | Cursor constraint | MAJOR |
| P6 | No inline bash analysis blocks for codebase scanning | Prohibited | MAJOR |
| P7 | Self-validation phase references `validation-criteria.md` | Required | MAJOR |
| P8 | `references/` directory exists | Required | CRITICAL |
| P9 | `assets/templates/` directory exists | Required | CRITICAL |
| P10 | References one level deep (no nested paths) | Required | MAJOR |

### Cursor Agent Files (3 files)

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| A1 | YAML frontmatter present with `name` and `description` | Required | CRITICAL |
| A2 | `model` equals "inherit" | Cursor requirement | CRITICAL |
| A3 | `readonly` equals `true` | Cursor requirement | CRITICAL |
| A4 | NO `tools:` field present | Cursor constraint | CRITICAL |
| A5 | NO `maxTurns:` field present | Cursor constraint | MAJOR |
| A6 | No agent spawning instructions in body | Prohibited | MAJOR |

### Reference Files (all copies)

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| R1 | File length ≤ 200 lines | Hard limit | CRITICAL |
| R2 | `## Contents` TOC present if file > 100 lines | Required | MINOR |
| R3 | Source attribution present (`Source:` or `Sources:`) | Required | MINOR |
| R4 | Content framed as instructions, not executable scripts | Required | MAJOR |
| R5 | No nested reference imports within file | Prohibited | MAJOR |

### Template Files

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| T1 | All three activation-mode `.mdc` variants present in both skills (`cursor-rule-always.mdc`, `cursor-rule-globs.mdc`, `cursor-rule-description.mdc`) | Required | CRITICAL |
| T2 | `.mdc` templates use ONLY valid frontmatter: `description`, `alwaysApply`, `globs` | Cursor constraint | CRITICAL |
| T3 | `.mdc` templates do NOT contain `paths:` | Prohibited (Claude field) | CRITICAL |
| T4 | The three `.mdc` variants are byte-identical between init-cursor and improve-cursor | Required | MAJOR |
| T5 | `init-cursor` does NOT generate `AGENTS.md` (rules-first; no legacy monolithic context file output) | Cursor constraint | CRITICAL |
| T6 | `improve-cursor` migrates `AGENTS.md` non-destructively when present in the target project (original file left intact) | Cursor constraint | CRITICAL |

### Cross-Copy Parity (init-cursor ↔ improve-cursor)

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| X1 | Shared reference files byte-identical within each intended copy family | Required | MAJOR |
| X2 | Shared template files byte-identical within each intended copy family | Required | MAJOR |

### Red-Green Test Coverage

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| G1 | S1: init simple project — cursor distribution passes | GREEN required | MAJOR |
| G2 | S2: init complex monorepo — cursor distribution passes | GREEN required | MAJOR |
| G3 | S3: improve bloated file — all planted violations caught | GREEN required | MAJOR |
| G4 | S4: improve reasonable file — surgical changes only | GREEN required | MAJOR |

---

## Severity Classification

| Severity | Meaning | Must Fix Before Release? |
|----------|---------|--------------------------|
| CRITICAL | Hard limit violated; feature broken or convention fundamentally wrong | Yes — blocking |
| MAJOR | Structural convention violated; output quality or parity at risk | Yes — before next release |
| MINOR | Quality or documentation convention missed; no runtime impact | Recommended — track in backlog |

---

## Report Template

Use this structure for `.specs/reports/cursor-quality-gate-[YYYY-MM-DD]-findings.md`:

```markdown
# Cursor Quality Gate Findings — [YYYY-MM-DD]

**Status:** FAIL — [N] findings ([N] CRITICAL, [N] MAJOR, [N] MINOR)

## Quality Gate Dashboard

| Category | Checks | Passed | Failed | Status |
|----------|--------|--------|--------|--------|
| Static Artifact Compliance | [N] | [N] | [N] | FAIL |
| Cross-Copy Parity | [N] | [N] | [N] | PASS/FAIL |
| Red-Green Test Coverage | 4 | [N] | [N] | PASS/FAIL |
| **OVERALL** | [N] | [N] | [N] | **FAIL** |

---

## Findings

### F001 — [Short Title] [CRITICAL/MAJOR/MINOR]

- **Category**: Static | Parity | Red-Green
- **Artifact**: `[file path]`
- **Rule Violated**: "[exact rule text]"
- **Rule Source**: `[rule file]` — [section]
- **Current State**: [what the artifact contains — quote evidence]
- **Expected State**: [what it should contain per documentation]
- **Impact**: [what degrades or breaks without fixing]
- **Proposed Fix**: [specific action — what to add/change/remove]

[Repeat for each finding...]

---

## Improvement Areas

### Area 1: [Name]
**Findings covered:** F001, F002
**Summary:** [Why these findings belong together]
**Estimated scope:** [number of files, nature of change]

[Repeat per area...]

---

## PRD Brief

> This section is structured as input for `/prp-core:prp-prd`.

**Problem Statement:**
[Summary of what's wrong with the current state, grounded in the findings above]

**Evidence:**
[List key evidence points from findings — file paths, rule citations, measurements]

**Proposed Solution:**
[What changes would resolve all findings — describe at improvement-area level]

**Success Metrics:**
[How to verify the fix worked — specific checks that would now pass]

**Out of Scope:**
[What this remediation does NOT address]
```
