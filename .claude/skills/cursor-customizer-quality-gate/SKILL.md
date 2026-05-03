---
name: cursor-customizer-quality-gate
description: "Performs a complete quality gate analysis of the cursor-customizer plugin. Validates all artifacts against documented Cursor-platform conventions, checks intra-plugin shared-copy parity, runs docs drift detection, evaluates red-green test scenarios, and generates a structured findings report compatible with /prp-core:prp-prd when issues are found."
---

# Cursor-Customizer Quality Gate Analysis

Perform a complete quality gate of the cursor-customizer plugin. This meta-skill validates every
artifact against documented Cursor-platform conventions, verifies intra-plugin shared-copy
consistency, detects docs drift via the plugin's own `docs-drift-checker` subagent, and evaluates
whether all 8 skills are structurally capable of passing all test scenarios.

**Scope:** `plugins/cursor-customizer/` — 8 SKILL.md files, 6 Cursor-native subagent files,
30+ reference files, 8 template directories, plugin manifest, and the docs drift manifest.

**Convention sources:**
`.claude/rules/cursor-plugin-skills.md`, `.claude/rules/reference-files.md`,
`plugins/cursor-customizer/CONVENTIONS.md`, `docs/adr/0001-cursor-distribution-rules-first.md`,
`docs/adr/0002-product-strict-research-foundation.md`,
`docs/adr/0003-cursor-skills-default-path.md`.

**Test scenarios:** `.claude/PRPs/tests/scenarios/` — `create-simple-artifact.md`,
`create-complex-artifact.md`, `improve-bloated-artifact.md`, `improve-reasonable-artifact.md`
(four families × four artifact types each).

**Report output:** `.specs/reports/cursor-customizer-quality-gate-[YYYY-MM-DD]-findings.md`
(only generated when issues are found).

---

## Phase 1: Static Artifact Inspection

Read `.claude/skills/cursor-customizer-quality-gate/agents/artifact-inspector.md`. Skip the YAML
frontmatter block (the content between the first and second `---` delimiters) — it is documentation
metadata only. Pass the remaining content as the task to a general-purpose agent via the Task tool.

**Wait for completion.** Collect structured output as `artifact_report`, which contains:
- Compliance matrix per category (Plugin SKILL.md × 8, Cursor Subagents × 6, Reference Files,
  Templates × 8 dirs, Plugin Manifest, Drift Manifest)
- Violation list: file path, rule violated, rule source, severity (CRITICAL/MAJOR/MINOR), evidence

---

## Phase 2: Intra-Plugin Shared-Copy Parity

Read `.claude/skills/cursor-customizer-quality-gate/agents/parity-checker.md`. Skip the YAML
frontmatter block. Pass the remaining content as the task to a general-purpose agent via the Task tool.

**Wait for completion.** Collect structured output as `parity_report`, which contains:
- Parity matrix: 19 shared file groups with MATCH/MISMATCH status
- Divergence list: file pair, nature of difference, diff excerpt

---

## Phase 3: Docs Drift Detection

Delegate to the existing `docs-drift-checker` subagent registered in the cursor-customizer plugin:
`plugins/cursor-customizer/agents/docs-drift-checker.md`.

The subagent's frontmatter is Cursor-native and forbids spawning other agents. Skip the YAML
frontmatter block. Pass the remaining content as the task to a general-purpose agent via the
Task tool, with this appended instruction:

> **Manifest to check:** Read `plugins/cursor-customizer/docs-drift-manifest.md` and verify all
> source documents and section attributions it cites for every reference file under
> `plugins/cursor-customizer/skills/*/references/`.

**Wait for completion.** Collect structured output as `drift_report`, which contains:
- Per-row drift status: `{reference_file, source_doc, cited_range, drift_status, evidence}`
- Inventory audit: any `UNREGISTERED` or `MISSING_FILE` entries
- Overall status: `CLEAN` or `DRIFT_DETECTED`

---

## Phase 4: Red-Green Scenario Evaluation

Read `.claude/skills/cursor-customizer-quality-gate/agents/scenario-evaluator.md`. Skip the YAML
frontmatter block. Use the remaining content as base evaluator instructions.

**Spawn all 4 agents simultaneously in a single response** using the Task tool (one call per scenario
— do not wait between them). For each agent, combine the scenario-evaluator instructions with this
appended instruction:

> **Your scenario to evaluate:** Read the scenario file at `[SCENARIO_PATH]` and evaluate the
> cursor-customizer plugin version of all 4 artifact types covered by it.

| Agent | Scenario Path |
|-------|--------------|
| Agent 1 | `.claude/PRPs/tests/scenarios/create-simple-artifact.md` |
| Agent 2 | `.claude/PRPs/tests/scenarios/create-complex-artifact.md` |
| Agent 3 | `.claude/PRPs/tests/scenarios/improve-bloated-artifact.md` |
| Agent 4 | `.claude/PRPs/tests/scenarios/improve-reasonable-artifact.md` |

**Wait for all 4 to complete.** Collect outputs as `scenario_reports[1..4]`. Each contains:
- Scenario ID, target skills, RED baseline description
- GREEN assessment per artifact type: PASS / FAIL / PARTIAL
- Gap list: guidance missing from skill that would cause a failure

---

## Phase 5: Findings Synthesis

Aggregate all outputs from Phases 1–4.

Read `.claude/skills/cursor-customizer-quality-gate/references/quality-gate-criteria.md` Sections
`## Plugin SKILL.md Checks`, `## Cursor Subagent Checks`, `## Reference File Checks`,
`## Template File Checks`, `## Intra-Plugin Parity Checks`, `## Docs Drift Checks`,
`## Red-Green Scenario Checks`, `## Plugin Manifest Checks`, and
`## Known-Accepted Exceptions`. Cross-reference those category headings against Phase 1–4 results
to confirm full coverage. Apply the documented known-accepted exceptions before classifying
findings — those exceptions must NOT appear as violations in the final report.

Compute and display the **Quality Gate Dashboard**:

```
Quality Gate Dashboard — cursor-customizer [DATE]
═══════════════════════════════════════════════════════════
Category                         Checks  Passed  Failed  Status
─────────────────────────────────────────────────────────────
Static Artifact Compliance          [N]    [N]     [N]   [PASS/FAIL]
Intra-Plugin Parity                  19    [N]     [N]   [PASS/FAIL]
Docs Drift                          [N]    [N]     [N]   [PASS/FAIL]
Red-Green Scenario Coverage          16    [N]     [N]   [PASS/FAIL]
Plugin Manifest                       3    [N]     [N]   [PASS/FAIL]
─────────────────────────────────────────────────────────────
OVERALL                             [N]    [N]     [N]   [PASS/FAIL]
═══════════════════════════════════════════════════════════
```

**If all checks pass:**
> Quality Gate PASSED — All [N] checks passed. All artifacts comply with documented
> cursor-customizer conventions and all test scenarios evaluate as GREEN.

**Stop here. Do NOT write any report file.**

**If any checks fail:** generate
`.specs/reports/cursor-customizer-quality-gate-[YYYY-MM-DD]-findings.md`.

Read the `## Report Template` section from the criteria reference for the exact document structure.

For each finding, document: Artifact, Rule Violated, Rule Source, Current State, Expected State,
Impact, Proposed Fix. Group findings into Improvement Areas. Close with a PRD Brief section
pre-formatted for `/prp-core:prp-prd`.

After writing the file, report:
> Quality Gate FAILED — [N] finding(s) across [N] category(ies).
> Findings report: `.specs/reports/cursor-customizer-quality-gate-[DATE]-findings.md`
> Next step: Run `/prp-core:prp-prd` with this findings file to create a remediation PRD.

---

## Regression Checkpoint

Before declaring the gate complete, confirm the following against
`docs/compliance/regression-prevention-workflow.md` (where applicable):

1. **Drift manifest current** — if any cursor-customizer reference file was modified during this
   session, verify its row in `plugins/cursor-customizer/docs-drift-manifest.md` still reflects
   the correct source path and cited section/range.
2. **Parity families intact** — if any shared-copy reference or template was changed, verify all
   copies in the parity family remain in sync per the parity matrix in Phase 2.
3. **Cursor frontmatter posture intact** — every file in `plugins/cursor-customizer/agents/`
   still uses Cursor-native frontmatter exclusively (`name`, `description`, `model: inherit`,
   `readonly: true`); none has been promoted to include `tools:`, `maxTurns:`, or `paths:`.
4. **No Claude-Code contamination** — no slice-authored cursor-customizer artifact contains
   banned tokens (see `## Product-Strict Textual Compliance` in the criteria reference), with
   the documented known-accepted exceptions applied.

If any item above is unresolved, file a follow-up issue before merging.
