# Artifact Audit Manifest

> **Status**: Active
> **Source**: [PRD #56 — Repository Compliance Program](https://github.com/rodrigorjsf/agent-engineering-toolkit/issues/56), Phase 2
> **Scope**: Complete file-level inventory of all in-scope repository artifacts for compliance audit

## Contents

- [1. Purpose and Usage](#1-purpose-and-usage)
- [2. Scan Contract](#2-scan-contract)
- [3. Scope Summary](#3-scope-summary)
- [4. Artifact Registry Definition](#4-artifact-registry-definition)
- [5. Artifact Inventory — agents-initializer](#5-artifact-inventory--agents-initializer)
- [6. Artifact Inventory — agent-customizer](#6-artifact-inventory--agent-customizer)
- [7. Artifact Inventory — cursor-initializer](#7-artifact-inventory--cursor-initializer)
- [8. Artifact Inventory — cursor-customizer](#8-artifact-inventory--cursor-customizer)
- [9. Artifact Inventory — standalone](#9-artifact-inventory--standalone)
- [10. Artifact Inventory — repository-global](#10-artifact-inventory--repository-global)
- [11. Shared Copy Group Registry](#11-shared-copy-group-registry)
- [12. Validator Coverage Matrix](#12-validator-coverage-matrix)
- [13. Quality Gate Coverage Map](#13-quality-gate-coverage-map)
- [14. Audit Phase Assignments](#14-audit-phase-assignments)

---

## 1. Purpose and Usage

This manifest enumerates every in-scope repository artifact individually, linking each to its normative source bundle, assigned validators, shared copy group (if any), and PRD audit phase. It is the authoritative inventory used by Phases 3–9 auditors.

**Relationship to `normative-source-matrix.md`**: The normative source matrix (Phase 1) defines which documentation sources are authoritative per (scope × artifact type). This manifest (Phase 2) applies that authority model to enumerate every individual artifact and assign concrete validators. The Phase 1 bundle IDs (`claude-plugin-bundle`, `agent-customizer-bundle`, etc.) are used in the Bundle column of every inventory table.

**How to use this document:**

- **Phase 4–6 auditors**: open the inventory section for your scope; work through each row using the Bundle and Validators columns to locate the applicable sources and enforcement rules.
- **Phase 7 (parity/drift)**: use the Shared Copy Group Registry (Section 11) to identify which files must be byte-identical and which quality gate enforces parity.
- **Phase 9 (regression prevention)**: use the Quality Gate Coverage Map (Section 13) to identify scopes lacking automated enforcement.

---

## 2. Scan Contract

Defines the reproducible filesystem scan rules for verifying manifest completeness. Run the inclusion patterns against the included roots, excluding the listed paths.

### Included Roots

| Root | Scope |
|------|-------|
| `plugins/agents-initializer/` | agents-initializer |
| `plugins/agent-customizer/` | agent-customizer |
| `plugins/cursor-initializer/` | cursor-initializer |
| `plugins/cursor-customizer/` | cursor-customizer |
| `skills/` | standalone |
| `.claude/rules/` | repository-global |
| `.claude/hooks/` | repository-global |
| `.claude/skills/` | repository-global |
| `.claude-plugin/` | repository-global (root marketplace manifest) |
| `.cursor-plugin/` | repository-global (root marketplace manifest) |
| `.github/instructions/` | repository-global |
| `docs/` | repository-global |
| `CLAUDE.md`, `DESIGN-GUIDELINES.md`, `README.md` | repository-global (root files) |

### Included Patterns

`*.md`, `*.mdc`, `*.json`, `*.sh`, `*.yaml`

### Excluded Paths and Rationale

| Path | Rationale |
|------|-----------|
| `docs/plans/` | Historical design docs — see normative-source-matrix.md §Excluded Sources |
| `.claude/PRPs/plans/completed/` | Completed implementation plans — excluded source |
| `.claude/PRPs/prds/completed/` | Completed PRDs — excluded source |
| `.claude/PRPs/reports/` | Findings reports — excluded source |
| `next-steps.md` | Personal session tracking — excluded source |
| `.github/skills/` | Internal PRP workflow infrastructure — not auditable artifacts |
| `.github/hooks/` | GitHub Actions (not Claude hooks) |
| `node_modules/`, `.git/`, `.specs/` | Build / infra / excluded source |

---

## 3. Scope Summary

| Scope | Skills | Agents | Refs | Templates | Manifests | Config/README | Docs/Other | Total |
|-------|--------|--------|------|-----------|-----------|---------------|------------|-------|
| agents-initializer | 4 | 3 | 22 | 19 | 1 | 2 | — | 51 |
| agent-customizer | 8 | 6 | 34 | 8 | 1 | 3 | — | 60 |
| cursor-initializer | 2 | 3 | 12 | 10 | 1 | 3 | — | 31 |
| cursor-customizer | 8 | 6 | 36 | 12 | 1 | 3 | — | 66 |
| standalone | 12 | — | 76 | 25 | — | 1 | — | 114 |
| repository-global | 4 | 6 | 13 | — | 2 | 15 | 59 | 99 |
| **TOTAL** | **38** | **24** | **193** | **74** | **6** | **27** | **59** | **421** |

> repository-global "Refs" = 4 quality-gate + dev-skill reference files; "Config/README" = rules (9) + instructions (9) + hooks (2) + root files (3) = 23, plus 2 marketplace manifests = 25... see Section 10 for per-artifact classification.

---

## 4. Artifact Registry Definition

Type taxonomy and validator code legend used in all inventory tables.

### Artifact Types

| Type | Glob | Scope Rule | Example |
|------|------|------------|---------|
| `skill` | `*/SKILL.md` | Scope = parent plugin or `standalone` | `plugins/agents-initializer/skills/init-claude/SKILL.md` |
| `agent` | `agents/*.md` | Scope = parent plugin | `plugins/agents-initializer/agents/codebase-analyzer.md` |
| `reference` | `references/*.md` | Scope = parent skill's scope | `plugins/agents-initializer/skills/improve-agents/references/context-optimization.md` |
| `template` | `assets/templates/*.{md,mdc}` | Scope = parent skill's scope | `plugins/agents-initializer/skills/init-claude/assets/templates/claude-rule.md` |
| `plugin-manifest` | `*/.claude-plugin/plugin.json`, `*/.cursor-plugin/plugin.json` | Scope = parent plugin | `plugins/agents-initializer/.claude-plugin/plugin.json` |
| `marketplace-manifest` | `.claude-plugin/marketplace.json`, `.cursor-plugin/marketplace.json` | repository-global | `.claude-plugin/marketplace.json` |
| `config-file` | `*/CLAUDE.md`, `*/AGENTS.md` | Scope = parent directory | `plugins/cursor-initializer/AGENTS.md` |
| `readme` | `*/README.md`, `skills/README.md` | Scope = parent directory | `plugins/agents-initializer/README.md` |
| `rule` | `.claude/rules/*.md` | repository-global | `.claude/rules/plugin-skills.md` |
| `instruction` | `.github/instructions/*.md` | repository-global | `.github/instructions/skill-files.instructions.md` |
| `docs` | `docs/**/*.md`, `DESIGN-GUIDELINES.md` | repository-global | `docs/general-llm/a-guide-to-agents.md` |
| `hook` | `.claude/hooks/*.sh` | repository-global | `.claude/hooks/check-docs-sync.sh` |
| `quality-gate-skill` | `.claude/skills/*/SKILL.md` (quality gates) | repository-global | `.claude/skills/quality-gate/SKILL.md` |
| `quality-gate-agent` | `.claude/skills/*/agents/*.md` | repository-global | `.claude/skills/quality-gate/agents/parity-checker.md` |
| `quality-gate-reference` | `.claude/skills/*/references/*.md` | repository-global | `.claude/skills/quality-gate/references/quality-gate-criteria.md` |
| `dev-skill` | `.claude/skills/receiving-code-review/SKILL.md`, `.claude/skills/update-review-instructions/SKILL.md` | repository-global | `.claude/skills/receiving-code-review/SKILL.md` |
| `dev-skill-reference` | `.claude/skills/update-review-instructions/references/*.md` | repository-global | `.claude/skills/update-review-instructions/references/scope-registry.md` |
| `drift-manifest` | `docs-drift-manifest.md` | agent-customizer, cursor-customizer | `plugins/agent-customizer/docs-drift-manifest.md` |

### Validator Code Legend

| Code | Expands to |
|------|-----------|
| `r:ps` | `.claude/rules/plugin-skills.md` |
| `r:ss` | `.claude/rules/standalone-skills.md` |
| `r:af` | `.claude/rules/agent-files.md` |
| `r:ca` | `.claude/rules/cursor-agent-files.md` |
| `r:rf` | `.claude/rules/reference-files.md` |
| `r:rm` | `.claude/rules/readme-files.md` |
| `r:cp` | `.claude/rules/cursor-plugin-skills.md` |
| `i:sf` | `.github/instructions/skill-files.instructions.md` |
| `i:ad` | `.github/instructions/agent-definitions.instructions.md` |
| `i:rf` | `.github/instructions/reference-files.instructions.md` |
| `i:tf` | `.github/instructions/template-files.instructions.md` |
| `i:pc` | `.github/instructions/plugin-config.instructions.md` |
| `i:rm` | `.github/instructions/readme-files.instructions.md` |
| `i:dc` | `.github/instructions/documentation.instructions.md` |
| `i:rl` | `.github/instructions/rules.instructions.md` |
| `q:P` | quality-gate Phase 1, SKILL checks P1–P12 |
| `q:S` | quality-gate Phase 1, Standalone checks S1–S11 |
| `q:A` | quality-gate Phase 1, Agent checks A1–A6 |
| `q:R` | quality-gate Phase 1, Ref checks R1–R5 |
| `q:T` | quality-gate Phase 1, Template checks T1–T2 |
| `q:X` | quality-gate Phase 2, Parity checks X1–X2 |
| `ac:P` | agent-customizer-qg Phase 1, checks P1–P12 |
| `ac:A` | agent-customizer-qg Phase 2, checks A1–A6 |
| `ac:R` | agent-customizer-qg Phase 3, checks R1–R5 |
| `ac:X` | agent-customizer-qg Phase 4, checks X1–X14 |
| `ac:D` | agent-customizer-qg Phase 3, Drift D1–D3 |

---

## 5. Artifact Inventory — agents-initializer

> **Base**: `plugins/agents-initializer/` | **Bundle**: `claude-plugin-bundle` | **Primary Phase**: 4

| Path (relative to base) | Type | Validators | Copy Group | Ph.7? |
|-------------------------|------|------------|------------|-------|
| `.claude-plugin/plugin.json` | plugin-manifest | `i:pc` | — | no |
| `CLAUDE.md` | config-file | `i:pc` | — | no |
| `README.md` | readme | `r:rm`, `i:rm` | — | no |
| `agents/codebase-analyzer.md` | agent | `r:af`, `i:ad`, `q:A` | — | no |
| `agents/file-evaluator.md` | agent | `r:af`, `i:ad`, `q:A` | — | no |
| `agents/scope-detector.md` | agent | `r:af`, `i:ad`, `q:A` | — | no |
| `skills/improve-agents/SKILL.md` | skill | `r:ps`, `i:sf`, `q:P` | — | no |
| `skills/improve-agents/references/automation-migration-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-05 | yes |
| `skills/improve-agents/references/context-optimization.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-01 | yes |
| `skills/improve-agents/references/evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-06 | yes |
| `skills/improve-agents/references/progressive-disclosure-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-04 | yes |
| `skills/improve-agents/references/validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-02 | yes |
| `skills/improve-agents/references/what-not-to-include.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-03 | yes |
| `skills/improve-agents/assets/templates/claude-rule.md` | template | `i:tf`, `q:T`, `q:X` | TCG-06 | yes |
| `skills/improve-agents/assets/templates/domain-doc.md` | template | `i:tf`, `q:T`, `q:X` | TCG-01 | yes |
| `skills/improve-agents/assets/templates/hook-config.md` | template | `i:tf`, `q:T`, `q:X` | TCG-07 | yes |
| `skills/improve-agents/assets/templates/root-agents-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-02 | yes |
| `skills/improve-agents/assets/templates/scoped-agents-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-03 | yes |
| `skills/improve-agents/assets/templates/skill.md` | template | `i:tf`, `q:T`, `q:X` | TCG-08 | yes |
| `skills/improve-claude/SKILL.md` | skill | `r:ps`, `i:sf`, `q:P` | — | no |
| `skills/improve-claude/references/automation-migration-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-05 | yes |
| `skills/improve-claude/references/claude-rules-system.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-07 | yes |
| `skills/improve-claude/references/context-optimization.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-01 | yes |
| `skills/improve-claude/references/evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-06 | yes |
| `skills/improve-claude/references/progressive-disclosure-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-04 | yes |
| `skills/improve-claude/references/validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-02 | yes |
| `skills/improve-claude/references/what-not-to-include.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-03 | yes |
| `skills/improve-claude/assets/templates/claude-rule.md` | template | `i:tf`, `q:T`, `q:X` | TCG-06 | yes |
| `skills/improve-claude/assets/templates/domain-doc.md` | template | `i:tf`, `q:T`, `q:X` | TCG-01 | yes |
| `skills/improve-claude/assets/templates/hook-config.md` | template | `i:tf`, `q:T`, `q:X` | TCG-07 | yes |
| `skills/improve-claude/assets/templates/root-claude-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-04 | yes |
| `skills/improve-claude/assets/templates/scoped-claude-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-05 | yes |
| `skills/improve-claude/assets/templates/skill.md` | template | `i:tf`, `q:T`, `q:X` | TCG-08 | yes |
| `skills/init-agents/SKILL.md` | skill | `r:ps`, `i:sf`, `q:P` | — | no |
| `skills/init-agents/references/context-optimization.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-01 | yes |
| `skills/init-agents/references/progressive-disclosure-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-04 | yes |
| `skills/init-agents/references/validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-02 | yes |
| `skills/init-agents/references/what-not-to-include.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-03 | yes |
| `skills/init-agents/assets/templates/domain-doc.md` | template | `i:tf`, `q:T`, `q:X` | TCG-01 | yes |
| `skills/init-agents/assets/templates/root-agents-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-02 | yes |
| `skills/init-agents/assets/templates/scoped-agents-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-03 | yes |
| `skills/init-claude/SKILL.md` | skill | `r:ps`, `i:sf`, `q:P` | — | no |
| `skills/init-claude/references/claude-rules-system.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-07 | yes |
| `skills/init-claude/references/context-optimization.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-01 | yes |
| `skills/init-claude/references/progressive-disclosure-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-04 | yes |
| `skills/init-claude/references/validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-02 | yes |
| `skills/init-claude/references/what-not-to-include.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-03 | yes |
| `skills/init-claude/assets/templates/claude-rule.md` | template | `i:tf`, `q:T`, `q:X` | TCG-06 | yes |
| `skills/init-claude/assets/templates/domain-doc.md` | template | `i:tf`, `q:T`, `q:X` | TCG-01 | yes |
| `skills/init-claude/assets/templates/root-claude-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-04 | yes |
| `skills/init-claude/assets/templates/scoped-claude-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-05 | yes |

---

## 6. Artifact Inventory — agent-customizer

> **Base**: `plugins/agent-customizer/` | **Bundle**: `agent-customizer-bundle` | **Primary Phase**: 4

| Path (relative to base) | Type | Validators | Copy Group | Ph.7? |
|-------------------------|------|------------|------------|-------|
| `.claude-plugin/plugin.json` | plugin-manifest | `i:pc` | — | no |
| `CLAUDE.md` | config-file | `i:pc` | — | no |
| `README.md` | readme | `r:rm`, `i:rm` | — | no |
| `docs-drift-manifest.md` | drift-manifest | `ac:D` | — | no |
| `agents/artifact-analyzer.md` | agent | `r:af`, `i:ad`, `ac:A` | — | no |
| `agents/docs-drift-checker.md` | agent | `r:af`, `i:ad`, `ac:A` | — | no |
| `agents/hook-evaluator.md` | agent | `r:af`, `i:ad`, `ac:A` | — | no |
| `agents/rule-evaluator.md` | agent | `r:af`, `i:ad`, `ac:A` | — | no |
| `agents/skill-evaluator.md` | agent | `r:af`, `i:ad`, `ac:A` | — | no |
| `agents/subagent-evaluator.md` | agent | `r:af`, `i:ad`, `ac:A` | — | no |
| `skills/create-hook/SKILL.md` | skill | `r:ps`, `i:sf`, `ac:P` | — | no |
| `skills/create-hook/references/hook-authoring-guide.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-17 | yes |
| `skills/create-hook/references/hook-events-reference.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-21 | yes |
| `skills/create-hook/references/hook-validation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-13 | yes |
| `skills/create-hook/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-11 | yes |
| `skills/create-hook/assets/templates/hook-config.md` | template | `i:tf`, `ac:X` | SCG-24, TCG-07 | yes |
| `skills/create-rule/SKILL.md` | skill | `r:ps`, `i:sf`, `ac:P` | — | no |
| `skills/create-rule/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-11 | yes |
| `skills/create-rule/references/rule-authoring-guide.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-18 | yes |
| `skills/create-rule/references/rule-validation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-14 | yes |
| `skills/create-rule/assets/templates/rule-file.md` | template | `i:tf` | — | no |
| `skills/create-skill/SKILL.md` | skill | `r:ps`, `i:sf`, `ac:P` | — | no |
| `skills/create-skill/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-11 | yes |
| `skills/create-skill/references/behavioral-guidelines.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-25 | yes |
| `skills/create-skill/references/skill-authoring-guide.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-16 | yes |
| `skills/create-skill/references/skill-format-reference.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-20 | yes |
| `skills/create-skill/references/skill-validation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-12 | yes |
| `skills/create-skill/assets/templates/skill-md.md` | template | `i:tf`, `ac:X` | SCG-23, TCG-09 | yes |
| `skills/create-subagent/SKILL.md` | skill | `r:ps`, `i:sf`, `ac:P` | — | no |
| `skills/create-subagent/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-11 | yes |
| `skills/create-subagent/references/subagent-authoring-guide.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-19 | yes |
| `skills/create-subagent/references/subagent-config-reference.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-22 | yes |
| `skills/create-subagent/references/subagent-validation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-15 | yes |
| `skills/create-subagent/assets/templates/subagent-definition.md` | template | `i:tf`, `ac:X` | SCG-24, TCG-10 | yes |
| `skills/improve-hook/SKILL.md` | skill | `r:ps`, `i:sf`, `ac:P` | — | no |
| `skills/improve-hook/references/hook-authoring-guide.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-17 | yes |
| `skills/improve-hook/references/hook-evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R` | — | no |
| `skills/improve-hook/references/hook-events-reference.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-21 | yes |
| `skills/improve-hook/references/hook-validation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-13 | yes |
| `skills/improve-hook/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-11 | yes |
| `skills/improve-hook/assets/templates/hook-config.md` | template | `i:tf`, `ac:X` | SCG-24, TCG-07 | yes |
| `skills/improve-rule/SKILL.md` | skill | `r:ps`, `i:sf`, `ac:P` | — | no |
| `skills/improve-rule/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-11 | yes |
| `skills/improve-rule/references/rule-authoring-guide.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-18 | yes |
| `skills/improve-rule/references/rule-evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R` | — | no |
| `skills/improve-rule/references/rule-validation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-14 | yes |
| `skills/improve-rule/assets/templates/rule-file.md` | template | `i:tf` | — | no |
| `skills/improve-skill/SKILL.md` | skill | `r:ps`, `i:sf`, `ac:P` | — | no |
| `skills/improve-skill/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-11 | yes |
| `skills/improve-skill/references/behavioral-guidelines.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-25 | yes |
| `skills/improve-skill/references/skill-authoring-guide.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-16 | yes |
| `skills/improve-skill/references/skill-evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R` | — | no |
| `skills/improve-skill/references/skill-format-reference.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-20 | yes |
| `skills/improve-skill/references/skill-validation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-12 | yes |
| `skills/improve-skill/assets/templates/skill-md.md` | template | `i:tf`, `ac:X` | SCG-23, TCG-09 | yes |
| `skills/improve-subagent/SKILL.md` | skill | `r:ps`, `i:sf`, `ac:P` | — | no |
| `skills/improve-subagent/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-11 | yes |
| `skills/improve-subagent/references/subagent-authoring-guide.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-19 | yes |
| `skills/improve-subagent/references/subagent-config-reference.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-22 | yes |
| `skills/improve-subagent/references/subagent-evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R` | — | no |
| `skills/improve-subagent/references/subagent-validation-criteria.md` | reference | `r:rf`, `i:rf`, `ac:R`, `ac:X` | SCG-15 | yes |
| `skills/improve-subagent/assets/templates/subagent-definition.md` | template | `i:tf`, `ac:X` | SCG-24, TCG-10 | yes |

---

## 7. Artifact Inventory — cursor-initializer

> **Base**: `plugins/cursor-initializer/` | **Bundle**: `cursor-plugin-bundle` | **Primary Phase**: 6

| Path (relative to base) | Type | Validators | Copy Group | Ph.7? |
|-------------------------|------|------------|------------|-------|
| `.cursor-plugin/plugin.json` | plugin-manifest | `i:pc` | — | no |
| `AGENTS.md` | config-file | `i:pc` | — | no |
| `CLAUDE.md` | config-file | `i:pc` | — | no |
| `README.md` | readme | `r:rm`, `i:rm` | — | no |
| `agents/codebase-analyzer.md` | agent | `r:ca`, `i:ad` | — | no |
| `agents/file-evaluator.md` | agent | `r:ca`, `i:ad` | — | no |
| `agents/scope-detector.md` | agent | `r:ca`, `i:ad` | — | no |
| `skills/improve-cursor/SKILL.md` | skill | `r:cp`, `i:sf` | — | no |
| `skills/improve-cursor/references/automation-migration-guide.md` | reference | `r:rf`, `i:rf` | SCG-05 | yes |
| `skills/improve-cursor/references/context-optimization.md` | reference | `r:rf`, `i:rf` | SCG-01 | yes |
| `skills/improve-cursor/references/cursor-rules-system.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-cursor/references/evaluation-criteria.md` | reference | `r:rf`, `i:rf` | SCG-06 | yes |
| `skills/improve-cursor/references/progressive-disclosure-guide.md` | reference | `r:rf`, `i:rf` | SCG-04 | yes |
| `skills/improve-cursor/references/validation-criteria.md` | reference | `r:rf`, `i:rf` | SCG-02 | yes |
| `skills/improve-cursor/references/what-not-to-include.md` | reference | `r:rf`, `i:rf` | SCG-03 | yes |
| `skills/improve-cursor/assets/templates/cursor-rule.mdc` | template | `i:tf` | — | no |
| `skills/improve-cursor/assets/templates/domain-doc.md` | template | `i:tf` | TCG-01 | yes |
| `skills/improve-cursor/assets/templates/hook-config.md` | template | `i:tf` | TCG-07 | yes |
| `skills/improve-cursor/assets/templates/root-agents-md.md` | template | `i:tf` | TCG-02 | yes |
| `skills/improve-cursor/assets/templates/scoped-agents-md.md` | template | `i:tf` | TCG-03 | yes |
| `skills/improve-cursor/assets/templates/skill.md` | template | `i:tf` | TCG-08 | yes |
| `skills/init-cursor/SKILL.md` | skill | `r:cp`, `i:sf` | — | no |
| `skills/init-cursor/references/context-optimization.md` | reference | `r:rf`, `i:rf` | SCG-01 | yes |
| `skills/init-cursor/references/cursor-rules-system.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/init-cursor/references/progressive-disclosure-guide.md` | reference | `r:rf`, `i:rf` | SCG-04 | yes |
| `skills/init-cursor/references/validation-criteria.md` | reference | `r:rf`, `i:rf` | SCG-02 | yes |
| `skills/init-cursor/references/what-not-to-include.md` | reference | `r:rf`, `i:rf` | SCG-03 | yes |
| `skills/init-cursor/assets/templates/cursor-rule.mdc` | template | `i:tf` | — | no |
| `skills/init-cursor/assets/templates/domain-doc.md` | template | `i:tf` | TCG-01 | yes |
| `skills/init-cursor/assets/templates/root-agents-md.md` | template | `i:tf` | TCG-02 | yes |
| `skills/init-cursor/assets/templates/scoped-agents-md.md` | template | `i:tf` | TCG-03 | yes |

> **Note**: `.mdc` templates are Cursor-only — no Claude/standalone counterpart expected. `cursor-rules-system.md` is cursor-initializer-specific (no cross-distribution copy group).

---

## 8. Artifact Inventory — cursor-customizer

> **Base**: `plugins/cursor-customizer/` | **Bundle**: `cursor-plugin-bundle` | **Primary Phase**: 6

| Path (relative to base) | Type | Validators | Copy Group | Ph.7? |
|-------------------------|------|------------|------------|-------|
| `.cursor-plugin/plugin.json` | plugin-manifest | `i:pc` | — | no |
| `CONVENTIONS.md` | config-file | `i:pc` | — | no |
| `README.md` | readme | `r:rm`, `i:rm` | — | no |
| `docs-drift-manifest.md` | drift-manifest | — | — | no |
| `agents/artifact-analyzer.md` | agent | `r:ca`, `i:ad` | — | no |
| `agents/docs-drift-checker.md` | agent | `r:ca`, `i:ad` | — | no |
| `agents/hook-evaluator.md` | agent | `r:ca`, `i:ad` | — | no |
| `agents/rule-evaluator.md` | agent | `r:ca`, `i:ad` | — | no |
| `agents/skill-evaluator.md` | agent | `r:ca`, `i:ad` | — | no |
| `agents/subagent-evaluator.md` | agent | `r:ca`, `i:ad` | — | no |
| `skills/create-hook/SKILL.md` | skill | `r:cp`, `i:sf` | — | no |
| `skills/create-hook/references/hook-authoring-guide.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-hook/references/hook-events-reference.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-hook/references/hook-validation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-hook/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-hook/assets/templates/hook-config.md` | template | `i:tf` | — | no |
| `skills/create-rule/SKILL.md` | skill | `r:cp`, `i:sf` | — | no |
| `skills/create-rule/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-rule/references/rule-authoring-guide.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-rule/references/rule-validation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-rule/assets/templates/cursor-rule-always.mdc` | template | `i:tf` | — | no |
| `skills/create-rule/assets/templates/cursor-rule-description.mdc` | template | `i:tf` | — | no |
| `skills/create-rule/assets/templates/cursor-rule-globs.mdc` | template | `i:tf` | — | no |
| `skills/create-skill/SKILL.md` | skill | `r:cp`, `i:sf` | — | no |
| `skills/create-skill/references/behavioral-guidelines.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-skill/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-skill/references/skill-authoring-guide.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-skill/references/skill-format-reference.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-skill/references/skill-validation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-skill/assets/templates/skill-md.md` | template | `i:tf` | — | no |
| `skills/create-subagent/SKILL.md` | skill | `r:cp`, `i:sf` | — | no |
| `skills/create-subagent/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-subagent/references/subagent-authoring-guide.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-subagent/references/subagent-config-reference.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-subagent/references/subagent-validation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/create-subagent/assets/templates/subagent-definition.md` | template | `i:tf` | — | no |
| `skills/improve-hook/SKILL.md` | skill | `r:cp`, `i:sf` | — | no |
| `skills/improve-hook/references/hook-authoring-guide.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-hook/references/hook-evaluation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-hook/references/hook-events-reference.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-hook/references/hook-validation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-hook/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-hook/assets/templates/hook-config.md` | template | `i:tf` | — | no |
| `skills/improve-rule/SKILL.md` | skill | `r:cp`, `i:sf` | — | no |
| `skills/improve-rule/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-rule/references/rule-authoring-guide.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-rule/references/rule-evaluation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-rule/references/rule-validation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-rule/assets/templates/cursor-rule-always.mdc` | template | `i:tf` | — | no |
| `skills/improve-rule/assets/templates/cursor-rule-description.mdc` | template | `i:tf` | — | no |
| `skills/improve-rule/assets/templates/cursor-rule-globs.mdc` | template | `i:tf` | — | no |
| `skills/improve-skill/SKILL.md` | skill | `r:cp`, `i:sf` | — | no |
| `skills/improve-skill/references/behavioral-guidelines.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-skill/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-skill/references/skill-authoring-guide.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-skill/references/skill-evaluation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-skill/references/skill-format-reference.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-skill/references/skill-validation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-skill/assets/templates/skill-md.md` | template | `i:tf` | — | no |
| `skills/improve-subagent/SKILL.md` | skill | `r:cp`, `i:sf` | — | no |
| `skills/improve-subagent/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-subagent/references/subagent-authoring-guide.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-subagent/references/subagent-config-reference.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-subagent/references/subagent-evaluation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-subagent/references/subagent-validation-criteria.md` | reference | `r:rf`, `i:rf` | — | no |
| `skills/improve-subagent/assets/templates/subagent-definition.md` | template | `i:tf` | — | no |

> **Note**: `.mdc` templates are Cursor-only — no Claude/standalone counterpart expected. `docs-drift-manifest.md` validator is managed by `cursor-customizer-quality-gate` Phase 3 (drift detection); no separate rule or instruction validator is assigned.

---

## 9. Artifact Inventory — standalone

> **Base**: `skills/` | **Bundle**: `standalone-bundle` | **Primary Phase**: 5

| Path (relative to base) | Type | Validators | Copy Group | Ph.7? |
|-------------------------|------|------------|------------|-------|
| `README.md` | readme | `r:rm`, `i:rm` | — | no |
| `create-hook/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `create-hook/references/artifact-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-hook/references/hook-authoring-guide.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-hook/references/hook-events-reference.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-hook/references/hook-validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-hook/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-hook/assets/templates/hook-config.md` | template | `i:tf`, `q:T`, `q:X` | TCG-07 | yes |
| `create-rule/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `create-rule/references/artifact-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-rule/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-rule/references/rule-authoring-guide.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-rule/references/rule-validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-rule/assets/templates/rule-file.md` | template | `i:tf`, `q:T` | — | no |
| `create-skill/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `create-skill/references/artifact-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-skill/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-skill/references/behavioral-guidelines.md` | reference | `r:rf`, `i:rf`, `q:R` | SCG-25 | yes |
| `create-skill/references/skill-authoring-guide.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-skill/references/skill-format-reference.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-skill/references/skill-validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-skill/assets/templates/skill-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-09 | yes |
| `create-subagent/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `create-subagent/references/artifact-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-subagent/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-subagent/references/subagent-authoring-guide.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-subagent/references/subagent-config-reference.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-subagent/references/subagent-validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `create-subagent/assets/templates/subagent-definition.md` | template | `i:tf`, `q:T`, `q:X` | TCG-10 | yes |
| `improve-agents/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `improve-agents/references/automation-migration-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-05 | yes |
| `improve-agents/references/codebase-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | SCG-08 | yes |
| `improve-agents/references/context-optimization.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-01 | yes |
| `improve-agents/references/evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-06 | yes |
| `improve-agents/references/file-evaluator.md` | reference | `r:rf`, `i:rf`, `q:R` | SCG-09 | yes |
| `improve-agents/references/progressive-disclosure-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-04 | yes |
| `improve-agents/references/validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-02 | yes |
| `improve-agents/references/what-not-to-include.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-03 | yes |
| `improve-agents/assets/templates/claude-rule.md` | template | `i:tf`, `q:T`, `q:X` | TCG-06 | yes |
| `improve-agents/assets/templates/domain-doc.md` | template | `i:tf`, `q:T`, `q:X` | TCG-01 | yes |
| `improve-agents/assets/templates/root-agents-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-02 | yes |
| `improve-agents/assets/templates/scoped-agents-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-03 | yes |
| `improve-agents/assets/templates/skill.md` | template | `i:tf`, `q:T`, `q:X` | TCG-08 | yes |
| `improve-claude/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `improve-claude/references/automation-migration-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-05 | yes |
| `improve-claude/references/claude-rules-system.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-07 | yes |
| `improve-claude/references/codebase-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | SCG-08 | yes |
| `improve-claude/references/context-optimization.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-01 | yes |
| `improve-claude/references/evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-06 | yes |
| `improve-claude/references/file-evaluator.md` | reference | `r:rf`, `i:rf`, `q:R` | SCG-09 | yes |
| `improve-claude/references/progressive-disclosure-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-04 | yes |
| `improve-claude/references/validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-02 | yes |
| `improve-claude/references/what-not-to-include.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-03 | yes |
| `improve-claude/assets/templates/claude-rule.md` | template | `i:tf`, `q:T`, `q:X` | TCG-06 | yes |
| `improve-claude/assets/templates/domain-doc.md` | template | `i:tf`, `q:T`, `q:X` | TCG-01 | yes |
| `improve-claude/assets/templates/root-claude-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-04 | yes |
| `improve-claude/assets/templates/scoped-claude-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-05 | yes |
| `improve-claude/assets/templates/skill.md` | template | `i:tf`, `q:T`, `q:X` | TCG-08 | yes |
| `improve-hook/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `improve-hook/references/artifact-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-hook/references/hook-authoring-guide.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-hook/references/hook-evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-hook/references/hook-evaluator.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-hook/references/hook-events-reference.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-hook/references/hook-validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-hook/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-hook/assets/templates/hook-config.md` | template | `i:tf`, `q:T`, `q:X` | TCG-07 | yes |
| `improve-rule/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `improve-rule/references/artifact-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-rule/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-rule/references/rule-authoring-guide.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-rule/references/rule-evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-rule/references/rule-evaluator.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-rule/references/rule-validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-rule/assets/templates/rule-file.md` | template | `i:tf`, `q:T` | — | no |
| `improve-skill/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `improve-skill/references/artifact-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-skill/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-skill/references/behavioral-guidelines.md` | reference | `r:rf`, `i:rf`, `q:R` | SCG-25 | yes |
| `improve-skill/references/skill-authoring-guide.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-skill/references/skill-evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-skill/references/skill-evaluator.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-skill/references/skill-format-reference.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-skill/references/skill-validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-skill/assets/templates/skill-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-09 | yes |
| `improve-subagent/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `improve-subagent/references/artifact-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-subagent/references/prompt-engineering-strategies.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-subagent/references/subagent-authoring-guide.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-subagent/references/subagent-config-reference.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-subagent/references/subagent-evaluation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-subagent/references/subagent-evaluator.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-subagent/references/subagent-validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R` | — | no |
| `improve-subagent/assets/templates/subagent-definition.md` | template | `i:tf`, `q:T`, `q:X` | TCG-10 | yes |
| `init-agents/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `init-agents/references/codebase-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | SCG-08 | yes |
| `init-agents/references/context-optimization.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-01 | yes |
| `init-agents/references/progressive-disclosure-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-04 | yes |
| `init-agents/references/scope-detector.md` | reference | `r:rf`, `i:rf`, `q:R` | SCG-10 | yes |
| `init-agents/references/validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-02 | yes |
| `init-agents/references/what-not-to-include.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-03 | yes |
| `init-agents/assets/templates/domain-doc.md` | template | `i:tf`, `q:T`, `q:X` | TCG-01 | yes |
| `init-agents/assets/templates/root-agents-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-02 | yes |
| `init-agents/assets/templates/scoped-agents-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-03 | yes |
| `init-claude/SKILL.md` | skill | `r:ss`, `i:sf`, `q:S` | — | no |
| `init-claude/references/claude-rules-system.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-07 | yes |
| `init-claude/references/codebase-analyzer.md` | reference | `r:rf`, `i:rf`, `q:R` | SCG-08 | yes |
| `init-claude/references/context-optimization.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-01 | yes |
| `init-claude/references/progressive-disclosure-guide.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-04 | yes |
| `init-claude/references/scope-detector.md` | reference | `r:rf`, `i:rf`, `q:R` | SCG-10 | yes |
| `init-claude/references/validation-criteria.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-02 | yes |
| `init-claude/references/what-not-to-include.md` | reference | `r:rf`, `i:rf`, `q:R`, `q:X` | SCG-03 | yes |
| `init-claude/assets/templates/claude-rule.md` | template | `i:tf`, `q:T`, `q:X` | TCG-06 | yes |
| `init-claude/assets/templates/domain-doc.md` | template | `i:tf`, `q:T`, `q:X` | TCG-01 | yes |
| `init-claude/assets/templates/root-claude-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-04 | yes |
| `init-claude/assets/templates/scoped-claude-md.md` | template | `i:tf`, `q:T`, `q:X` | TCG-05 | yes |

---

## 10. Artifact Inventory — repository-global

> **Bundle**: `governance-bundle` | **Primary Phase**: varies — see Ph.column

| Path (from repo root) | Type | Validators | Copy Group | Pri.Phase | Ph.7? |
|-----------------------|------|------------|------------|-----------|-------|
| `.claude/rules/agent-files.md` | rule | `i:rl` | — | 4,5,6 | no |
| `.claude/rules/cursor-agent-files.md` | rule | `i:rl` | — | 6 | no |
| `.claude/rules/cursor-plugin-skills.md` | rule | `i:rl` | — | 6 | no |
| `.claude/rules/plugin-skills.md` | rule | `i:rl` | — | 4 | no |
| `.claude/rules/readme-files.md` | rule | `i:rl` | — | 4,5,6 | no |
| `.claude/rules/reference-files.md` | rule | `i:rl` | — | 4,5,6 | no |
| `.claude/rules/standalone-skills.md` | rule | `i:rl` | — | 5 | no |
| `.github/instructions/agent-definitions.instructions.md` | instruction | — | — | 4,5,6 | no |
| `.github/instructions/documentation.instructions.md` | instruction | — | — | 7 | no |
| `.github/instructions/plugin-config.instructions.md` | instruction | — | — | 4,6 | no |
| `.github/instructions/prp-artifacts.instructions.md` | instruction | — | — | 9 | no |
| `.github/instructions/readme-files.instructions.md` | instruction | — | — | 4,5,6 | no |
| `.github/instructions/reference-files.instructions.md` | instruction | — | — | 4,5,6 | no |
| `.github/instructions/rules.instructions.md` | instruction | — | — | 4,5,6 | no |
| `.github/instructions/skill-files.instructions.md` | instruction | — | — | 4,5,6 | no |
| `.github/instructions/template-files.instructions.md` | instruction | — | — | 4,5,6 | no |
| `.claude/hooks/check-docs-sync.sh` | hook | — | — | 9 | no |
| `.claude/skills/quality-gate/SKILL.md` | quality-gate-skill | — | — | 9 | no |
| `.claude/skills/quality-gate/README.md` | quality-gate-skill | — | — | 9 | no |
| `.claude/skills/quality-gate/agents/artifact-inspector.md` | quality-gate-agent | — | — | 9 | no |
| `.claude/skills/quality-gate/agents/parity-checker.md` | quality-gate-agent | — | — | 9 | no |
| `.claude/skills/quality-gate/agents/scenario-evaluator.md` | quality-gate-agent | — | — | 9 | no |
| `.claude/skills/quality-gate/references/quality-gate-criteria.md` | quality-gate-reference | — | — | 9 | no |
| `.claude/skills/agent-customizer-quality-gate/SKILL.md` | quality-gate-skill | — | — | 9 | no |
| `.claude/skills/agent-customizer-quality-gate/agents/artifact-inspector.md` | quality-gate-agent | — | — | 9 | no |
| `.claude/skills/agent-customizer-quality-gate/agents/parity-checker.md` | quality-gate-agent | — | — | 9 | no |
| `.claude/skills/agent-customizer-quality-gate/agents/scenario-evaluator.md` | quality-gate-agent | — | — | 9 | no |
| `.claude/skills/agent-customizer-quality-gate/references/quality-gate-criteria.md` | quality-gate-reference | — | — | 9 | no |
| `.claude/skills/receiving-code-review/SKILL.md` | dev-skill | — | — | 9 | no |
| `.claude/skills/update-review-instructions/SKILL.md` | dev-skill | — | — | 9 | no |
| `.claude/skills/update-review-instructions/references/instruction-writing-guide.md` | dev-skill-reference | — | — | 9 | no |
| `.claude/skills/update-review-instructions/references/scope-registry.md` | dev-skill-reference | — | — | 9 | no |
| `CLAUDE.md` | config-file | `i:pc` | — | 4,5,6 | no |
| `DESIGN-GUIDELINES.md` | docs | `i:dc` | — | 4,5,6 | no |
| `README.md` | readme | `r:rm`, `i:rm` | — | 7 | no |
| `.claude-plugin/marketplace.json` | marketplace-manifest | `i:pc` | — | 4 | no |
| `.cursor-plugin/marketplace.json` | marketplace-manifest | `i:pc` | — | 6 | no |
| `docs/CLAUDE.md` | config-file | `i:dc` | — | 4,5,6 | no |
| `docs/README.md` | readme | `r:rm`, `i:rm` | — | 7 | no |
| `docs/analysis/analysis-a-guide-to-agents.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-a-guide-to-claude.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-automate-workflow-with-hooks.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-claude-create-plugin-doc.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-claude-hook-reference-doc.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-claude-orchestrate-of-claude-code-sessions.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-claude-prompting-best-practices.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-creating-custom-subagents.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-evaluating-agents-paper.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-extend-claude-with-skills.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-how-claude-remembers-a-project.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-prompt-engineering-guide.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-research-claude-code-skills-format.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-research-llm-context-optimization.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-research-subagent-best-practices.md` | docs | `i:dc` | — | 7 | no |
| `docs/analysis/analysis-skill-authoring-best-practices.md` | docs | `i:dc` | — | 7 | no |
| `docs/claude-code/claude-prompting-best-practices.md` | docs | `i:dc` | — | 7 | no |
| `docs/claude-code/hooks/automate-workflow-with-hooks.md` | docs | `i:dc` | — | 7 | no |
| `docs/claude-code/hooks/claude-hook-reference-doc.md` | docs | `i:dc` | — | 7 | no |
| `docs/claude-code/memory/how-claude-remembers-a-project.md` | docs | `i:dc` | — | 7 | no |
| `docs/claude-code/plugins/claude-create-plugin-doc.md` | docs | `i:dc` | — | 7 | no |
| `docs/claude-code/skills/extend-claude-with-skills.md` | docs | `i:dc` | — | 7 | no |
| `docs/claude-code/skills/research-claude-code-skills-format.md` | docs | `i:dc` | — | 7 | no |
| `docs/claude-code/subagents/claude-orchestrate-of-claude-code-sessions.md` | docs | `i:dc` | — | 7 | no |
| `docs/claude-code/subagents/creating-custom-subagents.md` | docs | `i:dc` | — | 7 | no |
| `docs/compliance/normative-source-matrix.md` | docs | `i:dc` | — | 3 | no |
| `docs/compliance/artifact-audit-manifest.md` | docs | `i:dc` | — | 2 | no |
| `docs/cursor/README.md` | readme | `r:rm`, `i:rm` | — | 7 | no |
| `docs/cursor/best-practices/agent-best-practices.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/hooks/hooks-guide.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/mcp/mcp-guide.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/plugin/plugin-full-reference.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/plugin/plugins.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/rules/rules.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/skills/agent-skills-guide.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/subagents/subagents-guide.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/tools/browser/browser-guide.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/tools/search/search-guide.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/tools/terminal/terminal-guide.md` | docs | `i:dc` | — | 7 | no |
| `docs/cursor/tools/worktrees/worktrees-guide.md` | docs | `i:dc` | — | 7 | no |
| `docs/general-llm/Evaluating-AGENTS-paper.md` | docs | `i:dc` | — | 7 | no |
| `docs/general-llm/a-guide-to-agents.md` | docs | `i:dc` | — | 7 | no |
| `docs/general-llm/prompt-engineering-guide.md` | docs | `i:dc` | — | 7 | no |
| `docs/general-llm/research-agent-workflows-and-patterns.md` | docs | `i:dc` | — | 7 | no |
| `docs/general-llm/research-context-engineering-comprehensive.md` | docs | `i:dc` | — | 7 | no |
| `docs/general-llm/research-context-rot-and-management.md` | docs | `i:dc` | — | 7 | no |
| `docs/general-llm/research-multilingual-performance.md` | docs | `i:dc` | — | 7 | no |
| `docs/general-llm/research-whitespace-and-formatting.md` | docs | `i:dc` | — | 7 | no |
| `docs/general-llm/subagents/research-subagent-best-practices.md` | docs | `i:dc` | — | 7 | no |
| `docs/shared/skill-authoring-best-practices.md` | docs | `i:dc` | — | 7 | no |
| `docs/shared/skills-standard/README.md` | readme | `i:rm` | — | 7 | no |
| `docs/shared/skills-standard/agentskills-best-practices.md` | docs | `i:dc` | — | 7 | no |
| `docs/shared/skills-standard/agentskills-evaluating-skills.md` | docs | `i:dc` | — | 7 | no |
| `docs/shared/skills-standard/agentskills-optimizing-descriptions.md` | docs | `i:dc` | — | 7 | no |
| `docs/shared/skills-standard/agentskills-specification.md` | docs | `i:dc` | — | 7 | no |
| `docs/shared/skills-standard/agentskills-using-scripts.md` | docs | `i:dc` | — | 7 | no |
| `docs/shared/skills-standard/agentskills-what-are-skills.md` | docs | `i:dc` | — | 7 | no |

> **Note**: review instruction files (`.github/instructions/*.md`) have no automated validator — they ARE validators. Enforcement gaps for this type are documented in Section 12.

---

## 11. Shared Copy Group Registry

Groups are stable identifiers referenced in inventory Ph.7 columns. Member paths are the filesystem truth — Task 2 cross-validates all member paths exist. Some Phase 7 groups contain multiple parity families under one stable ID when platform or lifecycle adaptations are intentional; in those cases, the Parity Enforcer column names the family split instead of requiring one hash across every listed member.

### SCG Groups (Reference Shared Copies)

| Group ID | Shared File | Member Paths | Copies | Parity Enforcer |
|----------|-------------|--------------|--------|-----------------|
| SCG-01 | `context-optimization.md` | Family A: agents-init ×4 + standalone ×4; Family B: cursor-init ×2 | 8 + 2 | quality-gate parity-checker (X1 split families) |
| SCG-02 | `validation-criteria.md` (initializer) | Family A: agents-init ×4 + standalone ×4; Family B: cursor-init ×2 | 8 + 2 | quality-gate parity-checker (X2 split families) |
| SCG-03 | `what-not-to-include.md` | Family A: agents-init ×4 + standalone ×4; Family B: cursor-init ×2 | 8 + 2 | quality-gate parity-checker (X1 split families) |
| SCG-04 | `progressive-disclosure-guide.md` | Family A: agents-init ×4 + standalone ×4; Family B: cursor-init ×2 | 8 + 2 | quality-gate parity-checker (X1 split families) |
| SCG-05 | `automation-migration-guide.md` | Family A: agents-init ×2 + standalone ×2; Family B: cursor-init improve-cursor singleton | 4 + 1 | quality-gate parity-checker (X1 family A) + manual validator (singleton) |
| SCG-06 | `evaluation-criteria.md` | Family A: agents-init ×2 + standalone ×2; Family B: cursor-init improve-cursor singleton | 4 + 1 | quality-gate parity-checker (X1 family A) + manual validator (singleton) |
| SCG-07 | `claude-rules-system.md` | agents-init/improve-claude, agents-init/init-claude, standalone/improve-claude, standalone/init-claude | 4 | quality-gate parity-checker (X1) |
| SCG-08 | `codebase-analyzer.md` (standalone refs) | standalone/improve-agents, standalone/improve-claude, standalone/init-agents, standalone/init-claude | 4 | quality-gate parity-checker (X1) |
| SCG-09 | `file-evaluator.md` (standalone refs) | standalone/improve-agents, standalone/improve-claude | 2 | quality-gate parity-checker (X1) |
| SCG-10 | `scope-detector.md` (standalone refs) | standalone/init-agents, standalone/init-claude | 2 | quality-gate parity-checker (X1) |

### SCG-11 to SCG-24: agent-customizer Intra-Plugin Groups (X1–X14)

| Group ID | QG Check | Shared File | Member Paths | Copies | Parity Enforcer |
|----------|----------|-------------|--------------|--------|-----------------|
| SCG-11 | X1 | `prompt-engineering-strategies.md` | All 8 create/improve skill dirs | 8 | agent-customizer-qg parity-checker |
| SCG-12 | X2 | `skill-validation-criteria.md` | create-skill ↔ improve-skill | 2 | agent-customizer-qg parity-checker |
| SCG-13 | X3 | `hook-validation-criteria.md` | create-hook ↔ improve-hook | 2 | agent-customizer-qg parity-checker |
| SCG-14 | X4 | `rule-validation-criteria.md` | create-rule ↔ improve-rule | 2 | agent-customizer-qg parity-checker |
| SCG-15 | X5 | `subagent-validation-criteria.md` | create-subagent ↔ improve-subagent | 2 | agent-customizer-qg parity-checker |
| SCG-16 | X6 | `skill-authoring-guide.md` | create-skill ↔ improve-skill | 2 | agent-customizer-qg parity-checker |
| SCG-17 | X7 | `hook-authoring-guide.md` | create-hook ↔ improve-hook | 2 | agent-customizer-qg parity-checker |
| SCG-18 | X8 | `rule-authoring-guide.md` | create-rule ↔ improve-rule | 2 | agent-customizer-qg parity-checker |
| SCG-19 | X9 | `subagent-authoring-guide.md` | create-subagent ↔ improve-subagent | 2 | agent-customizer-qg parity-checker |
| SCG-20 | X10 | `skill-format-reference.md` | create-skill ↔ improve-skill | 2 | agent-customizer-qg parity-checker |
| SCG-21 | X11 | `hook-events-reference.md` | create-hook ↔ improve-hook | 2 | agent-customizer-qg parity-checker |
| SCG-22 | X12 | `subagent-config-reference.md` | create-subagent ↔ improve-subagent | 2 | agent-customizer-qg parity-checker |
| SCG-23 | X13 | `skill-md.md` (template) | create-skill ↔ improve-skill | 2 | agent-customizer-qg parity-checker |
| SCG-24 | X14 | `subagent-definition.md` (template) | create-subagent ↔ improve-subagent | 2 | agent-customizer-qg parity-checker |
| SCG-25 | X15 | `behavioral-guidelines.md` | create-skill ↔ improve-skill (plugin + standalone) | 4 | agent-customizer-qg parity-checker (plugin 2) + quality-gate parity-checker (standalone 2) |

### TCG Groups (Template Shared Copies)

| Group ID | Shared Template | Member Distributions | Copies | Parity Enforcer |
|----------|-----------------|----------------------|--------|-----------------|
| TCG-01 | `domain-doc.md` | agents-init ×4, cursor-init ×2, standalone ×4 | 10 | quality-gate parity-checker (T2) |
| TCG-02 | `root-agents-md.md` | Family A: agents-init ×2 + standalone ×2; Family B: cursor-init ×2 | 4 + 2 | quality-gate parity-checker (T2 split families) |
| TCG-03 | `scoped-agents-md.md` | Family A: agents-init ×2 + standalone ×2; Family B: cursor-init ×2 | 4 + 2 | quality-gate parity-checker (T2 split families) |
| TCG-04 | `root-claude-md.md` | agents-init ×2, standalone ×2 | 4 | quality-gate parity-checker (T2) |
| TCG-05 | `scoped-claude-md.md` | agents-init ×2 + standalone ×2 | 4 | quality-gate parity-checker (T2) |
| TCG-06 | `claude-rule.md` | Family A: init-claude plugin + standalone; Family B: improve-agents + improve-claude across plugin + standalone | 2 + 4 | quality-gate parity-checker (T2 split families) |
| TCG-07 | `hook-config.md` | Family A: agents-init improve pair; Family B: agent-custom create/improve + standalone create/improve hook pair; Family C: cursor-init improve singleton | 2 + 4 + 1 | quality-gate parity-checker (T2 split families) + manual validator (singleton) |
| TCG-08 | `skill.md` | Family A: agents-init improve pair + standalone improve pair; Family B: cursor-init improve singleton | 4 + 1 | quality-gate parity-checker (T2 family A) + manual validator (singleton) |
| TCG-09 | `skill-md.md` | Family A: agent-custom create/improve pair (SCG-23); Family B: standalone create/improve pair | 2 + 2 | quality-gate parity-checker (T2 family B) + agent-custom-qg (X13 family A) |
| TCG-10 | `subagent-definition.md` | Family A: agent-custom create/improve pair (SCG-24); Family B: standalone create/improve pair | 2 + 2 | quality-gate parity-checker (T2 family B) + agent-custom-qg (X14 family A) |

---

## 12. Validator Coverage Matrix

Enforcement status per (scope × artifact type). Cells show active rule/instruction/gate checks. **Gap** = no automated enforcement.

| Scope | Artifact Type | Rule | Instruction | QG Checks | Drift | Gap? |
|-------|--------------|------|-------------|-----------|-------|------|
| agents-initializer | skill | `r:ps` | `i:sf` | `q:P` (P1–P12) | — | no |
| agents-initializer | agent | `r:af` | `i:ad` | `q:A` (A1–A6) | — | no |
| agents-initializer | reference | `r:rf` | `i:rf` | `q:R` (R1–R5), `q:X` (X1–X2) | — | no |
| agents-initializer | template | — | `i:tf` | `q:T` (T1–T2), `q:X` | — | no |
| agents-initializer | plugin-manifest | — | `i:pc` | — | — | **yes** (no gate) |
| agents-initializer | config-file/readme | `r:rm` | `i:pc`, `i:rm` | — | — | **yes** (no gate) |
| agent-customizer | skill | `r:ps` | `i:sf` | `ac:P` (P1–P12) | `ac:D` (D1–D3) | no |
| agent-customizer | agent | `r:af` | `i:ad` | `ac:A` (A1–A6) | `ac:D` | no |
| agent-customizer | reference | `r:rf` | `i:rf` | `ac:R` (R1–R5), `ac:X` (X1–X14) | `ac:D` | no |
| agent-customizer | template | — | `i:tf` | `ac:X` (X13–X14) | — | no |
| agent-customizer | drift-manifest | — | — | `ac:D` | — | no |
| agent-customizer | plugin-manifest | — | `i:pc` | — | — | **yes** (no gate) |
| cursor-initializer | skill | `r:cp` | `i:sf` | `ci:P` (P1–P10) | — | no |
| cursor-initializer | agent | `r:ca` | `i:ad` | `ci:A` (A1–A5) | — | no |
| cursor-initializer | reference | `r:rf` | `i:rf` | `ci:R` (R1–R5), `ci:X` (X1–X2) | — | no |
| cursor-initializer | template | — | `i:tf` | `ci:T` (T1–T4), `ci:X` | — | no |
| cursor-customizer | skill | `r:cp` | `i:sf` | `cc:P` (P1–P12) | `cc:D` (D1–D3) | no |
| cursor-customizer | agent | `r:ca` | `i:ad` | `cc:A` (A1–A6) | `cc:D` | no |
| cursor-customizer | reference | `r:rf` | `i:rf` | `cc:R` (R1–R5), `cc:X` (X1–X19) | `cc:D` | no |
| cursor-customizer | template | — | `i:tf` | `cc:X` | — | no |
| cursor-customizer | drift-manifest | — | — | `cc:D` | — | no |
| cursor-customizer | plugin-manifest | — | `i:pc` | — | — | **yes** (no gate) |
| cursor-customizer | config-file/readme | `r:rm` | `i:pc`, `i:rm` | — | — | **yes** (no gate) |
| standalone | skill | `r:ss` | `i:sf` | `q:S` (S1–S11) | — | no |
| standalone | reference | `r:rf` | `i:rf` | `q:R` (R1–R5), `q:X` (X1–X2) | — | no |
| standalone | template | — | `i:tf` | `q:T` (T1–T2), `q:X` | — | no |
| repository-global | rule | — | `i:rl` | — | — | **yes** (instructions only) |
| repository-global | instruction | — | — | — | — | **yes** (no validator) |
| repository-global | docs | — | `i:dc` | — | — | **yes** (instructions only) |
| repository-global | hook | — | — | — | — | **yes** (no validator) |
| repository-global | quality-gate assets | — | — | — | — | **yes** (Phase 9 scope) |

---

## 13. Quality Gate Coverage Map

| Scope | Quality Gate | Static (Phase 1) | Parity (Phase 2) | Drift (Phase 3) | Scenarios (Phase 4) | Coverage Gap |
|-------|-------------|-----------------|-----------------|-----------------|---------------------|--------------|
| agents-initializer | `.claude/skills/quality-gate/` | ✅ P1–P12, A1–A6, R1–R5 | ✅ X1–X2, T1–T2 | ✅ (Phase 3, via manifest) | ✅ G1–G4 | No cursor-initializer drift |
| agent-customizer | `.claude/skills/agent-customizer-quality-gate/` | ✅ P1–P12, A1–A6, R1–R5 | ✅ X1–X14, T1–T3 | ✅ D1–D3 | ✅ G1–G4 | Full coverage |
| cursor-initializer | `.claude/skills/cursor-initializer-quality-gate/` | ✅ P1–P10, A1–A5, R1–R5 | ✅ X1–X2, T1–T4 | ❌ none | ✅ G1–G4 | No drift detection |
| cursor-customizer | `.claude/skills/cursor-customizer-quality-gate/` | ✅ P1–P12, A1–A6, R1–R5 | ✅ X1–X19 | ✅ D1–D3 | ✅ G1–G4 | Full coverage |
| standalone | `.claude/skills/quality-gate/` (shared) | ✅ S1–S11, R1–R5 | ✅ X1–X2, T1–T2 | ✅ (Phase 3, via manifest) | ✅ G1–G4 | No cursor-initializer drift |
| repository-global | **No quality gate** | ❌ | ❌ | ❌ | ❌ | **All coverage manual** |

> **Note**: cursor-initializer quality gate shipped in Phase 9 (`.claude/skills/cursor-initializer-quality-gate/`); first full run executed in Phase 10. cursor-customizer quality gate is at `.claude/skills/cursor-customizer-quality-gate/`; drift detection is implemented via `plugins/cursor-customizer/docs-drift-manifest.md` (Phase 3). Drift detection for agents-initializer and standalone is implemented via `plugins/agents-initializer/docs-drift-manifest.md` and `skills/docs-drift-manifest.md` respectively (quality-gate Phase 3). Cursor-initializer has no drift manifest; cursor-initializer drift detection not yet implemented. Repository-global coverage remains manual-only.

---

## 14. Audit Phase Assignments

| PRD Phase | Scope | Artifact Count | Quality Gate | Notes |
|-----------|-------|---------------|--------------|-------|
| 3 | Cross-cutting | — | — | Normative source matrix cross-validation; validator protocol definition |
| 4 | agents-initializer + agent-customizer | 111 | Both quality gates available | Claude Code scope audit; ~51 agents-init + ~60 agent-customizer |
| 5 | standalone | 114 | quality-gate (partial) | Standalone scope audit |
| 6 | cursor-initializer + cursor-customizer | 97 | cursor-initializer-qg + cursor-customizer-qg | Cursor scope audit; ~31 cursor-init + ~66 cursor-customizer |
| 7 | Cross-cutting (Ph.7?=yes) | ~180 | Parity checkers | Parity review for all SCG/TCG groups; drift remediation for agent-customizer and cursor-customizer |
| 8 | RAG/Wiki infrastructure | — | None | RAG hardening; out of scope for distribution artifact audit |
| 9 | All | 420 | New/extended gates | Regression prevention; cursor-initializer and repository-global gap remediation |
