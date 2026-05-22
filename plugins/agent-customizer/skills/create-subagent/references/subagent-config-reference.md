# Subagent Config Reference

Complete YAML frontmatter specification, model IDs, and orchestration patterns for subagents.

---

## Contents

- Frontmatter fields (complete specification)
- Model IDs and capabilities
- Tool restriction patterns
- Orchestration patterns (parallel, sequential, agent teams)
- Constraints (what subagents cannot do)
- Plugin subagent restrictions

---

## Frontmatter Fields

Only `name` and `description` are required. All others have sensible defaults.

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | — | Lowercase letters and hyphens; unique identifier |
| `description` | Yes | — | When Claude should delegate to this agent |
| `tools` | No | Inherit all | Allowlist: only these tools permitted |
| `disallowedTools` | No | None | Denylist: these tools removed from pool |
| `model` | No | `inherit` | `sonnet`, `opus`, `haiku`, full model ID, or `inherit`. Project convention: explicitly set to document intent. |
| `permissionMode` | No | `default` | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | Unlimited | Max agentic turns before agent stops |
| `skills` | No | None | Skills preloaded (full content injected, not just descriptions) |
| `mcpServers` | No | None | MCP servers scoped to this subagent |
| `hooks` | No | None | Lifecycle hooks scoped to this subagent |
| `memory` | No | None | Persistent memory: `user`, `project`, or `local` |
| `background` | No | `false` | `true` = always run as background task |
| `effort` | No | Inherit | `low`, `medium`, `high`, `max` (Opus 4.6 only) |
| `isolation` | No | None | `worktree` = isolated git worktree; auto-cleanup if no changes |


---

## Model IDs and Capabilities

| Alias | Maps to | Best for | Context |
|-------|---------|----------|---------|
| `haiku` | Claude Haiku 4.5 | Fast exploration, simple analysis | Standard |
| `sonnet` | Claude Sonnet 4.6 | Balanced capability/cost; daily work | Standard |
| `opus` | Claude Opus 4.6 | Complex reasoning, architecture | Standard |
| `inherit` | Same as session | Default behavior | — |
| `sonnet[1m]` | Sonnet + 1M context | Long sessions with large codebases | 1M tokens |
| `opus[1m]` | Opus + 1M context | Long sessions with complex reasoning | 1M tokens |

Full model IDs (e.g., `claude-opus-4-6`, `claude-sonnet-4-6`) also accepted.


---

## Tool Restriction Patterns

**Allowlist** — only these tools:

```yaml
tools: Read, Glob, Grep, Bash
```

**Denylist** — all tools except:

```yaml
disallowedTools: Write, Edit
```

**Combined** — denylist applied first, then allowlist resolves against remaining:

```yaml
disallowedTools: Write, Edit
tools: Read, Grep, Glob
```

**Restrict spawnable subagent types** (for orchestrators running with `claude --agent`):

```yaml
tools: Agent(worker, researcher), Read, Bash
```

Standard patterns from community (read-only reviewers dominate):

- Reviewer: `tools: Read, Grep, Glob`
- Explorer: `tools: Read, Grep, Glob, Bash`
- Full-access (rare): omit `tools` and `disallowedTools`


---

## Orchestration Patterns

**Hub-and-spoke** (standard subagents): Main agent delegates tasks to specialized subagents; subagents report results only to main agent. No inter-agent communication.

**Agent teams** (experimental, v2.1.32+): Peer-to-peer communication between teammates via shared task list and mailbox. Use when workers need to debate, challenge, and coordinate (not just report results).

| Pattern | When to use | Complexity |
|---------|-------------|-----------|
| Hub-and-spoke | Independent parallel tasks | Low |
| Sequential pipeline | Task B depends on Task A's output | Low |
| Agent teams | Workers need to communicate | High |

**Sequential pipeline example:**

```
Main → (delegate) → Researcher agent → (report) → Main → (delegate) → Writer agent
```

**Parallel decomposition:**
Spawn multiple independent subagents simultaneously. Main aggregates results.


---

## Constraints

These limitations are enforced by the runtime:

- **Subagents cannot spawn other subagents** — prevents infinite nesting
- **Subagents do not inherit parent conversation history** — receive only system prompt + environment details
- **Subagents do not inherit parent skills** — must be explicitly listed in `skills` field (full content injected)
- **`maxTurns` applies per invocation** — project convention: 15 for analysis agents, 20 for evaluator agents; values outside 15–20 require explicit justification


---

## Plugin Subagent Restrictions

Plugin subagents (from installed plugins) have additional restrictions for security:

- `hooks` field is **ignored**
- `mcpServers` field is **ignored**
- `permissionMode` field is **ignored**

To use these fields with a plugin agent: copy the agent file to `.claude/agents/` or `~/.claude/agents/`.

