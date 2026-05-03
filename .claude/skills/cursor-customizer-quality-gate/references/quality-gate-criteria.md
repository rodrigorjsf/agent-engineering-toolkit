# Quality Gate Criteria — cursor-customizer Plugin

Complete checklist of expected results, the known-accepted exceptions, and the findings report
template for the `cursor-customizer-quality-gate` meta-skill.

Source: `.claude/rules/cursor-plugin-skills.md`, `.claude/rules/reference-files.md`,
`plugins/cursor-customizer/CONVENTIONS.md`, `docs/adr/0001-cursor-distribution-rules-first.md`,
`docs/adr/0002-product-strict-research-foundation.md`,
`docs/adr/0003-cursor-skills-default-path.md`.

## Contents

1. [Plugin SKILL.md Checks](#plugin-skillmd-checks)
2. [Cursor Subagent Checks](#cursor-subagent-checks)
3. [Reference File Checks](#reference-file-checks)
4. [Template File Checks](#template-file-checks)
5. [Intra-Plugin Parity Checks](#intra-plugin-parity-checks)
6. [Docs Drift Checks](#docs-drift-checks)
7. [Red-Green Scenario Checks](#red-green-scenario-checks)
8. [Plugin Manifest Checks](#plugin-manifest-checks)
9. [Drift Manifest Completeness Checks](#drift-manifest-completeness-checks)
10. [Product-Strict Textual Compliance](#product-strict-textual-compliance)
11. [Known-Accepted Exceptions](#known-accepted-exceptions)
12. [Severity Classification](#severity-classification)
13. [Expected Results Checklist](#expected-results-checklist)
14. [Report Template](#report-template)

---

## Plugin SKILL.md Checks

Applies to all 8 skills: `create-skill`, `improve-skill`, `create-hook`, `improve-hook`,
`create-rule`, `improve-rule`, `create-subagent`, `improve-subagent`.

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| P1 | YAML frontmatter: `name` and `description` present | Required | CRITICAL |
| P2 | `name` ≤ 64 chars, pattern `[a-z0-9-]+` | Exact | MAJOR |
| P3 | `description` ≤ 1024 chars, non-empty, no XML tags | Exact | MAJOR |
| P4 | Body < 500 lines | Hard limit | CRITICAL |
| P5 | Uses relative paths for bundled files (no `${CLAUDE_SKILL_DIR}`) | Cursor constraint | MAJOR |
| P6 | Create skills delegate to `artifact-analyzer` | Required | CRITICAL |
| P7 | Improve skills delegate to a Cursor-native type-specific evaluator | Required | CRITICAL |
| P8 | No inline bash analysis blocks for codebase scanning | Prohibited | MAJOR |
| P9 | Self-validation phase references `*-validation-criteria.md` | Required | MAJOR |
| P10 | `references/` directory exists alongside SKILL.md | Required | CRITICAL |
| P11 | `assets/templates/` directory exists alongside SKILL.md | Required | CRITICAL |
| P12 | References one level deep — no nested `references/references/` paths | Required | MAJOR |

---

## Cursor Subagent Checks

Applies to every file in `plugins/cursor-customizer/agents/*.md` (currently 6: `artifact-analyzer`,
`docs-drift-checker`, `skill-evaluator`, `hook-evaluator`, `rule-evaluator`, `subagent-evaluator`).

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| A1 | YAML frontmatter present with `name` and `description` | Required | CRITICAL |
| A2 | `model` equals `inherit` | Cursor requirement | CRITICAL |
| A3 | `readonly` equals `true` | Cursor requirement | CRITICAL |
| A4 | NO `tools:` field present | Cursor constraint | CRITICAL |
| A5 | NO `maxTurns:` field present | Cursor constraint | CRITICAL |
| A6 | NO `paths:` field present | Cursor constraint | CRITICAL |
| A7 | `model` value is exactly `inherit` (no `sonnet`, `opus`, `haiku`, or `claude-*` literals) | Cursor constraint | CRITICAL |
| A8 | No agent-spawning instructions in body | Prohibited | MAJOR |

---

## Reference File Checks

Applies to all reference files in `plugins/cursor-customizer/skills/*/references/`.

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| R1 | File length ≤ 200 lines | Hard limit | CRITICAL |
| R2 | `## Contents` TOC present if file > 100 lines | Required | MINOR |
| R3 | Source attribution present (`Source:` or `Sources:`) | Required | MINOR |
| R4 | Content framed as instructions ("do this", "check for"), not documentation prose | Required | MAJOR |
| R5 | No nested reference imports (references must not import other references) | Prohibited | MAJOR |

---

## Template File Checks

Applies to all templates in `plugins/cursor-customizer/skills/*/assets/templates/`.

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| T1 | Template exists for the skill's artifact type | Required | CRITICAL |
| T2 | HTML comment metadata block present (`<!-- TEMPLATE: ... -->`) | Required | MAJOR |
| T3 | Placeholders use bracket convention: `[PLACEHOLDER_NAME]` | Required | MINOR |
| T4 | `.mdc` rule templates use ONLY Cursor-native frontmatter keys (`description`, `alwaysApply`, `globs`) | Cursor constraint | CRITICAL |
| T5 | `.mdc` rule templates do NOT contain `paths:` (Claude-specific) | Prohibited | CRITICAL |
| T6 | `subagent-definition.md` template uses ONLY the four Cursor-native subagent frontmatter keys (`name`, `description`, `model: inherit`, `readonly: true`) | Cursor constraint | CRITICAL |
| T7 | `subagent-definition.md` template does NOT contain `tools:`, `maxTurns:`, `paths:`, or any literal model alias | Cursor constraint | CRITICAL |

---

## Intra-Plugin Parity Checks

Shared files must be byte-identical across their declared copy families. The cursor-customizer
plugin has 19 parity groups: 1 group of 8 copies, 1 group of 2 copies for `behavioral-guidelines.md`,
11 reference-file create/improve pairs, and 6 template create/improve pairs.

| # | Shared File Group | Copies | Severity |
|---|-------------------|--------|----------|
| X1 | `prompt-engineering-strategies.md` | All 8 skills | MAJOR |
| X2 | `behavioral-guidelines.md` | create-skill ↔ improve-skill | MAJOR |
| X3 | `skill-authoring-guide.md` | create-skill ↔ improve-skill | MAJOR |
| X4 | `skill-format-reference.md` | create-skill ↔ improve-skill | MAJOR |
| X5 | `skill-validation-criteria.md` | create-skill ↔ improve-skill | MAJOR |
| X6 | `hook-authoring-guide.md` | create-hook ↔ improve-hook | MAJOR |
| X7 | `hook-events-reference.md` | create-hook ↔ improve-hook | MAJOR |
| X8 | `hook-validation-criteria.md` | create-hook ↔ improve-hook | MAJOR |
| X9 | `rule-authoring-guide.md` | create-rule ↔ improve-rule | MAJOR |
| X10 | `rule-validation-criteria.md` | create-rule ↔ improve-rule | MAJOR |
| X11 | `subagent-authoring-guide.md` | create-subagent ↔ improve-subagent | MAJOR |
| X12 | `subagent-config-reference.md` | create-subagent ↔ improve-subagent | MAJOR |
| X13 | `subagent-validation-criteria.md` | create-subagent ↔ improve-subagent | MAJOR |
| X14 | Template `cursor-rule-always.mdc` | create-rule ↔ improve-rule | MAJOR |
| X15 | Template `cursor-rule-globs.mdc` | create-rule ↔ improve-rule | MAJOR |
| X16 | Template `cursor-rule-description.mdc` | create-rule ↔ improve-rule | MAJOR |
| X17 | Template `hook-config.md` | create-hook ↔ improve-hook | MAJOR |
| X18 | Template `skill-md.md` | create-skill ↔ improve-skill | MAJOR |
| X19 | Template `subagent-definition.md` | create-subagent ↔ improve-subagent | MAJOR |

---

## Docs Drift Checks

Delegated to `plugins/cursor-customizer/agents/docs-drift-checker.md` using
`plugins/cursor-customizer/docs-drift-manifest.md` as input.

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| D1 | All source documents cited in the manifest still exist at declared paths | Required | CRITICAL |
| D2 | Cited section attributions or line ranges still contain relevant content | Required | MAJOR |
| D3 | Reference file claims still align with current source-document content | Required | MAJOR |
| D4 | Verbatim-copy entries are still byte-identical to their declared upstream source | Required | MAJOR |

---

## Red-Green Scenario Checks

4 scenario families × 4 artifact types each = 16 evaluation cells.

| # | Scenario | Threshold | Severity |
|---|----------|-----------|----------|
| G1 | Create simple: all 4 artifact types produce valid Cursor-native output | GREEN required | MAJOR |
| G2 | Create complex: all 4 artifact types handle monorepo context | GREEN required | MAJOR |
| G3 | Improve bloated: all planted violations detected per artifact type | GREEN required | MAJOR |
| G4 | Improve reasonable: surgical changes only; no over-correction | GREEN required | MAJOR |

---

## Plugin Manifest Checks

Applies to `plugins/cursor-customizer/.cursor-plugin/plugin.json`.

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| M1 | `name` field equals `cursor-customizer` | Required | CRITICAL |
| M2 | Valid JSON | Structural validity | CRITICAL |
| M3 | `description` non-empty | Required | MAJOR |

---

## Drift Manifest Completeness Checks

Applies to `plugins/cursor-customizer/docs-drift-manifest.md`.

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| DM1 | Every reference file under `plugins/cursor-customizer/skills/*/references/` has at least one manifest entry | Required | MAJOR |
| DM2 | Every reference path mentioned in the manifest exists on disk | Required | MAJOR |
| DM3 | Every entry declares at least one source document (Cursor source under `docs/cursor/`, Industry Research, or a verbatim-copy upstream) | Required | MAJOR |

---

## Product-Strict Textual Compliance

Per ADR-0002 the cursor-customizer plugin contains zero textual references to Claude Code
constructs in slice-authored content. The banned-token regex is:

```
(\$\{CLAUDE_SKILL_DIR\}|CLAUDE\.md|\.claude/|maxTurns:|tools:|paths:|docs\.anthropic\.com/en/docs/claude-code)
```

Run it across `plugins/cursor-customizer/agents/` and `plugins/cursor-customizer/skills/`. After
applying the documented `## Known-Accepted Exceptions` (below), the remaining hit count must be
zero.

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| S1 | Banned-token grep across slice-authored cursor-customizer content reports zero hits after exceptions applied | Required | MAJOR |

---

## Known-Accepted Exceptions

These specific deviations are documented and pre-approved. The artifact-inspector and any
Phase-1 grep run MUST apply these exceptions before classifying findings — exceptions listed
here are NOT violations. Do not flag them on subsequent quality-gate runs.

### E1: Bare "Claude" mentions in `prompt-engineering-strategies.md` (verbatim copies)

- **Files**: every copy of `plugins/cursor-customizer/skills/*/references/prompt-engineering-strategies.md` (8 copies — one per skill).
- **Lines**: 20, 105, 108, 110 (bare "Claude" word, not `CLAUDE.md`, not `.claude/`).
- **Reason**: the file is a verbatim copy of `plugins/agent-customizer/skills/create-skill/references/prompt-engineering-strategies.md` per the manifest's "Verbatim copy" mapping. The verbatim-copy directive takes precedence over the otherwise-strict "use 'Claude' only inside Cost-and-Model-Guidance contexts" rule, because diverging the copy would break the Group 1 parity check (X1) that requires byte-identity across all 8 copies.
- **Action**: do NOT count these four lines as banned-token hits. The banned-token regex above does NOT match the bare word "Claude" — it matches `CLAUDE.md`, `.claude/`, `${CLAUDE_SKILL_DIR}`, `tools:`, `maxTurns:`, `paths:`, and the public Anthropic docs URL. The four lines therefore do not appear as hits under the regex. This exception is recorded explicitly so future maintainers do not narrow the regex to also match bare "Claude" without first updating either the upstream `agent-customizer` canonical copy or this exception.

### Maintenance rule for this section

When adding a new known-accepted exception:

1. Justify it with a reference to the relevant ADR or convention rule.
2. List the exact files and lines.
3. State precisely whether the regex matches or does not match those lines today.
4. State the action the inspector must take (skip / re-classify / count differently).

When removing an exception (because the upstream change has been adopted), update both this
section and the corresponding artifact in the same commit so the inspector and the criteria stay
in sync.

---

## Severity Classification

| Severity | Meaning | Must Fix Before Release? |
|----------|---------|--------------------------|
| CRITICAL | Hard limit violated; feature broken or convention fundamentally wrong | Yes — blocking |
| MAJOR | Structural convention violated; output quality or parity at risk | Yes — before next release |
| MINOR | Quality or documentation convention missed; no runtime impact | Recommended — track in backlog |

---

## Expected Results Checklist

The Phase-5 synthesis cross-references this checklist against the Phase-1 through Phase-4
outputs to confirm full coverage. Every category heading below MUST appear in the dashboard.

- Plugin SKILL.md (8 files)
- Cursor Subagent Files (6 files)
- Reference Files
- Template Files (8 dirs)
- Intra-Plugin Parity (19 groups)
- Docs Drift
- Red-Green Scenario Coverage (16 cells)
- Plugin Manifest
- Drift Manifest Completeness
- Product-Strict Textual Compliance

---

## Report Template

Use this structure for `.specs/reports/cursor-customizer-quality-gate-[YYYY-MM-DD]-findings.md`:

```markdown
# Quality Gate Findings — cursor-customizer — [YYYY-MM-DD]

**Status:** FAIL — [N] findings ([N] CRITICAL, [N] MAJOR, [N] MINOR)

## Quality Gate Dashboard

| Category | Checks | Passed | Failed | Status |
|----------|--------|--------|--------|--------|
| Static Artifact Compliance | [N] | [N] | [N] | PASS/FAIL |
| Intra-Plugin Parity | 19 | [N] | [N] | PASS/FAIL |
| Docs Drift | [N] | [N] | [N] | PASS/FAIL |
| Red-Green Scenario Coverage | 16 | [N] | [N] | PASS/FAIL |
| Plugin Manifest | 3 | [N] | [N] | PASS/FAIL |
| Drift Manifest Completeness | 3 | [N] | [N] | PASS/FAIL |
| Product-Strict Textual Compliance | 1 | [N] | [N] | PASS/FAIL |
| **OVERALL** | [N] | [N] | [N] | **FAIL** |

## Findings

### F001 — [Short Title] [CRITICAL/MAJOR/MINOR]

- **Category**: Static | Parity | Drift | Red-Green | Manifest | Drift Manifest | Product-Strict
- **Artifact**: `[file path]`
- **Rule Violated**: "[exact rule text]"
- **Rule Source**: `[rule file]` — [section]
- **Current State**: [what the artifact contains — quote evidence]
- **Expected State**: [what it should contain per documentation]
- **Impact**: [what degrades or breaks without fixing]
- **Proposed Fix**: [specific action — what to add/change/remove]

[Repeat for each finding...]

## Improvement Areas

### Area 1: [Name]
**Findings covered:** F001, F002
**Summary:** [Why these findings belong together]
**Estimated scope:** [number of files, nature of change]

[Repeat per area...]

## PRD Brief

> Input for `/prp-core:prp-prd`. Fill all sections.

**Problem Statement:** [Summary of what's wrong]
**Evidence:** [Key evidence — file paths, rule citations, measurements]
**Proposed Solution:** [Changes that would resolve all findings]
**Success Metrics:** [Specific checks that would now pass]
**Out of Scope:** [What this remediation does NOT address]
```
