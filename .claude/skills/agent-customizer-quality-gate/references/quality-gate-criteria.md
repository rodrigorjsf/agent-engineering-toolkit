# Quality Gate Criteria — agent-customizer Plugin

Complete checklist of expected results and the findings report template for the
`agent-customizer-quality-gate` meta-skill.
Source: `.claude/rules/plugin-skills.md`, `.claude/rules/reference-files.md`,
`.claude/rules/agent-files.md`, `plugins/agent-customizer/CLAUDE.md`, `DESIGN-GUIDELINES.md`

## Contents

1. [Plugin SKILL.md Checks](#plugin-skillmd-checks)
2. [Agent File Checks](#agent-file-checks)
3. [Reference File Checks](#reference-file-checks)
4. [Template File Checks](#template-file-checks)
5. [Intra-Plugin Parity Checks](#intra-plugin-parity-checks)
6. [Docs Drift Checks](#docs-drift-checks)
7. [Red-Green Scenario Checks](#red-green-scenario-checks)
8. [Plugin Manifest Checks](#plugin-manifest-checks)
9. [Canonical Semantic-Tag Convention Checks](#canonical-semantic-tag-convention-checks)
10. [Severity Classification](#severity-classification)
11. [Report Template](#report-template)

---

## Plugin SKILL.md Checks

Applies to all 8 skills: `create-skill`, `improve-skill`, `create-hook`, `improve-hook`,
`create-rule`, `improve-rule`, `create-subagent`, `improve-subagent`

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| P1 | YAML frontmatter: `name` and `description` present | Required | CRITICAL |
| P2 | `name` ≤ 64 chars, pattern `[a-z0-9-]+` | Exact | MAJOR |
| P3 | `description` ≤ 1024 chars, non-empty, no XML tags | Exact | MAJOR |
| P4 | Body < 500 lines | Hard limit | CRITICAL |
| P5 | Create skills delegate to `artifact-analyzer` | Required | CRITICAL |
| P6 | Improve skills delegate to type-specific evaluator (`skill-evaluator`, `hook-evaluator`, `rule-evaluator`, `subagent-evaluator`) | Required | CRITICAL |
| P7 | Improve skills also reference `artifact-analyzer` for broader context when needed | Required | CRITICAL |
| P8 | No inline bash analysis blocks (plugin skills must not run bash for analysis) | Prohibited | MAJOR |
| P9 | Self-validation phase references `*-validation-criteria.md` | Required | MAJOR |
| P10 | `references/` directory exists alongside SKILL.md | Required | CRITICAL |
| P11 | `assets/templates/` directory exists alongside SKILL.md | Required | CRITICAL |
| P12 | References one level deep — no nested `references/references/` paths | Required | MAJOR |

---

## Agent File Checks

Applies to all 6 agents: `artifact-analyzer`, `docs-drift-checker`, `skill-evaluator`,
`hook-evaluator`, `rule-evaluator`, `subagent-evaluator`

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| A1 | YAML frontmatter with all required fields (`name`, `description`, `tools`, `model`, `maxTurns`) | Required | CRITICAL |
| A2 | `tools` contains only read-only set: `Read, Grep, Glob, Bash` | Required | CRITICAL |
| A3 | `model` equals `sonnet` | Required | CRITICAL |
| A4 | `maxTurns` value 15–20 | Required | MAJOR |
| A5 | No agent spawning instructions in body | Prohibited | MAJOR |
| A6 | No `hooks` or `mcpServers` references | Prohibited | CRITICAL |

---

## Reference File Checks

Applies to all reference files in `plugins/agent-customizer/skills/*/references/`

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| R1 | File length ≤ 200 lines | Hard limit | CRITICAL |
| R2 | `## Contents` TOC present if file > 100 lines | Required | MINOR |
| R3 | Source attribution present (`Source:` or `Sources:`) | Required | MINOR |
| R4 | Content framed as instructions ("do this", "check for"), not documentation | Required | MAJOR |
| R5 | No nested reference imports (references must not import other references) | Prohibited | MAJOR |

---

## Template File Checks

Applies to all templates in `plugins/agent-customizer/skills/*/assets/templates/`

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| T1 | Template exists for the skill's artifact type | Required | CRITICAL |
| T2 | HTML comment metadata block present (`<!-- TEMPLATE: ... -->`) | Required | MAJOR |
| T3 | Placeholders use bracket convention: `[PLACEHOLDER_NAME]` | Required | MINOR |

---

## Intra-Plugin Parity Checks

Shared files must be byte-identical across create/improve pairs.

| # | Shared File Group | Copies | Severity |
|---|------------------|--------|----------|
| X1 | `prompt-engineering-strategies.md` | All 8 skills | MAJOR |
| X2 | `skill-validation-criteria.md` | create-skill ↔ improve-skill | MAJOR |
| X3 | `hook-validation-criteria.md` | create-hook ↔ improve-hook | MAJOR |
| X4 | `rule-validation-criteria.md` | create-rule ↔ improve-rule | MAJOR |
| X5 | `subagent-validation-criteria.md` | create-subagent ↔ improve-subagent | MAJOR |
| X6 | `skill-authoring-guide.md` | create-skill ↔ improve-skill | MAJOR |
| X7 | `hook-authoring-guide.md` | create-hook ↔ improve-hook | MAJOR |
| X8 | `rule-authoring-guide.md` | create-rule ↔ improve-rule | MAJOR |
| X9 | `subagent-authoring-guide.md` | create-subagent ↔ improve-subagent | MAJOR |
| X10 | `skill-format-reference.md` | create-skill ↔ improve-skill | MAJOR |
| X11 | `hook-events-reference.md` | create-hook ↔ improve-hook | MAJOR |
| X12 | `subagent-config-reference.md` | create-subagent ↔ improve-subagent | MAJOR |
| X13 | Template `skill-md.md` | create-skill ↔ improve-skill | MAJOR |
| X14 | Template `subagent-definition.md` | create-subagent ↔ improve-subagent | MAJOR |

---

## Docs Drift Checks

Delegated to `plugins/agent-customizer/agents/docs-drift-checker.md` using
`plugins/agent-customizer/docs-drift-manifest.md` as input.

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| D1 | All source docs cited in manifest still exist at declared paths | Required | CRITICAL |
| D2 | Cited line ranges still contain relevant content (no shifts) | Required | MAJOR |
| D3 | Reference file claims still align with current source doc content | Required | MAJOR |

---

## Red-Green Scenario Checks

4 scenario families, 4 artifact types each = 16 evaluation cells.

| # | Scenario | Threshold | Severity |
|---|---------|-----------|----------|
| G1 | S5 create-simple: all 4 artifact types produce valid output | GREEN required | MAJOR |
| G2 | S6 create-complex: all 4 artifact types handle monorepo context | GREEN required | MAJOR |
| G3 | S7 improve-bloated: all planted violations detected per artifact type | GREEN required | MAJOR |
| G4 | S8 improve-reasonable: surgical changes only; ≤ 2 MEDIUM per type | GREEN required | MAJOR |

---

## Plugin Manifest Checks

Applies to `plugins/agent-customizer/.claude-plugin/plugin.json`

| # | Check | Threshold | Severity |
|---|-------|-----------|----------|
| M1 | `name` field matches directory name `agent-customizer` | Required | CRITICAL |
| M2 | `repository` URL resolves (if present) | Required | MAJOR |
| M3 | `description` non-empty | Required | MAJOR |

---

## Canonical Semantic-Tag Convention Checks

Applies to all SKILL.md bodies under `plugins/agent-customizer/skills/**/SKILL.md` and all
subagent bodies under `plugins/agent-customizer/agents/**/*.md`.
Source: `wiki/knowledge/skill-body-convention.md`, `docs/adr/0007-skill-body-semantic-tag-convention.md`

### Skill targets (`plugins/agent-customizer/skills/**/SKILL.md`)

Mandatory tags: `<TRIGGER>`, `<BEHAVIOUR>`, `<HARD_RULES>` (or legacy `<RULES>` alias), `<PROCESS>`
containing at least one `<PHASE id="N" name="X">`.

| # | Check | Tier | Severity |
|---|-------|------|----------|
| V1 | `<TRIGGER>` present in body | Hard-fail if absent | CRITICAL |
| V2 | `<BEHAVIOUR>` present in body | Hard-fail if absent | CRITICAL |
| V3 | `<HARD_RULES>` or `<RULES>` alias present in body | Hard-fail if absent | CRITICAL |
| V4 | `<PROCESS>` present in body | Hard-fail if absent | CRITICAL |
| V5 | `<PROCESS>` contains at least one `<PHASE>` | Hard-fail if zero `<PHASE>` | CRITICAL |
| V6 | Every `<PHASE>` carries a mandatory `id=` attribute | Hard-fail if `id=` absent | CRITICAL |
| V7 | All opened tags have a matching closing tag (no unbalanced open/close) | Hard-fail if unbalanced | CRITICAL |
| V8 | All attribute values are properly quoted (no bare `=`, no unterminated quotes) | Hard-fail if malformed | CRITICAL |
| V9 | All attribute names belong to the closed set: `avoid`, `always`, `when`, `name`, `id`, `priority` | Warn if non-canonical | MAJOR |
| V10 | `<RULES>` occurrences reported as informational `<HARD_RULES>` alias candidates | Informational (not a fail or warn) | — |

### Subagent targets (`plugins/agent-customizer/agents/**/*.md`)

Mandatory tags: `<BEHAVIOUR>`, `<HARD_RULES>` (or `<RULES>` alias), `<PROCESS>` with at least one
`<PHASE id="N" name="X">`. `<TRIGGER>` is OPTIONAL for subagents — its absence is SILENT (never a
finding).

| # | Check | Tier | Severity |
|---|-------|------|----------|
| VA1 | `<BEHAVIOUR>` present in body | Hard-fail if absent | CRITICAL |
| VA2 | `<HARD_RULES>` or `<RULES>` alias present in body | Hard-fail if absent | CRITICAL |
| VA3 | `<PROCESS>` present in body | Hard-fail if absent | CRITICAL |
| VA4 | `<PROCESS>` contains at least one `<PHASE>` | Hard-fail if zero `<PHASE>` | CRITICAL |
| VA5 | Every `<PHASE>` carries a mandatory `id=` attribute | Hard-fail if `id=` absent | CRITICAL |
| VA6 | All opened tags have a matching closing tag | Hard-fail if unbalanced | CRITICAL |
| VA7 | All attribute values properly quoted | Hard-fail if malformed | CRITICAL |
| VA8 | All attribute names in closed set | Warn if non-canonical | MAJOR |
| VA9 | `<TRIGGER>` absence | Silent — no finding | — |
| VA10 | `<RULES>` occurrences reported as informational `<HARD_RULES>` alias candidates | Informational (not a fail or warn) | — |

### Fixture corpus

The golden fixture corpus for these checks lives under
`.claude/skills/agent-customizer-quality-gate/assets/fixtures/`.

- `skill/` — 10 fixtures for skill-body validation (see `skill/MANIFEST.md`)
- `subagent/` — 10 fixtures for subagent-body validation (see `subagent/MANIFEST.md`)

Running the checks above against the corpus MUST produce the verdict documented in each MANIFEST.
Any mismatch means the strictness-tier text above is ambiguous and must be tightened.

---

## Severity Classification

| Severity | Meaning | Must Fix Before Release? |
|----------|---------|--------------------------|
| CRITICAL | Hard limit violated; feature broken or convention fundamentally wrong | Yes — blocking |
| MAJOR | Structural convention violated; output quality or parity at risk | Yes — before next release |
| MINOR | Quality or documentation convention missed; no runtime impact | Recommended — track in backlog |

---

## Report Template

Use this structure for `.specs/reports/agent-customizer-quality-gate-[YYYY-MM-DD]-findings.md`:

```markdown
# Quality Gate Findings — agent-customizer — [YYYY-MM-DD]

**Status:** FAIL — [N] findings ([N] CRITICAL, [N] MAJOR, [N] MINOR)

## Quality Gate Dashboard

| Category | Checks | Passed | Failed | Status |
|----------|--------|--------|--------|--------|
| Static Artifact Compliance | [N] | [N] | [N] | PASS/FAIL |
| Intra-Plugin Parity | 14 | [N] | [N] | PASS/FAIL |
| Docs Drift | [N] | [N] | [N] | PASS/FAIL |
| Red-Green Scenario Coverage | 16 | [N] | [N] | PASS/FAIL |
| Plugin Manifest | 3 | [N] | [N] | PASS/FAIL |
| Canonical Semantic-Tag Convention | [N] | [N] | [N] | PASS/FAIL |
| **OVERALL** | [N] | [N] | [N] | **FAIL** |

## Findings

### F001 — [Short Title] [CRITICAL/MAJOR/MINOR]

- **Category**: Static | Parity | Drift | Red-Green | Manifest
- **Artifact**: `[file path]`
- **Rule Violated**: "[exact rule text]"
- **Rule Source**: `[rule file]` — [section]
- **Current State**: [what the artifact contains — quote evidence]
- **Expected State**: [what it should contain per documentation]
- **Impact**: [what degrades or breaks without fixing]
- **Proposed Fix**: [specific action — what to add/change/remove]

## PRD Brief

> Input for `/prp-core:prp-prd`. Fill all sections.

**Problem Statement:** [Summary of what's wrong]
**Evidence:** [Key evidence — file paths, rule citations, measurements]
**Proposed Solution:** [Changes that would resolve all findings]
**Success Metrics:** [Specific checks that would now pass]
**Out of Scope:** [What this remediation does NOT address]
```
