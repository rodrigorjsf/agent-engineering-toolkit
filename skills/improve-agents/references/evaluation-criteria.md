# Evaluation Criteria
Scoring rubric for assessing existing AGENTS.md and CLAUDE.md files before improvement.
Used by IMPROVE skills only.
Source: file-evaluator.md, research-context-engineering-comprehensive.md
---

## Contents

- Hard limits table (file length, instruction count, contradictions)
- Bloat indicators table (directory listings, vague instructions, duplicates)
- Staleness indicators table (stale paths, failing commands, outdated refs)
- Progressive disclosure assessment (root focus, domain separation, pointers)
- Instruction specificity assessment (goldilocks zone, config-enforcement distinction)
- Automation opportunity assessment (migration candidate signals and classification)
- Quality score rubric (6-dimension scoring 1-10)
- Evaluation output template
- Calibrated improvement mode (restrained suggestions for high-quality files)

---

## Hard Limits Table

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| File length | ≤ 200 lines | Anthropic Docs: "Target under 200 lines per CLAUDE.md file" |
| Instruction count | ≤ 150-200 | HumanLayer: "Frontier LLMs can follow ~150-200 instructions" |
| Contradictions | 0 | Anthropic: "Claude may pick one arbitrarily" |

A file violating any hard limit is flagged **OVER LIMIT** regardless of content quality.

---

## Bloat Indicators Table

Check each line of the file against these indicators:

| Indicator | Why It's Bloat | Source |
|-----------|---------------|--------|
| Directory/file structure listings | "Not effective at providing repository overview" | ETH Zurich: Evaluating AGENTS.md |
| Standard language conventions | Agent already knows from training data | Anthropic Best Practices |
| Vague instructions ("write clean code") | Not actionable; wastes attention budget | a-guide-to-agents.md |
| Codebase overview paragraphs | Increases steps without improving navigation | ETH Zurich: Evaluating AGENTS.md |
| Obvious tool usage ("use git for version control") | Agent already knows this | Anthropic: "If Claude already does it, delete it" |
| Duplicated content across files | Wastes tokens on every request | research-context-engineering-comprehensive.md |

*Source: file-evaluator.md lines 30-41*

---

## Staleness Indicators Table

| Indicator | How to Detect |
|-----------|---------------|
| Referenced file paths that don't exist | Check if each `path/to/file` in the content actually exists |
| Documented commands that fail | Run documented build/test commands |
| Package references to uninstalled deps | Check if mentioned packages are in manifest files |
| Outdated framework version references | Compare mentioned versions with actual installed versions |

*Source: file-evaluator.md lines 43-50*

---

## Progressive Disclosure Assessment

| Question | Good | Bad |
|----------|------|-----|
| Does root file stay focused on essentials? | One-sentence desc + tooling + pointers only | Inlines domain rules |
| Are domain topics in separate files? | Testing in TESTING.md, build in BUILD.md | All topics in one file |
| Do subdirectory files exist for distinct scopes? | packages/api/AGENTS.md for API-specific rules | Everything in root |
| Are pointers provided to detailed docs? | "See docs/TESTING.md" | No cross-references |

*Source: file-evaluator.md lines 52-59*

---

## Instruction Specificity Assessment

Every instruction should be in the Goldilocks zone:

| Rating | Example | Problem |
|--------|---------|---------|
| ✅ Specific | "Use 2-space indentation" | None — clear and actionable |
| ✅ Specific | "Run `npm test` before committing" | None — verifiable *(format example only; standard commands should still be excluded per what-not-to-include.md)* |
| ❌ Too vague | "Format code properly" | Cannot be verified or acted on |
| ❌ Too specific | "File `src/auth/handlers.ts` handles JWT" | Over-specified file path, will go stale |

**Config-enforcement distinction** — check before flagging as redundant:

| Type | Example | Verdict |
|------|---------|---------|
| Enforced by config file | "Strict mode is enabled" (`tsconfig.json` has `"strict": true`) | ❌ DELETE — agent reads the config directly |
| Project decision not in config | "Use `unknown` over `any`; validate with `zod`" | ✅ Keep — agent cannot infer rationale |

*Source: research-context-engineering-comprehensive.md lines 131-134*

---

## Automation Opportunity Assessment

Check each instruction block for migration potential to on-demand mechanisms:

| Signal | Classification | Priority |
|--------|---------------|----------|
| Content specific to one package or scope | Subdirectory AGENTS.md candidate (`RULE_CANDIDATE`) | HIGH — pure token savings for root |
| Domain knowledge or workflow block >50 lines | Skill candidate (`SKILL_CANDIDATE`) | MEDIUM — net savings = block − 100 tokens |
| Standard conventions / agent-inferable content | DELETE candidate (`DELETE_CANDIDATE`) | HIGH — pure savings |
| Content duplicated across multiple files | Consolidation candidate (`CONSOLIDATE`) | MEDIUM — saves (N−1) × content size |

Flag each candidate in the Per-File Issues output under `**Automation Opportunity Issues:**`.

*Source: automation-migration-guide.md lines 58-72*

---

## Quality Score Rubric

Score each dimension 1-10 based on observed issues:

| Dimension | 8-10 (Good) | 4-7 (Mixed) | 1-3 (Bad) |
|-----------|-------------|-------------|-----------|
| Conciseness | ≤200 lines, minimal bloat | 200-400 lines, some bloat | >400 lines, heavy bloat |
| Accuracy | 0 stale references | 1-2 stale refs | 3+ stale refs |
| Specificity | All instructions actionable | Mix of specific/vague | Mostly vague |
| Progressive Disclosure | Content at right scope level | Some misplaced content | All inlined in root |
| Consistency | 0 contradictions | 1 contradiction | 2+ contradictions |
| Automation Opportunity | 0 migration candidates missed | 1-3 potential migrations | 4+ missed migrations |

*Source: file-evaluator.md lines 132-141*

---

## Evaluation Output Template

Return findings in exactly this format:

```
## File Evaluation Results

### Files Found
| File | Lines | Status |
|------|-------|--------|
| `./CLAUDE.md` | 342 | ⚠️ Over limit |

### Per-File Issues

#### `./CLAUDE.md` (342 lines — OVER 200 LINE LIMIT)

**Bloat Issues:**
- Lines 45-78: [specific issue with evidence]

**Staleness Issues:**
- Line 23: References `src/auth/handlers.ts` — file does not exist

**Contradiction Issues:**
- Line 12: "[rule A]" conflicts with "[rule B]" at line 89

**Progressive Disclosure Issues:**
- Lines 150-200: Testing conventions should be in separate `docs/TESTING.md`

**Automation Opportunity Issues:**
- Lines 45-60: Scope-specific content (RULE_CANDIDATE — move to subdirectory AGENTS.md)
- Lines 200-210: Domain workflow block >50 lines (SKILL_CANDIDATE — extract to skill)

### Cross-File Issues
- [List cross-file contradictions or duplications, or "None"]

### Quality Score
| Dimension | Score (1-10) | Notes |
|-----------|-------------|-------|
| Conciseness | 3 | 342 lines, 70%+ over limit |
| Accuracy | 6 | 2 stale references |
| Specificity | 5 | Mix of specific and vague |
| Progressive Disclosure | 4 | Most content inlined |
| Consistency | 7 | 1 contradiction |
| Automation Opportunity | 8 | 0 migration candidates missed |
| **Overall** | **4** | Needs significant refactoring |
```

---

## Calibrated Improvement Mode

When the overall quality score is **7/10 or higher** across all dimensions and no hard-limit violations exist:

- Generate **at most one actionable suggestion per identified issue** — not one per paragraph
- Default to **keeping content as-is** for borderline cases (dimension score ≥ 6 with ambiguous evidence)
- Focus exclusively on clear violations from the criteria above — not speculative improvements
- A file scoring 7-9/10 exits the workflow with surgical targeted changes, not a full restructure
- Progressive disclosure extraction candidates meeting the 10+ line / 3+ rule threshold are suggested only when they resolve a documented failing criterion or remove clearly non-root content without rewriting unrelated sections
- Preserve non-issue sections in place; calibrated mode favors issue-local edits over structural churn
- If the file still exceeds the root line target after issue-local fixes, allow one additional low-churn extraction or consolidation step focused on the lowest-value remaining block; do not rewrite preserved sections
- Domain-specific blocks meeting the 10+ line / 3+ rule threshold but under 50 lines should be extracted to a domain-doc (not `SKILL_CANDIDATE`); the 50-line threshold applies only to `SKILL_CANDIDATE` classification
