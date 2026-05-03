# Regression Prevention Workflow

> **Status**: Active
> **Source**: PRD #56 Phase 9 — Regression Prevention Workflow
> **Scope**: Repository-wide; applies after all Phase 4–8 corrections are complete

## Contents

- [1. Purpose](#1-purpose)
- [2. Change Type Matrix](#2-change-type-matrix)
- [3. Scope-to-Gate Map](#3-scope-to-gate-map)
- [4. Checkpoint Protocol](#4-checkpoint-protocol)
- [5. Manual Fallback](#5-manual-fallback)
- [6. Post-Gate Actions](#6-post-gate-actions)

---

## 1. Purpose

This document ties all quality gates into a repeatable regression prevention system. After
Phases 4–8 corrected all open compliance violations, this workflow ensures that future changes
cannot silently re-introduce drift. Every implementer making changes to artifacts in any
compliance scope consults this document to identify the correct gate before merging.

---

## 2. Change Type Matrix

| Change Type | Affected Scope | Required Gate | Manual Fallback |
|-------------|---------------|---------------|-----------------|
| Plugin artifact modified (skills, agents, references, templates) in `plugins/agents-initializer/` or `skills/` | agents-initializer, standalone | `quality-gate` | §5 below |
| Plugin artifact modified in `plugins/agent-customizer/` | agent-customizer | `agent-customizer-quality-gate` | §5 below |
| Plugin artifact modified in `plugins/cursor-initializer/` | cursor-initializer | `cursor-initializer-quality-gate` | §5 below |
| Plugin artifact modified in `plugins/cursor-customizer/` | cursor-customizer | `cursor-customizer-quality-gate` | §5 below |
| Rule, hook, instruction, or root config modified (`.claude/rules/`, `.claude/hooks/`, `.github/instructions/`, `CLAUDE.md`) | repository-global | `docs/compliance/repository-global-validation-protocol.md` | §5 below |
| New shared reference copy added | all containing scopes | Run parity phase of gate for each affected scope | Compare copy manually against all siblings |
| Drift manifest updated (`**/docs-drift-manifest.md`) | scope of manifest | Re-run drift detection phase of the scope's quality gate | Manual source doc comparison |
| Compliance doc modified (`docs/compliance/`) | repository-global | `docs/compliance/repository-global-validation-protocol.md` | §5 below |
| Multiple scopes affected | all affected scopes | Run each scope's gate in sequence | §5 for each scope |

---

## 3. Scope-to-Gate Map

| Scope | Quality Gate Skill | Fallback Protocol |
|-------|-------------------|-------------------|
| agents-initializer | `quality-gate` | `docs/compliance/repository-global-validation-protocol.md` §Rules |
| standalone | `quality-gate` | `docs/compliance/repository-global-validation-protocol.md` §Rules |
| agent-customizer | `agent-customizer-quality-gate` | Manual per §5 below |
| cursor-initializer | `cursor-initializer-quality-gate` | Manual per §5 below |
| cursor-customizer | `cursor-customizer-quality-gate` | Manual per §5 below |
| repository-global | *(no automated gate)* | `docs/compliance/repository-global-validation-protocol.md` |

---

## 4. Checkpoint Protocol

Execute these steps before merging any change that touches a compliance-relevant artifact:

1. **Identify change type** — use the Change Type Matrix (§2) to determine which scope(s) are affected
2. **Select gate(s)** — use the Scope-to-Gate Map (§3) to identify the required quality gate(s)
3. **Run gate(s)** — invoke each quality gate skill; collect structured output
4. **Document findings** — for any violation found, record a CF-NNN finding using `docs/compliance/finding-model-and-validator-protocol.md` before proposing corrections
5. **Block on open findings** — do not merge until all findings reach REVALIDATED or CLOSED state; CORRECTED alone is not sufficient
6. **Complete post-gate actions** — see §6 below

---

## 5. Manual Fallback

Use this fallback when: the automated quality gate is unavailable, the change affects
repository-global scope, or an urgent fix must merge before gate infrastructure is operational.

**Manual fallback protocol:**

1. Read `docs/compliance/repository-global-validation-protocol.md` and run all applicable
   checklist sections for the artifact type being changed
2. For each section checked, note the result (PASS / FINDING) inline in your PR description
3. For any FINDING, create a CF-NNN record using `docs/compliance/finding-model-and-validator-protocol.md` before merging
4. Record the revalidation method as `manual-auditor-rerun` in the CF-NNN finding
5. Notify the next compliance review that a manual fallback was used (add label `manual-compliance-fallback` to the PR)

**Limitations of manual fallback:** Manual checks miss drift and parity violations that require
automated cross-file comparison. After a manual-fallback merge, schedule a full gate run at
the next opportunity.

---

## 6. Post-Gate Actions

After every quality gate run, confirm the following before declaring the gate complete:

- [ ] **Drift manifests current** — if any reference file was modified, verify the corresponding row in the scope's drift manifest still reflects the correct source doc path and line range
- [ ] **Parity maintained** — if any shared-copy file was modified, verify all copies in the copy group remain identical (parity report confirms this)
- [ ] **No new OPEN findings** — all CF-NNN findings generated in this gate run have been recorded in the finding register; none remain without a proposed fix
- [ ] **Gate report saved** — if the gate produced a findings report, confirm it is saved to `.specs/reports/` and linked in the relevant CF-NNN Gate Rerun Record fields
- [ ] **PRD updated** — if findings affect an active implementation phase, update the PRD issue (GitHub #56) with the new finding count
