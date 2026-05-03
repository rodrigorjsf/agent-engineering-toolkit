# Subagent Evaluation Criteria

Scoring rubric for assessing existing Claude Code subagent definitions before improvement.
Source: subagents/research-subagent-best-practices.md, subagents/creating-custom-subagents.md

---

## Contents

- Hard limits table (frontmatter validity, required fields)
- Bloat indicators table (excessive turns, broad tools, vague prompts)
- Staleness indicators table (deprecated model IDs, removed tools)
- Quality assessment (task specificity, tool restriction, context isolation)
- Quality score rubric (5-dimension scoring 1-10)
- Evaluation output template

---

## Hard Limits Table

| Criterion | Threshold | Source |
|-----------|-----------|--------|
| `name` field | Present; lowercase letters and hyphens only | subagents/creating-custom-subagents.md lines 217-220 |
| `description` field | Present, non-empty, specific | subagents/creating-custom-subagents.md lines 217-220 |
| `model` field | Recognized alias or full model ID | subagents/creating-custom-subagents.md lines 234-241 |
| `maxTurns` | 15–20 for most tasks; values outside 15–20 require justification | Project convention — `.claude/rules/agent-files.md` |
| System prompt (markdown body) | Present and task-specific | subagents/creating-custom-subagents.md lines 199-212 |

A subagent violating any hard limit is flagged **INVALID** regardless of other quality.

*Source: subagents/creating-custom-subagents.md lines 213-232*

---

## Deletion Test

For every instruction, line, and reference, ask: **"Would removing this cause the agent to make mistakes?"** If the answer is no, flag it for removal. ETH Zurich (Feb 2026) measured that LLM-generated agent files reduce success rate by ~3% and increase cost by ~20% — the failure mode is content that looks helpful but adds no decision value. The deletion test is the rubric for separating signal from bloat.

*Source: docs/general-llm/Evaluating-AGENTS-paper.pdf*

---

## Bloat Indicators Table

| Indicator | Why It's Bloat |
|-----------|---------------|
| `maxTurns` > 20 without justification | Runaway agents; most tasks need 15–20 turns |
| Tools: all tools (no restriction on a review agent) | Unintended modifications; context waste |
| Generic system prompt ("you are a helpful AI") | No specialization; defeats purpose of subagent |
| `skills` field preloading many skills | Full skill content injected at startup; inflates context |
| Duplicate subagent with same purpose as built-in | Explore/Plan built-ins cover exploration; don't recreate |
| Aggressive delegation language ("CRITICAL: MUST use") | Overtriggering; normal language preferred |

*Source: subagents/research-subagent-best-practices.md lines 152-180*

---

## Staleness Indicators Table

| Indicator | How to Detect |
|-----------|---------------|
| Deprecated model IDs (e.g., `claude-3-sonnet`) | Compare against current aliases: `haiku`, `sonnet`, `opus` |
| References to removed tools in `tools` field | Verify tool names against current Claude Code tools |
| `allowedTools` field (old format) | Current field name is `tools` (allowlist) |
| Tasks spawning other subagents | Runtime blocks this; remove nested spawn instructions |

*Source: subagents/creating-custom-subagents.md lines 213-232*

---

## Quality Assessment

| Question | Good | Bad |
|----------|------|-----|
| Task-specific system prompt? | Role + process + output format defined | Generic "helpful AI" prompt |
| Model appropriate for task complexity? | Haiku for exploration, Sonnet for reviews, Opus for architecture | Opus for simple grep tasks |
| Tool access restricted to minimum needed? | Read-only tools for reviewers | All tools on a read-only reviewer |
| Description specific enough for routing? | Triggers specified; "use proactively when..." | Generic description; poor delegation |
| Context isolation justified? | Subagent prevents context pollution | Subagent used when inline works |

*Source: subagents/research-subagent-best-practices.md lines 33-55*

---

## Quality Score Rubric

| Dimension | 8-10 (Good) | 4-7 (Mixed) | 1-3 (Bad) |
|-----------|-------------|-------------|-----------|
| Task Specificity | Role+process+checklist+output defined | Partial structure | Generic or missing prompt |
| Model Selection | Appropriate model for task type | Default (may be ok) | Opus for trivial tasks |
| Tool Restriction | Minimal allowlist; read-only where appropriate | Some restriction | No restriction at all |
| Routing Quality | Specific description with triggers | Vague description | Missing or generic |
| Context Isolation | Subagent use justified; prevents pollution | Questionable necessity | Duplicates inline capability |
| **Overall** | | | |

*Source: subagents/research-subagent-best-practices.md lines 92-146*

---

## Evaluation Output Template

```
## Subagent Evaluation Results

### Agents Found
| Name | Model | Tools | maxTurns | Status |
|------|-------|-------|----------|--------|
| `code-reviewer` | inherit | all | unlimited | ⚠️ No tool restriction |

### Issues

**Bloat Issues:**
- Tools: all — read-only reviewer should use `tools: Read, Grep, Glob`
- maxTurns: unlimited — cap at 20 for review tasks

**Staleness Issues:**
- model: `claude-3-sonnet` — use alias `sonnet` instead

**Quality Issues:**
- description: "Reviews code" — missing trigger; add "Use proactively when code is written"

### Quality Score
| Dimension | Score (1-10) | Notes |
|-----------|-------------|-------|
| Task Specificity | 6 | Has role, missing process and output format |
| Model Selection | 5 | Stale ID; likely equivalent to sonnet |
| Tool Restriction | 2 | All tools on read-only reviewer |
| Routing Quality | 4 | Description too vague for delegation |
| Context Isolation | 7 | Subagent use justified |
| **Overall** | **5** | Fix tools, description, maxTurns |
```
