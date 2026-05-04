# File Evaluation Instructions
Structured process for evaluating existing AGENTS.md/CLAUDE.md files against evidence-based quality criteria.
Used by IMPROVE skills for current state analysis.
Source: agents/file-evaluator.md
---

Follow these file evaluation instructions. Analyze existing AGENTS.md or CLAUDE.md files in the project at the current working directory and assess their quality against evidence-based criteria. Identify specific problems with evidence so an improvement skill can act on them.

Use your environment's file reading and search capabilities to examine the project.

## Contents

- Constraints (analyze only, no modifications, cite line numbers)
- Quality criteria: hard limits, bloat indicators, staleness indicators, progressive disclosure, automation opportunity indicators
- Process (find config files, per-file analysis, cross-file analysis)
- Output format (structured template for evaluation results)
- Self-verification (quality checks before returning)

---

## Constraints

- Do not modify any files — only analyze and report
- Do not suggest improvements — only identify problems with evidence
- Be specific: cite exact line numbers and content for each issue found
- Score objectively against the criteria below

## Quality Criteria (from Research)

### Hard Limits

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| File length | ≤ 200 lines | Anthropic Docs: "Target under 200 lines per CLAUDE.md file" |
| Instruction count | ≤ 150-200 | HumanLayer: "Frontier LLMs can follow ~150-200 instructions" |
| No contradictions | 0 conflicts | Anthropic: "Claude may pick one arbitrarily" |

### Bloat Indicators

Each of these wastes tokens without improving agent performance:

| Indicator | Why It's Bloat | Source |
|-----------|---------------|--------|
| Directory/file structure listings | "Not effective at providing repository overview" | Evaluating AGENTS.md (ETH Zurich) |
| Standard language conventions | Agent already knows these from training | Anthropic Best Practices |
| Vague instructions ("write clean code") | Not actionable, wastes attention budget | a-guide-to-agents.md |
| Codebase overview paragraphs | Increases steps without improving navigation | Evaluating AGENTS.md |
| Obvious tool usage ("use git for version control") | Agent already knows this | Anthropic: "If Claude already does it correctly, delete it" |
| Duplicated information across files | Wastes tokens on every request | Context engineering research |
| **Architectural path trap** | Lists of paths WITH behavioral constraints (e.g., `services/ must not import from routes/`) are **not** directory listings — flag only pure path listings with no rules attached | Evaluating AGENTS.md |

### Staleness Indicators

| Indicator | How to Detect |
|-----------|---------------|
| Referenced file paths that don't exist | Check if each `path/to/file` in the content actually exists |
| Referenced docs or import-style pointers that don't resolve | Check every `@import`, `See ...md`, and similar pointer target |
| Documented commands that fail | Try running documented build/test commands |
| Package references to uninstalled deps | Check if mentioned packages are in manifest files |
| Outdated framework version references | Compare mentioned versions with actual versions |

### Progressive Disclosure Assessment

| Question | Good | Bad |
|----------|------|-----|
| Does root file stay focused on essentials? | One-sentence desc + tooling + pointers | Inlines everything |
| Are domain topics in separate files? | Testing in TESTING.md, build in BUILD.md | All in one file |
| Do subdirectory files exist for distinct scopes? | packages/api/CLAUDE.md for API-specific rules | Everything in root |
| Are pointers provided to detailed docs? | "See docs/TESTING.md" | No cross-references |

*Source: agents/file-evaluator.md lines 20-59*

### Automation Opportunity Indicators

Flag instructions that are candidates for migration to on-demand mechanisms:

| Indicator | Migration Type | Flag As |
|-----------|---------------|---------|
| Instructions specific to one package or scope | Subdirectory AGENTS.md | `RULE_CANDIDATE` |
| Domain knowledge or workflow blocks >50 lines | Skill | `SKILL_CANDIDATE` |
| Content agents can infer from code | Deletion | `DELETE_CANDIDATE` |
| Instructions duplicated across multiple files | Consolidation | `CONSOLIDATE` |
| Version numbers, team names, high-churn content | Deletion | `DELETE_CANDIDATE` |
| Standard default commands (e.g., `npm test`, `cargo build`, `go test ./...`) | Agent knows platform defaults from training | `DELETE_CANDIDATE` |

*Source: automation-migration-guide.md lines 58-72*

---

## Process

### 1. Find All Configuration Files

Search for:

- `AGENTS.md` files at any depth
- `CLAUDE.md` files at any depth
- Subdirectory configuration files (scope-specific AGENTS.md for monorepos)

### 2. Per-File Analysis

For each file found:

1. Count metrics: lines, sections (markdown headers), bullet points, code blocks
2. Scan for bloat indicators: check each line against the bloat indicators table
3. Check for staleness: verify referenced paths exist, `@import` / pointer targets resolve, and commands work
4. Identify contradictions within each file and between files: look for conflicting rules at different line numbers in the same file, and compare instructions across separate files for cross-file conflicts
5. Assess progressive disclosure: is content at the right scope level?
6. Check instruction specificity: are instructions specific and verifiable?
7. Scan for automation opportunities: check each instruction against the automation opportunity indicators table above

### 3. Cross-File Analysis

- Are there contradictions between root and subdirectory files?
- Is information duplicated across multiple files?
- Are there scopes with distinct tooling that lack their own file?
- Is the root file overloaded with scope-specific information?

*Source: agents/file-evaluator.md lines 75-102*

---

## Output Format

Return your analysis in exactly this format:

```
## File Evaluation Results

### Files Found
| File | Lines | Sections | Status |
|------|-------|----------|--------|
| `./CLAUDE.md` | 342 | 15 | ⚠️ Over limit |
| `./packages/api/CLAUDE.md` | 28 | 3 | ✅ Good |

### Per-File Issues

#### `./CLAUDE.md` (342 lines — OVER 200 LINE LIMIT)

**Bloat Issues:**
- Lines 45-78: Directory structure listing (research shows these don't help agents)
- Lines 102-115: Standard TypeScript conventions (agent already knows these)
- Line 134: "Write clean, maintainable code" (too vague to be actionable)

**Staleness Issues:**
- Line 23: References `src/auth/handlers.ts` — file does not exist
- Line 89: Documents `npm run build:legacy` — command not in package.json

**Contradiction Issues:**
- Line 12: "Use 4-space indentation" conflicts with `.prettierrc` setting of 2 spaces

**Progressive Disclosure Issues:**
- Lines 150-200: Testing conventions should be in separate `docs/TESTING.md`
- Lines 201-250: API design patterns should be in `packages/api/CLAUDE.md`

**Specificity Issues:**
- Line 67: "Follow best practices for error handling" — not actionable

**Automation Opportunity Issues:**
- Lines 45-60: Formatting enforcement (HOOK_CANDIDATE — deterministic behavior)
- Lines 102-130: Testing domain block, 28 lines (SKILL_CANDIDATE — domain knowledge)
- Lines 200-210: Glob-based rule "*.test.ts" (RULE_CANDIDATE — path-specific)

### Cross-File Issues
- [List any cross-file contradictions or duplications]

### Missing Scopes
- `packages/web/` — Has distinct React tech stack, no config file
- `scripts/` — Has custom tooling, no config file

### Quality Score
| Dimension | Score (1-10) | Notes |
|-----------|-------------|-------|
| Conciseness | 3 | 342 lines, 70%+ over limit |
| Accuracy | 6 | 2 stale references found |
| Specificity | 5 | Mix of specific and vague instructions |
| Progressive Disclosure | 4 | Most content inlined in root |
| Consistency | 7 | 1 contradiction found |
| **Overall** | **4** | Needs significant refactoring |
```

*Source: agents/file-evaluator.md lines 103-162*

---

## Self-Verification

Before returning results, verify:

1. Every reported issue includes a specific line number or line range
2. Bloat classifications match the criteria table — no false positives
3. Staleness claims are verified (paths checked, commands checked)
4. The quality score reflects the actual severity of issues found
5. No improvement suggestions crept in — report only identifies problems
6. Automation opportunity flags match the indicators table — no false classifications

*Source: agents/file-evaluator.md lines 143-152*
