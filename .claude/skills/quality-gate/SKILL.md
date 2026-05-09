---
name: quality-gate
description: 'Quality-gate audit of agents-initializer: convention compliance, cross-distribution parity, docs drift, red-green tests. Outputs PRD-compatible findings.'
---

# Quality Gate Analysis

Perform a complete quality gate of the agents-initializer project. This meta-skill validates every artifact against documented conventions, verifies cross-distribution consistency, and evaluates whether skills are structurally capable of passing all test scenarios.

**Distributions checked:**
- Plugin: `plugins/agents-initializer/` — SKILL.md files, agent files, references, templates
- Standalone: `skills/` — SKILL.md files, references, templates

**Convention sources:** `.claude/rules/`, `plugins/agents-initializer/CLAUDE.md`, `DESIGN-GUIDELINES.md`

**Routing guidance:** For platform-scoped validation, read `wiki/knowledge/compliance-routing.md` and the matching scope page (`wiki/knowledge/validation-routing-claude.md` for this skill) before loading convention files. They list the scope-specific source bundle, forbidden sources, and direct read paths.

**Test scenarios:** `.claude/PRPs/tests/scenarios/` (4 scenarios, init + improve)

**Report output:** `.specs/reports/quality-gate-[YYYY-MM-DD]-findings.md` (if issues found)

---

## Phase 1: Static Artifact Inspection

Read `.claude/skills/quality-gate/agents/artifact-inspector.md`. Skip the YAML frontmatter block (the content between the first and second `---` delimiters) — it is documentation metadata only. Pass the remaining content as the task to a general-purpose agent via the Task tool.

**Wait for completion.** Collect structured output as `artifact_report`, which contains:
- Compliance matrix per category (Plugin SKILL.md, Standalone SKILL.md, Reference Files, Agent Files, Templates)
- Violation list: file path, rule violated, rule source, severity (CRITICAL/MAJOR/MINOR), evidence

---

## Phase 2: Cross-Distribution Parity Check

Read `.claude/skills/quality-gate/agents/parity-checker.md`. Skip the YAML frontmatter block. Pass the remaining content as the task to a general-purpose agent via the Task tool.

**Wait for completion.** Collect structured output as `parity_report`, which contains:
- Parity matrix: each shared file group with MATCH/MISMATCH status and copy count
- Divergence list: file pair, nature of difference, diff excerpt

---

## Phase 3: Docs Drift Detection

Delegate to the shared docs-drift-checker agent:
`plugins/agent-customizer/agents/docs-drift-checker.md`

Skip the YAML frontmatter block. Pass the remaining content as the task to a general-purpose
agent via the Task tool, with this appended instruction:

> **Manifests to check:** Read `plugins/agents-initializer/docs-drift-manifest.md` and
> `skills/docs-drift-manifest.md`, then verify all source docs and line ranges cited in both.
> Ignore any hardcoded path to the agent-customizer manifest in the agent body — use the two
> manifests listed here instead.

**Wait for completion.** Collect structured output as `drift_report`, which contains:
- Alignment status per reference file in each manifest
- Drift findings: source doc paths, line range shifts, content claim mismatches

---

## Phase 4: Red-Green Test Evaluation

Read `.claude/skills/quality-gate/agents/scenario-evaluator.md`. Skip the YAML frontmatter block. Use the remaining content as the base evaluator instructions.

**Spawn all 4 agents simultaneously in a single response** using the Task tool (one call per scenario — do not wait between them). For each agent, combine the scenario-evaluator instructions with this appended instruction:

> **Your scenario to evaluate:** Read the scenario file at `[SCENARIO_PATH]` and evaluate both the plugin and standalone versions of the target skill.

| Agent | Scenario Path |
|-------|--------------|
| Agent 1 | `.claude/PRPs/tests/scenarios/init-simple-project.md` |
| Agent 2 | `.claude/PRPs/tests/scenarios/init-complex-monorepo.md` |
| Agent 3 | `.claude/PRPs/tests/scenarios/improve-reasonable-file.md` |
| Agent 4 | `.claude/PRPs/tests/scenarios/improve-bloated-file.md` |

**Wait for all 4 to complete.** Collect outputs as `scenario_reports[1..4]`. Each contains:
- Scenario ID, target skill(s), RED baseline description
- GREEN assessment: does the skill handle this scenario correctly?
- PASS/FAIL verdict with evidence
- Gaps: guidance missing from skill that would cause a failure

---

## Phase 5: Findings Synthesis

Aggregate all outputs from Phases 1, 2, 3, and 4.

Read `.claude/skills/quality-gate/references/quality-gate-criteria.md` Section `## Expected Results Checklist`. Cross-reference the category headings in the checklist against the Phase 1–4 results to confirm every category was covered. Note any categories with no corresponding results.

Compute and display the **Quality Gate Dashboard**:

```
Quality Gate Dashboard — agents-initializer [DATE]
═══════════════════════════════════════════════════
Category                    Checks  Passed  Failed  Status
─────────────────────────────────────────────────────────
Static Artifact Compliance    [N]     [N]     [N]   [PASS/FAIL]
Cross-Distribution Parity     [N]     [N]     [N]   [PASS/FAIL]
Docs Drift                    [N]     [N]     [N]   [PASS/FAIL]
Red-Green Test Coverage         4     [N]     [N]   [PASS/FAIL]
─────────────────────────────────────────────────────────
OVERALL                       [N]     [N]     [N]   [PASS/FAIL]
═══════════════════════════════════════════════════
```

**If all checks pass:**
> ✅ Quality Gate PASSED — All [N] checks passed. All artifacts comply with documented conventions and all test scenarios evaluate as GREEN.

**Stop here. Do NOT write any report file to `.specs/reports/`.**

**If any checks fail:** Proceed to Phase 6.

---

## Phase 6: Findings Report

Generate `.specs/reports/quality-gate-[YYYY-MM-DD]-findings.md`.

Read `.claude/skills/quality-gate/references/quality-gate-criteria.md` Section "## Report Template" for the exact document structure to follow.

For each finding, assign a Finding ID (F001, F002, ...) and document:
1. **Artifact**: file path affected
2. **Rule Violated**: exact rule text from convention source
3. **Rule Source**: document and section where the rule is defined
4. **Current State**: what the artifact currently contains (quote evidence)
5. **Expected State**: what it should contain per documentation
6. **Impact**: what degrades or breaks if not fixed
7. **Proposed Fix**: specific action to resolve

Group related findings into **Improvement Areas**. Each Improvement Area becomes a candidate PRD work item. Name each area clearly (e.g., "Add source attribution to reference files").

Close the report with a **PRD Brief** section pre-formatted as input for `/prp-core:prp-prd`.

After writing the file, report:
> ⚠️ Quality Gate FAILED — [N] finding(s) across [N] category(ies).
> Findings report: `.specs/reports/quality-gate-[date]-findings.md`
> Next step: Run `/prp-core:prp-prd` with this findings file to create a remediation PRD.

---

## Regression Checkpoint

After the gate completes, confirm the following before closing the session:

1. **Drift manifests current** — if any reference file was modified this session, verify its row in
   `plugins/agents-initializer/docs-drift-manifest.md` or `skills/docs-drift-manifest.md` still
   reflects the correct source path and line range.
2. **Parity families intact** — if any shared-copy reference was changed, verify all copies in the
   parity family remain in sync (see `docs/compliance/regression-prevention-workflow.md`
   § Change Type Matrix).
3. **No new convention gaps** — if a new skill, agent, or reference was added, confirm it either
   appears in the next quality gate run scope or is tracked in a pending PRD.

If any item above is unresolved, file a follow-up issue before merging.
