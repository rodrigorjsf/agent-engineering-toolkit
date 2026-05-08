# Subagent Authoring Guide

Evidence-based guidance for creating effective Claude Code subagent definitions.
Source: subagents/research-subagent-best-practices.md, subagents/creating-custom-subagents.md

---

## Contents

- When to use subagents (vs inline, hooks, skills)
- Subagent file structure and scope
- System prompt structure (effective patterns)
- Model selection heuristics
- Tool restriction strategies
- Anti-patterns (10 documented failures)
- Confidence-based filtering pattern

---

## When to Use Subagents

Subagents are context firewalls. They encapsulate exploration work — glob output, grep noise, evaluator scans — in an isolated window so it never reaches the parent context. Only the condensed, structured result flows back. The orchestrator stays in the smart zone; the subagent absorbs the noise.

*Source: harness-engineering.md*

| Use subagent when | Use inline Claude when | Use hook when |
|------------------|----------------------|--------------|
| Context isolation needed | Simple lookup or generation | Deterministic enforcement |
| Domain-specific expertise | No tool use required | Side effects must always happen |
| Read-only exploration | Quick answer needed | Format/validate on every write |
| Cost optimization (Haiku for cheap tasks) | Context sharing beneficial | |
| Parallel task decomposition | | |

**Subagents cannot spawn other subagents** — prevents infinite nesting.

*Source: subagents/research-subagent-best-practices.md lines 33-55*

---

## Subagent File Structure and Scope

A subagent is a Markdown file with YAML frontmatter stored in an `agents/` directory:

```
.claude/agents/
└── code-reviewer.md    # Project-scoped subagent
~/.claude/agents/
└── architect.md        # User-scoped (all projects)
plugins/<name>/agents/
└── specialized.md      # Plugin-scoped
```

Scope priority: `--agents` CLI flag > `.claude/agents/` > `~/.claude/agents/` > plugin agents.

**File format:**

```yaml
---
name: code-reviewer
description: Reviews code for quality and best practices. Use proactively when code is written or modified.
tools: Read, Glob, Grep
model: sonnet
maxTurns: 20
---

You are a code reviewer specializing in [domain]...
```

*Source: subagents/creating-custom-subagents.md lines 151-210*

---

## System Prompt Structure

Effective subagent system prompts follow this 5-part pattern:

1. **Role Definition** — "You are a [specific role] specializing in [domain]"
2. **Responsibilities** — Clear bullet list of what this agent does
3. **Process Steps** — Numbered: gather context → analyze → act → verify → report
4. **Checklist/Criteria** — Categorized by severity (CRITICAL → HIGH → MEDIUM → LOW)
5. **Output Format** — Exact expected output structure with examples

**Description field** — the only routing signal for automatic delegation:

- Be specific about when to use the agent
- Include trigger phrases ("use proactively when...", "use when editing...")
- Avoid generic descriptions ("helps with code")

*Source: subagents/research-subagent-best-practices.md lines 73-76, 374-430*

---

## Model Selection

| Alias | Maps to | Best for |
|-------|---------|----------|
| `haiku` | Claude Haiku 4.5 | Fast exploration, simple analysis, cheap tasks |
| `sonnet` | Claude Sonnet 4.6 | Standard work, reviews, daily tasks (default) |
| `opus` | Claude Opus 4.6 | Complex reasoning, architecture, deep planning |
| `inherit` | Same as main session | Default behavior |
| `sonnet[1m]` | Sonnet + 1M context | Long sessions with large codebases |
| `opus[1m]` | Opus + 1M context | Long sessions with complex reasoning |

**Rule of thumb**: Opus for architecture decisions, Sonnet for everything else, Haiku for read-only exploration only.

*Source: subagents/research-subagent-best-practices.md lines 318-355*

---

## Tool Restriction Strategies

**Allowlist** (safest — only these tools permitted):

```yaml
tools: Read, Glob, Grep, Bash
```

**Denylist** (all tools except these):

```yaml
disallowedTools: Write, Edit
```

If both defined: denylist applied first, then allowlist resolves against remaining tools.

**Design for least privilege** — grant only tools the task requires:

- Read-only reviewers: `Read, Grep, Glob`
- Explorers: `Read, Grep, Glob, Bash(readonly commands)`
- Full-capability (rare): all tools — justify explicitly

*Source: subagents/creating-custom-subagents.md lines 245-295*

---

## Anti-Patterns

| Anti-Pattern | Consequence | Fix |
|-------------|-------------|-----|
| Aggressive delegation prompts ("CRITICAL: You MUST...") | Overtriggering with Opus 4.6 | Use normal language ("use when...") |
| Too many agents (>10) | Exceed context budget (2% per description) | Monitor via `/context` |
| Subagent for simple grep | Token waste and latency | Use inline tool call |
| No tool restriction | Unintended modifications | Allowlist minimum needed |
| Generic description | Poor automatic delegation | Be specific about task + trigger |
| Subagent spawning subagents | Blocked by runtime | Not supported; use orchestration |
| maxTurns > 30 | Runaway agents | Cap at 20-30 for most tasks |
| Vague system prompt | Inconsistent behavior | Add role, process, output format |

*Source: subagents/research-subagent-best-practices.md lines 791-819*

---

## Confidence-Based Filtering

For review/analysis agents, include this pattern to reduce output noise:

```markdown
## Output Filter

Report findings only when:
- >80% confident it is a real issue
- Issue is in changed code (not surrounding unchanged code)
- Not a stylistic preference unless it violates project conventions

Consolidate similar issues. Prioritize by: CRITICAL (bugs/security) > HIGH > MEDIUM > LOW.
```

This pattern significantly reduces noise and keeps output actionable.

*Source: subagents/research-subagent-best-practices.md lines 463-475*
