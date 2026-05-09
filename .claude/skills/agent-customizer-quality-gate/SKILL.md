---
name: agent-customizer-quality-gate
description: 'Quality-gate audit of agent-customizer plugin: convention compliance, parity, docs drift, red-green tests. Outputs PRD-compatible findings.'
---

# Quality Gate Analysis — agent-customizer Plugin

Perform a complete quality gate of the agent-customizer plugin. This meta-skill validates every
artifact against documented conventions, verifies intra-plugin shared-copy consistency, detects
docs drift, and evaluates whether all 8 skills are structurally capable of passing all test scenarios.

**Scope:** `plugins/agent-customizer/` — 8 SKILL.md files, 6 agent files, 34+ reference files,
8 template directories, plugin manifest

**Convention sources:** `.claude/rules/plugin-skills.md`, `.claude/rules/reference-files.md`,
`.claude/rules/agent-files.md`, `plugins/agent-customizer/CLAUDE.md`

**Test scenarios:** `.claude/PRPs/tests/scenarios/` (S5–S8, 4 families × 4 artifact types)

**Report output:** `.specs/reports/agent-customizer-quality-gate-[YYYY-MM-DD]-findings.md` (if issues found)

---

## Phase 1: Static Artifact Inspection

Read `.claude/skills/agent-customizer-quality-gate/agents/artifact-inspector.md`. Skip the YAML
frontmatter block (between the first and second `---` delimiters). Pass the remaining content as
the task to a general-purpose agent via the Task tool.

**Wait for completion.** Collect structured output as `artifact_report`, which contains:
- Compliance matrix per category (Plugin SKILL.md × 8, Agents × 6, Reference Files, Templates, Manifest)
- Violation list: file path, rule violated, rule source, severity (CRITICAL/MAJOR/MINOR), evidence

---

## Phase 2: Intra-Plugin Shared-Copy Parity

Read `.claude/skills/agent-customizer-quality-gate/agents/parity-checker.md`. Skip the YAML
frontmatter block. Pass the remaining content as the task to a general-purpose agent via the Task tool.

**Wait for completion.** Collect structured output as `parity_report`, which contains:
- Parity matrix: 14 shared file groups with MATCH/MISMATCH status
- Divergence list: file pair, nature of difference, diff excerpt

---

## Phase 3: Docs Drift Detection

Delegate to the existing docs-drift-checker agent registered in the agent-customizer plugin:
`plugins/agent-customizer/agents/docs-drift-checker.md`

Pass the manifest file as input: `plugins/agent-customizer/docs-drift-manifest.md`

Skip the YAML frontmatter block. Pass the remaining content as the task to a general-purpose
agent via the Task tool, with this appended instruction:

> **Manifest to check:** Read `plugins/agent-customizer/docs-drift-manifest.md` and verify all
> source docs and line ranges it cites.

**Wait for completion.** Collect structured output as `drift_report`, which contains:
- Alignment status per reference file in the manifest
- Drift findings: source doc paths, line range shifts, content claim mismatches

---

## Phase 4: Red-Green Scenario Evaluation

Read `.claude/skills/agent-customizer-quality-gate/agents/scenario-evaluator.md`. Skip the YAML
frontmatter block. Use the remaining content as base evaluator instructions.

**Spawn all 4 agents simultaneously in a single response** (one call per scenario). For each,
combine the evaluator instructions with this appended instruction:

> **Your scenario to evaluate:** Read the scenario file at `[SCENARIO_PATH]` and evaluate all
> 4 artifact types within it.

| Agent | Scenario Path |
|-------|--------------|
| Agent 1 | `.claude/PRPs/tests/scenarios/create-simple-artifact.md` |
| Agent 2 | `.claude/PRPs/tests/scenarios/create-complex-artifact.md` |
| Agent 3 | `.claude/PRPs/tests/scenarios/improve-bloated-artifact.md` |
| Agent 4 | `.claude/PRPs/tests/scenarios/improve-reasonable-artifact.md` |

**Wait for all 4 to complete.** Collect outputs as `scenario_reports[1..4]`.

---

## Phase 5: Findings Synthesis

Aggregate all outputs from Phases 1–4.

Read `.claude/skills/agent-customizer-quality-gate/references/quality-gate-criteria.md`
Sections `## Plugin SKILL.md Checks`, `## Agent File Checks`, `## Reference File Checks`,
`## Shared-Copy Parity Checks`, `## Docs Drift Checks`, `## Scenario Checks`, and
`## Plugin Manifest Checks`. Cross-reference those category headings against Phase 1–4
results to confirm full coverage.

Compute and display the **Quality Gate Dashboard**:

```
Quality Gate Dashboard — agent-customizer [DATE]
═══════════════════════════════════════════════════════════
Category                         Checks  Passed  Failed  Status
─────────────────────────────────────────────────────────────
Static Artifact Compliance          [N]    [N]     [N]   [PASS/FAIL]
Intra-Plugin Parity                  14    [N]     [N]   [PASS/FAIL]
Docs Drift                          [N]    [N]     [N]   [PASS/FAIL]
Red-Green Scenario Coverage          16    [N]     [N]   [PASS/FAIL]
Plugin Manifest                       3    [N]     [N]   [PASS/FAIL]
─────────────────────────────────────────────────────────────
OVERALL                             [N]    [N]     [N]   [PASS/FAIL]
═══════════════════════════════════════════════════════════
```

**If all checks pass:**
> ✅ Quality Gate PASSED — All [N] checks passed. All artifacts comply with documented conventions
> and all test scenarios evaluate as GREEN.

**Stop here. Do NOT write any report file.**

**If any checks fail:** generate `.specs/reports/agent-customizer-quality-gate-[YYYY-MM-DD]-findings.md`.

Read the `## Report Template` section from the criteria reference for the exact document structure.

For each finding, document: Artifact, Rule Violated, Rule Source, Current State, Expected State,
Impact, Proposed Fix. Group findings into Improvement Areas. Close with a PRD Brief section
pre-formatted for `/prp-core:prp-prd`.

After writing the file, report:
> ⚠️ Quality Gate FAILED — [N] finding(s) across [N] category(ies).
> Findings report: `.specs/reports/agent-customizer-quality-gate-[DATE]-findings.md`
> Next step: Run `/prp-core:prp-prd` with this findings file to create a remediation PRD.

---

## Regression Checkpoint

After the gate completes, confirm the following before closing the session:

1. **Drift manifest current** — if any agent-customizer reference file was modified this session,
   verify its row in `plugins/agent-customizer/docs-drift-manifest.md` still reflects the correct
   source path and line range.
2. **Parity families intact** — if any shared-copy reference was changed, verify all copies in the
   parity family remain in sync (see `docs/compliance/regression-prevention-workflow.md`
   § Change Type Matrix).
3. **No new convention gaps** — if a new skill, agent, or reference was added, confirm it either
   appears in the next quality gate run scope or is tracked in a pending PRD.

If any item above is unresolved, file a follow-up issue before merging.
