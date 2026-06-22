# Quality Gate Criteria — Cursor-Code-Documentation

Complete check tables, severity classification, and findings report template for
the cursor-code-documentation quality gate meta-skill. All tables below encode the
GREEN-expected state for the shipped plugin.

Source: `.claude/rules/cursor-plugin-skills.md`, `.claude/rules/plugin-versioning.md`,
`.claude/rules/readme-files.md`, `docs/adr/0016-cursor-code-documentation-rule-not-hook.md`,
`wiki/knowledge/skill-body-convention.md`

## Contents

1. [Rule Checks](#rule-checks)
2. [Per-Skill Checks](#per-skill-checks)
3. [Manifest Checks](#manifest-checks)
4. [Marketplace-Parity Checks](#marketplace-parity-checks)
5. [Version-Cascade Checks](#version-cascade-checks)
6. [Red-Green Scenario Table](#red-green-scenario-table)
7. [Severity Classification](#severity-classification)
8. [Report Template](#report-template)

---

## Rule Checks

Target: `plugins/cursor-code-documentation/.cursor/rules/document-as-you-code.mdc`

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| R1 | YAML frontmatter present with `description` | Required | CRITICAL |
| R2 | `alwaysApply` equals `true` | Required (always-on per-turn injection) | CRITICAL |
| R3 | Frontmatter uses ONLY Cursor-native keys (`description`, `alwaysApply`, `globs`) | Cursor constraint | CRITICAL |
| R4 | NO Claude-specific `paths:` field present | Prohibited (Claude field) | CRITICAL |
| R5 | Body ≤ 30 lines and names the language→format mapping (Java→Javadoc, JS/TS→JSDoc, Python→docstring, shell→header comment) | Hard limit + content | MAJOR |

---

## Per-Skill Checks

Targets: `plugins/cursor-code-documentation/skills/code-explain/SKILL.md`,
`plugins/cursor-code-documentation/skills/doc-generate/SKILL.md`

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| S1 | YAML frontmatter present with `name` and `description` | Required | CRITICAL |
| S2 | `name` equals the containing folder name (`code-explain` / `doc-generate`) | Exact | CRITICAL |
| S3 | `disable-model-invocation: true` present (manual-only invocation) | Required | CRITICAL |
| S4 | `description` ≤ 1024 chars, non-empty, no XML tags | Exact | MAJOR |
| S5 | Mandatory semantic tags present: `<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>`, `<PROCESS>` containing ≥1 `<PHASE>` | Required | CRITICAL |
| S6 | Every `<PHASE>` carries an `id=` attribute (ONLY `<PHASE>` requires `id=`; `<PREFLIGHT>`/`<OUTPUT>`/`<VALIDATION>` correctly carry none) | Required | CRITICAL |
| S7 | All opened tags balanced; all attribute values quoted | Well-formed | CRITICAL |

> **Do NOT apply generator checks** to these skills: no `references/` dir, no
> `assets/templates/` dir, no `validation-criteria.md` reference, no
> delegate-to-analyzer phase, no intra-plugin shared-copy parity. Those govern the
> cursor-initializer / cursor-customizer generators. These are manual-only,
> deployable-behavior skills with none of those surfaces by design.

---

## Manifest Checks

Target: `plugins/cursor-code-documentation/.cursor-plugin/plugin.json`

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| M1 | Valid JSON (parses without error) | Required | CRITICAL |
| M2 | `name` equals `cursor-code-documentation` | Exact | CRITICAL |
| M3 | `version` present and valid SemVer (`1.0.0`) | Required | CRITICAL |
| M4 | `description` present and non-empty | Required | MAJOR |

---

## Marketplace-Parity Checks

Target: repo-root `.cursor-plugin/marketplace.json` and root `README.md`

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| MP1 | `cursor-code-documentation` registered in the `plugins[]` array | Required | CRITICAL |
| MP2 | Entry matches existing-sibling shape (`name` + `source` + `description`), `source` equals bare dir name `cursor-code-documentation`, and carries NO per-entry `version` field | Shape parity | CRITICAL |
| MP3 | Root `README.md` Distributions table has a `cursor-code-documentation` row | Required | MAJOR |
| MP4 | Root `README.md` Installation section has a `cursor-code-documentation` install one-liner block linking to the plugin README | Required | MAJOR |

> MP2 asserts parity with the sibling entries' shape, NOT a hardcoded key count.
> Acceptance criterion #4 forbids only a per-entry `version` field; a `description`
> matching the two siblings is required for shape consistency.

---

## Version-Cascade Checks

Source: `.claude/rules/plugin-versioning.md`

| # | Check | Threshold | Severity if Violated |
|---|-------|-----------|---------------------|
| VC1 | `.cursor-plugin/marketplace.json` `metadata.version` bumped to `1.2.0` (MINOR — new `plugins[]` entry) | Exact | CRITICAL |
| VC2 | `plugins/cursor-code-documentation/.cursor-plugin/plugin.json` `version` STAYS `1.0.0` (this slice touches no file under `plugins/cursor-code-documentation/**`) | Exact | MAJOR |

> Do NOT check `.claude-plugin/marketplace.json` — cascade rule (2) is
> Claude-Code-only; this Cursor plugin is not in the Claude registry. The two
> marketplaces are independent.

---

## Red-Green Scenario Table

All four scenarios are GREEN-expected for the shipped plugin.

| # | Scenario | RED baseline (absent behavior) | GREEN assertion (evidence in artifact) |
|---|----------|--------------------------------|----------------------------------------|
| G1 | Edit/create a code symbol | No automatic documentation added | The always-apply rule (`alwaysApply: true`) maps each language to its idiomatic doc format and instructs documenting on every code write/edit |
| G2 | `/code-explain` invoked | No structured explanation | `code-explain` `<PROCESS>` produces the three-section format (Overview, Key Concepts, Step-by-Step Breakdown) |
| G3 | `/doc-generate` invoked | No documentation artifact | `doc-generate` `<PROCESS>` produces the requested form (API docs, README section, or inline doc-strings) |
| G4 | Mid-edit, no explicit `/command` | A manual skill auto-fires spuriously | Both skills carry `disable-model-invocation: true`, so neither auto-invokes |

---

## Severity Classification

| Severity | Meaning | Must Fix Before Release? |
|----------|---------|--------------------------|
| CRITICAL | Hard limit violated; feature broken or convention fundamentally wrong | Yes — blocking |
| MAJOR | Structural convention violated; output quality or parity at risk | Yes — before next release |
| MINOR | Quality or documentation convention missed; no runtime impact | Recommended — track in backlog |

---

## Report Template

Use this structure for `.specs/reports/cursor-code-documentation-quality-gate-[YYYY-MM-DD]-findings.md`:

```markdown
# Cursor-Code-Documentation Quality Gate Findings — [YYYY-MM-DD]

**Status:** FAIL — [N] findings ([N] CRITICAL, [N] MAJOR, [N] MINOR)

## Quality Gate Dashboard

| Category | Checks | Passed | Failed | Status |
|----------|--------|--------|--------|--------|
| Static Artifact Conformance | [N] | [N] | [N] | PASS/FAIL |
| Marketplace Parity + Version | [N] | [N] | [N] | PASS/FAIL |
| Docs-Drift (N/A by design) | 1 | 1 | 0 | PASS |
| Red-Green Scenario Evaluation | 4 | [N] | [N] | PASS/FAIL |
| **OVERALL** | [N] | [N] | [N] | **FAIL** |

---

## Findings

### F001 — [Short Title] [CRITICAL/MAJOR/MINOR]

- **Category**: Static | Marketplace/Version | Red-Green
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

---

## PRD Brief

> This section is structured as input for `/prp-core:prp-prd`.

**Problem Statement:**
[Summary of what's wrong with the current state, grounded in the findings above]

**Evidence:**
[Key evidence points — file paths, rule citations, measurements]

**Proposed Solution:**
[What changes resolve all findings — at improvement-area level]

**Success Metrics:**
[Specific checks that would now pass]

**Out of Scope:**
[What this remediation does NOT address]
```
