---
name: cursor-initializer-quality-gate
description: "Performs a complete quality gate analysis of the cursor-initializer plugin. Validates all artifacts against documented conventions, checks intra-plugin shared-copy parity, evaluates red-green test scenarios, and generates a structured findings report compatible with /prp-core:prp-prd when issues are found."
---

# Cursor-Initializer Quality Gate Analysis

Perform a complete quality gate of the cursor-initializer plugin. This meta-skill validates every
artifact against documented Cursor-platform conventions, verifies intra-plugin parity,
and evaluates whether skills are structurally capable of passing all test scenarios.

**Scope:** `plugins/cursor-initializer/` — SKILL.md files, agent files, references, templates

**Convention sources:** `.claude/rules/cursor-plugin-skills.md`, `DESIGN-GUIDELINES.md`

**Test scenarios:** `.claude/PRPs/tests/scenarios/` (init-simple-project, init-complex-monorepo, improve-reasonable-file, improve-bloated-file)

**Report output:** `.specs/reports/cursor-quality-gate-[YYYY-MM-DD]-findings.md` (if issues found)

---

## Phase 1: Static Artifact Inspection

Read `.claude/skills/cursor-initializer-quality-gate/agents/artifact-inspector.md`. Skip the YAML frontmatter block (the content between the first and second `---` delimiters) — it is documentation metadata only. Pass the remaining content as the task to a general-purpose agent via the Task tool.

**Wait for completion.** Collect structured output as `artifact_report`, which contains:
- Compliance matrix per category (Plugin SKILL.md, Cursor Agent Files, Reference Files, Templates)
- Violation list: file path, rule violated, rule source, severity (CRITICAL/MAJOR/MINOR), evidence

---

## Phase 2: Cross-Copy Parity Check

Read `.claude/skills/cursor-initializer-quality-gate/agents/parity-checker.md`. Skip the YAML frontmatter block. Pass the remaining content as the task to a general-purpose agent via the Task tool.

**Wait for completion.** Collect structured output as `parity_report`, which contains:
- Parity matrix: each shared file group with MATCH/MISMATCH status and copy count
- Divergence list: file pair, nature of difference, diff excerpt

---

## Phase 3: Red-Green Test Evaluation

Read `.claude/skills/cursor-initializer-quality-gate/agents/scenario-evaluator.md`. Skip the YAML frontmatter block. Use the remaining content as the base evaluator instructions.

**Spawn all 4 agents simultaneously in a single response** using the Task tool (one call per scenario — do not wait between them). For each agent, combine the scenario-evaluator instructions with this appended instruction:

> **Your scenario to evaluate:** Read the scenario file at `[SCENARIO_PATH]` and evaluate the cursor-initializer plugin version of the target skill.

| Agent | Scenario Path |
|-------|--------------|
| Agent 1 | `.claude/PRPs/tests/scenarios/init-simple-project.md` |
| Agent 2 | `.claude/PRPs/tests/scenarios/init-complex-monorepo.md` |
| Agent 3 | `.claude/PRPs/tests/scenarios/improve-reasonable-file.md` |
| Agent 4 | `.claude/PRPs/tests/scenarios/improve-bloated-file.md` |

**Wait for all 4 to complete.** Collect outputs as `scenario_reports[1..4]`. Each contains:
- Scenario ID, target skill(s), RED baseline description
- GREEN assessment: does the cursor skill handle this scenario correctly?
- PASS/FAIL verdict with evidence
- Gaps: guidance missing from skill that would cause a failure

---

## Phase 4: Findings Synthesis

Aggregate all outputs from Phases 1, 2, and 3.

Read `.claude/skills/cursor-initializer-quality-gate/references/quality-gate-criteria.md` Section `## Expected Results Checklist`. Cross-reference the category headings in the checklist against the Phase 1–3 results to confirm every category was covered.

Compute and display the **Quality Gate Dashboard**:

```
Quality Gate Dashboard — cursor-initializer [DATE]
═══════════════════════════════════════════════════
Category                    Checks  Passed  Failed  Status
─────────────────────────────────────────────────────────
Static Artifact Compliance    [N]     [N]     [N]   [PASS/FAIL]
Cross-Copy Parity             [N]     [N]     [N]   [PASS/FAIL]
Red-Green Test Coverage         4     [N]     [N]   [PASS/FAIL]
─────────────────────────────────────────────────────────
OVERALL                       [N]     [N]     [N]   [PASS/FAIL]
═══════════════════════════════════════════════════
```

**If all checks pass:**
> ✅ Quality Gate PASSED — All [N] checks passed. All artifacts comply with documented cursor-initializer conventions and all test scenarios evaluate as GREEN.

**Stop here. Do NOT write any report file to `.specs/reports/`.**

**If any checks fail:** Proceed to Phase 5.

---

## Phase 5: Findings Report

Generate `.specs/reports/cursor-quality-gate-[YYYY-MM-DD]-findings.md`.

Read `.claude/skills/cursor-initializer-quality-gate/references/quality-gate-criteria.md` Section "## Report Template" for the exact document structure to follow.

For each finding, assign a Finding ID (F001, F002, ...) and document:
1. **Artifact**: file path affected
2. **Rule Violated**: exact rule text from convention source
3. **Rule Source**: document and section where the rule is defined
4. **Current State**: what the artifact currently contains (quote evidence)
5. **Expected State**: what it should contain per documentation
6. **Impact**: what degrades or breaks if not fixed
7. **Proposed Fix**: specific action to resolve

Group related findings into **Improvement Areas**. Each Improvement Area becomes a candidate PRD work item.

Close the report with a **PRD Brief** section pre-formatted as input for `/prp-core:prp-prd`.

After writing the file, report:
> ⚠️ Quality Gate FAILED — [N] finding(s) across [N] category(ies).
> Findings report: `.specs/reports/cursor-quality-gate-[date]-findings.md`
> Next step: Run `/prp-core:prp-prd` with this findings file to create a remediation PRD.

---

## Regression Checkpoint

Before declaring the gate complete, confirm the following against
`docs/compliance/regression-prevention-workflow.md`:

- [ ] No reference file modified during this session without a corresponding drift manifest update
- [ ] No cursor agent file promoted from `readonly: true` — verify all agents still have `readonly: true` and no `tools:` or `maxTurns:` fields
- [ ] No cross-platform contamination: no Claude-specific fields (`.claude/rules/`, `paths:`) present in any cursor artifact
- [ ] Parity report confirms all intended shared copies within cursor-initializer remain byte-identical
