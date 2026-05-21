# Subagents

**Summary**: Specialized assistants running in isolated context windows with custom system prompts and restricted tool sets — the primary mechanism for keeping main agent context clean while enabling complex parallel work across both Claude Code and Cursor platforms.
**Sources**: creating-custom-subagents.md, subagents-guide.md, research-subagent-best-practices.md, analysis-creating-custom-subagents.md, analysis-research-subagent-best-practices.md, research-plan-implement-rpi.md, skill-issue-harness-engineering-for-coding-agents.md
**Last updated**: 2026-05-21

---

Subagents are the workhorse of [[agent-workflows]]. They receive only their system prompt plus basic environment details — **not** parent conversation history. This isolation is a feature: it keeps the main context clean and lets subagents focus on their specific task.

## Cross-Platform Comparison

| Feature          | Claude Code                          | Cursor                                                         |
| ---------------- | ------------------------------------ | -------------------------------------------------------------- |
| Format           | `.md` with YAML frontmatter          | `.md`/`.mdc` with YAML frontmatter                             |
| Required fields  | `name`, `description`                | `name`, `description`                                          |
| Model default    | `inherit` (from parent)              | `inherit` (from parent)                                        |
| Model options    | sonnet, opus, haiku, full ID         | inherit, fast, specific ID                                     |
| Tool restriction | `tools` / `disallowedTools` fields   | `readonly: true` only                                          |
| Nesting          | Cannot spawn other subagents         | Supports nested launches (Cursor 2.5+, restricted per-project) |
| Execution        | Synchronous (in parent turn)         | Foreground (blocking) or Background (async)                    |
| Locations        | session, project, user, plugin       | project, user, compatibility dirs                              |
| Max turns        | `maxTurns` field (15–20 typical)     | Not available                                                  |
| Hooks            | Frontmatter-scoped hooks supported   | Not available                                                  |
| Effort           | `effort` field (low/medium/high/xhigh/max) | Not available                                            |

## Common Tool Profiles

| Agent Role         | Tools                        | Model              | Notes                                            |
| ------------------ | ---------------------------- | ------------------ | ------------------------------------------------ |
| Code reviewer      | Read, Grep, Glob, Bash       | Haiku (fast/cheap) | ~97% of community agents use this read-only core |
| Explorer           | Read, Grep, Glob             | Haiku              | Minimal set for fast codebase search             |
| Code modifier      | Read, Grep, Glob, Edit, Bash | Sonnet             | Standard work requiring writes                   |
| Architect/Reasoner | Read, Grep, Glob, Bash       | Opus               | Complex reasoning and planning                   |
| Security auditor   | Read, Grep, Glob             | Sonnet             | Read-only with stronger model for nuance         |

## Built-in Subagents

Both platforms provide built-in subagents:

- **Explore** — Fast, read-only codebase search (Haiku model in Claude Code)
- **Plan** — Research-focused read-only agent (Claude Code)
- **general-purpose** — Full tool access (Claude Code)
- **statusline-setup**, **claude-code-guide** — Claude Code helper agents for `/statusline` setup and feature questions (source: creating-custom-subagents.md)
- **Bash** — Shell command execution with output isolation (Cursor)
- **Browser** — Web automation and visual testing (Cursor)

The Claude Code built-in subagents documentation no longer lists a `Bash` built-in — its "Other" tab now lists only `statusline-setup` and `claude-code-guide` (source: creating-custom-subagents.md). See [[claude-code-subagents]] for the full Claude Code built-in table and [[cursor-subagents]] for Cursor built-ins.

## System Prompt Structure

Effective subagent prompts follow a five-part structure:

1. **Role** — Who the agent is and its expertise area
2. **Process** — Step-by-step procedure to follow
3. **Checklist** — Specific items to verify or produce
4. **Output Format** — Exact structure of the response (field names, grouping, format)
5. **Success Criteria** — What constitutes a complete, useful result

Keep prompts focused and under 2000 words. Longer prompts are slower to process and harder to maintain.

## Design Principles

1. **Restrict tools to minimum necessary** — Read-only agents get Read+Grep+Glob; prevents accidental modifications
2. **Use Haiku for fast, cheap exploration** — Sonnet for standard work, Opus for complex reasoning
3. **Set `maxTurns`** to prevent runaway agents (15 for exploration, 20 for evaluation) — missing `maxTurns` is a common source of unexpected token consumption
4. **Implement confidence-based filtering** — Report only >80% confidence issues. This threshold significantly reduces noise while preserving actionable findings. The agent prompt must explicitly instruct: "Report only issues where you are at least 80% confident"
5. **Specify exact output structure** — Field names, format, grouping in the system prompt. Without this, output varies between invocations and is hard to parse programmatically
6. **Use normal guidance language** — Replace "CRITICAL: You MUST" with "Use when...". Natural phrasing performs equivalently without wasting tokens on emphasis markers
7. **Restrict spawnable agents** — Use `Agent(worker, researcher)` syntax to limit which agents a parent can spawn

## Effort Levels (Claude Code Only)

| Level    | Behavior                             | Availability                         |
| -------- | ------------------------------------ | ------------------------------------ |
| `low`    | Quick, shallow analysis              | available levels depend on the model |
| `medium` | Standard depth                       | available levels depend on the model |
| `high`   | Thorough analysis                    | available levels depend on the model |
| `xhigh`  | Extended-depth reasoning             | available levels depend on the model |
| `max`    | Deepest reasoning, extended thinking | available levels depend on the model |

Which `effort` levels are accepted depends on the model in use (source: creating-custom-subagents.md).

## Plugin Security (Claude Code)

Agents bundled in [[claude-code-plugins]] have restricted capabilities — the `hooks`, `mcpServers`, and `permissionMode` frontmatter fields are **silently ignored** when the agent is loaded from a plugin context. To use these fields, copy the agent file to `.claude/agents/` or `~/.claude/agents/`.

## Anti-Patterns

Ten common mistakes when building and deploying subagents:

1. **Giving all tools to read-only agents** → Risk of accidental file modifications; restrict to Read+Grep+Glob
2. **Using subagents for simple, single-purpose tasks** → Use [[claude-code-skills]] instead; subagents add context-switching overhead
3. **Generic or vague subagent descriptions** → The description determines when the orchestrator delegates; unclear descriptions mean missed or wrong invocations
4. **Over-delegation by larger models** → Opus may delegate when a simpler direct approach suffices; not every task needs a subagent
5. **Overly long prompts (2000+ words)** → Slower processing, harder maintenance, diminishing returns on quality
6. **Too many subagents (50+)** → Agent confusion during selection, increased maintenance burden; consolidate or use skill-based dispatch
7. **Duplicating slash commands as subagents** → If the task is single-purpose, a skill or command is more appropriate
8. **Missing `maxTurns`** → Runaway agents consuming tokens with no bound; always set a turn limit
9. **Not restricting tool access** → Security risk and unfocused behavior; every agent should have the minimum tools it needs
10. **Not checking into version control** → Team members can't benefit; `.claude/agents/` should be committed

## Subagents as Context Firewalls

The primary value of subagents is **context isolation**, not task delegation. Each subagent starts with a fresh context window containing only its system prompt and task input — no accumulated parent history, no unrelated exploration results, no poisoned trajectory from earlier errors.

This makes subagents the primary mechanism for staying in the [[context-engineering#the-dumb-zone|smart zone]]. When a task would push the main context above ~40%, route it to a subagent instead. The subagent completes in its own fresh window and returns only a summary to the parent (typically 1,000–2,000 tokens vs. tens of thousands of exploration tokens).

Two concrete applications (source: skill-issue-harness-engineering-for-coding-agents.md, research-plan-implement-rpi.md):

1. **Research isolation** — The research phase of [[rpi-workflow]] runs in a dedicated subagent. It can explore broadly, accumulate documentation, and exhaust its window. The parent receives only the synthesized RESEARCH.md artifact.
2. **Compaction enforcement** — When a task segment finishes, a compaction subagent summarizes that segment before the next segment begins. This implements Frequent Intentional Compaction (FIC) without losing the parent's high-level context.

The mistake is treating subagents as role-based workers ("the researcher", "the planner") when their real value is as **context windows you can throw away**. See [[harness-engineering]] for how this integrates with the full harness model.

## Related pages

- [[claude-code-subagents]]
- [[cursor-subagents]]
- [[agent-workflows]]
- [[progressive-disclosure]]
- [[claude-code-plugins]]
- [[harness-engineering]]
- [[rpi-workflow]]
- [[context-engineering]]
