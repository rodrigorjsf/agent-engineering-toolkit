# Agent Workflows

**Summary**: Proven patterns for structuring LLM agent work — from the fundamental Explore → Plan → Code → Verify loop to multi-agent architectures and progressive context strategies that prevent one-shotting complex projects.
**Sources**: research-agent-workflows-and-patterns.md, a-guide-to-agents.md, analysis-a-guide-to-agents.md, dynamic-workflows.md, goals.md, parallel-sessions-worktrees.md
**Last updated**: 2026-06-04

---

## The Fundamental Loop

Claude performs dramatically better when it can verify its own work:

```
Explore → Plan → Code → Verify → (loop if needed)
```

Discrete loops prevent one-shotting complex projects. Planning separated from execution improves outcomes.

## Five Core Patterns

### 1. Spec → Plan → Execute

Separate planning from execution entirely. Planning agent researches and produces a structured plan; execution agent follows it. Prevents "getting over your skis" on complex projects.

### 2. Two-Agent Architecture (Long-Running Tasks)

- **Initializer** (first session): Creates structured artifacts (JSON feature list, progress file, architecture docs)
- **Coding Agent** (incremental sessions): Picks up work from artifacts, makes progress, updates state
- State tracking via JSON (model less likely to inappropriately modify vs. Markdown) and git history

### 3. Subagent Delegation

Route complex research to [[subagents]] to keep the main context focused:

- Subagents return only summaries (1,000–2,000 tokens) vs. exploration tokens (tens of thousands)
- Main agent stays within its token budget and focused on the current task

### 4. Progressive Context Loading

Implement [[progressive-disclosure]] for instructions:

- Path-scoped rules trigger only when matching files are read
- Skills load full instructions only when invoked
- Subagent summaries replace full exploration traces

### 5. Orchestrator Pattern

Team lead coordinates multiple agents working in parallel:

- Shared task list with claim/complete workflow
- Task dependencies prevent premature work
- Direct communication between teammates
- Available in Claude Code via Agent Teams (experimental)

Claude Code now also provides a *codified* orchestrator primitive — dynamic workflows — where the plan lives in a rerunnable script rather than in Claude's turn-by-turn decisions (source: dynamic-workflows.md). See [[claude-code-workflows]]. Worktrees are the file-isolation substrate underneath these parallel/orchestrator patterns (source: parallel-sessions-worktrees.md); see [[claude-code-worktrees]].

## Session-Continuing Autonomous Approaches

Several Claude Code mechanisms keep a session working autonomously; they differ by *what starts the next turn* (source: goals.md):

- **`/goal`** — the next turn starts when the previous one finishes, and the run stops when a fresh small model confirms the condition is met (source: goals.md)
- **`/loop`** — the next turn starts on a time interval (source: goals.md)
- **Stop hook** — fires after every turn (source: goals.md)
- **auto mode** — does *not* start a new turn; it only auto-approves tool calls within one (source: goals.md)

`/goal` and auto mode are complementary: auto mode removes per-tool prompts while `/goal` removes per-turn prompts (source: goals.md).

## Context Management During Workflows

| Strategy                        | Complexity | Effectiveness                      |
| ------------------------------- | ---------- | ---------------------------------- |
| Auto-compaction (summarization) | Low        | Matches sophisticated alternatives |
| JSON state files                | Low        | Reliable for structured data       |
| Git-based state tracking        | Medium     | Natural for code-producing agents  |
| External memory (CLAUDE.md)     | Medium     | Persistent across sessions         |
| Subagent architecture           | High       | Best for parallel/complex work     |

Boris Cherny's principle applies: prefer simple, straightforward solutions over complex memory architectures. Auto-compaction via summarization (asking Claude to summarize its context) works as well as more sophisticated approaches.

## Anti-Patterns

- **One-shotting complex projects** — Fails predictably; use discrete loops
- **Accumulating failed approaches** — After 2 failed corrections, clear context and restart
- **Overly generic instructions** — Specific credentialed personas outperform generic "helpful assistant" labels
- **Aggressive delegation language** — Replace "CRITICAL: You MUST" with normal guidance "Use when..."

## Related pages

- [[subagents]]
- [[progressive-disclosure]]
- [[context-engineering]]
- [[claude-code-subagents]]
- [[cursor-subagents]]
- [[claude-code-workflows]]
- [[claude-code-agent-teams]]
- [[claude-code-worktrees]]
