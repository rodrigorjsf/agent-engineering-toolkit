# Finding Model and Validator Protocol

> **Status**: Active
> **Source**: [PRD #56 — Repository Compliance Program](https://github.com/rodrigorjsf/agent-engineering-toolkit/issues/56), Phase 3
> **Scope**: Standardized finding model, validator execution protocol, and correction lifecycle for compliance auditing

## Contents

- [1. Purpose and Relationship to Prior Phases](#1-purpose-and-relationship-to-prior-phases)
- [2. Extended Compliance Finding Record](#2-extended-compliance-finding-record)
- [3. Check Categories](#3-check-categories)
- [4. Severity Floor Matrix](#4-severity-floor-matrix)
- [5. Validator Execution Protocol](#5-validator-execution-protocol)
- [6. Correction Loop Contract](#6-correction-loop-contract)
- [7. Compliance Audit Report Format](#7-compliance-audit-report-format)
- [8. Integration with Existing Quality Gates](#8-integration-with-existing-quality-gates)

---

## 1. Purpose and Relationship to Prior Phases

This document is Phase 3 of the Repository Compliance Program. Phase 1 ([`normative-source-matrix.md`](normative-source-matrix.md)) established the authority model — which sources are normative per scope and artifact type. Phase 2 ([`artifact-audit-manifest.md`](artifact-audit-manifest.md)) inventoried all in-scope artifacts and assigned validators to each.

Phase 3 defines **HOW** to validate, record, correct, and certify: the extended finding format (CF-NNN), six check categories, severity floors, a seven-step validator execution protocol, and a five-state correction loop. This document is consumed by Phase 4–9 auditors.

The existing quality gates produce F001 findings (8 fields, defined in `.claude/skills/quality-gate/references/quality-gate-criteria.md:127-138`). This protocol **extends** F001 with compliance-specific fields. When a quality gate is the validator, its F001 findings are wrapped in CF-NNN records with the additional compliance fields.

---

## 2. Extended Compliance Finding Record

The CF-NNN prefix distinguishes compliance findings from quality gate findings (F001), preventing ID collisions when both systems cover the same artifact.

```
### CF-NNN — [Short Title] [CRITICAL/MAJOR/MINOR]

- **Check Category**: Contamination | Self-Sufficiency | Normative-Alignment | Parity | Drift | Provenance
- **Scope**: [scope ID from normative-source-matrix.md § Scope Registry]
- **Artifact**: `[file path]`
- **Evidence**: `[path:line[-line]]` — "[short quoted snippet]"
- **Violated Source**: [normative source ID or validator code] — "[exact rule text]"
- **Current State**: [what the artifact currently contains]
- **Expected State**: [what it should contain per normative source]
- **Impact**: [what degrades or breaks without fixing]
- **Proposed Fix**: [specific action — add/change/remove/localize]
- **Correction Notes**: [what was done to fix — filled after correction]
- **Provenance**: [for localized copies: "Distilled from [source]:lines [N-M]" — or "N/A"]
- **Revalidation Method**: [automated-gate-pass | automated-gate-fail | manual-auditor-rerun | instruction-only/manual-validator | no-validator-available]
- **Revalidation Evidence**: [gate report path, manual check description, or "pending"]
- **Gate Rerun Record**: [reference to quality gate report, or "N/A — no gate covers this artifact"]
```

**CF-NNN findings extend — not replace — the F001 format used by existing quality gates.** When a quality gate is the validator, the gate's F001 finding is wrapped in a CF-NNN record with the additional compliance fields.

| Field | Filled At | Purpose |
|-------|-----------|---------|
| Check Category through Proposed Fix | Recording | Document the violation fully at time of discovery |
| Correction Notes | Correction | Record what was done to resolve the issue |
| Provenance | Recording | Attribution for localized/distilled content (N/A if original) |
| Revalidation Method + Revalidation Evidence | Revalidation | Distinguish automated gate vs manual verification |
| Gate Rerun Record | Closure | Confirm gate-level verification of the fix |

---

## 3. Check Categories

| Category | Description | Reference |
|----------|-------------|-----------|
| **Contamination** | Claude↔Cursor or Plugin↔Standalone isolation boundary violated | `normative-source-matrix.md` § Contamination Rules |
| **Self-Sufficiency** | Artifact depends on docs outside its own scope for operational behavior | PRD #56 Phase 3: no artifact blocked by external-scope docs |
| **Normative-Alignment** | Artifact does not match its normative source bundle | `normative-source-matrix.md` § Normative Matrix |
| **Parity** | Shared copy group members diverge from each other | `artifact-audit-manifest.md` § Shared Copy Group Registry |
| **Drift** | Reference file content has drifted from its source documentation | `artifact-audit-manifest.md` § Validator Coverage Matrix |
| **Provenance** | Localized (copied/distilled) content lacks attribution to its source | Applies to all localized copies in any scope |

A finding may carry multiple categories. For example, a localized copy that also lacks self-sufficiency receives both **Provenance** and **Self-Sufficiency**.

---

## 4. Severity Floor Matrix

| Category | Floor | Rationale |
|----------|-------|-----------|
| Contamination | minimum MAJOR | Claude leaking into Cursor or vice versa is never a minor concern |
| Self-Sufficiency | minimum MAJOR | Operational dependency on external scope blocks distribution |
| Normative-Alignment | *(no floor)* | Severity depends on the specific violation |
| Parity | minimum MAJOR | Shared copies that diverge break consistency guarantees |
| Drift | *(no floor)* | Severity depends on divergence scope and impact |
| Provenance | *(no floor)* | Missing attribution is a documentation gap, not structural |

**When the severity floor applies, auditors MUST NOT score a finding below the floor.** A contamination finding scored MINOR is itself a protocol violation.

---

## 5. Validator Execution Protocol

Apply these seven steps for each artifact. Steps 1–4 use the manifest's Validators column; Steps 5–7 are **universal mandatory checks for every artifact** regardless of listed validators.

**Step 1 — Resolve scope and bundle**: Look up the artifact's scope ID in `normative-source-matrix.md` § Scope Registry. Load the named source bundle from § Named Source Bundles (e.g., `claude-plugin-bundle` for agents-initializer). This determines Primary, Secondary, Project, Supporting, and Forbidden sources.

**Step 2 — Load artifact from manifest**: Find the artifact row in `artifact-audit-manifest.md` §§ 5–10. Note the Type, Validators, Copy Group, and Ph.7? columns.

**Step 3 — Apply validators**: Execute each validator in the Validators column. Expand codes using `artifact-audit-manifest.md` § Validator Code Legend (e.g., `r:ps` → `.claude/rules/plugin-skills.md`). For rule validators (`r:*`), check against the rule file. For instruction validators (`i:*`), check against the instruction file. For quality gate validators (`q:*`, `ac:*`), run the relevant gate phase.

**Step 4 — Record findings**: For each violation found, create a CF-NNN finding (Section 2) with fields through "Proposed Fix". Leave Correction Notes, Revalidation Evidence, and Gate Rerun Record blank until later lifecycle states.

**Step 5 — Check contamination**: Verify no Forbidden Sources appear in the artifact. Check both Claude↔Cursor and Plugin↔Standalone boundaries per `normative-source-matrix.md` § Contamination Rules. Any violation is a **Contamination** finding with minimum severity MAJOR.

**Step 6 — Check self-sufficiency**: Verify the artifact does not reference docs outside its scope root (`docs/`, `DESIGN-GUIDELINES.md`, or cross-distribution files) for operational behavior. Any such dependency is a **Self-Sufficiency** finding with minimum severity MAJOR.

**Step 7 — Check provenance**: For any artifact containing localized (copied or distilled) content, verify provenance attribution exists. Missing attribution is a **Provenance** finding.

---

## 6. Correction Loop Contract

```
OPEN → IN-PROGRESS → CORRECTED → REVALIDATED → CLOSED
```

| State | Entry Condition | Required Fields | Exit Condition | Actor |
|-------|----------------|-----------------|----------------|-------|
| OPEN | CF-NNN recorded | Fields 1–9 (Category through Proposed Fix) | Auditor begins correction | Auditor |
| IN-PROGRESS | Correction underway | — | Fix applied; Correction Notes filled | Implementer |
| CORRECTED | Fix applied | Correction Notes | Revalidation method and evidence recorded | Validator |
| REVALIDATED | Revalidation complete | Revalidation Method + Revalidation Evidence | Gate rerun confirms fix, or N/A recorded | Gate or auditor |
| CLOSED | Finding fully resolved | Gate Rerun Record | None — terminal state | Auditor |

**Revalidation Method enum:**

| Value | Meaning | Evidence |
|-------|---------|---------|
| `automated-gate-pass` | Gate rerun — artifact passed all relevant checks | Path to gate report file |
| `automated-gate-fail` | Gate rerun — artifact still fails; finding returns to IN-PROGRESS | Path to failing gate report |
| `manual-auditor-rerun` | No gate covers artifact; auditor manually re-checked | Description of manual verification steps |
| `instruction-only/manual-validator` | Only validators are `i:*` or `r:*`; no gate coverage | Description of what was checked against which sources |
| `no-validator-available` | No validator covers this artifact; best-effort check | Description of ad-hoc verification |

**Backward transitions are supported**: CORRECTED → IN-PROGRESS if revalidation fails; REVALIDATED → CORRECTED if a gate rerun reveals a regression. The only terminal state is CLOSED.

---

## 7. Compliance Audit Report Format

Report files: `docs/compliance/reports/compliance-audit-[scope]-[YYYY-MM-DD].md`

**7.1 Header** — Compliance Audit Report title, scope ID, audit date, auditor phase (4/5/6), total artifact count from manifest.

**7.2 Dashboard**

| Category | Total | CRITICAL | MAJOR | MINOR |
|----------|-------|----------|-------|-------|
| Contamination | … | … | … | … |
| Self-Sufficiency | … | … | … | … |
| Normative-Alignment | … | … | … | … |
| Parity | … | … | … | … |
| Drift | … | … | … | … |
| Provenance | … | … | … | … |
| **Total** | … | … | … | … |

> **Note — Phase 10 certification alternative:** Final certification reports covering multiple scopes and automated gates may use an aggregate pass/fail check-count table (rows by gate category + scope, columns: Total Checks / Passed / Failed / Status) instead of the finding-category format above. This aggregate format is valid when the report summarises automated gate run results rather than manual audit findings.

**7.3 Findings** — CF-NNN records ordered by severity (CRITICAL first), then by category.

**7.4 Correction Log**

| CF-NNN ID | State | Correction Date | Revalidation Method | Revalidation Date |
|-----------|-------|-----------------|--------------------|--------------------|

**7.5 Gate Rerun Summary**

| Gate | Scope | Run Date | Report Path | Result | Relevant CF-NNN IDs |
|------|-------|----------|-------------|--------|---------------------|

> **Note**: Phase 7 (parity/drift) produces cross-scope reports. Phases 4–6 produce scope-specific reports. Phase 10 produces a final certification report aggregating all scopes.

---

## 8. Integration with Existing Quality Gates

Existing quality gates (`quality-gate`, `agent-customizer-quality-gate`) continue to operate independently using the F001 format and `.specs/reports/` output path.

**When a gate is the validator for a compliance audit**: the auditor wraps each F001 finding in a CF-NNN record by adding Check Category, Scope, Evidence, Violated Source (as normative source ID), Provenance, Revalidation fields, and Gate Rerun Record.

**For non-gated artifacts** (see `artifact-audit-manifest.md` § 12 Validator Coverage Matrix, rows marked Gap): auditors produce CF-NNN findings directly using this protocol. No gate wrapping occurs. Gate rerun evidence references `.specs/reports/quality-gate-[YYYY-MM-DD]-findings.md` or `.specs/reports/agent-customizer-quality-gate-[YYYY-MM-DD]-findings.md`.

| Scope | Quality Gate | Automated Coverage | Manual-Only Artifacts |
|-------|-------------|-------------------|----------------------|
| agents-initializer | `quality-gate` | skill, agent, reference, template | plugin-manifest, config-file, readme |
| agent-customizer | `agent-customizer-quality-gate` | skill, agent, reference, template, drift-manifest | plugin-manifest, config-file, readme |
| cursor-initializer | **None** | — | **All artifacts** |
| cursor-customizer | `cursor-customizer-quality-gate` | skill, agent, reference, template, drift-manifest | plugin-manifest, config-file, readme |
| standalone | `quality-gate` (shared) | skill, reference, template | readme |
| repository-global | **None** | — | **All artifacts** |

See `artifact-audit-manifest.md` § 13 Quality Gate Coverage Map for detailed check-level coverage.
