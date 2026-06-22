---
name: cursor-code-documentation-quality-gate
description: "Performs a complete quality gate analysis of the cursor-code-documentation plugin. Validates its three artifacts (the always-apply rule, the two manual-only skills, the plugin manifest) against documented conventions, checks marketplace parity and the version cascade, confirms no docs drift, evaluates the red-green behavior scenarios, and generates a structured findings report compatible with /prp-core:prp-prd when issues are found."
---

# Cursor-Code-Documentation Quality Gate Analysis

Perform a complete quality gate of the `cursor-code-documentation` plugin — the
first deployable-behavior plugin in this marketplace (it *ships* a rule + skills
consumed on install, rather than *generating* artifacts into a target project).
This meta-skill validates every artifact against documented conventions, confirms
marketplace parity and the version cascade, and evaluates whether the plugin's
external behavior passes all red-green scenarios.

This gate is **scaled to three artifacts** (rule + 2 skills + manifest) — it is
deliberately NOT a six-phase clone of the generator-plugin gates, and it does NOT
delegate phases to inspector subagents (none exist for this plugin). Run every
check inline against the criteria reference.

**Scope:** `plugins/cursor-code-documentation/` — the `.cursor/rules/document-as-you-code.mdc`
rule, `skills/code-explain/SKILL.md`, `skills/doc-generate/SKILL.md`, and
`.cursor-plugin/plugin.json`. Plus the repo-root `.cursor-plugin/marketplace.json`
and root `README.md` for parity.

**Convention sources:** `.claude/rules/plugin-versioning.md`,
`.claude/rules/readme-files.md`,
`docs/adr/0016-cursor-code-documentation-rule-not-hook.md`. The two manual-only
skills are authored per the `/writing-great-skills` methodology and are an
explicit, recorded exception to the ADR-0007 semantic-tag convention (see
ADR-0016 and the "Recorded exceptions" note in
`wiki/knowledge/skill-body-convention.md`) — this gate validates them against the
writing-great-skills authoring bar, **not** the semantic-tag vocabulary.

**Do NOT apply generator-skill checks.** The `references/` directory,
`assets/templates/` directory, `validation-criteria.md` reference, delegate-to-analyzer
phase, and intra-plugin shared-copy parity are conventions for the
cursor-initializer / cursor-customizer *generators*. The two manual-only skills here
have none of those by design. Importing those checks would wrongly FAIL the gate.

**Report output:** `.specs/reports/cursor-code-documentation-quality-gate-[YYYY-MM-DD]-findings.md`
(only generated when issues are found).

---

## Phase 1: Static Artifact Conformance

Read `.claude/skills/cursor-code-documentation-quality-gate/references/quality-gate-criteria.md`
sections "Rule Checks", "Per-Skill Checks", and "Manifest Checks". Apply each
check inline against the live artifacts.

**The rule** — `plugins/cursor-code-documentation/.cursor/rules/document-as-you-code.mdc`:
apply checks R1–R5. Confirm `alwaysApply: true`, Cursor-native frontmatter keys
only (`description`, `alwaysApply`, `globs` — NO Claude `paths:`), and the body
stays within the ≤30-line budget naming the language→format mapping.

**Each skill** — `plugins/cursor-code-documentation/skills/{code-explain,doc-generate}/SKILL.md`:
apply checks S1–S7. Confirm `name` equals the folder name, `disable-model-invocation: true`
is present, and the frontmatter is valid. These skills are authored per
`/writing-great-skills` (ADR-0016 exception to ADR-0007), so validate the body
against the **writing-great-skills authoring bar — NOT semantic tags**: a
human-facing `description` (a one-line summary with no trigger lists, since the
skill is user-invoked), an ordered process whose steps each carry a checkable
completion criterion, and the explain↔generate role boundary stated once (single
source of truth). Do **not** require or flag the absence of `<TRIGGER>`/
`<BEHAVIOUR>`/`<HARD_RULES>`/`<PROCESS>`/`<PHASE>` tags.

**The manifest** — `plugins/cursor-code-documentation/.cursor-plugin/plugin.json`:
apply checks M1–M4. Confirm `name` equals `cursor-code-documentation`, the file is
valid JSON, and `version` + `description` are present.

Record each check as PASS/FAIL with evidence (file path + quoted line). Classify
any failure by the Severity table in the criteria reference.

---

## Phase 2: Marketplace Parity + Version Cascade

Read the criteria reference sections "Marketplace-Parity Checks" and
"Version-Cascade Checks". Apply each check inline.

**Marketplace parity** — `.cursor-plugin/marketplace.json`:
- The plugin is registered in the `plugins[]` array (check MP1).
- Its entry matches the existing-sibling shape — `name` + `source` + `description`,
  with `source` equal to the bare directory name `cursor-code-documentation`, and
  carrying **NO per-entry `version` field** (check MP2). Assert shape parity with
  the sibling entries, not a hardcoded key count.

**Version cascade**:
- `.cursor-plugin/marketplace.json` `metadata.version` reflects the
  `plugins[]` addition — bumped MINOR from the pre-registration baseline (check
  VC1). Assert the rule, not a hardcoded number.
- `plugins/cursor-code-documentation/.cursor-plugin/plugin.json` `version` is
  present, valid SemVer, and consistent with the changes made under
  `plugins/cursor-code-documentation/**` per the versioning ladder (check VC2).
  Do NOT assert a fixed value: any change under that tree bumps it, so the
  manifest legitimately advances past `1.0.0` (e.g. README/skill edits in the
  same integration branch).
- Do NOT check `.claude-plugin/marketplace.json` — cascade rule (2) is
  Claude-Code-only; this Cursor plugin is not in the Claude registry.

**Root README parity** — root `README.md`:
- A Distributions-table row for `cursor-code-documentation` exists (check MP3).
- An install one-liner block linking to the plugin README exists (check MP4).

Record each check as PASS/FAIL with evidence.

---

## Phase 3: Docs-Drift — Documented N/A

This plugin has **NO `references/` directory** and **NO `docs/cursor` reference
mirrors** to drift against — it ships live behavior, not generated artifacts
derived from a documentation corpus. There is no `docs-drift-checker` subagent for
this plugin; do NOT attempt to delegate to one.

Record this phase as **CLEAN (N/A by design)** — a documented no-op, not a skipped
check. If a future revision adds a `references/` directory or a `docs/cursor`
mirror, this phase must be upgraded to a real drift check.

---

## Phase 4: Red-Green Scenario Evaluation

Read the criteria reference section "Red-Green Scenario Table". Evaluate each of
the four behavior scenarios inline against the shipped artifacts. Each is
GREEN-expected for the implemented plugin.

| # | Scenario | GREEN assertion |
|---|----------|-----------------|
| G1 | Edit/create a code symbol | The always-apply rule fires every turn and maps the language to its idiomatic doc format (Java→Javadoc, JS/TS→JSDoc, Python→docstring, shell→header comment). |
| G2 | `/code-explain` invoked | The `code-explain` skill produces the three-section structured explanation (Overview, Key Concepts, Step-by-Step Breakdown). |
| G3 | `/doc-generate` invoked | The `doc-generate` skill produces the requested documentation artifact (API docs, README section, or inline doc-strings). |
| G4 | Mid-edit, no explicit `/command` | Neither manual skill auto-fires — `disable-model-invocation: true` is present on both skills, so the model does not auto-invoke them. |

For each scenario, confirm the relevant artifact contains the guidance/frontmatter
that makes the assertion hold, and record PASS/FAIL with evidence (the rule body
for G1, each skill's Process section for G2/G3, the `disable-model-invocation`
frontmatter for G4).

---

## Phase 5: Findings Synthesis

Aggregate all results from Phases 1, 2, 3, and 4.

Compute and display the **Quality Gate Dashboard**:

```
Quality Gate Dashboard — cursor-code-documentation [DATE]
═══════════════════════════════════════════════════════════
Category                          Checks  Passed  Failed  Status
──────────────────────────────────────────────────────────
Static Artifact Conformance         [N]     [N]     [N]   [PASS/FAIL]
Marketplace Parity + Version        [N]     [N]     [N]   [PASS/FAIL]
Docs-Drift (N/A by design)            1       1       0    PASS
Red-Green Scenario Evaluation         4     [N]     [N]   [PASS/FAIL]
──────────────────────────────────────────────────────────
OVERALL                             [N]     [N]     [N]   [PASS/FAIL]
═══════════════════════════════════════════════════════════
```

**If all checks pass:**
> ✅ Quality Gate PASSED — All [N] checks passed. All three artifacts comply with
> documented cursor-code-documentation conventions, the marketplace registration
> and version cascade are correct, and all four red-green scenarios evaluate as GREEN.

**Stop here. Do NOT write any report file to `.specs/reports/`.**

**If any checks fail:** generate `.specs/reports/cursor-code-documentation-quality-gate-[YYYY-MM-DD]-findings.md`.

Read the criteria reference section "## Report Template" for the exact document
structure to follow. For each finding, assign a Finding ID (F001, F002, …) and
document: the artifact path, the rule violated, the rule source, the current state
(quote evidence), the expected state, the impact, and the proposed fix. Group
related findings into Improvement Areas, and close the report with a PRD Brief
section pre-formatted as input for `/prp-core:prp-prd`.

After writing the file, report:
> ⚠️ Quality Gate FAILED — [N] finding(s) across [N] category(ies).
> Findings report: `.specs/reports/cursor-code-documentation-quality-gate-[date]-findings.md`
> Next step: Run `/prp-core:prp-prd` with this findings file to create a remediation PRD.

---

## Regression Checkpoint

Before declaring the gate complete, confirm:

- [ ] No generator-skill check (`references/` dir, `assets/templates/` dir,
      `validation-criteria.md`, delegate-to-analyzer, intra-plugin shared-copy parity)
      was applied to the manual-only skills — those conventions govern the
      cursor-initializer / cursor-customizer generators, not this deployable-behavior plugin.
- [ ] The skills were judged against the writing-great-skills authoring bar
      (human-facing description, ordered process with checkable completion criteria,
      role boundary), NOT the semantic-tag vocabulary — no skill was flagged for
      lacking `<TRIGGER>`/`<BEHAVIOUR>`/`<HARD_RULES>`/`<PROCESS>`/`<PHASE>` tags
      (ADR-0016 exception to ADR-0007).
- [ ] No Claude-specific field (`paths:`) was required of, or found in, any Cursor artifact.
- [ ] The version-cascade check asserted the RULE, not fixed numbers — `metadata.version`
      reflects the `plugins[]` addition and `plugin.json` advances per the ladder for
      changes under `plugins/cursor-code-documentation/**`; it did NOT pin `plugin.json` to 1.0.0.
- [ ] The marketplace-parity check asserted sibling-shape parity with NO per-entry
      version field — not a hardcoded key count.
